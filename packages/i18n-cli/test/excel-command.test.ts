import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import ExcelJS from "exceljs";
import { describe, expect, it } from "vite-plus/test";

import { main, runCli } from "../src/command.ts";
import type { I18nProjectConfig } from "../src/config.ts";
import { useTemporaryDirectory } from "./temporary-directory.ts";

describe("Excel CLI commands", () => {
  const temporaryDirectory = useTemporaryDirectory();

  it("exports the JSON key union without rewriting source catalogs", async () => {
    const root = temporaryDirectory.path;
    await writeConfig(root, {
      web: {
        catalogs: { en: "en.json", fr: "fr.json" },
        excel: { file: "translations/web.xlsx" },
      },
    });
    await writeJson(root, "en.json", { shared: "Hello", englishOnly: "English" });
    await writeJson(root, "fr.json", { shared: "Bonjour", frenchOnly: "Français" });
    const sources = await readFiles(root, ["en.json", "fr.json"]);

    expect(await runCli(["excel", "export"], { cwd: root, stdout: () => undefined })).toBe(0);

    const table = await readTable(join(root, "translations/web.xlsx"));
    expect(table.headers).toEqual(["key", "en", "fr"]);
    expect(table.values).toEqual({
      shared: { en: "Hello", fr: "Bonjour" },
      englishOnly: { en: "English", fr: null },
      frenchOnly: { en: null, fr: "Français" },
    });
    expect(await readFiles(root, ["en.json", "fr.json"])).toEqual(sources);
  });

  it("imports an Excel-only project into missing JSON using its configured sheet", async () => {
    const root = temporaryDirectory.path;
    await writeConfig(root, {
      web: {
        catalogs: { en: "locales/en.json" },
        excel: { file: "web.xlsx", sheet: "译文" },
      },
    });
    await writeWorkbook(
      root,
      "web.xlsx",
      [
        ["key", "en"],
        ["greeting", "Hello"],
      ],
      "译文",
    );
    const source = await readFile(join(root, "web.xlsx"));

    expect(await main(["excel", "import"], { cwd: root, stdout: () => undefined })).toBe(0);

    expect(await readJson(root, "locales/en.json")).toEqual({ greeting: "Hello" });
    expect(await readFile(join(root, "web.xlsx"))).toEqual(source);
    const errors: string[] = [];
    expect(
      await main(["sync"], {
        cwd: root,
        stdout: () => undefined,
        stderr: (message) => errors.push(message),
      }),
    ).toBe(2);
    expect(errors.join("\n")).toContain("requires include");
    expect(await readJson(root, "locales/en.json")).toEqual({ greeting: "Hello" });
  });

  it.each(["export", "import"] as const)(
    "%s blocks every selected project when a later project conflicts, including additions and prune",
    async (direction) => {
      const root = temporaryDirectory.path;
      await writeConfig(root, { first: project("first"), second: project("second") });
      await writeJson(
        root,
        "first.json",
        direction === "export"
          ? { shared: "Same", added: "New" }
          : { shared: "Same", extra: "Preserve" },
      );
      await writeJson(root, "second.json", { conflict: "JSON value" });
      await writeWorkbook(
        root,
        "first.xlsx",
        direction === "export"
          ? [
              ["key", "en"],
              ["shared", "Same"],
              ["extra", "Preserve"],
            ]
          : [
              ["key", "en"],
              ["shared", "Same"],
              ["added", "New"],
            ],
      );
      await writeWorkbook(root, "second.xlsx", [
        ["key", "en"],
        ["conflict", "Excel value"],
      ]);
      const files = ["first.json", "second.json", "first.xlsx", "second.xlsx"];
      const originals = await readFiles(root, files);
      const output: string[] = [];

      expect(
        await main(["excel", direction, "--project", "first", "--project", "second", "--prune"], {
          cwd: root,
          stdout: (message) => output.push(message),
        }),
      ).toBe(1);

      expect(await readFiles(root, files)).toEqual(originals);
      expect(await backupFiles(root)).toEqual([]);
      const report = await readFile(reportPath(root, direction), "utf8");
      expect(report).toContain("值冲突阻断");
      expect(report).toContain("新增与删除也未执行");
      expect(report).toContain('"added"');
      expect(report).toContain('"extra"');
      expect(report).toContain("JSON value");
      expect(report).toContain("Excel value");
      expect(output.join("\n")).toContain("所有选中项目数据均未写入");
    },
  );

  it.each([
    { direction: "export", preference: undefined, expected: "Excel value" },
    { direction: "export", preference: "json", expected: "JSON value" },
    { direction: "import", preference: undefined, expected: "Excel value" },
    { direction: "import", preference: "json", expected: "JSON value" },
  ] as const)(
    "$direction force with preference $preference writes only the target",
    async ({ direction, preference, expected }) => {
      const root = temporaryDirectory.path;
      await writeConfig(root, { web: project("web") });
      await writeJson(
        root,
        "web.json",
        direction === "export"
          ? { conflict: "JSON value", added: "Added" }
          : { conflict: "JSON value", extra: "Preserve extra" },
      );
      await writeWorkbook(
        root,
        "web.xlsx",
        direction === "export"
          ? [
              ["key", "en"],
              ["conflict", "Excel value"],
              ["extra", "Preserve extra"],
            ]
          : [
              ["key", "en"],
              ["conflict", "Excel value"],
              ["added", "Added"],
            ],
      );
      const sourceName = direction === "export" ? "web.json" : "web.xlsx";
      const targetName = direction === "export" ? "web.xlsx" : "web.json";
      const source = await readFile(join(root, sourceName));
      const target = await readFile(join(root, targetName));
      const flags = preference === undefined ? ["-f"] : ["--force", "--prefer", preference];

      expect(
        await runCli(["excel", direction, ...flags], { cwd: root, stdout: () => undefined }),
      ).toBe(0);

      expect(await readFile(join(root, sourceName))).toEqual(source);
      if (direction === "export") {
        expect((await readTable(join(root, targetName))).values).toEqual({
          conflict: { en: expected },
          extra: { en: "Preserve extra" },
          added: { en: "Added" },
        });
      } else {
        expect(await readJson(root, targetName)).toEqual({
          conflict: expected,
          extra: "Preserve extra",
          added: "Added",
        });
      }
      const backups = await backupFiles(root);
      expect(backups).toHaveLength(1);
      expect(backups[0]).toContain(targetName);
      expect(await readFile(join(root, backups[0]!))).toEqual(target);
      expect(await readFile(reportPath(root, direction), "utf8")).toContain("数据备份");
    },
  );

  it.each([
    { direction: "export", existingTarget: false },
    { direction: "export", existingTarget: true },
    { direction: "import", existingTarget: false },
    { direction: "import", existingTarget: true },
  ] as const)(
    "$direction dry-run preserves data and creates no backups, existing target $existingTarget",
    async ({ direction, existingTarget }) => {
      const root = temporaryDirectory.path;
      await writeConfig(root, { web: project("web") });
      const targetName = direction === "export" ? "web.xlsx" : "web.json";
      const sourceName = direction === "export" ? "web.json" : "web.xlsx";
      if (direction === "export") {
        await writeJson(root, "web.json", { added: "New" });
        if (existingTarget)
          await writeWorkbook(root, "web.xlsx", [
            ["key", "en"],
            ["old", "Old"],
          ]);
      } else {
        await writeWorkbook(root, "web.xlsx", [
          ["key", "en"],
          ["added", "New"],
        ]);
        if (existingTarget) await writeJson(root, "web.json", { old: "Old" });
      }
      const source = await readFile(join(root, sourceName));
      const target = existingTarget ? await readFile(join(root, targetName)) : null;

      expect(
        await main(["excel", direction, "--dry-run"], { cwd: root, stdout: () => undefined }),
      ).toBe(0);

      expect(await readFile(join(root, sourceName))).toEqual(source);
      if (target === null)
        await expect(access(join(root, targetName))).rejects.toMatchObject({ code: "ENOENT" });
      else expect(await readFile(join(root, targetName))).toEqual(target);
      expect(await backupFiles(root)).toEqual([]);
      expect(await readFile(reportPath(root, direction), "utf8")).toContain("状态：预览");
    },
  );

  it.each(["export", "import"] as const)(
    "%s preserves target-only keys until explicit prune",
    async (direction) => {
      const root = temporaryDirectory.path;
      await writeConfig(root, { web: project("web") });
      await writeJson(
        root,
        "web.json",
        direction === "export" ? { used: "Same" } : { used: "Same", extra: "Extra" },
      );
      await writeWorkbook(
        root,
        "web.xlsx",
        direction === "export"
          ? [
              ["key", "en"],
              ["used", "Same"],
              ["extra", "Extra"],
            ]
          : [
              ["key", "en"],
              ["used", "Same"],
            ],
      );
      const output: string[] = [];

      expect(
        await runCli(["excel", direction], {
          cwd: root,
          stdout: (message) => output.push(message),
        }),
      ).toBe(0);
      const report = await readFile(reportPath(root, direction), "utf8");
      expect(report).toContain("目标端独有 key");
      expect(report).toContain('"extra"');
      expect(output.join("\n")).toContain('保留目标端独有 key: "extra"');
      expect(
        direction === "export"
          ? (await readTable(join(root, "web.xlsx"))).values.extra
          : (await readJson(root, "web.json")).extra,
      ).toBeDefined();

      expect(
        await runCli(["excel", direction, "--project", "web", "--prune"], {
          cwd: root,
          stdout: () => undefined,
        }),
      ).toBe(0);
      expect(
        direction === "export"
          ? (await readTable(join(root, "web.xlsx"))).values.extra
          : (await readJson(root, "web.json")).extra,
      ).toBeUndefined();
      expect(await readFile(reportPath(root, direction), "utf8")).toContain("已删除项");
    },
  );

  it("exports one locale while preserving rows present only in an unselected locale", async () => {
    const root = temporaryDirectory.path;
    await writeConfig(root, {
      web: { catalogs: { en: "en.json", fr: "fr.json" }, excel: { file: "web.xlsx" } },
    });
    await writeJson(root, "en.json", { englishOnly: "English" });
    await writeJson(root, "fr.json", { frenchOnly: "Français" });
    await writeWorkbook(root, "web.xlsx", [
      ["key", "en", "fr"],
      ["englishOnly", null, "Retain French cell"],
      ["frenchOnly", "Retain English cell", "Français"],
      ["obsolete", "Old", "Ancien"],
    ]);
    const french = await readFile(join(root, "fr.json"));

    expect(
      await runCli(["excel", "export", "--project", "web", "--locale", "en", "--prune"], {
        cwd: root,
        stdout: () => undefined,
      }),
    ).toBe(0);

    expect((await readTable(join(root, "web.xlsx"))).values).toEqual({
      englishOnly: { en: "English", fr: "Retain French cell" },
      frenchOnly: { en: "Retain English cell", fr: "Français" },
    });
    expect(await readFile(join(root, "fr.json"))).toEqual(french);
  });

  it("imports only selected locales without modifying unselected JSON or the workbook", async () => {
    const root = temporaryDirectory.path;
    await writeConfig(root, {
      web: { catalogs: { en: "en.json", fr: "fr.json" }, excel: { file: "web.xlsx" } },
    });
    await writeJson(root, "en.json", {});
    await writeJson(root, "fr.json", { keep: "Français" });
    await writeWorkbook(root, "web.xlsx", [
      ["key", "en", "fr"],
      ["added", "English", "French"],
    ]);
    const unchanged = await readFiles(root, ["fr.json", "web.xlsx"]);

    expect(
      await runCli(["excel", "import", "--locale=en", "--locale", "en"], {
        cwd: root,
        stdout: () => undefined,
      }),
    ).toBe(0);

    expect(await readJson(root, "en.json")).toEqual({ added: "English" });
    expect(await readFiles(root, ["fr.json", "web.xlsx"])).toEqual(unchanged);
    const errors: string[] = [];
    expect(
      await main(["excel", "import", "--locale", "de"], {
        cwd: root,
        stdout: () => undefined,
        stderr: (message) => errors.push(message),
      }),
    ).toBe(2);
    expect(errors.join("\n")).toContain('Unknown locale "de"');
  });

  it.each([
    { args: ["excel", "export", "--prefer", "json"], diagnostic: "--prefer requires --force" },
    {
      args: ["excel", "export", "-f", "--prefer", "excel", "--prefer=json"],
      diagnostic: "mutually exclusive",
    },
    { args: ["excel", "import", "--prune"], diagnostic: "requires an explicit --project" },
    { args: ["check", "--prune"], diagnostic: "not available with check" },
    { args: ["sync", "-f"], diagnostic: "only available with Excel commands" },
    { args: ["sync", "--locale", "en"], diagnostic: "only available with Excel commands" },
    { args: ["excel", "export", "--clean"], diagnostic: "use --prune for Excel commands" },
    { args: ["excel", "export", "--config", "-f"], diagnostic: "--config requires a value" },
    { args: ["excel", "import", "--project", "-f"], diagnostic: "--project requires a value" },
    { args: ["excel", "export", "--locale", "-f"], diagnostic: "--locale requires a value" },
    { args: ["excel", "import", "--prefer", "-f"], diagnostic: "--prefer requires a value" },
    {
      args: ["excel", "export", "-f", "--prefer", "other"],
      diagnostic: "--prefer must be excel or json",
    },
  ])("rejects invalid options $args before touching data", async ({ args, diagnostic }) => {
    const errors: string[] = [];
    expect(
      await main(args, {
        cwd: temporaryDirectory.path,
        stdout: () => undefined,
        stderr: (message) => errors.push(message),
      }),
    ).toBe(2);
    expect(errors.join("\n")).toContain(diagnostic);
    expect(await readdir(temporaryDirectory.path)).toEqual([]);
  });
});

