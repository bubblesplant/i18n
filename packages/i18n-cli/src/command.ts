import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import type { I18nProjectConfig } from "./config.ts";
import { scanFiles, type ScanFilesResult } from "./files.ts";
import { loadConfig } from "./load-config.ts";
import { createSyncReport, type SyncFileReport, writeSyncReport } from "./report.ts";
import { syncProject } from "./sync.ts";

export type CliCommand = "check" | "sync";

export interface CliEnvironment {
  cwd?: string;
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
}

interface ParsedArguments {
  command: CliCommand;
  configPath?: string;
  projects: string[];
  clean: boolean;
  allowEmpty: boolean;
  dryRun: boolean;
  failOnStale: boolean;
}

interface ProjectExecution {
  name: string;
  scan: ScanFilesResult;
  catalogs: Record<string, string>;
}

interface ProjectCatalogs {
  name: string;
  catalogs: Record<string, string>;
}

interface SummaryTotals {
  added: number;
  unused: number;
  deleted: number;
  unchanged: number;
}

export class CliUsageError extends Error {
  override name = "CliUsageError";
}

const helpText = `用法：
  bubbles-i18n sync [options]
  bubbles-i18n check [options]

命令：
  sync   把源码中缺失的静态 tr() key 添加到配置的语言包。
  check  只检查、不修改语言包；存在缺失 key 时返回失败。

选项：
  --config <path>       使用指定配置文件，不再自动查找 i18n.config.ts。
  --project <name>      只处理指定项目；可以多次传入。
  --dry-run             预览同步结果，不修改语言包。
  --clean               删除源码中已不存在的 key。
  --allow-empty         配合 --clean，允许空扫描结果清空语言包。
  --fail-on-stale       check 时发现废弃 key 也返回失败。
  -h, --help            显示帮助信息。

安全保护：
  项目的 include 未匹配到可读取文本源文件时，--clean 始终拒绝执行。
  已有翻译保持不变；新增项默认使用 key 作为翻译值。`;

/** 解析命令并执行词条扫描、语言包校验与可选同步，输出报告和摘要，返回命令退出码。 */
export async function runCli(
  arguments_: readonly string[],
  environment: CliEnvironment = {},
): Promise<number> {
  const writeOutput = environment.stdout ?? defaultStdout;

  if (arguments_.length === 0) {
    writeOutput(helpText);
    return 1;
  }

  if (arguments_.includes("--help") || arguments_.includes("-h")) {
    writeOutput(helpText);
    return 0;
  }

  const options = parseArguments(arguments_);
  const cwd = resolve(environment.cwd ?? process.cwd());
  const loaded = await loadConfig({ cwd, configPath: options.configPath });
  const allProjectCatalogs = Object.entries(loaded.config.projects).map(
    ([name, project]): ProjectCatalogs => ({
      name,
      catalogs: resolveCatalogs(loaded.rootDir, project.catalogs),
    }),
  );
  const reportPath = loaded.config.report
    ? resolveFromRoot(loaded.rootDir, loaded.config.report)
    : undefined;

  validateOutputPaths(allProjectCatalogs, reportPath, loaded.configPath);
  if (reportPath) {
    await assertSafeReportTarget(reportPath);
  }

  const projectEntries = selectProjects(loaded.config.projects, options.projects);
  const executions = await Promise.all(
    projectEntries.map(
      /** 扫描词条并拦截无源文件的清理。 */ async ([name, project]): Promise<ProjectExecution> => {
        const scan = await scanFiles({
          rootDir: loaded.rootDir,
          include: project.include,
          exclude: project.exclude,
          callNames: loaded.config.callNames,
        });

        if (options.clean && scan.files.length === scan.skippedBinaryFiles.length) {
          throw new CliUsageError(
            `Refusing --clean for project "${name}" because its include patterns matched no readable source files.`,
          );
        }

        return {
          name,
          scan,
          catalogs: resolveCatalogs(loaded.rootDir, project.catalogs),
        };
      },
    ),
  );

  if (reportPath) {
    assertReportIsNotSourceFile(executions, reportPath);
  }

  // Validate every selected catalog before any project is allowed to write.
  const previews = await Promise.all(
    executions.map((execution) =>
      syncProject({
        project: execution.name,
        catalogs: execution.catalogs,
        keys: execution.scan.keys,
        clean: options.clean,
        allowEmpty: options.allowEmpty,
        dryRun: true,
      }),
    ),
  );

  let fileReports = previews.flat();
  if (options.command === "sync" && !options.dryRun) {
    fileReports = [];
    for (const execution of executions) {
      fileReports.push(
        ...(await syncProject({
          project: execution.name,
          catalogs: execution.catalogs,
          keys: execution.scan.keys,
          clean: options.clean,
          allowEmpty: options.allowEmpty,
        })),
      );
    }
  }

  const portableReports = fileReports.map((file) => ({
    ...file,
    path: toPortablePath(loaded.rootDir, file.path),
  }));
  const report = createSyncReport({
    command: options.command,
    clean: options.clean,
    dryRun: options.command === "check" || options.dryRun,
    files: portableReports,
  });

  if (reportPath) {
    await writeSyncReport(report, reportPath);
  }

  printSummary({
    command: options.command,
    dryRun: options.dryRun,
    configPath: toPortablePath(cwd, loaded.configPath),
    reportPath: reportPath ? toPortablePath(loaded.rootDir, reportPath) : undefined,
    executions,
    files: portableReports,
    writeOutput,
  });

  if (options.command === "check") {
    const totals = summarize(portableReports);
    const failedForMissing = totals.added > 0;
    const failedForStale = options.failOnStale && totals.unused > 0;

    if (failedForMissing || failedForStale) {
      writeOutput(
        `Check failed: ${totals.added} missing catalog entries, ${totals.unused} unused entries.`,
      );
      return 1;
    }

    writeOutput("Check passed.");
  }

  return 0;
}

