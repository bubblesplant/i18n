import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import type { Cell, CellValue, Workbook, Worksheet } from "exceljs";

import { readCatalog, serializeCatalog } from "./sync.ts";
import type { CatalogState } from "./sync.ts";

export type ExcelDirection = "export" | "import";

export interface ExcelProjectInput {
  name: string;
  catalogs: Record<string, string>;
  excelPath: string;
  sheet: string;
  locales: string[];
}

export interface ExcelOptions {
  direction: ExcelDirection;
  projects: ExcelProjectInput[];
  force: boolean;
  prefer: "excel" | "json";
  prune: boolean;
  dryRun: boolean;
}

/** null 表示缺失或空 Excel cell，空字符串 JSON 值仍用 "" 表示。 */
export interface ExcelDifference {
  project: string;
  key: string;
  locale: string;
  jsonPath: string;
  excelPath: string;
  sheet: string;
  cell: string;
  jsonValue: string | null;
  excelValue: string | null;
  reason: string;
}

export interface ExcelConflict extends ExcelDifference {
  reason: "different-values";
  resolution: "excel" | "json" | null;
}

export interface ExcelProjectPlan {
  project: string;
  excelPath: string;
  sheet: string;
  locales: string[];
  additions: ExcelDifference[];
  extras: ExcelDifference[];
  deletions: ExcelDifference[];
  conflicts: ExcelConflict[];
  skipped: ExcelDifference[];
  unchangedCount: number;
  writePaths: string[];
  /** 实际创建的备份路径，applyExcel 执行时填充。 */
  backupPaths: string[];
}

export interface ExcelPlan {
  direction: ExcelDirection;
  force: boolean;
  prefer: "excel" | "json";
  prune: boolean;
  dryRun: boolean;
  blocked: boolean;
  projects: ExcelProjectPlan[];
  conflicts: ExcelConflict[];
}

export class ExcelValidationError extends Error {
  override name = "ExcelValidationError";
}

export class ExcelConcurrentModificationError extends Error {
  override name = "ExcelConcurrentModificationError";
}

/** 跨文件提交失败时保留真实提交、回滚和备份信息。 */
export class ExcelApplyError extends Error {
  override name = "ExcelApplyError";
  readonly committedPaths: string[];
  readonly rolledBackPaths: string[];
  readonly rollbackFailedPaths: string[];
  readonly backupPaths: string[];

  constructor(
    cause: unknown,
    committedPaths: string[],
    rolledBackPaths: string[],
    rollbackFailedPaths: string[],
    backupPaths: string[],
  ) {
    const failures = rollbackFailedPaths.length
      ? ` Rollback failed for: ${rollbackFailedPaths.join(", ")}. Backups: ${backupPaths.join(", ")}.`
      : committedPaths.length > 0
        ? " Committed files were rolled back."
        : " No target files were committed.";
    super(`Excel write failed: ${errorMessage(cause)}.${failures}`, { cause });
    this.committedPaths = committedPaths;
    this.rolledBackPaths = rolledBackPaths;
    this.rollbackFailedPaths = rollbackFailedPaths;
    this.backupPaths = backupPaths;
  }
}

interface ExcelRow {
  key: string;
  index: number;
  values: Map<string, string | null>;
}

interface WorkbookState {
  workbook: Workbook;
  worksheet: Worksheet;
  columns: Map<string, number>;
  rows: Map<string, ExcelRow>;
  exists: boolean;
}

interface PlannedWrite {
  path: string;
  content: Buffer;
  kind: "json" | "excel";
  project: ExcelProjectPlan;
}

interface InternalPlan {
  inputs: Map<string, Buffer | null>;
  writes: PlannedWrite[];
  applied: boolean;
}

interface PreparedWrite extends PlannedWrite {
  temporaryPath: string;
  backupPath: string | null;
}

const internalPlans = new WeakMap<ExcelPlan, InternalPlan>();

