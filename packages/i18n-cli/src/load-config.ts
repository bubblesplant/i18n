import { stat } from "node:fs/promises";
import { dirname, extname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { I18nConfig } from "./config.ts";

export const CONFIG_FILE_NAMES = [
  "i18n.config.ts",
  "i18n.config.mts",
  "i18n.config.js",
  "i18n.config.mjs",
  "i18n.config.cts",
  "i18n.config.cjs",
] as const;

export interface LoadConfigOptions {
  readonly cwd?: string;
  readonly configPath?: string;
}

export interface LoadedI18nConfig {
  readonly configPath: string;
  readonly rootDir: string;
  readonly config: I18nConfig;
}

export class ConfigNotFoundError extends Error {
  override readonly name = "ConfigNotFoundError";
}

export class ConfigLoadError extends Error {
  override readonly name = "ConfigLoadError";
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.cause = cause;
  }
}

export class ConfigValidationError extends Error {
  override readonly name = "ConfigValidationError";
}

/** 从指定路径或逐级向上的默认位置加载并校验国际化配置，返回配置文件所在目录作为项目根。 */
export async function loadConfig(options: LoadConfigOptions = {}): Promise<LoadedI18nConfig> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const configPath =
    options.configPath === undefined
      ? await findConfigPath(cwd)
      : await resolveExplicitConfigPath(options.configPath, cwd);

  let importedConfig: unknown;

  try {
    const module = (await import(pathToFileURL(configPath).href)) as Record<string, unknown>;

    if (!Object.prototype.hasOwnProperty.call(module, "default")) {
      throw new ConfigValidationError(
        `Invalid i18n config at "${configPath}": the module must have a default export`,
      );
    }

    importedConfig = module.default;
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      throw error;
    }

    throw new ConfigLoadError(`Failed to load i18n config at "${configPath}"`, error);
  }

  return {
    configPath,
    rootDir: dirname(configPath),
    config: validateConfig(importedConfig, configPath),
  };
}

/** 校验项目、可选扫描规则和 JSON / Excel 路径，非法配置抛出带字段位置的 ConfigValidationError。 */
export function validateConfig(value: unknown, configPath = "<config>"): I18nConfig {
  const prefix = `Invalid i18n config at "${configPath}"`;

  if (!isRecord(value)) {
    throw new ConfigValidationError(`${prefix}: the default export must be an object`);
  }

  const projects = value.projects;
  if (!isRecord(projects) || Object.keys(projects).length === 0) {
    throw new ConfigValidationError(`${prefix}: projects must be a non-empty object`);
  }

  for (const [projectName, project] of Object.entries(projects)) {
    if (projectName.trim() === "") {
      throw new ConfigValidationError(`${prefix}: project names must be non-empty strings`);
    }

    const projectPath = `projects[${JSON.stringify(projectName)}]`;
    if (!isRecord(project)) {
      throw new ConfigValidationError(`${prefix}: ${projectPath} must be an object`);
    }

    if (project.include !== undefined) {
      validateStringArray(project.include, `${projectPath}.include`, prefix, { nonEmpty: true });
    }

    if (project.exclude !== undefined) {
      validateStringArray(project.exclude, `${projectPath}.exclude`, prefix);
    }

    if (project.excel !== undefined) {
      validateExcelConfig(project.excel, `${projectPath}.excel`, prefix);
    }

    const catalogs = project.catalogs;
    if (!isRecord(catalogs) || Object.keys(catalogs).length === 0) {
      throw new ConfigValidationError(
        `${prefix}: ${projectPath}.catalogs must be a non-empty object`,
      );
    }

    for (const [locale, catalogPath] of Object.entries(catalogs)) {
      if (locale.trim() === "") {
        throw new ConfigValidationError(
          `${prefix}: ${projectPath}.catalogs locale names must be non-empty strings`,
        );
      }

      if (typeof catalogPath !== "string" || catalogPath.trim() === "") {
        throw new ConfigValidationError(
          `${prefix}: ${projectPath}.catalogs[${JSON.stringify(locale)}] must be a non-empty string`,
        );
      }
    }
  }

  if (value.callNames !== undefined) {
    validateStringArray(value.callNames, "callNames", prefix, { nonEmpty: true });
  }

  if (
    value.report !== undefined &&
    (typeof value.report !== "string" || value.report.trim() === "")
  ) {
    throw new ConfigValidationError(`${prefix}: report must be a non-empty string`);
  }

  return value as unknown as I18nConfig;
}