/** 运行命令入口，统一输出异常与用法提示；执行异常时返回退出码 2。 */
export async function main(
  arguments_: readonly string[] = process.argv.slice(2),
  environment: CliEnvironment = {},
): Promise<number> {
  const writeError = environment.stderr ?? defaultStderr;

  try {
    return await runCli(arguments_, environment);
  } catch (error) {
    writeError(`Error: ${errorMessage(error)}`);
    if (error instanceof CliUsageError) {
      writeError('Run "bubbles-i18n --help" for usage.');
    }
    return 2;
  }
}

/** 解析同步或检查命令的选项，校验必填值、未知选项和互斥组合。 */
function parseArguments(arguments_: readonly string[]): ParsedArguments {
  const command = arguments_[0];
  if (command !== "sync" && command !== "check") {
    throw new CliUsageError(`Unknown command "${command ?? ""}".`);
  }

  let configPath: string | undefined;
  const projects = new Set<string>();
  let clean = false;
  let allowEmpty = false;
  let dryRun = false;
  let failOnStale = false;

  for (let index = 1; index < arguments_.length; index += 1) {
    const argument = arguments_[index] ?? "";

    if (argument === "--config") {
      const [value, nextIndex] = readOptionValue(arguments_, index, "--config");
      configPath = value;
      index = nextIndex;
    } else if (argument.startsWith("--config=")) {
      configPath = readInlineOptionValue(argument, "--config");
    } else if (argument === "--project") {
      const [value, nextIndex] = readOptionValue(arguments_, index, "--project");
      projects.add(value);
      index = nextIndex;
    } else if (argument.startsWith("--project=")) {
      projects.add(readInlineOptionValue(argument, "--project"));
    } else if (argument === "--clean") {
      clean = true;
    } else if (argument === "--allow-empty") {
      allowEmpty = true;
    } else if (argument === "--dry-run") {
      dryRun = true;
    } else if (argument === "--fail-on-stale") {
      failOnStale = true;
    } else {
      throw new CliUsageError(`Unknown option "${argument}".`);
    }
  }

  if (command === "check" && clean) {
    throw new CliUsageError("--clean is only available with the sync command.");
  }
  if (command === "check" && dryRun) {
    throw new CliUsageError("check is already read-only; --dry-run is only available with sync.");
  }
  if (command === "sync" && failOnStale) {
    throw new CliUsageError("--fail-on-stale is only available with the check command.");
  }
  if (allowEmpty && !clean) {
    throw new CliUsageError("--allow-empty requires --clean.");
  }

  return {
    command,
    configPath,
    projects: [...projects],
    clean,
    allowEmpty,
    dryRun,
    failOnStale,
  };
}

