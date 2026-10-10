import { access, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { CellValue, Workbook } from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  applyExcel,
  ExcelApplyError,
  ExcelConcurrentModificationError,
  ExcelValidationError,
  planExcel,
} from "../src/excel.ts";
import type { ExcelOptions, ExcelProjectInput } from "../src/excel.ts";
import { useTemporaryDirectory } from "./temporary-directory.ts";

vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return { ...original, rename: vi.fn(original.rename) };
});

const originalFs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");

async function makeProject(
  directory: string,
  name: string,
  messages: Record<string, Record<string, string>>,
): Promise<ExcelProjectInput> {
  const catalogs: Record<string, string> = {};
  for (const [locale, values] of Object.entries(messages)) {
    catalogs[locale] = join(directory, `${name}-${locale}.json`);
    await writeFile(catalogs[locale], `${JSON.stringify(values, undefined, 2)}\n`, "utf8");
  }
  return {
    name,
    catalogs,
    excelPath: join(directory, `${name}.xlsx`),
    sheet: "translations",
    locales: Object.keys(messages),
  };
}

function options(projects: ExcelProjectInput[], changes: Partial<ExcelOptions> = {}): ExcelOptions {
  return {
    direction: "export",
    projects,
    force: false,
    prefer: "excel",
    prune: false,
    dryRun: false,
    ...changes,
  };
}

async function createWorkbook(): Promise<Workbook> {
  const { default: ExcelJS } = await import("exceljs");
  return new ExcelJS.Workbook();
}

async function writeWorkbook(
  project: ExcelProjectInput,
  rows: CellValue[][],
  headers: CellValue[] = ["key", ...Object.keys(project.catalogs)],
  customize?: (workbook: Workbook) => void,
): Promise<void> {
  const workbook = await createWorkbook();
  const worksheet = workbook.addWorksheet(project.sheet);
  worksheet.addRow(headers);
  worksheet.addRows(rows);
  customize?.(workbook);
  await workbook.xlsx.writeFile(project.excelPath);
}

async function readWorkbook(path: string): Promise<Workbook> {
  const workbook = await createWorkbook();
  await workbook.xlsx.readFile(path);
  return workbook;
}

async function readMessages(path: string): Promise<Record<string, string>> {
  return JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/u, ""));
}