function project(name: string): I18nProjectConfig {
  return { catalogs: { en: `${name}.json` }, excel: { file: `${name}.xlsx` } };
}

async function writeConfig(
  root: string,
  projects: Record<string, I18nProjectConfig>,
): Promise<void> {
  await writeFile(
    join(root, "i18n.config.mjs"),
    `export default ${JSON.stringify({ projects })}`,
    "utf8",
  );
}

async function writeJson(
  root: string,
  file: string,
  values: Record<string, string>,
): Promise<void> {
  await mkdir(dirname(join(root, file)), { recursive: true });
  await writeFile(join(root, file), `${JSON.stringify(values, null, 2)}\n`, "utf8");
}

async function readJson(root: string, file: string): Promise<Record<string, string>> {
  return JSON.parse(await readFile(join(root, file), "utf8")) as Record<string, string>;
}

async function writeWorkbook(
  root: string,
  file: string,
  rows: readonly (readonly (string | null)[])[],
  sheet = "translations",
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheet);
  for (const row of rows) worksheet.addRow([...row]);
  await mkdir(dirname(join(root, file)), { recursive: true });
  await workbook.xlsx.writeFile(join(root, file));
}

async function readTable(path: string): Promise<{
  headers: string[];
  values: Record<string, Record<string, ExcelJS.CellValue>>;
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const worksheet = workbook.getWorksheet("translations")!;
  const headers = Array.from(
    { length: worksheet.columnCount },
    (_, index) => worksheet.getCell(1, index + 1).value as string,
  );
  const values: Record<string, Record<string, ExcelJS.CellValue>> = {};
  for (let row = 2; row <= worksheet.rowCount; row++) {
    const key = worksheet.getCell(row, 1).value as string;
    values[key] = Object.fromEntries(
      headers.slice(1).map((locale, index) => [locale, worksheet.getCell(row, index + 2).value]),
    );
  }
  return { headers, values };
}

async function readFiles(root: string, files: string[]): Promise<Buffer[]> {
  return Promise.all(files.map((file) => readFile(join(root, file))));
}

async function backupFiles(root: string): Promise<string[]> {
  return (await readdir(root, { recursive: true })).filter(
    (file) => file.includes(".bubbles-i18n-backups") && /\.(?:json|xlsx)$/u.test(file),
  );
}

function reportPath(root: string, direction: "export" | "import"): string {
  return join(root, ".bubbles-i18n", "reports", `excel-${direction}.md`);
}