/** 在内存中验证全部项目并计算计划；此阶段不会写 JSON、Excel 或备份。 */
export async function planExcel(options: ExcelOptions): Promise<ExcelPlan> {
  validateOptions(options);
  const internal: InternalPlan = { inputs: new Map(), writes: [], applied: false };
  const projects: ExcelProjectPlan[] = [];

  for (const input of options.projects) {
    const project: ExcelProjectPlan = {
      project: input.name,
      excelPath: input.excelPath,
      sheet: input.sheet || "translations",
      locales: [...input.locales],
      additions: [],
      extras: [],
      deletions: [],
      conflicts: [],
      skipped: [],
      unchangedCount: 0,
      writePaths: [],
      backupPaths: [],
    };
    const catalogs = await loadCatalogs(input, options.direction, internal.inputs);
    const state = await loadWorkbook(input, project.sheet, options.direction, internal.inputs);

    if (options.direction === "export") {
      await planExport(options, input, project, catalogs, state, internal.writes);
    } else {
      planImport(options, input, project, catalogs, state, internal.writes);
    }

    projects.push(project);
  }

  const conflicts = projects.flatMap((project) => project.conflicts);
  const plan: ExcelPlan = {
    direction: options.direction,
    force: options.force,
    prefer: options.prefer,
    prune: options.prune,
    dryRun: options.dryRun,
    blocked: conflicts.length > 0 && !options.force,
    projects,
    conflicts,
  };
  internalPlans.set(plan, internal);
  return plan;
}

/** 全部临时文件与备份准备完成后提交；失败时尽力恢复已经提交的目标文件。 */
export async function applyExcel(plan: ExcelPlan): Promise<void> {
  if (plan.blocked || plan.dryRun) return;
  const internal = internalPlans.get(plan);
  if (!internal) throw new TypeError("applyExcel requires a plan returned by planExcel.");
  if (internal.applied || internal.writes.length === 0) return;

  await verifyInputs(internal.inputs);
  const runId = `${Date.now()}-${randomUUID()}`;
  const prepared: PreparedWrite[] = [];
  const committed: PreparedWrite[] = [];

  try {
    for (const write of internal.writes) {
      const original = internal.inputs.get(write.path);
      if (original === undefined) throw new Error(`Missing input snapshot: "${write.path}"`);
      if (original !== null) {
        const handle = await open(write.path, "r+");
        await handle.close();
      }
      await mkdir(dirname(write.path), { recursive: true });
      const temporaryPath = join(dirname(write.path), `.${basename(write.path)}.${runId}.tmp`);
      const backupPath =
        original === null
          ? null
          : join(dirname(write.path), ".bubbles-i18n-backups", runId, basename(write.path));
      const item: PreparedWrite = { ...write, temporaryPath, backupPath };
      prepared.push(item);
      await writeFile(temporaryPath, write.content, { flag: "wx" });
      await verifyTemporaryFile(item);
      if (backupPath !== null) {
        await mkdir(dirname(backupPath), { recursive: true });
        await copyFile(write.path, backupPath, constants.COPYFILE_EXCL);
        write.project.backupPaths.push(backupPath);
      }
    }

    await verifyInputs(internal.inputs);
    for (const item of prepared) {
      await rename(item.temporaryPath, item.path);
      committed.push(item);
    }
    internal.applied = true;
  } catch (error) {
    const rolledBackPaths: string[] = [];
    const rollbackFailedPaths: string[] = [];
    for (const item of [...committed].reverse()) {
      const rollbackPath = `${item.temporaryPath}.rollback`;
      try {
        if (item.backupPath === null) {
          await unlink(item.path);
        } else {
          await copyFile(item.backupPath, rollbackPath, constants.COPYFILE_EXCL);
          await rename(rollbackPath, item.path);
        }
        rolledBackPaths.push(item.path);
      } catch {
        rollbackFailedPaths.push(item.path);
      } finally {
        await unlink(rollbackPath).catch(() => undefined);
      }
    }
    throw new ExcelApplyError(
      error,
      committed.map((item) => item.path),
      rolledBackPaths,
      rollbackFailedPaths,
      plan.projects.flatMap((project) => project.backupPaths),
    );
  } finally {
    await Promise.all(prepared.map((item) => unlink(item.temporaryPath).catch(() => undefined)));
  }
}

