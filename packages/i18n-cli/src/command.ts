import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import type { I18nProjectConfig } from "./config.ts";
import { applyExcel, planExcel, type ExcelProjectInput } from "./excel.ts";
import { scanFiles, type ScanFilesResult } from "./files.ts";
import { loadConfig } from "./load-config.ts";
import { createSyncReport, type SyncFileReport, writeSyncReport } from "./report.ts";
import { syncProject } from "./sync.ts";
import {
  assertSafeMarkdownTarget,
  quoteArgument,
  renderExcelMarkdown,
  renderScanMarkdown,
  writeMarkdownReport,
} from "./markdown-report.ts";

export type CliCommand = "check" | "sync" | "excel export" | "excel import";

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
  force: boolean;
  prefer: "excel" | "json";
  locales: string[];
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
  bubbles-i18n excel export [options]
  bubbles-i18n excel import [options]

命令：
  sync   把源码中缺失的静态 tr() key 添加到配置的语言包。
  check  只检查、不修改语言包；存在缺失 key 时返回失败。
  excel export  JSON → Excel，补缺失行并检测译文冲突。
  excel import  Excel → JSON，导入译文并检测译文冲突。

选项：
  --config <path>       使用指定配置文件，不再自动查找 i18n.config.ts。
  --project <name>      只处理指定项目；可以多次传入。
  --locale <locale>     Excel 命令只处理指定语言；可以多次传入。
  --dry-run             生成预览报告，不修改 JSON/XLSX，不创建数据备份。
  --prune               删除目标端独有 key；Excel 清理需显式 --project。
  --clean               sync --prune 的兼容参数。
  -f, --force           Excel 值冲突时允许执行，默认采用 Excel。
  --prefer excel|json   指定冲突优先方，必须配合 --force。
  --allow-empty         配合 sync --prune/--clean，允许零 key 扫描清空语言包。
  --fail-on-stale       check 时发现废弃 key 也返回失败。
  -h, --help            显示帮助信息。