describe("Excel synchronization", () => {
  const temporaryDirectory = useTemporaryDirectory();

  beforeEach(() => {
    vi.mocked(rename).mockImplementation(originalFs.rename);
  });

  it("creates a workbook using all locale headers and the complete key union", async () => {
    const input = await makeProject(temporaryDirectory.path, "web", {
      zh: { 登录: "登录", 仅中文: "只有中文" },
      en: { 登录: "Sign in", "English only": "English" },
    });
    input.locales = ["en"];
    const plan = await planExcel(options([input]));

    expect(plan.blocked).toBe(false);
    expect(plan.projects[0]!.additions.map((entry) => entry.key)).toEqual([
      "登录",
      "仅中文",
      "English only",
    ]);
    await expect(access(input.excelPath)).rejects.toMatchObject({ code: "ENOENT" });
    await applyExcel(plan);

    const worksheet = (await readWorkbook(input.excelPath)).getWorksheet("translations")!;
    expect(worksheet.getRow(1).values).toEqual([undefined, "key", "zh", "en"]);
    expect(worksheet.getCell("A2").value).toBe("登录");
    expect(worksheet.getCell("C2").value).toBe("Sign in");
    expect(worksheet.getCell("A3").value).toBe("仅中文");
    expect(worksheet.getCell("C3").value).toBeNull();
    expect(worksheet.getCell("A4").value).toBe("English only");
    expect(worksheet.getCell("B2").value).toBeNull();
    expect(plan.projects[0]!.backupPaths).toEqual([]);
  });

  it("merges by exact headers while preserving row order, notes, styles and other sheets", async () => {
    const input = await makeProject(temporaryDirectory.path, "web", {
      en: { second: "Second", first: "First", new: "New" },
      zh: { second: "第二", first: "第一", new: "新" },
    });
    await writeWorkbook(
      input,
      [
        ["first", "说明", "第一", "First"],
        ["second", "保留", "第二", null],
        ["excel-only", "用户备注", "外部", "External"],
      ],
      ["key", "备注", "zh", "en"],
      (workbook) => {
        workbook.getWorksheet(input.sheet)!.getCell("B2").font = {
          bold: true,
          color: { argb: "FF123456" },
        };
        workbook.addWorksheet("instructions").getCell("A1").value = "Keep this sheet";
      },
    );
    const original = await readFile(input.excelPath);
    const jsonBefore = await readFile(input.catalogs.en!, "utf8");
    const plan = await planExcel(options([input]));
    await applyExcel(plan);

    const workbook = await readWorkbook(input.excelPath);
    const worksheet = workbook.getWorksheet(input.sheet)!;
    expect([2, 3, 4, 5].map((index) => worksheet.getCell(index, 1).value)).toEqual([
      "first",
      "second",
      "excel-only",
      "new",
    ]);
    expect(worksheet.getCell("D3").value).toBe("Second");
    expect(worksheet.getCell("B2").value).toBe("说明");
    expect(worksheet.getCell("B2").font.bold).toBe(true);
    expect(workbook.getWorksheet("instructions")!.getCell("A1").value).toBe("Keep this sheet");
    expect(plan.projects[0]!.extras.map((entry) => entry.key)).toEqual([
      "excel-only",
      "excel-only",
    ]);
    expect(await readFile(input.catalogs.en!, "utf8")).toBe(jsonBefore);
    expect(plan.projects[0]!.backupPaths).toHaveLength(1);
    expect(await readFile(plan.projects[0]!.backupPaths[0]!)).toEqual(original);
  });

  it("reports conflicts and blocks writes for every selected project", async () => {
    const first = await makeProject(temporaryDirectory.path, "first", { en: { new: "New" } });
    const second = await makeProject(temporaryDirectory.path, "second", { en: { save: "Save" } });
    await writeWorkbook(second, [["save", "Store"]]);
    const original = await readFile(second.excelPath);
    const plan = await planExcel(options([first, second]));

    expect(plan.blocked).toBe(true);
    expect(plan.projects).toHaveLength(2);
    expect(plan.conflicts).toEqual([
      expect.objectContaining({
        project: "second",
        key: "save",
        locale: "en",
        jsonPath: second.catalogs.en,
        excelPath: second.excelPath,
        sheet: "translations",
        cell: "B2",
        jsonValue: "Save",
        excelValue: "Store",
        resolution: null,
      }),
    ]);
    await applyExcel(plan);
    await expect(access(first.excelPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(second.excelPath)).toEqual(original);
    expect(plan.projects.flatMap((project) => project.backupPaths)).toEqual([]);
  });

  it("force with Excel preference preserves conflicting Excel cells and still exports new keys", async () => {
    const input = await makeProject(temporaryDirectory.path, "web", {
      en: { save: "Save", new: "New" },
    });
    await writeWorkbook(input, [["save", "Store"]]);
    const originalJson = await readFile(input.catalogs.en!);
    const plan = await planExcel(options([input], { force: true }));
    await applyExcel(plan);

    const worksheet = (await readWorkbook(input.excelPath)).getWorksheet(input.sheet)!;
    expect(worksheet.getCell("B2").value).toBe("Store");
    expect(worksheet.getCell("B3").value).toBe("New");
    expect(plan.conflicts[0]!.resolution).toBe("excel");
    expect(plan.projects[0]!.skipped[0]!.reason).toBe("preferred-target-preserved");
    expect(await readFile(input.catalogs.en!)).toEqual(originalJson);
  });

  it("force with JSON preference writes only the export target", async () => {
    const input = await makeProject(temporaryDirectory.path, "web", { en: { save: "Save" } });
    await writeWorkbook(input, [["save", "Store"]]);
    const originalJson = await readFile(input.catalogs.en!);
    const plan = await planExcel(options([input], { force: true, prefer: "json" }));
    await applyExcel(plan);

    expect(
      (await readWorkbook(input.excelPath)).getWorksheet(input.sheet)!.getCell("B2").value,
    ).toBe("Save");
    expect(plan.conflicts[0]!.resolution).toBe("json");
    expect(await readFile(input.catalogs.en!)).toEqual(originalJson);
  });

  it("blocks ordinary import differences without touching JSON or Excel", async () => {
    const input = await makeProject(temporaryDirectory.path, "web", { en: { save: "Save" } });
    await writeWorkbook(input, [
      ["save", "Store"],
      ["new", "New"],
    ]);
    const jsonBefore = await readFile(input.catalogs.en!);
    const excelBefore = await readFile(input.excelPath);
    const plan = await planExcel(options([input], { direction: "import" }));
    await applyExcel(plan);

    expect(plan.blocked).toBe(true);
    expect(await readFile(input.catalogs.en!)).toEqual(jsonBefore);
    expect(await readFile(input.excelPath)).toEqual(excelBefore);
  });

  it("imports preferred Excel values and preserves BOM, EOL, indentation and final newline", async () => {
    const input = await makeProject(temporaryDirectory.path, "web", { en: {} });
    const original = '\uFEFF{\r\n    "save": "Save",\r\n    "empty": ""\r\n}\r\n';
    await writeFile(input.catalogs.en!, original, "utf8");
    await writeWorkbook(input, [
      ["save", "Store"],
      ["__proto__", "Own property"],
      ["empty", null],
    ]);
    const excelBefore = await readFile(input.excelPath);
    const plan = await planExcel(options([input], { direction: "import", force: true }));
    await applyExcel(plan);

    const source = await readFile(input.catalogs.en!, "utf8");
    expect(source).toBe(
      '\uFEFF{\r\n    "save": "Store",\r\n    "empty": "",\r\n    "__proto__": "Own property"\r\n}\r\n',
    );
    expect(
      Object.prototype.hasOwnProperty.call(await readMessages(input.catalogs.en!), "__proto__"),
    ).toBe(true);
    expect(await readFile(input.excelPath)).toEqual(excelBefore);
    expect(plan.projects[0]!.backupPaths).toHaveLength(1);
    expect(await readFile(plan.projects[0]!.backupPaths[0]!, "utf8")).toBe(original);
  });

  it("imports additions while retaining conflicting JSON when JSON is preferred", async () => {
    const input = await makeProject(temporaryDirectory.path, "web", { en: { save: "Save" } });
    await writeWorkbook(input, [
      ["save", "Store"],
      ["new", "New"],
    ]);
    const excelBefore = await readFile(input.excelPath);
    const plan = await planExcel(
      options([input], { direction: "import", force: true, prefer: "json" }),
    );
    await applyExcel(plan);

    expect(await readMessages(input.catalogs.en!)).toEqual({ save: "Save", new: "New" });
    expect(await readFile(input.excelPath)).toEqual(excelBefore);
    expect(plan.conflicts[0]!.resolution).toBe("json");
  });

  it("preserves blank cells and does not create missing catalogs for blanks", async () => {
    const input = await makeProject(temporaryDirectory.path, "web", {
      en: { existing: "Keep", empty: "" },
      zh: {},
    });
    await unlink(input.catalogs.zh!);
    await writeWorkbook(input, [
      ["existing", null, null],
      ["empty", "", ""],
      ["new", null, null],
    ]);
    const before = await readFile(input.catalogs.en!);
    const plan = await planExcel(options([input], { direction: "import", force: true }));
    await applyExcel(plan);

    expect(plan.conflicts).toEqual([]);
    expect(plan.projects[0]!.writePaths).toEqual([]);
    expect(plan.projects[0]!.skipped).toHaveLength(6);
    expect(await readFile(input.catalogs.en!)).toEqual(before);
    await expect(access(input.catalogs.zh!)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("import prune removes absent rows only in selected locales and ignores unselected JSON", async () => {
    const input = await makeProject(temporaryDirectory.path, "web", {
      en: { keep: "Keep", stale: "Old" },
      zh: {},
    });
    input.locales = ["en"];
    await writeFile(input.catalogs.zh!, "invalid JSON", "utf8");
    await writeWorkbook(input, [["keep", null]], ["key", "en"]);
    const excelBefore = await readFile(input.excelPath);
    const plan = await planExcel(options([input], { direction: "import", prune: true }));
    await applyExcel(plan);

    expect(await readMessages(input.catalogs.en!)).toEqual({ keep: "Keep" });
    expect(await readFile(input.catalogs.zh!, "utf8")).toBe("invalid JSON");
    expect(await readFile(input.excelPath)).toEqual(excelBefore);
    expect(plan.projects[0]!.deletions).toEqual([
      expect.objectContaining({ key: "stale", locale: "en", cell: "" }),
    ]);
  });

  it("export prune protects keys from unselected locales", async () => {
    const input = await makeProject(temporaryDirectory.path, "web", {
      en: { shared: "Shared" },
      zh: { "zh-only": "中文" },
    });
    input.locales = ["en"];
    await writeWorkbook(
      input,
      [
        ["shared", "Shared"],
        ["zh-only", null],
        ["stale", "Old"],
      ],
      ["key", "en"],
    );
    const plan = await planExcel(options([input], { prune: true }));
    await applyExcel(plan);

    const worksheet = (await readWorkbook(input.excelPath)).getWorksheet(input.sheet)!;
    expect(worksheet.getCell("A2").value).toBe("shared");
    expect(worksheet.getCell("A3").value).toBe("zh-only");
    expect(worksheet.getCell("A4").value).toBeNull();
    expect(plan.projects[0]!.deletions.map((entry) => entry.key)).toEqual(["stale"]);
  });

  it.each(["export", "import"] as const)(
    "rejects an empty %s source before pruning even in dry run",
    async (direction) => {
      const input = await makeProject(temporaryDirectory.path, "web", {
        en: direction === "export" ? {} : { existing: "Keep" },
      });
      await writeWorkbook(input, direction === "export" ? [["existing", "Keep"]] : []);
      const jsonBefore = await readFile(input.catalogs.en!);
      const excelBefore = await readFile(input.excelPath);

      await expect(
        planExcel(options([input], { direction, prune: true, dryRun: true })),
      ).rejects.toThrow(/Refusing to prune/u);
      expect(await readFile(input.catalogs.en!)).toEqual(jsonBefore);
      expect(await readFile(input.excelPath)).toEqual(excelBefore);
    },
  );

  it("reports a dry run without creating workbooks or backups", async () => {
    const input = await makeProject(temporaryDirectory.path, "web", { en: { new: "New" } });
    const plan = await planExcel(options([input], { dryRun: true }));
    await applyExcel(plan);

    expect(plan.projects[0]!.additions).toHaveLength(1);
    expect(plan.projects[0]!.backupPaths).toEqual([]);
    await expect(access(input.excelPath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      access(join(temporaryDirectory.path, ".bubbles-i18n-backups")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("preserves exact strings and formula-like text through an unchanged round trip", async () => {
    const values = Object.fromEntries([
      [" 文案 ", " 翻译 \n😀 {name} ' \" ` \t\r\n"],
      ["formula", "=SUM(A1:A2)"],
      ["plus", "+text"],
      ["minus", "-text"],
      ["at", "@text"],
      ["__proto__", "Prototype text"],
      ["empty", ""],
      ["\rKey_x0041_", "_x005F_x000D_\r\n_x0041_x0042_"],
    ]);
    const input = await makeProject(temporaryDirectory.path, "web", { en: values });
    const original = await readFile(input.catalogs.en!);
    await applyExcel(await planExcel(options([input])));
    const worksheet = (await readWorkbook(input.excelPath)).getWorksheet(input.sheet)!;
    expect(worksheet.getCell("B3").value).toBe("=SUM(A1:A2)");
    expect(worksheet.getCell("B2").value).toBe(values[" 文案 "]);
    const excelBefore = await readFile(input.excelPath);
    const second = await planExcel(options([input]));
    await applyExcel(second);
    expect(second.projects[0]!.writePaths).toEqual([]);
    expect(await readFile(input.excelPath)).toEqual(excelBefore);
    await applyExcel(await planExcel(options([input], { direction: "import" })));
    expect(await readFile(input.catalogs.en!)).toEqual(original);
  });

  it("preserves CR and literal OOXML escapes in untouched cells across every sheet", async () => {
    const input = await makeProject(temporaryDirectory.path, "web", {
      en: { existing: "Value", new: "New" },
      zh: {},
    });
    input.locales = ["en"];
    await writeWorkbook(
      input,
      [["existing", "Value", "未选_x000D_语言", "Note_x000D_\n_x005F_x000D_"]],
      ["key", "en", "zh", "notes_x005F_x0041_"],
      (workbook) => {
        workbook.addWorksheet("other").getCell("A1").value = "_x005F_x005F_x005F_x000D_";
        workbook.getWorksheet("other")!.mergeCells("A1:B1");
      },
    );
    const before = await readWorkbook(input.excelPath);
    expect(before.getWorksheet(input.sheet)!.getCell("C2").value).toBe("未选\r语言");
    await applyExcel(await planExcel(options([input])));

    const after = await readWorkbook(input.excelPath);
    expect(after.getWorksheet(input.sheet)!.getCell("C2").value).toBe("未选\r语言");
    expect(after.getWorksheet(input.sheet)!.getCell("D2").value).toBe("Note\r\n_x000D_");
    expect(after.getWorksheet(input.sheet)!.getCell("D1").value).toBe("notes_x0041_");
    expect(after.getWorksheet("other")!.getCell("A1").value).toBe("_x005F_x000D_");
    expect(after.getWorksheet("other")!.getCell("B1").value).toBe("_x005F_x000D_");
  });

  it("preserves harmless complex values in unselected locales, notes and other sheets", async () => {
    const input = await makeProject(temporaryDirectory.path, "web", {
      en: { existing: "Value", new: "New" },
      zh: {},
    });
    input.locales = ["en"];
    await writeWorkbook(
      input,
      [
        [
          "existing",
          "Value",
          { richText: [{ text: "未选语言", font: { bold: true } }] },
          { text: "Help", hyperlink: "https://example.com" },
        ],
      ],
      ["key", "en", "zh", "notes"],
      (workbook) => {
        const other = workbook.addWorksheet("other");
        other.addRow([
          new Date("2026-01-01T12:34:56.789Z"),
          42,
          true,
          { formula: "1+1", result: 2 },
          { formula: '"Result"', result: "Result" },
          { formula: '"Result"', result: "_x000D_" },
          { formula: '"Result"', result: "_x005F_x0041_" },
          { richText: [{ text: "Rich", font: { italic: true } }, { text: " text" }] },
          { text: "Link", hyperlink: "https://example.com" },
        ]);
      },
    );
    const before = await readWorkbook(input.excelPath);
    const expectedLocale = structuredClone(before.getWorksheet(input.sheet)!.getCell("C2").value);
    const expectedNote = structuredClone(before.getWorksheet(input.sheet)!.getCell("D2").value);
    const expectedOther = structuredClone(before.getWorksheet("other")!.getRow(1).values);
    await applyExcel(await planExcel(options([input])));

    const after = await readWorkbook(input.excelPath);
    expect(after.getWorksheet(input.sheet)!.getCell("C2").value).toEqual(expectedLocale);
    expect(after.getWorksheet(input.sheet)!.getCell("D2").value).toEqual(expectedNote);
    expect(after.getWorksheet("other")!.getRow(1).values).toEqual(expectedOther);
    expect(after.getWorksheet(input.sheet)!.getCell("A3").value).toBe("new");
  });

  it.each([
    { label: "rich text CR", kind: "richText", text: "_x000D_", location: "locale" },
    {
      label: "rich text literal escape",
      kind: "richText",
      text: "_x005F_x0041_",
      location: "other",
    },
    { label: "hyperlink CR", kind: "hyperlink", text: "_x000D_", location: "note" },
    {
      label: "hyperlink literal escape",
      kind: "hyperlink",
      text: "_x005F_x0041_",
      location: "other",
    },
  ] as const)("rejects changed $label before writing", async ({ kind, text, location }) => {
    const input = await makeProject(temporaryDirectory.path, "web", {
      en: { existing: "Value", new: "New" },
      zh: {},
    });
    input.locales = ["en"];
    const value: CellValue =
      kind === "richText" ? { richText: [{ text }] } : { text, hyperlink: "https://example.com" };
    await writeWorkbook(
      input,
      [["existing", "Value", null, null]],
      ["key", "en", "zh", "notes"],
      (workbook) => {
        const worksheet =
          location === "other"
            ? workbook.addWorksheet("other")
            : workbook.getWorksheet(input.sheet)!;
        const address = location === "other" ? "A1" : location === "locale" ? "C2" : "D2";
        worksheet.getCell(address).value = value;
      },
    );
    const excelBefore = await readFile(input.excelPath);
    const jsonBefore = await readFile(input.catalogs.en!);

    await expect(planExcel(options([input], { force: true, prefer: "json" }))).rejects.toThrow(
      /Excel cell value changed during serialization/u,
    );
    expect(await readFile(input.excelPath)).toEqual(excelBefore);
    expect(await readFile(input.catalogs.en!)).toEqual(jsonBefore);
    await expect(
      access(join(temporaryDirectory.path, ".bubbles-i18n-backups")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each([0x00, 0x08, 0x0b, 0x0c, 0x0e, 0x1f, 0xfffe, 0xffff, 0xd800, 0xdc00])(
    "rejects unsupported text character %i before writing even with force",
    async (code) => {
      const input = await makeProject(temporaryDirectory.path, "web", {
        en: { key: `before${String.fromCharCode(code)}after` },
      });
      await expect(planExcel(options([input], { force: true }))).rejects.toThrow(
        /Unsupported Excel text character/u,
      );
      await expect(access(input.excelPath)).rejects.toMatchObject({ code: "ENOENT" });
    },
  );

  it("accepts an Excel cell at the supported text length limit", async () => {
    const value = "x".repeat(32_767);
    const input = await makeProject(temporaryDirectory.path, "web", { en: { key: value } });
    await applyExcel(await planExcel(options([input])));
    expect(
      (await readWorkbook(input.excelPath)).getWorksheet(input.sheet)!.getCell("B2").value,
    ).toBe(value);
  });

  it("reports locale-only Excel values as skipped and keeps them during prune", async () => {
    const input = await makeProject(temporaryDirectory.path, "web", {
      en: {},
      zh: { key: "中文" },
    });
    input.locales = ["en"];
    await writeWorkbook(input, [["key", "Excel translation"]]);
    const original = await readFile(input.excelPath);
    const plan = await planExcel(options([input], { prune: true }));
    await applyExcel(plan);

    expect(plan.conflicts).toEqual([]);
    expect(plan.projects[0]!.extras).toEqual([]);
    expect(plan.projects[0]!.deletions).toEqual([]);
    expect(plan.projects[0]!.skipped[0]!.reason).toBe("excel-only-value-preserved");
    expect(await readFile(input.excelPath)).toEqual(original);
  });

  it("treats an empty JSON string and nonblank Excel string as different current values", async () => {
    const input = await makeProject(temporaryDirectory.path, "web", { en: { key: "" } });
    await writeWorkbook(input, [["key", "Excel value"]]);
    const plan = await planExcel(options([input]));
    expect(plan.blocked).toBe(true);
    expect(plan.conflicts[0]!.jsonValue).toBe("");
  });

  it("refuses changed JSON inputs after planning", async () => {
    const input = await makeProject(temporaryDirectory.path, "web", { en: { key: "Value" } });
    const plan = await planExcel(options([input]));
    await writeFile(input.catalogs.en!, '{"key":"Changed"}', "utf8");
    await expect(applyExcel(plan)).rejects.toBeInstanceOf(ExcelConcurrentModificationError);
    await expect(access(input.excelPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("refuses changed Excel inputs after import planning", async () => {
    const input = await makeProject(temporaryDirectory.path, "web", { en: {} });
    await writeWorkbook(input, [["new", "New"]]);
    const jsonBefore = await readFile(input.catalogs.en!);
    const plan = await planExcel(options([input], { direction: "import" }));
    await writeWorkbook(input, [["new", "Changed"]]);
    await expect(applyExcel(plan)).rejects.toBeInstanceOf(ExcelConcurrentModificationError);
    expect(await readFile(input.catalogs.en!)).toEqual(jsonBefore);
  });

  it.each([
    {
      label: "duplicate keys",
      headers: ["key", "en"],
      rows: [
        ["key", "Value"],
        ["key", "Other"],
      ],
    },
    { label: "blank key with content", headers: ["key", "en"], rows: [[null, "Value"]] },
    { label: "numeric key", headers: ["key", "en"], rows: [[123, "Value"]] },
    { label: "duplicate headers", headers: ["key", "en", "en"], rows: [] },
    { label: "missing selected header", headers: ["key", "zh"], rows: [] },
    { label: "wrong key header", headers: ["Key", "en"], rows: [] },
    { label: "number translation", headers: ["key", "en"], rows: [["key", 123]] },
    { label: "boolean translation", headers: ["key", "en"], rows: [["key", true]] },
    { label: "date translation", headers: ["key", "en"], rows: [["key", new Date("2026-01-01")]] },
    {
      label: "formula translation",
      headers: ["key", "en"],
      rows: [["key", { formula: "1+1", result: 2 }]],
    },
    {
      label: "hyperlink translation",
      headers: ["key", "en"],
      rows: [["key", { text: "Link", hyperlink: "https://example.com" }]],
    },
    {
      label: "rich text translation",
      headers: ["key", "en"],
      rows: [["key", { richText: [{ text: "Rich" }] }]],
    },
  ] satisfies { label: string; headers: CellValue[]; rows: CellValue[][] }[])(
    "rejects $label even with force",
    async ({ headers, rows }) => {
      const input = await makeProject(temporaryDirectory.path, "web", { en: {} });
      await writeWorkbook(input, rows, headers);
      const original = await readFile(input.excelPath);

      await expect(
        planExcel(options([input], { direction: "import", force: true })),
      ).rejects.toBeInstanceOf(ExcelValidationError);
      expect(await readFile(input.excelPath)).toEqual(original);
    },
  );

  it("refuses missing import workbooks, missing sheets and malformed xlsx files", async () => {
    const input = await makeProject(temporaryDirectory.path, "web", { en: {} });
    await expect(planExcel(options([input], { direction: "import" }))).rejects.toThrow(
      /does not exist/u,
    );
    await writeWorkbook(input, []);
    input.sheet = "absent";
    await expect(planExcel(options([input]))).rejects.toThrow(/missing sheet/u);
    await writeFile(input.excelPath, "not an xlsx file", "utf8");
    await expect(planExcel(options([input]))).rejects.toThrow(/Cannot read Excel/u);
  });

  it.each([
    { label: "key and translation", range: "A2:B2" },
    { label: "translations across rows", range: "B2:B3" },
    { label: "translations across locales", range: "B2:C2" },
    { label: "keys across rows", range: "A2:A3" },
    { label: "key header", range: "A1:B1" },
    { label: "selected locale header", range: "B1:C1" },
  ])("rejects merged $label for both directions even with force", async ({ range }) => {
    const input = await makeProject(temporaryDirectory.path, "web", {
      en: { first: "First", second: "Second" },
      zh: { first: "第一", second: "第二" },
    });
    await writeWorkbook(
      input,
      [
        ["first", null, null],
        ["second", null, null],
      ],
      undefined,
      (workbook) => {
        workbook.getWorksheet(input.sheet)!.mergeCells(range);
      },
    );
    const excelBefore = await readFile(input.excelPath);
    const jsonBefore = await readFile(input.catalogs.en!);
    for (const direction of ["export", "import"] as const) {
      await expect(
        planExcel(options([input], { direction, force: true, prefer: "json" })),
      ).rejects.toThrow(/Merged .* cell at translations!/u);
    }
    expect(await readFile(input.excelPath)).toEqual(excelBefore);
    expect(await readFile(input.catalogs.en!)).toEqual(jsonBefore);
  });

  it("rejects merged selected translation cells even in otherwise blank rows", async () => {
    const input = await makeProject(temporaryDirectory.path, "web", { en: { new: "New" } });
    await writeWorkbook(
      input,
      [
        [null, null],
        [null, null],
      ],
      undefined,
      (workbook) => {
        workbook.getWorksheet(input.sheet)!.mergeCells("B2:B3");
      },
    );
    await expect(planExcel(options([input], { force: true }))).rejects.toThrow(
      /Merged translation/u,
    );
  });

  it("validates every selected project before any write occurs", async () => {
    const first = await makeProject(temporaryDirectory.path, "first", { en: { new: "New" } });
    const second = await makeProject(temporaryDirectory.path, "second", { en: {} });
    await writeWorkbook(second, [["key", 42]]);
    await expect(planExcel(options([first, second]))).rejects.toBeInstanceOf(ExcelValidationError);
    await expect(access(first.excelPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects oversized Excel text and shared workbook paths", async () => {
    const first = await makeProject(temporaryDirectory.path, "first", {
      en: { key: "x".repeat(32_768) },
    });
    await expect(planExcel(options([first]))).rejects.toThrow(/32,767/u);
    const second = await makeProject(temporaryDirectory.path, "second", { en: {} });
    second.excelPath = first.excelPath;
    await expect(planExcel(options([first, second]))).rejects.toThrow(/distinct files/u);
  });

  it("rolls back a committed catalog if a later target cannot be replaced", async () => {
    const input = await makeProject(temporaryDirectory.path, "web", {
      en: { keep: "Keep" },
      zh: { 保留: "保留" },
    });
    await writeWorkbook(input, [["new", "New", "新增"]]);
    const enBefore = await readFile(input.catalogs.en!);
    const zhBefore = await readFile(input.catalogs.zh!);
    const plan = await planExcel(options([input], { direction: "import" }));
    vi.mocked(rename).mockImplementation(async (source, target) => {
      if (target === input.catalogs.zh && String(source).endsWith(".tmp"))
        throw new Error("Simulated target lock");
      return originalFs.rename(source, target);
    });

    await expect(applyExcel(plan)).rejects.toMatchObject({
      name: "ExcelApplyError",
      committedPaths: [input.catalogs.en],
      rolledBackPaths: [input.catalogs.en],
      rollbackFailedPaths: [],
    });
    expect(await readFile(input.catalogs.en!)).toEqual(enBefore);
    expect(await readFile(input.catalogs.zh!)).toEqual(zhBefore);
    expect(plan.projects[0]!.backupPaths).toHaveLength(2);
    expect(await readFile(plan.projects[0]!.backupPaths[0]!)).toEqual(enBefore);
  });

  it("removes a newly created target during rollback", async () => {
    const input = await makeProject(temporaryDirectory.path, "web", { en: {}, zh: {} });
    await unlink(input.catalogs.en!);
    await writeWorkbook(input, [["new", "New", "新增"]]);
    const plan = await planExcel(options([input], { direction: "import" }));
    vi.mocked(rename).mockImplementation(async (source, target) => {
      if (target === input.catalogs.zh && String(source).endsWith(".tmp"))
        throw new Error("Simulated target lock");
      return originalFs.rename(source, target);
    });

    await expect(applyExcel(plan)).rejects.toBeInstanceOf(ExcelApplyError);
    await expect(access(input.catalogs.en!)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readMessages(input.catalogs.zh!)).toEqual({});
  });

  it("retains usable backups and reports files that could not be rolled back", async () => {
    const input = await makeProject(temporaryDirectory.path, "web", { en: {}, zh: {} });
    await writeWorkbook(input, [["new", "New", "新增"]]);
    const plan = await planExcel(options([input], { direction: "import" }));
    vi.mocked(rename).mockImplementation(async (source, target) => {
      if (
        (target === input.catalogs.zh && String(source).endsWith(".tmp")) ||
        (target === input.catalogs.en && String(source).endsWith(".rollback"))
      ) {
        throw new Error("Simulated replacement failure");
      }
      return originalFs.rename(source, target);
    });

    await expect(applyExcel(plan)).rejects.toMatchObject({
      name: "ExcelApplyError",
      committedPaths: [input.catalogs.en],
      rolledBackPaths: [],
      rollbackFailedPaths: [input.catalogs.en],
      backupPaths: expect.arrayContaining(plan.projects[0]!.backupPaths),
    });
    expect(await readMessages(plan.projects[0]!.backupPaths[0]!)).toEqual({});
    expect(await readMessages(input.catalogs.en!)).toEqual({ new: "New" });
  });
});