/** 从当前目录逐级向上按候选名称查找配置文件，找不到时抛出 ConfigNotFoundError。 */
async function findConfigPath(cwd: string): Promise<string> {
  let directory = cwd;

  while (true) {
    for (const fileName of CONFIG_FILE_NAMES) {
      const candidate = resolve(directory, fileName);
      if (await isFile(candidate)) {
        return candidate;
      }
    }

    const parent = dirname(directory);
    if (parent === directory) {
      break;
    }
    directory = parent;
  }

  throw new ConfigNotFoundError(
    `Could not find an i18n config from "${cwd}" upward. Expected one of: ${CONFIG_FILE_NAMES.join(", ")}`,
  );
}

/** 相对工作目录解析显式配置路径，并确认该路径指向存在的文件。 */
async function resolveExplicitConfigPath(configPath: string, cwd: string): Promise<string> {
  if (configPath.trim() === "") {
    throw new ConfigNotFoundError("The explicit i18n config path must be a non-empty string");
  }

  const resolvedPath = isAbsolute(configPath) ? resolve(configPath) : resolve(cwd, configPath);
  if (!(await isFile(resolvedPath))) {
    throw new ConfigNotFoundError(
      `Could not find the explicit i18n config at "${resolvedPath}" (resolved from "${cwd}")`,
    );
  }

  return resolvedPath;
}

/** 断言配置字段是由非空字符串组成的数组，并按选项要求数组本身非空。 */
function validateStringArray(
  value: unknown,
  path: string,
  prefix: string,
  options: { readonly nonEmpty?: boolean } = {},
): asserts value is string[] {
  if (!Array.isArray(value)) {
    throw new ConfigValidationError(`${prefix}: ${path} must be an array of non-empty strings`);
  }

  if (options.nonEmpty === true && value.length === 0) {
    throw new ConfigValidationError(`${prefix}: ${path} must be a non-empty array of strings`);
  }

  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || item.trim() === "") {
      throw new ConfigValidationError(`${prefix}: ${path}[${index}] must be a non-empty string`);
    }
  }
}

/** 校验 Excel 文件和可选工作表名称，默认工作表由执行转换的命令确定。 */
function validateExcelConfig(value: unknown, path: string, prefix: string): void {
  if (!isRecord(value)) {
    throw new ConfigValidationError(`${prefix}: ${path} must be an object`);
  }

  if (typeof value.file !== "string" || value.file.trim() === "") {
    throw new ConfigValidationError(`${prefix}: ${path}.file must be a non-empty string`);
  }

  if (extname(value.file).toLowerCase() !== ".xlsx") {
    throw new ConfigValidationError(`${prefix}: ${path}.file must point to an .xlsx file`);
  }

  if (value.sheet !== undefined) {
    if (typeof value.sheet !== "string" || value.sheet.trim() === "") {
      throw new ConfigValidationError(`${prefix}: ${path}.sheet must be a non-empty string`);
    }

    if (value.sheet.length > 31 || /[[\]:*?/\\]/u.test(value.sheet) || /^'|'$/u.test(value.sheet)) {
      throw new ConfigValidationError(
        `${prefix}: ${path}.sheet must be a valid Excel sheet name (at most 31 characters, without []:*?/\\ or leading/trailing apostrophes)`,
      );
    }
  }
}

/** 判断输入是否为普通对象或无原型对象，排除数组和类实例。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

/** 确认路径是否指向文件；路径不存在时返回 false，其他文件系统错误继续抛出。 */
async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }
    throw error;
  }
}

/** 识别文件不存在或中间路径不是目录的文件系统错误。 */
function isMissingPathError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}