安全保护：
  项目的 include 未匹配到可读取文本源文件时，--clean 始终拒绝执行。
  扫描保留已有翻译；新增项默认使用 key 作为翻译值。
  Excel 普通命令有值冲突时退出 1，所有选中项目数据均不写入。
  多余 key 默认保留并逐项报告；--prune 不解决值冲突。
  报告：.bubbles-i18n/reports/{sync,excel-export,excel-import}.md。`;

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

  const markdownPath =
    options.command === "check"
      ? undefined
      : resolve(
          loaded.rootDir,
          ".bubbles-i18n",
          "reports",
          `${options.command.replace(" ", "-")}.md`,
        );
  const excelPaths = Object.entries(loaded.config.projects).flatMap(([name, project]) =>
    project.excel ? [{ name, path: resolveFromRoot(loaded.rootDir, project.excel.file) }] : [],
  );
  validateOutputPaths(allProjectCatalogs, reportPath, loaded.configPath, excelPaths, markdownPath);
  if (markdownPath)
    await assertSafeMarkdownTarget(
      markdownPath,
      options.command as "sync" | "excel export" | "excel import",
    );

  const projectEntries = selectProjects(loaded.config.projects, options.projects);
  if (options.command === "excel export" || options.command === "excel import") {
    return runExcelCommand(options, projectEntries, loaded.rootDir, markdownPath!, writeOutput);
  }
  if (reportPath) {
    await assertSafeReportTarget(reportPath);
  }

  const executions = await Promise.all(
    projectEntries.map(
      /** 扫描词条并拦截无源文件的清理。 */ async ([name, project]): Promise<ProjectExecution> => {
        if (!project.include)
          throw new CliUsageError(
            `Project "${name}" requires include for ${options.command}; select scanning projects with --project.`,
          );
        const scan = await scanFiles({
          rootDir: loaded.rootDir,
          include: project.include,
          exclude: [...(project.exclude ?? []), "**/.bubbles-i18n/**"],
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
  if (markdownPath) assertReportIsNotSourceFile(executions, markdownPath);

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
  const retryCommand = createReplayCommand(options);
  const pruneCommand = `${createScopeCommand(options)}${options.allowEmpty ? " --allow-empty" : ""}`;
  if (markdownPath) {
    await writeMarkdownReport(
      markdownPath,
      renderScanMarkdown({ files: fileReports, status: "preview", retryCommand, pruneCommand }),
    );
  }
  if (options.command === "sync" && !options.dryRun) {
    try {
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
    } catch (error) {
      if (markdownPath)
        await writeMarkdownReport(
          markdownPath,
          renderScanMarkdown({
            files: previews.flat(),
            status: "failed",
            retryCommand,
            pruneCommand,
            error: errorMessage(error),
          }),
        );
      throw error;
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
  if (markdownPath)
    await writeMarkdownReport(
      markdownPath,
      renderScanMarkdown({
        files: portableReports,
        status: options.dryRun ? "preview" : "applied",
        retryCommand,
        pruneCommand,
      }),
    );

  printSummary({
    command: options.command,
    dryRun: options.dryRun,
    configPath: toPortablePath(cwd, loaded.configPath),
    reportPath: markdownPath
      ? toPortablePath(loaded.rootDir, markdownPath)
      : reportPath
        ? toPortablePath(loaded.rootDir, reportPath)
        : undefined,
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

/** Excel 命令不扫描源码：先计划全部项目，冲突时仅写报告，获准后只写目标端。 */
async function runExcelCommand(
  options: ParsedArguments,
  entries: readonly [string, I18nProjectConfig][],
  rootDir: string,
  reportPath: string,
  writeOutput: (message: string) => void,
): Promise<number> {
  const projects: ExcelProjectInput[] = entries.map(([name, project]) => {
    if (!project.excel)
      throw new CliUsageError(
        `Project "${name}" requires excel.file; select Excel projects with --project.`,
      );
    const available = Object.keys(project.catalogs);
    for (const locale of options.locales) {
      if (!available.includes(locale))
        throw new CliUsageError(
          `Unknown locale "${locale}" in project "${name}". Available locales: ${available.join(", ")}.`,
        );
    }
    return {
      name,
      catalogs: resolveCatalogs(rootDir, project.catalogs),
      excelPath: resolveFromRoot(rootDir, project.excel.file),
      sheet: project.excel.sheet ?? "translations",
      locales: options.locales.length ? options.locales : available,
    };
  });
  const plan = await planExcel({
    direction: options.command === "excel export" ? "export" : "import",
    projects,
    force: options.force,
    prefer: options.prefer,
    prune: options.clean,
    dryRun: options.dryRun,
  });
  const retryCommand = createReplayCommand(options);
  const forceCommand = createReplayCommand(options, false);
  const pruneCommand = createScopeCommand(
    options,
    projects.map((project) => project.name),
  );
  await writeMarkdownReport(
    reportPath,
    renderExcelMarkdown({
      plan,
      status: plan.blocked ? "blocked" : "preview",
      retryCommand,
      forceCommand,
      pruneCommand,
    }),
  );
  if (!plan.blocked && !options.dryRun) {
    try {
      await applyExcel(plan);
      await writeMarkdownReport(
        reportPath,
        renderExcelMarkdown({
          plan,
          status: "applied",
          retryCommand,
          forceCommand,
          pruneCommand,
          backups: plan.projects.flatMap((project) => project.backupPaths),
        }),
      );
    } catch (error) {
      await writeMarkdownReport(
        reportPath,
        renderExcelMarkdown({
          plan,
          status: "failed",
          retryCommand,
          forceCommand,
          pruneCommand,
          backups: plan.projects.flatMap((project) => project.backupPaths),
          error: errorMessage(error),
        }),
      );
      throw error;
    }
  }
  writeOutput(`bubbles-i18n ${options.command}${options.dryRun ? " dry-run" : ""}`);
  for (const project of plan.projects) {
    writeOutput(
      `Project ${project.project}: added ${project.additions.length}, extra ${project.extras.length}, deleted ${project.deletions.length}, conflicts ${project.conflicts.length}, skipped ${project.skipped.length}.`,
    );
    for (const item of project.extras)
      writeOutput(`  保留目标端独有 key: ${JSON.stringify(item.key)} (${item.locale})`);
    for (const item of project.conflicts)
      writeOutput(
        `  冲突 ${JSON.stringify(item.key)} (${item.locale}): JSON=${JSON.stringify(item.jsonValue)}, Excel=${JSON.stringify(item.excelValue)}; ${project.excelPath} / ${item.sheet} / ${item.cell}`,
      );
  }
  writeOutput(`Report: ${toPortablePath(rootDir, reportPath)}`);
  if (plan.blocked) {
    writeOutput("值冲突阻断，所有选中项目数据均未写入。请先处理报告中的冲突，或使用以下命令：");
    writeOutput(`${forceCommand} --force --prefer excel`);
    writeOutput(`${forceCommand} --force --prefer json`);
    return 1;
  }
  writeOutput(options.dryRun ? "预览完成，数据未写入。" : "转换完成。");
  return 0;
}

/** 保留配置、项目及语言选择，具体操作参数由调用方补充。 */
function createScopeCommand(options: ParsedArguments, projects = options.projects): string {
  const words = ["pnpm exec bubbles-i18n", options.command];
  if (options.configPath) words.push("--config", quoteArgument(options.configPath));
  for (const project of projects) words.push("--project", quoteArgument(project));
  for (const locale of options.locales) words.push("--locale", quoteArgument(locale));
  return words.join(" ");
}

/** 保留本次命令语义；选择另一冲突优先方时只移除原强制与优先方参数。 */
function createReplayCommand(options: ParsedArguments, includeResolution = true): string {
  const words = [createScopeCommand(options)];
  if (options.clean) words.push("--prune");
  if (options.allowEmpty) words.push("--allow-empty");
  if (options.force && includeResolution) words.push("--force", "--prefer", options.prefer);
  if (options.dryRun) words.push("--dry-run");
  return words.join(" ");
}

/** 解析同步或检查命令的选项，校验必填值、未知选项和互斥组合。 */
function parseArguments(arguments_: readonly string[]): ParsedArguments {
  const command = arguments_[0] === "excel" ? `excel ${arguments_[1] ?? ""}` : arguments_[0];
  if (
    command !== "sync" &&
    command !== "check" &&
    command !== "excel export" &&
    command !== "excel import"
  ) {
    throw new CliUsageError(`Unknown command "${command ?? ""}".`);
  }

  let configPath: string | undefined;
  const projects = new Set<string>();
  let clean = false;
  let allowEmpty = false;
  let dryRun = false;
  let failOnStale = false;
  let force = false;
  let prefer: "excel" | "json" | undefined;
  const locales = new Set<string>();
  const excel = command === "excel export" || command === "excel import";

  for (let index = excel ? 2 : 1; index < arguments_.length; index += 1) {
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
    } else if (argument === "--locale" || argument.startsWith("--locale=")) {
      if (argument === "--locale") {
        const [value, nextIndex] = readOptionValue(arguments_, index, "--locale");
        locales.add(value);
        index = nextIndex;
      } else locales.add(readInlineOptionValue(argument, "--locale"));
    } else if (argument === "--force" || argument === "-f") {
      force = true;
    } else if (argument === "--prefer" || argument.startsWith("--prefer=")) {
      let value: string;
      if (argument === "--prefer") {
        const result = readOptionValue(arguments_, index, "--prefer");
        value = result[0];
        index = result[1];
      } else value = readInlineOptionValue(argument, "--prefer");
      if (value !== "excel" && value !== "json")
        throw new CliUsageError("--prefer must be excel or json.");
      if (prefer && prefer !== value)
        throw new CliUsageError("--prefer excel and --prefer json are mutually exclusive.");
      prefer = value;
    } else if (argument === "--prune") {
      clean = true;
    } else if (argument === "--clean") {
      if (excel)
        throw new CliUsageError(
          "--clean is only available with sync; use --prune for Excel commands.",
        );
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
    throw new CliUsageError("--clean/--prune is not available with check.");
  }
  if (command === "check" && dryRun) {
    throw new CliUsageError("check is already read-only; --dry-run is only available with sync.");
  }
  if (command !== "check" && failOnStale) {
    throw new CliUsageError("--fail-on-stale is only available with the check command.");
  }
  if (allowEmpty && !clean) {
    throw new CliUsageError("--allow-empty requires --clean or --prune.");
  }
  if (excel && allowEmpty) throw new CliUsageError("--allow-empty is only available with sync.");
  if (!excel && (force || prefer || locales.size))
    throw new CliUsageError(
      "--force, --prefer and --locale are only available with Excel commands.",
    );
  if (prefer && !force) throw new CliUsageError("--prefer requires --force.");
  if (excel && clean && projects.size === 0)
    throw new CliUsageError("Excel --prune requires an explicit --project.");

  return {
    command,
    configPath,
    projects: [...projects],
    clean,
    allowEmpty,
    dryRun,
    failOnStale,
    force,
    prefer: prefer ?? "excel",
    locales: [...locales],
  };
}

/** 读取独立命令选项后的值，并返回已消费位置；缺失值时抛出用法错误。 */
function readOptionValue(
  arguments_: readonly string[],
  index: number,
  option: string,
): [value: string, nextIndex: number] {
  const value = arguments_[index + 1];
  if (!value || value.startsWith("-")) {
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
  excelPaths: readonly { name: string; path: string }[] = [],
  markdownPath?: string,
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
      if (normalizedPath === normalizeComparablePath(configPath))
        throw new CliUsageError(`Catalog path must not overwrite the config file: "${path}".`);
    }
  }

  for (const file of excelPaths) {
    const comparable = normalizeComparablePath(file.path);
    const existing = owners.get(comparable);
    if (existing)
      throw new CliUsageError(
        `Excel path "${file.path}" is configured by both ${existing} and ${file.name}/excel.`,
      );
    if (comparable === normalizeComparablePath(configPath))
      throw new CliUsageError(`Excel path must not overwrite the config file: "${file.path}".`);
    owners.set(comparable, `${file.name}/excel`);
  }

  if (reportPath && owners.has(normalizeComparablePath(reportPath))) {
    throw new CliUsageError(`Report path must not overwrite a catalog: "${reportPath}".`);
  }

  if (reportPath && normalizeComparablePath(reportPath) === normalizeComparablePath(configPath)) {
    throw new CliUsageError(`Report path must not overwrite the config file: "${reportPath}".`);
  }
  if (markdownPath) {
    const comparable = normalizeComparablePath(markdownPath);
    if (
      owners.has(comparable) ||
      comparable === normalizeComparablePath(configPath) ||
      (reportPath && comparable === normalizeComparablePath(reportPath))
    ) {
      throw new CliUsageError(
        `Markdown report path must not overwrite catalogs, Excel, config or the JSON report: "${markdownPath}".`,
      );
    }
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
  command: "check" | "sync";
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
      for (const key of file.unused)
        options.writeOutput(`    保留 JSON 独有 key: ${JSON.stringify(key)}`);
      for (const key of file.deleted)
        options.writeOutput(
          `    ${options.command === "sync" && !options.dryRun ? "已删除" : "计划删除"} key: ${JSON.stringify(key)}`,
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
