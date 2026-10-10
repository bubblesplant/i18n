import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import ExcelJS from "exceljs";
import { describe, expect, it } from "vite-plus/test";

import { main, runCli } from "../src/command.ts";
import { assertSafeMarkdownTarget, quoteArgument } from "../src/markdown-report.ts";
import { useTemporaryDirectory } from "./temporary-directory.ts";

describe("Markdown CLI reports", () => {
  const temporaryDirectory = useTemporaryDirectory();

  it("lists every retained scan key and preserves config/project scope in prune instructions", async () => {
    const root = temporaryDirectory.path;
    const extra = "old|`<tag>&\nline";
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "web.ts"), 'tr("used")\n', "utf8");
    await writeFile(join(root, "src", "admin.ts"), 'tr("admin")\n', "utf8");
    await writeFile(
      join(root, "web.json"),
      JSON.stringify({ used: "Keep translation", [extra]: "Old" }),
      "utf8",
    );
    await writeFile(join(root, "admin.json"), '{"admin":"Admin","unselected":"Keep"}', "utf8");
    await writeFile(
      join(root, "custom config.mjs"),
      `export default ${JSON.stringify({
        projects: {
          "web app": { include: ["src/web.ts"], catalogs: { en: "web.json" } },
          admin: { include: ["src/admin.ts"], catalogs: { en: "admin.json" } },
        },
      })}`,
      "utf8",
    );
    const admin = await readFile(join(root, "admin.json"));
    const args = ["sync", "--config", "custom config.mjs", "--project", "web app"];
    const output: string[] = [];

    expect(await runCli(args, { cwd: root, stdout: (message) => output.push(message) })).toBe(0);

    const path = join(root, ".bubbles-i18n", "reports", "sync.md");
    const report = await readFile(path, "utf8");
    expect(report).toContain('## "web app" / "en"');
    expect(report).toContain('JSON："web.json"');
    expect(report).toContain('"old&#124;&#96;&lt;tag&gt;&amp;\\\\nline"');
    expect(report).not.toContain("<tag>");
    expect(report).toContain(
      "pnpm exec bubbles-i18n sync --config 'custom config.mjs' --project 'web app' --prune",
    );
    expect(report).not.toContain("--project admin");
    expect(output.join("\n")).toContain(`保留 JSON 独有 key: ${JSON.stringify(extra)}`);
    expect(JSON.parse(await readFile(join(root, "web.json"), "utf8"))).toEqual({
      used: "Keep translation",
      [extra]: "Old",
    });

    expect(await runCli([...args, "--prune"], { cwd: root, stdout: () => undefined })).toBe(0);

    expect(JSON.parse(await readFile(join(root, "web.json"), "utf8"))).toEqual({
      used: "Keep translation",
    });
    expect(await readFile(join(root, "admin.json"))).toEqual(admin);
    expect(await readFile(path, "utf8")).toContain("已删除 key：1");
  });

  it("writes a default scan preview without creating missing JSON or data backups", async () => {
    const root = temporaryDirectory.path;
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "app.ts"), 'tr("new")', "utf8");
    await writeFile(
      join(root, "i18n.config.mjs"),
      'export default { projects: { web: { include: ["src/**/*.ts"], catalogs: { en: "en.json" } } } }',
      "utf8",
    );

    expect(await runCli(["sync", "--dry-run"], { cwd: root, stdout: () => undefined })).toBe(0);

    await expect(access(join(root, "en.json"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(join(root, ".bubbles-i18n", "reports", "sync.md"), "utf8")).toContain(
      "状态：预览",
    );
    expect(
      (await readdir(root, { recursive: true })).some((path) => path.includes("backups")),
    ).toBe(false);
  });

  it.each([
    { command: "sync", args: ["sync"], file: "sync.md" },
    { command: "excel export", args: ["excel", "export"], file: "excel-export.md" },
    { command: "excel import", args: ["excel", "import"], file: "excel-import.md" },
  ])(
    "refuses to overwrite a manual $command report before changing any data",
    async ({ args, file }) => {
      const root = temporaryDirectory.path;
      await writeSimpleProject(root);
      await mkdir(join(root, "src"), { recursive: true });
      await writeFile(join(root, "src", "app.ts"), 'tr("new")', "utf8");
      await writeFile(join(root, "web.json"), '{"existing":"Keep"}', "utf8");
      await writeWorkbook(root, [
        ["key", "en"],
        ["new", "New"],
      ]);
      const json = await readFile(join(root, "web.json"));
      const excel = await readFile(join(root, "web.xlsx"));
      const path = join(root, ".bubbles-i18n", "reports", file);
      await mkdir(join(root, ".bubbles-i18n", "reports"), { recursive: true });
      const manual = "# 人工维护笔记\n请保留。\n";
      await writeFile(path, manual, "utf8");
      const errors: string[] = [];

      expect(
        await main(args, {
          cwd: root,
          stdout: () => undefined,
          stderr: (message) => errors.push(message),
        }),
      ).toBe(2);

      expect(errors.join("\n")).toContain("Refusing to overwrite existing non-report file");
      expect(await readFile(path, "utf8")).toBe(manual);
      expect(await readFile(join(root, "web.json"))).toEqual(json);
      expect(await readFile(join(root, "web.xlsx"))).toEqual(excel);
      expect(
        (await readdir(root, { recursive: true })).some((entry) => entry.includes("backups")),
      ).toBe(false);
    },
  );

  it("escapes special conflict keys and values while keeping retry config, project and locale", async () => {
    const root = temporaryDirectory.path;
    const key = "danger|`<tag>&\nline";
    await writeFile(
      join(root, "custom config.mjs"),
      `export default ${JSON.stringify({
        projects: {
          "web app": { catalogs: { en: "web.json", fr: "fr.json" }, excel: { file: "web.xlsx" } },
          admin: { catalogs: { en: "admin.json" }, excel: { file: "admin.xlsx" } },
        },
      })}`,
      "utf8",
    );
    await writeFile(join(root, "web.json"), JSON.stringify({ [key]: "JSON |`<>&" }), "utf8");
    await writeWorkbook(root, [
      ["key", "en", "fr"],
      [key, "Excel |`<>&", "Not selected"],
    ]);
    const args = [
      "excel",
      "import",
      "--config",
      "custom config.mjs",
      "--project",
      "web app",
      "--locale",
      "en",
    ];

    expect(await runCli(args, { cwd: root, stdout: () => undefined })).toBe(1);

    const report = await readFile(
      join(root, ".bubbles-i18n", "reports", "excel-import.md"),
      "utf8",
    );
    expect(report).toContain("状态：值冲突阻断");
    expect(report).toContain('"danger&#124;&#96;&lt;tag&gt;&amp;\\\\nline"');
    expect(report).toContain('"JSON &#124;&#96;&lt;&gt;&amp;"');
    expect(report).toContain('"Excel &#124;&#96;&lt;&gt;&amp;"');
    expect(report).toContain("translations / B2");
    expect(report).not.toContain("<tag>");
    const retry =
      "pnpm exec bubbles-i18n excel import --config 'custom config.mjs' --project 'web app' --locale en";
    expect(copyableCommands(report)).toEqual([
      retry,
      `${retry} --force --prefer excel`,
      `${retry} --force --prefer json`,
      `${retry} --prune --dry-run`,
      `${retry} --prune`,
    ]);
    expect(report).not.toContain("--project admin");
    expect(report).not.toContain("--locale fr");
    await expect(access(join(root, "fr.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each(["export", "import"] as const)(
    "preserves %s retry semantics and keeps conflict alternatives in dry-run mode",
    async (direction) => {
      const root = temporaryDirectory.path;
      await writeSimpleProject(root);
      await writeFile(
        join(root, "web.json"),
        JSON.stringify(
          direction === "import" ? { conflict: "JSON", extra: "Old" } : { conflict: "JSON" },
        ),
        "utf8",
      );
      await writeWorkbook(root, [
        ["key", "en"],
        ["conflict", "Excel"],
        ...(direction === "export" ? [["extra", "Old"]] : []),
      ]);
      const json = await readFile(join(root, "web.json"));
      const excel = await readFile(join(root, "web.xlsx"));

      expect(
        await runCli(
          [
            "excel",
            direction,
            "--project",
            "web",
            "-f",
            "--prefer",
            "json",
            "--prune",
            "--dry-run",
          ],
          {
            cwd: root,
            stdout: () => undefined,
          },
        ),
      ).toBe(0);

      const report = await readFile(
        join(root, ".bubbles-i18n", "reports", `excel-${direction}.md`),
        "utf8",
      );
      expect(report).toContain("状态：预览");
      expect(report).toContain("计划删除项：1");
      expect(report).toContain("计划采用 json");
      expect(report).not.toContain("已删除项");
      expect(report).not.toContain("## 数据备份");
      const scope = `pnpm exec bubbles-i18n excel ${direction} --project web`;
      const commands = copyableCommands(report);
      expect(commands).toEqual([
        `${scope} --prune --force --prefer json --dry-run`,
        `${scope} --prune --dry-run --force --prefer excel`,
        `${scope} --prune --dry-run --force --prefer json`,
        `${scope} --prune --dry-run`,
        `${scope} --prune`,
      ]);

      expect(
        await runCli(commands[1]!.split(" ").slice(3), { cwd: root, stdout: () => undefined }),
      ).toBe(0);
      expect(await readFile(join(root, "web.json"))).toEqual(json);
      expect(await readFile(join(root, "web.xlsx"))).toEqual(excel);
      expect(
        (await readdir(root, { recursive: true })).some((entry) => entry.includes("backups")),
      ).toBe(false);

      expect(
        await runCli(commands[4]!.split(" ").slice(3), { cwd: root, stdout: () => undefined }),
      ).toBe(1);
      expect(await readFile(join(root, "web.json"))).toEqual(json);
      expect(await readFile(join(root, "web.xlsx"))).toEqual(excel);
    },
  );

  it.each(["--prune", "--clean"])(
    "preserves allow-empty in scan retry and scoped cleanup commands using %s",
    async (pruneOption) => {
      const root = temporaryDirectory.path;
      await writeSimpleProject(root);
      await mkdir(join(root, "src"), { recursive: true });
      await writeFile(
        join(root, "src", "app.ts"),
        "// All translation calls have been removed.\n",
        "utf8",
      );
      await writeFile(join(root, "web.json"), '{"obsolete":"Old"}', "utf8");
      const json = await readFile(join(root, "web.json"));

      expect(
        await runCli(["sync", "--project", "web", pruneOption, "--allow-empty", "--dry-run"], {
          cwd: root,
          stdout: () => undefined,
        }),
      ).toBe(0);

      const report = await readFile(join(root, ".bubbles-i18n", "reports", "sync.md"), "utf8");
      const scope = "pnpm exec bubbles-i18n sync --project web";
      const commands = copyableCommands(report);
      expect(commands).toEqual([
        `${scope} --prune --allow-empty --dry-run`,
        `${scope} --allow-empty --prune --dry-run`,
        `${scope} --allow-empty --prune`,
      ]);
      expect(await readFile(join(root, "web.json"))).toEqual(json);

      expect(
        await runCli(commands[2]!.split(" ").slice(3), { cwd: root, stdout: () => undefined }),
      ).toBe(0);
      expect(JSON.parse(await readFile(join(root, "web.json"), "utf8"))).toEqual({});
    },
  );

  it("scopes Excel cleanup to every selected project when the original command selected all projects", async () => {
    const root = temporaryDirectory.path;
    await writeFile(
      join(root, "i18n.config.mjs"),
      `export default ${JSON.stringify({
        projects: {
          web: { catalogs: { en: "web.json" }, excel: { file: "web.xlsx" } },
          admin: { catalogs: { en: "admin.json" }, excel: { file: "admin.xlsx" } },
        },
      })}`,
      "utf8",
    );
    for (const project of ["web", "admin"]) {
      await writeFile(join(root, `${project}.json`), '{"used":"Same","extra":"Old"}', "utf8");
      await writeWorkbook(
        root,
        [
          ["key", "en"],
          ["used", "Same"],
        ],
        `${project}.xlsx`,
      );
    }
    const web = await readFile(join(root, "web.json"));
    const admin = await readFile(join(root, "admin.json"));

    expect(
      await runCli(["excel", "import", "--locale", "en", "--dry-run"], {
        cwd: root,
        stdout: () => undefined,
      }),
    ).toBe(0);

    const report = await readFile(
      join(root, ".bubbles-i18n", "reports", "excel-import.md"),
      "utf8",
    );
    const scope = "pnpm exec bubbles-i18n excel import --locale en";
    const cleanupScope =
      "pnpm exec bubbles-i18n excel import --project web --project admin --locale en";
    const commands = copyableCommands(report);
    expect(commands).toEqual([
      `${scope} --dry-run`,
      `${scope} --dry-run --force --prefer excel`,
      `${scope} --dry-run --force --prefer json`,
      `${cleanupScope} --prune --dry-run`,
      `${cleanupScope} --prune`,
    ]);
    expect(
      await runCli(commands[3]!.split(" ").slice(3), { cwd: root, stdout: () => undefined }),
    ).toBe(0);
    expect(await readFile(join(root, "web.json"))).toEqual(web);
    expect(await readFile(join(root, "admin.json"))).toEqual(admin);
  });

  it("only accepts a generated marker for the command that owns the report", async () => {
    const root = temporaryDirectory.path;
    const path = join(root, "report.md");
    await writeFile(path, "<!-- bubbles-i18n generated report: excel export -->\n# report", "utf8");

    await expect(assertSafeMarkdownTarget(path, "excel export")).resolves.toBeUndefined();
    await expect(assertSafeMarkdownTarget(path, "excel import")).rejects.toThrow(
      "Refusing to overwrite",
    );
    await expect(
      assertSafeMarkdownTarget(join(root, "missing.md"), "sync"),
    ).resolves.toBeUndefined();
  });

  it("quotes names and paths so copyable PowerShell commands keep their exact arguments", () => {
    expect(quoteArgument("web")).toBe("web");
    expect(quoteArgument("./config/i18n.mjs")).toBe("./config/i18n.mjs");
    expect(quoteArgument("web's project")).toBe("'web''s project'");
    expect(quoteArgument("$config`name.mjs")).toBe("'$config`name.mjs'");
  });
});

async function writeSimpleProject(root: string): Promise<void> {
  await writeFile(
    join(root, "i18n.config.mjs"),
    `export default ${JSON.stringify({
      projects: {
        web: {
          include: ["src/**/*.ts"],
          catalogs: { en: "web.json" },
          excel: { file: "web.xlsx" },
        },
      },
    })}`,
    "utf8",
  );
}

function copyableCommands(report: string): string[] {
  return report.split("\n").filter((line) => line.startsWith("pnpm exec bubbles-i18n "));
}

async function writeWorkbook(
  root: string,
  rows: readonly (readonly string[])[],
  file = "web.xlsx",
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("translations");
  for (const row of rows) worksheet.addRow([...row]);
  await workbook.xlsx.writeFile(join(root, file));
}
