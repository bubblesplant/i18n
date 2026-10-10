import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import type { ExcelDifference, ExcelPlan } from "./excel.ts";
import type { SyncFileReport } from "./report.ts";

export type ReportStatus = "preview" | "blocked" | "applied" | "failed";
export type MarkdownCommand = "sync" | "excel export" | "excel import";

/** 仅允许覆盖本命令生成的 Markdown 报告，保护已有手工文档。 */
export async function assertSafeMarkdownTarget(
  path: string,
  command: MarkdownCommand,
): Promise<void> {
  try {
    const source = await readFile(path, "utf8");
    if (!source.startsWith(marker(command))) {
      throw new Error(`Refusing to overwrite existing non-report file at "${path}".`);
    }
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
}

/** 原子更新人读报告，报告写入本身不改变任何语言包。 */
export async function writeMarkdownReport(path: string, content: string): Promise<void> {
  const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(temporary, content, "utf8");
    await rename(temporary, path);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

/** 扫描报告逐项展示新增与废弃词条，并附保留原作用范围的清理命令。 */
export function renderScanMarkdown(options: {
  files: readonly SyncFileReport[];
  status: ReportStatus;
  retryCommand: string;
  pruneCommand?: string;
  error?: string;
}): string {
  const lines = [marker("sync"), "# 源码 → JSON 同步报告", "", statusText(options.status), ""];
  if (options.error) lines.push(`错误：${cell(options.error)}`, "");
  lines.push("已有翻译保持不变，源码中新增 key 以 key 作为初始值。", "");
  for (const file of options.files) {
    lines.push(
      `## ${cell(file.project)} / ${cell(file.locale)}`,
      "",
      `JSON：${cell(file.path)}`,
      "",
    );
    for (const [title, keys] of [
      ["新增 key", file.added],
      ["JSON 独有 key（默认保留）", file.unused],
      [options.status === "applied" ? "已删除 key" : "计划删除 key", file.deleted],
    ] as const) {
      lines.push(`### ${title}：${keys.length}`, "");
      if (keys.length === 0) lines.push("无。", "");
      else lines.push(...keys.map((key) => `- ${cell(key)}`), "");
    }
    lines.push(`保持的已有词条：${file.unchangedCount}。`, "");
  }
  lines.push(
    "## 后续命令",
    "",
    "保留本次参数重试：",
    "",
    "```sh",
    options.retryCommand,
    "```",
    "",
    "如确认 JSON 独有 key 已废弃，可使用 `--prune` 删除；先预览再执行：",
    "",
    "```sh",
    `${options.pruneCommand ?? options.retryCommand} --prune --dry-run`,
    `${options.pruneCommand ?? options.retryCommand} --prune`,
    "```",
    "",
    "`--clean` 继续作为 `--prune` 的兼容参数。扫描未匹配可读取源文件时拒绝清理；扫描为零 key 时，清空非空 JSON 还需显式 `--allow-empty`。",
    "",
  );
  return lines.join("\n");
}

/** Excel 报告区分计划、阻断和已执行，并展示每个 key × locale 的双方值与定位。 */
export function renderExcelMarkdown(options: {
  plan: ExcelPlan;
  status: ReportStatus;
  retryCommand: string;
  forceCommand?: string;
  pruneCommand?: string;
  backups?: readonly string[];
  error?: string;
}): string {
  const command = `excel ${options.plan.direction}` as MarkdownCommand;
  const lines = [
    marker(command),
    `# ${options.plan.direction === "export" ? "JSON → Excel" : "Excel → JSON"} 同步报告`,
    "",
    statusText(options.status),
    "",
  ];
  if (options.error)
    lines.push(
      `错误：${cell(options.error)}`,
      "",
      "提交失败时请结合错误中的回滚结果及备份检查目标文件。",
      "",
    );
  lines.push(
    "只写入本次转换的目标端。以目标端为准时，双方值仍可能不同。空白 Excel 单元格不会清空已有 JSON 译文。",
    "",
  );
  for (const project of options.plan.projects) {
    lines.push(
      `## 项目 ${cell(project.project)}`,
      "",
      `Excel：${cell(project.excelPath)}；sheet：${cell(project.sheet)}；语言：${project.locales.map(cell).join("、")}`,
      "",
    );
    appendDifferences(lines, "新增项", project.additions);
    appendDifferences(lines, "目标端独有 key（保留并提示）", project.extras);
    appendDifferences(
      lines,
      options.status === "applied" ? "已删除项" : "计划删除项",
      project.deletions,
    );
    appendDifferences(lines, "跳过项", project.skipped);
    lines.push(`### 值冲突：${project.conflicts.length}`, "");
    if (project.conflicts.length === 0) lines.push("无。", "");
    else {
      lines.push(
        "| key | 语言 | JSON 值 | Excel 值 | JSON 文件 | Excel 文件 / sheet / cell | 处理 |",
        "| --- | --- | --- | --- | --- | --- | --- |",
        ...project.conflicts.map(
          (item) =>
            `| ${cell(item.key)} | ${cell(item.locale)} | ${valueCell(item.jsonValue)} | ${valueCell(item.excelValue)} | ${cell(item.jsonPath)} | ${cell(`${item.excelPath} / ${item.sheet} / ${item.cell}`)} | ${item.resolution ? `${options.status === "applied" ? "采用" : "计划采用"} ${item.resolution}` : "阻断，未写入"} |`,
        ),
        "",
      );
    }
    lines.push(
      `保持不变：${project.unchangedCount}；${options.status === "applied" ? "写入文件" : "计划写入文件"}：${project.writePaths.map(cell).join("、") || "无"}。`,
      "",
    );
  }
  if (options.backups?.length)
    lines.push("## 数据备份", "", ...options.backups.map((path) => `- ${cell(path)}`), "");
  lines.push(
    "## 后续命令",
    "",
    "可根据上面的差异手工处理后重试；也可明确选择冲突优先方。`--force` 默认采用 Excel：",
    "",
    "```sh",
    options.retryCommand,
    `${options.forceCommand ?? options.retryCommand} --force --prefer excel`,
    `${options.forceCommand ?? options.retryCommand} --force --prefer json`,
    "```",
    "",
    "删除目标端独有 key 使用 `--prune`，它不会解决值冲突。清理必须显式指定 `--project`：",
    "",
    "```sh",
    `${options.pruneCommand ?? options.retryCommand} --prune --dry-run`,
    `${options.pruneCommand ?? options.retryCommand} --prune`,
    "```",
    "",
    "任何命令都可追加 `--dry-run` 查看计划：只更新报告，不修改 JSON/XLSX，也不创建数据备份。",
    "",
  );
  return lines.join("\n");
}

/** 生成人可复制的 PowerShell 命令参数；常见项目名和路径无需引号。 */
export function quoteArgument(value: string): string {
  return /^[\w./:\\-]+$/u.test(value) ? value : `'${value.replaceAll("'", "''")}'`;
}

function marker(command: MarkdownCommand): string {
  return `<!-- bubbles-i18n generated report: ${command} -->`;
}

function statusText(status: ReportStatus): string {
  if (status === "applied") return "状态：执行成功。下列变更已应用到目标文件。";
  if (status === "blocked")
    return "状态：值冲突阻断。所有选中项目的 JSON/XLSX 均未写入，新增与删除也未执行。";
  if (status === "failed") return "状态：执行失败。下列内容是执行计划，不代表全部已完成。";
  return "状态：预览。下列内容是执行计划，JSON/XLSX 均未修改。";
}

function cell(value: string): string {
  let escaped = JSON.stringify(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("|", "&#124;")
    .replaceAll("`", "&#96;");
  for (const character of ["\\", "*", "_", "[", "]", "~", "!"])
    escaped = escaped.replaceAll(character, `\\${character}`);
  return escaped;
}

function valueCell(value: string | null): string {
  return value === null ? "（缺失 / 空白）" : cell(value);
}

function appendDifferences(
  lines: string[],
  title: string,
  items: readonly ExcelDifference[],
): void {
  lines.push(`### ${title}：${items.length}`, "");
  if (!items.length) {
    lines.push("无。", "");
    return;
  }
  lines.push(
    "| key | 语言 | JSON 值 | Excel 值 | JSON 文件 | Excel 文件 / sheet / cell | 原因 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...items.map(
      (item) =>
        `| ${cell(item.key)} | ${cell(item.locale)} | ${valueCell(item.jsonValue)} | ${valueCell(item.excelValue)} | ${cell(item.jsonPath)} | ${cell(`${item.excelPath} / ${item.sheet} / ${item.cell}`)} | ${cell(reasonText(item.reason))} |`,
    ),
    "",
  );
}

function reasonText(reason: string): string {
  const descriptions: Record<string, string> = {
    "row-added": "新增 Excel 行",
    "json-value-missing": "JSON 中缺少此语言的 key",
    "excel-value-missing": "Excel 语言单元格为空，填入 JSON 值",
    "excel-only-key": "Excel 独有 key",
    "excel-only-value-preserved": "该 key 已存在于 JSON，仅此语言缺值，保留 Excel 译文",
    "json-only-key": "JSON 独有 key",
    "excel-blank-preserved": "Excel 单元格为空，保留 JSON 原值",
    "preferred-target-preserved": "按优先方保留目标端值",
  };
  return descriptions[reason] ?? reason;
}