/** 读取独立命令选项后的值，并返回已消费位置；缺失值时抛出用法错误。 */
function readOptionValue(
  arguments_: readonly string[],
  index: number,
  option: string,
): [value: string, nextIndex: number] {
  const value = arguments_[index + 1];
  if (!value || value.startsWith("--")) {
    throw new CliUsageError(`${option} requires a value.`);
  }

  return [value, index + 1];
}

/** 读取等号形式的命令选项值，空值时抛出用法错误。 */
function readInlineOptionValue(argument: string, option: string): string {
  const value = argument.slice(option.length + 1);
  if (value.length === 0) {
    throw new CliUsageError(`${option} requires a value.`);
  }

  return value;
}

/** 按名称选择待处理项目；未指定时返回全部项目，未知项目名抛出用法错误。 */
function selectProjects(
  projects: Readonly<Record<string, I18nProjectConfig>>,
  selectedNames: readonly string[],
): Array<[name: string, project: I18nProjectConfig]> {
  if (selectedNames.length === 0) {
    return Object.entries(projects);
  }

  return selectedNames.map(
    /** 校验项目存在及配置有效后返回名称和配置。 */ (name) => {
      if (!Object.prototype.hasOwnProperty.call(projects, name)) {
        throw new CliUsageError(
          `Unknown project "${name}". Available projects: ${Object.keys(projects).join(", ")}.`,
        );
      }

      const project = projects[name];
      if (!project) {
        throw new CliUsageError(`Project "${name}" has an invalid configuration.`);
      }

      return [name, project];
    },
  );
}

/** 将每种语言的语言包路径统一解析为相对配置根目录的绝对路径。 */
function resolveCatalogs(
  rootDir: string,
  catalogs: Readonly<Record<string, string>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(catalogs).map(([locale, path]) => [locale, resolveFromRoot(rootDir, path)]),
  );
}

/** 保留绝对路径，或基于配置根目录解析相对路径。 */
function resolveFromRoot(rootDir: string, path: string): string {
  return isAbsolute(path) ? resolve(path) : resolve(rootDir, path);
}

/** 检查语言包路径是否重复，并防止报告路径覆盖语言包或配置文件。 */
function validateOutputPaths(
  projects: readonly ProjectCatalogs[],
  reportPath: string | undefined,
  configPath: string,
): void {
  const owners = new Map<string, string>();

  for (const project of projects) {
    for (const [locale, path] of Object.entries(project.catalogs)) {
      const normalizedPath = normalizeComparablePath(path);
      const owner = `${project.name}/${locale}`;
      const existingOwner = owners.get(normalizedPath);
      if (existingOwner) {
        throw new CliUsageError(
          `Catalog path "${path}" is configured by both ${existingOwner} and ${owner}.`,
        );
      }
      owners.set(normalizedPath, owner);
    }
  }

  if (reportPath && owners.has(normalizeComparablePath(reportPath))) {
    throw new CliUsageError(`Report path must not overwrite a catalog: "${reportPath}".`);
  }

  if (reportPath && normalizeComparablePath(reportPath) === normalizeComparablePath(configPath)) {
    throw new CliUsageError(`Report path must not overwrite the config file: "${reportPath}".`);
  }
}

/** 允许创建报告或覆盖已有同步报告，拒绝覆盖其他已存在的文件。 */
async function assertSafeReportTarget(reportPath: string): Promise<void> {
  let source: string;

  try {
    source = await readFile(reportPath, "utf8");
  } catch (error) {
    if (isMissingPathError(error)) {
      return;
    }
    throw error;
  }

  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new CliUsageError(`Refusing to overwrite existing non-report file at "${reportPath}".`);
  }

  if (!isSyncReportLike(value)) {
    throw new CliUsageError(`Refusing to overwrite existing non-report file at "${reportPath}".`);
  }
}