/** 配置层之外仍检查引擎入口，避免重复文件导致交叉覆盖。 */
function validateOptions(options: ExcelOptions): void {
  if (options.direction !== "export" && options.direction !== "import") {
    throw new TypeError("Excel direction must be export or import.");
  }
  if (options.prefer !== "json" && options.prefer !== "excel") {
    throw new TypeError("Excel preference must be json or excel.");
  }
  const paths = new Set<string>();
  const names = new Set<string>();
  for (const project of options.projects) {
    if (!project.name || names.has(project.name)) {
      throw new ExcelValidationError(`Invalid or duplicate Excel project: "${project.name}"`);
    }
    names.add(project.name);
    validatePath(project.excelPath);
    if (extname(project.excelPath).toLowerCase() !== ".xlsx") {
      throw new ExcelValidationError(`Excel file must use .xlsx: "${project.excelPath}"`);
    }
    const sheet = project.sheet || "translations";
    if (sheet.length > 31 || /[\\/*?:[\]]/u.test(sheet) || /^'|'$/u.test(sheet)) {
      throw new ExcelValidationError(`Invalid Excel sheet name: "${sheet}"`);
    }
    if (project.locales.length === 0 || new Set(project.locales).size !== project.locales.length) {
      throw new ExcelValidationError(`Project "${project.name}" must select unique locales.`);
    }
    for (const locale of Object.keys(project.catalogs)) {
      if (!locale || locale === "key") {
        throw new ExcelValidationError(`Invalid locale header: "${locale}"`);
      }
    }
    for (const locale of project.locales) {
      if (!Object.prototype.hasOwnProperty.call(project.catalogs, locale)) {
        throw new ExcelValidationError(`Unknown locale "${locale}" in project "${project.name}".`);
      }
    }
    for (const path of [project.excelPath, ...Object.values(project.catalogs)]) {
      validatePath(path);
      const identity = process.platform === "win32" ? resolve(path).toLowerCase() : resolve(path);
      if (paths.has(identity)) {
        throw new ExcelValidationError(`Excel projects must use distinct files: "${path}"`);
      }
      paths.add(identity);
    }
  }
}

function validatePath(path: string): void {
  if (!isAbsolute(path)) throw new TypeError(`Excel and catalog paths must be absolute: "${path}"`);
}

/** export 读取全部 locale 计算 key 并集，import 只读取实际处理的 locale。 */
async function loadCatalogs(
  input: ExcelProjectInput,
  direction: ExcelDirection,
  snapshots: Map<string, Buffer | null>,
): Promise<Map<string, CatalogState>> {
  const catalogs = new Map<string, CatalogState>();
  const locales = direction === "export" ? Object.keys(input.catalogs) : input.locales;
  for (const locale of locales) {
    const path = input.catalogs[locale]!;
    const before = await readOptional(path);
    const state = await readCatalog(path);
    const after = await readOptional(path);
    if (!sameContent(before, after)) throw changedInput(path);
    snapshots.set(path, before);
    catalogs.set(locale, state);
  }
  return catalogs;
}

/** ExcelJS 仅在 Excel 命令执行时加载，普通扫描命令不承担其启动成本。 */
async function createWorkbook(): Promise<Workbook> {
  const { default: ExcelJS } = await import("exceljs");
  return new ExcelJS.Workbook();
}

async function loadWorkbook(
  input: ExcelProjectInput,
  sheet: string,
  direction: ExcelDirection,
  snapshots: Map<string, Buffer | null>,
): Promise<WorkbookState> {
  const source = await readOptional(input.excelPath);
  snapshots.set(input.excelPath, source);
  if (source === null && direction === "import") {
    throw new ExcelValidationError(`Excel file does not exist: "${input.excelPath}"`);
  }
  const workbook = await createWorkbook();
  if (source !== null) {
    try {
      await workbook.xlsx.load(source as unknown as Parameters<Workbook["xlsx"]["load"]>[0]);
    } catch (error) {
      throw new ExcelValidationError(
        `Cannot read Excel "${input.excelPath}": ${errorMessage(error)}`,
      );
    }
  }
  let worksheet = workbook.getWorksheet(sheet);
  if (!worksheet && source !== null) {
    throw new ExcelValidationError(`Excel "${input.excelPath}" is missing sheet "${sheet}".`);
  }
  if (!worksheet) {
    worksheet = workbook.addWorksheet(sheet);
    worksheet.addRow(["key", ...Object.keys(input.catalogs)]);
    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
  }
  const columns = readHeaders(worksheet, input);
  const rows = readRows(worksheet, input, columns);
  return { workbook, worksheet, columns, rows, exists: source !== null };
}

function readHeaders(worksheet: Worksheet, input: ExcelProjectInput): Map<string, number> {
  const keyHeader = worksheet.getCell(1, 1);
  validateUnmergedCell(input, worksheet, keyHeader, "key header");
  if (keyHeader.value !== "key") {
    throw new ExcelValidationError(
      `Project "${input.name}" sheet "${worksheet.name}" A1 must be "key".`,
    );
  }
  const columns = new Map<string, number>();
  for (let column = 1; column <= worksheet.columnCount; column++) {
    const cell = worksheet.getCell(1, column);
    const header = cell.value;
    if (header === null || header === undefined || header === "") continue;
    if (typeof header !== "string") throw invalidCell(input, worksheet, cell.address, "header");
    if (input.locales.includes(header)) {
      validateUnmergedCell(input, worksheet, cell, `locale header (${header})`);
    }
    if (columns.has(header)) {
      throw new ExcelValidationError(
        `Duplicate header "${header}" at ${worksheet.name}!${cell.address} in "${input.excelPath}".`,
      );
    }
    columns.set(header, column);
  }
  for (const locale of input.locales) {
    if (!columns.has(locale)) {
      throw new ExcelValidationError(
        `Missing locale header "${locale}" in "${input.excelPath}" sheet "${worksheet.name}".`,
      );
    }
  }
  return columns;
}

function readRows(
  worksheet: Worksheet,
  input: ExcelProjectInput,
  columns: Map<string, number>,
): Map<string, ExcelRow> {
  const rows = new Map<string, ExcelRow>();
  for (let index = 2; index <= worksheet.rowCount; index++) {
    const keyCell = worksheet.getCell(index, 1);
    validateUnmergedCell(input, worksheet, keyCell, "key");
    for (const locale of input.locales) {
      validateUnmergedCell(
        input,
        worksheet,
        worksheet.getCell(index, columns.get(locale)!),
        `translation (${locale})`,
      );
    }
    const key = keyCell.value;
    if (key === null || key === undefined || key === "") {
      let hasContent = false;
      worksheet.getRow(index).eachCell((cell) => {
        if (cell.value !== null && cell.value !== undefined && cell.value !== "") hasContent = true;
      });
      if (hasContent) {
        throw new ExcelValidationError(
          `Empty key at ${worksheet.name}!${keyCell.address} in "${input.excelPath}".`,
        );
      }
      continue;
    }
    if (typeof key !== "string") throw invalidCell(input, worksheet, keyCell.address, "key");
    if (rows.has(key)) {
      throw new ExcelValidationError(
        `Duplicate key "${key}" at rows ${rows.get(key)!.index} and ${index} in "${input.excelPath}".`,
      );
    }
    const values = new Map<string, string | null>();
    for (const locale of input.locales) {
      const cell = worksheet.getCell(index, columns.get(locale)!);
      if (cell.value !== null && cell.value !== undefined && typeof cell.value !== "string") {
        throw invalidCell(input, worksheet, cell.address, `translation (${locale})`);
      }
      values.set(locale, typeof cell.value === "string" && cell.value !== "" ? cell.value : null);
    }
    rows.set(key, { key, index, values });
  }
  return rows;
}

/** 合并单元格共享 master，写入 alias 会覆盖其他 key 或 locale，托管字段必须独立。 */
function validateUnmergedCell(
  input: ExcelProjectInput,
  worksheet: Worksheet,
  cell: Cell,
  kind: string,
): void {
  if (cell.isMerged) {
    throw new ExcelValidationError(
      `Merged ${kind} cell at ${worksheet.name}!${cell.address} in "${input.excelPath}" is not supported; unmerge key and selected locale cells before synchronization.`,
    );
  }
}

async function planExport(
  options: ExcelOptions,
  input: ExcelProjectInput,
  project: ExcelProjectPlan,
  catalogs: Map<string, CatalogState>,
  state: WorkbookState,
  writes: PlannedWrite[],
): Promise<void> {
  const keys = new Set<string>();
  for (const catalog of catalogs.values()) {
    for (const key of Object.keys(catalog.messages)) {
      validateText(key, "key");
      if (key === "")
        throw new ExcelValidationError(`Project "${input.name}" contains an empty JSON key.`);
      keys.add(key);
    }
  }
  if (options.prune && keys.size === 0 && state.rows.size > 0) {
    throw new ExcelValidationError(
      `Refusing to prune Excel "${input.excelPath}" because all JSON catalogs are empty.`,
    );
  }
  let changed = !state.exists;
  for (const key of keys) {
    let row = state.rows.get(key);
    const isNewRow = row === undefined;
    if (!row) {
      const index = state.worksheet.rowCount + 1;
      row = { key, index, values: new Map() };
      writeText(state.worksheet, index, 1, key);
      state.rows.set(key, row);
      changed = true;
    }
    for (const locale of input.locales) {
      const jsonValue = catalogValue(catalogs.get(locale)!, key);
      const excelValue = row.values.get(locale) ?? null;
      const difference = location(input, state, row, locale, jsonValue, excelValue);
      if (jsonValue === null) {
        project[isNewRow ? "additions" : "skipped"].push({
          ...difference,
          reason: isNewRow
            ? "row-added"
            : excelValue !== null
              ? "excel-only-value-preserved"
              : "json-value-missing",
        });
        continue;
      }
      validateText(jsonValue, `${input.name}/${locale}/${key}`);
      if (excelValue !== null && excelValue !== jsonValue) {
        addConflict(project, difference, options);
        if (!options.force || options.prefer === "excel") continue;
      } else if (excelValue === jsonValue || (jsonValue === "" && excelValue === null)) {
        if (isNewRow) project.additions.push({ ...difference, reason: "row-added" });
        else project.unchangedCount++;
        continue;
      } else {
        project.additions.push({
          ...difference,
          reason: isNewRow ? "row-added" : "excel-value-missing",
        });
      }
      writeText(state.worksheet, row.index, state.columns.get(locale)!, jsonValue);
      changed = true;
    }
  }
  const removedRows: number[] = [];
  for (const row of state.rows.values()) {
    if (keys.has(row.key)) continue;
    for (const locale of input.locales) {
      const difference = location(input, state, row, locale, null, row.values.get(locale) ?? null);
      project[options.prune ? "deletions" : "extras"].push({
        ...difference,
        reason: "excel-only-key",
      });
    }
    if (options.prune) removedRows.push(row.index);
  }
  for (const index of removedRows.sort((left, right) => right - left)) {
    state.worksheet.spliceRows(index, 1);
    changed = true;
  }
  if (changed) {
    const content = await serializeWorkbook(state.workbook);
    writes.push({ path: input.excelPath, content, kind: "excel", project });
    project.writePaths.push(input.excelPath);
  }
}

function planImport(
  options: ExcelOptions,
  input: ExcelProjectInput,
  project: ExcelProjectPlan,
  catalogs: Map<string, CatalogState>,
  state: WorkbookState,
  writes: PlannedWrite[],
): void {
  if (
    options.prune &&
    state.rows.size === 0 &&
    [...catalogs.values()].some((catalog) => Object.keys(catalog.messages).length > 0)
  ) {
    throw new ExcelValidationError(
      `Refusing to prune JSON catalogs because Excel "${input.excelPath}" has no keys.`,
    );
  }
  for (const locale of input.locales) {
    const catalog = catalogs.get(locale)!;
    const next = new Map(Object.entries(catalog.messages));
    let changed = false;
    for (const row of state.rows.values()) {
      const jsonValue = catalogValue(catalog, row.key);
      const excelValue = row.values.get(locale) ?? null;
      const difference = location(input, state, row, locale, jsonValue, excelValue);
      if (excelValue === null) {
        project.skipped.push({ ...difference, reason: "excel-blank-preserved" });
        continue;
      }
      if (jsonValue !== null && jsonValue !== excelValue) {
        addConflict(project, difference, options);
        if (!options.force || options.prefer === "json") continue;
      } else if (jsonValue === excelValue) {
        project.unchangedCount++;
        continue;
      } else {
        project.additions.push({ ...difference, reason: "json-value-missing" });
      }
      next.set(row.key, excelValue);
      changed = true;
    }
    for (const [key, jsonValue] of Object.entries(catalog.messages)) {
      if (state.rows.has(key)) continue;
      const difference = location(input, state, undefined, locale, jsonValue, null, key);
      project[options.prune ? "deletions" : "extras"].push({
        ...difference,
        reason: "json-only-key",
      });
      if (options.prune) {
        next.delete(key);
        changed = true;
      }
    }
    if (changed) {
      const path = input.catalogs[locale]!;
      const content = Buffer.from(
        serializeCatalog(Object.fromEntries(next), catalog.format),
        "utf8",
      );
      writes.push({ path, content, kind: "json", project });
      project.writePaths.push(path);
    }
  }
}

function location(
  input: ExcelProjectInput,
  state: WorkbookState,
  row: ExcelRow | undefined,
  locale: string,
  jsonValue: string | null,
  excelValue: string | null,
  missingKey = "",
): Omit<ExcelDifference, "reason"> {
  const column = state.columns.get(locale)!;
  return {
    project: input.name,
    key: row?.key ?? missingKey,
    locale,
    jsonPath: input.catalogs[locale]!,
    excelPath: input.excelPath,
    sheet: state.worksheet.name,
    cell: row ? state.worksheet.getCell(row.index, column).address : "",
    jsonValue,
    excelValue,
  };
}

function addConflict(
  project: ExcelProjectPlan,
  difference: Omit<ExcelDifference, "reason">,
  options: ExcelOptions,
): void {
  project.conflicts.push({
    ...difference,
    reason: "different-values",
    resolution: options.force ? options.prefer : null,
  });
  const preferredTarget = options.direction === "export" ? "excel" : "json";
  if (options.force && options.prefer === preferredTarget) {
    project.skipped.push({ ...difference, reason: "preferred-target-preserved" });
  }
}

function catalogValue(catalog: CatalogState, key: string): string | null {
  return Object.prototype.hasOwnProperty.call(catalog.messages, key)
    ? catalog.messages[key]!
    : null;
}

function validateText(value: string, label: string): void {
  if (value.length > 32_767)
    throw new ExcelValidationError(`Excel text exceeds 32,767 characters: "${label}".`);
  for (const character of value) {
    const point = character.codePointAt(0)!;
    if (
      (point <= 0x1f && point !== 0x09 && point !== 0x0a && point !== 0x0d) ||
      (point >= 0xd800 && point <= 0xdfff) ||
      point === 0xfffe ||
      point === 0xffff
    ) {
      const code = point.toString(16).toUpperCase().padStart(4, "0");
      throw new ExcelValidationError(`Unsupported Excel text character U+${code}: "${label}".`);
    }
  }
}

/** 编码普通字符串，重读验证全部 cell value；无法保真的复杂值拒绝导出。 */
async function serializeWorkbook(workbook: Workbook): Promise<Buffer> {
  const expected: { sheet: string; cell: string; value: CellValue }[] = [];
  // 先快照全工作簿，再编码 master，避免合并 alias 读到已编码值。
  for (const worksheet of workbook.worksheets) {
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value === null || cell.value === undefined) return;
        expected.push({
          sheet: worksheet.name,
          cell: cell.address,
          value: structuredClone(cell.value),
        });
      });
    });
  }
  for (const worksheet of workbook.worksheets) {
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value !== "string") return;
        if (cell.isMerged && cell.master.address !== cell.address) return;
        const value = cell.value;
        validateText(value, `${worksheet.name}!${cell.address}`);
        // 用零宽前瞻处理共享下划线的 _x005F_x000D_，避免漏掉重叠转义。
        cell.value = value.replace(/_(?=x[0-9a-f]{4}_)/giu, "_x005F_").replace(/\r/gu, "_x000D_");
      });
    });
  }
  const content = Buffer.from(await workbook.xlsx.writeBuffer());
  const reread = await createWorkbook();
  try {
    await reread.xlsx.load(content as unknown as Parameters<Workbook["xlsx"]["load"]>[0]);
  } catch (error) {
    throw new ExcelValidationError(`Generated Excel cannot be read: ${errorMessage(error)}`);
  }
  for (const entry of expected) {
    const actual = reread.getWorksheet(entry.sheet)?.getCell(entry.cell).value;
    if (
      isDeepStrictEqual(actual, entry.value) ||
      (entry.value === "" && (actual === null || actual === undefined))
    )
      continue;
    throw new ExcelValidationError(
      `Excel cell value changed during serialization at ${entry.sheet}!${entry.cell}; no files were written.`,
    );
  }
  return content;
}