/** 确认报告目标不在已扫描源码中，避免报告写入覆盖业务源码。 */
function assertReportIsNotSourceFile(
  executions: readonly ProjectExecution[],
  reportPath: string,
): void {
  const normalizedReportPath = normalizeComparablePath(reportPath);

  for (const execution of executions) {
    if (
      execution.scan.files.some(
        (sourcePath) => normalizeComparablePath(sourcePath) === normalizedReportPath,
      )
    ) {
      throw new CliUsageError(
        `Report path must not overwrite a scanned source file: "${reportPath}".`,
      );
    }
  }
}

/** 规范化比较用的绝对路径，在 Windows 上忽略路径大小写。 */
function normalizeComparablePath(path: string): string {
  const normalized = resolve(path);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

/** 生成展示用的相对路径，统一使用正斜杠，根目录自身显示为句点。 */
function toPortablePath(rootDir: string, path: string): string {
  const relativePath = relative(rootDir, path);
  const displayPath = relativePath === "" ? "." : relativePath;
  return displayPath.split(sep).join("/");
}

/** 汇总所有语言包的新增、未使用、删除和保持不变的词条数量。 */
function summarize(files: readonly SyncFileReport[]): SummaryTotals {
  return files.reduce<SummaryTotals>(
    (totals, file) => ({
      added: totals.added + file.added.length,
      unused: totals.unused + file.unused.length,
      deleted: totals.deleted + file.deleted.length,
      unchanged: totals.unchanged + file.unchangedCount,
    }),
    { added: 0, unused: 0, deleted: 0, unchanged: 0 },
  );
}

/** 按项目和语言输出扫描及同步结果，并展示总计与可选报告路径。 */
function printSummary(options: {
  command: CliCommand;
  dryRun: boolean;
  configPath: string;
  reportPath?: string;
  executions: readonly ProjectExecution[];
  files: readonly SyncFileReport[];
  writeOutput: (message: string) => void;
}): void {
  const action = options.command === "check" ? "check" : options.dryRun ? "sync dry-run" : "sync";
  options.writeOutput(`bubbles-i18n ${action}`);
  options.writeOutput(`Config: ${options.configPath}`);

  for (const execution of options.executions) {
    options.writeOutput(
      `Project ${execution.name}: ${execution.scan.files.length} source files, ${execution.scan.keys.size} keys.`,
    );
    if (execution.scan.skippedBinaryFiles.length > 0) {
      options.writeOutput(`  Skipped binary files: ${execution.scan.skippedBinaryFiles.length}.`);
    }

    for (const file of options.files.filter((candidate) => candidate.project === execution.name)) {
      options.writeOutput(
        `  ${file.locale} ${file.path}: added ${file.added.length}, unused ${file.unused.length}, deleted ${file.deleted.length}, unchanged ${file.unchangedCount}.`,
      );
    }
  }

  const totals = summarize(options.files);
  options.writeOutput(
    `Total: added ${totals.added}, unused ${totals.unused}, deleted ${totals.deleted}, unchanged ${totals.unchanged}.`,
  );
  if (options.reportPath) {
    options.writeOutput(`Report: ${options.reportPath}`);
  }
}

/** 向标准输出写入一行命令结果。 */
function defaultStdout(message: string): void {
  process.stdout.write(`${message}\n`);
}

/** 向标准错误输出写入一行诊断信息。 */
function defaultStderr(message: string): void {
  process.stderr.write(`${message}\n`);
}

/** 将异常及其 cause 链递归拼接为可读的命令错误信息。 */
function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  return cause === undefined ? error.message : `${error.message}: ${errorMessage(cause)}`;
}

/** 按命令类型与文件列表字段识别已有同步报告的基本结构。 */
function isSyncReportLike(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const report = value as Record<string, unknown>;
  return (report.command === "sync" || report.command === "check") && Array.isArray(report.files);
}

/** 识别目标文件不存在或路径中间项不是目录的错误。 */
function isMissingPathError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}