function writeText(worksheet: Worksheet, row: number, column: number, value: string): void {
  const cell = worksheet.getCell(row, column);
  cell.value = value;
  cell.numFmt = "@";
}

function invalidCell(
  input: ExcelProjectInput,
  worksheet: Worksheet,
  cell: string,
  kind: string,
): ExcelValidationError {
  return new ExcelValidationError(
    `Invalid ${kind} cell at ${worksheet.name}!${cell} in "${input.excelPath}"; only text and blank cells are supported.`,
  );
}

async function readOptional(path: string): Promise<Buffer | null> {
  try {
    return await readFile(path);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

function sameContent(left: Buffer | null, right: Buffer | null): boolean {
  return left === null || right === null ? left === right : left.equals(right);
}

function changedInput(path: string): ExcelConcurrentModificationError {
  return new ExcelConcurrentModificationError(
    `File changed after Excel planning; run the command again: "${path}"`,
  );
}

async function verifyInputs(inputs: Map<string, Buffer | null>): Promise<void> {
  for (const [path, expected] of inputs) {
    if (!sameContent(await readOptional(path), expected)) throw changedInput(path);
  }
}

async function verifyTemporaryFile(write: PreparedWrite): Promise<void> {
  const source = await readFile(write.temporaryPath);
  if (!source.equals(write.content))
    throw new Error(`Temporary file validation failed: "${write.path}"`);
  if (write.kind === "json") {
    JSON.parse(source.toString("utf8").replace(/^\uFEFF/u, ""));
  } else {
    const workbook = await createWorkbook();
    await workbook.xlsx.load(source as unknown as Parameters<Workbook["xlsx"]["load"]>[0]);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
