import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { CliUsageError, main, runCli } from "../src/command.ts";
import { useTemporaryDirectory } from "./temporary-directory.ts";

describe("runCli", () => {
  const temporaryDirectory = useTemporaryDirectory();

  it("prints Chinese help", async () => {
    const output: string[] = [];

    await expect(runCli(["--help"], { stdout: (message) => output.push(message) })).resolves.toBe(
      0,
    );
    expect(output.join("\n")).toContain("用法：");
    expect(output.join("\n")).toContain("安全保护：");
    expect(output.join("\n")).toContain("显示帮助信息");
    expect(output.join("\n")).toContain("--prune");
    expect(output.join("\n")).not.toContain("--clean");
    expect(output.join("\n")).not.toContain("--allow-empty");
  });

  it("discovers config, syncs catalogs and writes relative report paths", async () => {
    const root = temporaryDirectory.path;
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "locales"), { recursive: true });
    await writeFile(
      join(root, "src", "app.ts"),
      "tr('保存')\ntr (\n  `English`\n)\ntr('ignored-' + value)\n",
      "utf8",
    );
    await writeFile(
      join(root, "locales", "zh_CN.json"),
      '{\n  "保存": "保存成功",\n  "旧文案": "旧翻译"\n}\n',
      "utf8",
    );
    await writeConfig(root, ".reports/i18n.json");

    const output: string[] = [];
    const exitCode = await runCli(["sync"], {
      cwd: join(root, "src"),
      stdout: (message) => output.push(message),
    });

    expect(exitCode).toBe(0);
    expect(JSON.parse(await readFile(join(root, "locales", "zh_CN.json"), "utf8"))).toEqual({
      保存: "保存成功",
      旧文案: "旧翻译",
      English: "English",
    });
    expect(JSON.parse(await readFile(join(root, "locales", "en_US.json"), "utf8"))).toEqual({
      English: "English",
      保存: "保存",
    });

    const report = JSON.parse(await readFile(join(root, ".reports", "i18n.json"), "utf8"));
    expect(report.command).toBe("sync");
    expect(report.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "locales/zh_CN.json", unused: ["旧文案"] }),
        expect.objectContaining({ path: "locales/en_US.json" }),
      ]),
    );
    expect(output.join("\n")).toContain("Project web: 1 source files, 2 keys.");
    await expect(access(join(root, ".bubbles-i18n", "report.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("keeps translations for calls with comments when cleaning catalogs", async () => {
    const root = temporaryDirectory.path;
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "locales"), { recursive: true });
    await writeFile(
      join(root, "src", "app.ts"),
      "tr('正常')\ntr(/* 参数说明 */ '保留' /* 结束说明 */)\n",
      "utf8",
    );
    await writeFile(
      join(root, "locales", "en_US.json"),
      JSON.stringify({ 正常: "Normal", 保留: "Keep translation", 废弃: "Remove translation" }),
      "utf8",
    );
    await writeFile(join(root, "locales", "zh_CN.json"), "{}\n", "utf8");
    await writeConfig(root);

    await expect(runCli(["sync", "--prune"], { cwd: root, stdout: () => undefined })).resolves.toBe(
      0,
    );
    expect(JSON.parse(await readFile(join(root, "locales", "en_US.json"), "utf8"))).toEqual({
      正常: "Normal",
      保留: "Keep translation",
    });
    const report = JSON.parse(await readFile(join(root, ".bubbles-i18n", "report.json"), "utf8"));
    expect(report.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          locale: "en_US",
          deleted: ["废弃"],
          unchangedCount: 2,
        }),
      ]),
    );
  });

  it("checks without changing catalogs and writes the default report beside the config", async () => {
    const root = temporaryDirectory.path;
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "locales"), { recursive: true });
    await writeFile(join(root, "src", "app.ts"), "tr('new')\n", "utf8");
    await writeFile(join(root, "locales", "en_US.json"), '{"old":"Translated"}\n', "utf8");
    await writeFile(join(root, "locales", "zh_CN.json"), "{}\n", "utf8");
    await writeConfig(root);

    const before = await readFile(join(root, "locales", "en_US.json"), "utf8");
    const exitCode = await runCli(["check", "--fail-on-stale"], {
      cwd: join(root, "src"),
      stdout: () => undefined,
    });

    expect(exitCode).toBe(1);
    expect(await readFile(join(root, "locales", "en_US.json"), "utf8")).toBe(before);
    const report = JSON.parse(await readFile(join(root, ".bubbles-i18n", "report.json"), "utf8"));
    expect(report).toMatchObject({ command: "check", dryRun: true });
    await expect(access(join(root, "src", ".bubbles-i18n"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(access(join(root, ".bubbles-i18n", "reports"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it.each([
    { args: ["sync"], writesMarkdown: true },
    { args: ["sync", "--dry-run"], writesMarkdown: true },
    { args: ["check"], writesMarkdown: false },
  ])("report: false disables JSON reports for $args", async ({ args, writesMarkdown }) => {
    const root = temporaryDirectory.path;
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "locales"), { recursive: true });
    await writeFile(join(root, "src", "app.ts"), "tr('used')\n", "utf8");
    await writeFile(join(root, "locales", "en_US.json"), '{"used":"Used"}\n', "utf8");
    await writeFile(join(root, "locales", "zh_CN.json"), '{"used":"使用"}\n', "utf8");
    await writeConfig(root, false);

    await expect(runCli(args, { cwd: root, stdout: () => undefined })).resolves.toBe(0);

    await expect(access(join(root, ".bubbles-i18n", "report.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    const markdownPath = join(root, ".bubbles-i18n", "reports", "sync.md");
    if (writesMarkdown) {
      expect(await readFile(markdownPath, "utf8")).toContain("bubbles-i18n generated report: sync");
    } else {
      await expect(access(markdownPath)).rejects.toMatchObject({ code: "ENOENT" });
    }
  });

  it("refuses prune when include patterns match no source files", async () => {
    const root = temporaryDirectory.path;
    await mkdir(join(root, "locales"), { recursive: true });
    await writeFile(join(root, "locales", "en_US.json"), '{"old":"Translation"}\n', "utf8");
    await writeFile(join(root, "locales", "zh_CN.json"), "{}\n", "utf8");
    await writeConfig(root);

    await expect(
      runCli(["sync", "--prune"], { cwd: root, stdout: () => undefined }),
    ).rejects.toBeInstanceOf(CliUsageError);
    expect(JSON.parse(await readFile(join(root, "locales", "en_US.json"), "utf8"))).toEqual({
      old: "Translation",
    });
  });

  it("validates catalog ownership across unselected projects", async () => {
    const root = temporaryDirectory.path;
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "locales"), { recursive: true });
    await writeFile(join(root, "src", "app.ts"), "tr('new')\n", "utf8");
    const sharedCatalog = join(root, "locales", "shared.json");
    await writeFile(sharedCatalog, '{"old":"Translation"}\n', "utf8");
    await writeFile(
      join(root, "i18n.config.mjs"),
      `export default {
  projects: {
    web: { include: ['src/**/*.ts'], catalogs: { en_US: 'locales/shared.json' } },
    admin: { include: ['src/**/*.ts'], catalogs: { zh_CN: 'locales/shared.json' } }
  }
}\n`,
      "utf8",
    );

    await expect(
      runCli(["sync", "--project", "web"], { cwd: root, stdout: () => undefined }),
    ).rejects.toThrow("configured by both web/en_US and admin/zh_CN");
    expect(await readFile(sharedCatalog, "utf8")).toBe('{"old":"Translation"}\n');
  });

  it("refuses report paths that overwrite config or existing non-report files", async () => {
    const root = temporaryDirectory.path;
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "app.ts"), "tr('new')\n", "utf8");
    const configPath = join(root, "i18n.config.mjs");
    const configSource = `export default {
  projects: {
    web: { include: ['src/**/*.ts'], catalogs: { en_US: 'locales/en_US.json' } }
  },
  report: 'i18n.config.mjs'
}\n`;
    await writeFile(configPath, configSource, "utf8");

    await expect(runCli(["sync"], { cwd: root, stdout: () => undefined })).rejects.toThrow(
      "Report path must not overwrite the config file",
    );
    expect(await readFile(configPath, "utf8")).toBe(configSource);

    const existingPath = join(root, "notes.json");
    const existingSource = '{"notes":"keep me"}\n';
    await writeFile(existingPath, existingSource, "utf8");
    const secondConfigPath = join(root, "other.config.mjs");
    await writeFile(
      secondConfigPath,
      configSource.replace("i18n.config.mjs", "notes.json"),
      "utf8",
    );

    await expect(
      runCli(["sync", "--config", secondConfigPath], {
        cwd: root,
        stdout: () => undefined,
      }),
    ).rejects.toThrow("Refusing to overwrite existing non-report file");
    expect(await readFile(existingPath, "utf8")).toBe(existingSource);
  });

  it("treats prototype names as unknown projects", async () => {
    const root = temporaryDirectory.path;
    await writeConfig(root);

    await expect(
      runCli(["sync", "--project", "toString"], { cwd: root, stdout: () => undefined }),
    ).rejects.toThrow('Unknown project "toString"');
  });

  it("refuses to overwrite a non-report file at the default report path before syncing", async () => {
    const root = temporaryDirectory.path;
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "locales"), { recursive: true });
    await mkdir(join(root, ".bubbles-i18n"), { recursive: true });
    await writeFile(join(root, "src", "app.ts"), "tr('new')\n", "utf8");
    const catalogPath = join(root, "locales", "en_US.json");
    const catalogSource = '{"old":"Translation"}\n';
    await writeFile(catalogPath, catalogSource, "utf8");
    const reportPath = join(root, ".bubbles-i18n", "report.json");
    const reportSource = '{"notes":"keep me"}\n';
    await writeFile(reportPath, reportSource, "utf8");
    await writeConfig(root);

    await expect(runCli(["sync"], { cwd: root, stdout: () => undefined })).rejects.toThrow(
      "Refusing to overwrite existing non-report file",
    );

    expect(await readFile(reportPath, "utf8")).toBe(reportSource);
    expect(await readFile(catalogPath, "utf8")).toBe(catalogSource);
    await expect(access(join(root, "locales", "zh_CN.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("refuses catalogs that collide with the default report path", async () => {
    const root = temporaryDirectory.path;
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, ".bubbles-i18n"), { recursive: true });
    await writeFile(join(root, "src", "app.ts"), "tr('new')\n", "utf8");
    const catalogPath = join(root, ".bubbles-i18n", "report.json");
    const catalogSource = '{"old":"Translation"}\n';
    await writeFile(catalogPath, catalogSource, "utf8");
    await writeFile(
      join(root, "i18n.config.mjs"),
      `export default {
  projects: {
    web: { include: ['src/**/*.ts'], catalogs: { en_US: '.bubbles-i18n/report.json' } }
  }
}\n`,
      "utf8",
    );

    await expect(runCli(["sync"], { cwd: root, stdout: () => undefined })).rejects.toThrow(
      "Report path must not overwrite a catalog",
    );
    expect(await readFile(catalogPath, "utf8")).toBe(catalogSource);
  });

  it("allows stale keys by default in check and fails with --fail-on-stale", async () => {
    const root = temporaryDirectory.path;
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "locales"), { recursive: true });
    await writeFile(join(root, "src", "app.ts"), "tr('used')\n", "utf8");
    await writeFile(join(root, "locales", "en_US.json"), '{"used":"Used","old":"Old"}\n', "utf8");
    await writeFile(
      join(root, "locales", "zh_CN.json"),
      '{"used":"使用","old":"旧文案"}\n',
      "utf8",
    );
    await writeConfig(root);

    await expect(runCli(["check"], { cwd: root, stdout: () => undefined })).resolves.toBe(0);
    await expect(
      runCli(["check", "--fail-on-stale"], { cwd: root, stdout: () => undefined }),
    ).resolves.toBe(1);
  });

  it.each(["--clean", "--allow-empty"])("rejects removed option %s", async (option) => {
    const errors: string[] = [];
    await expect(
      main(["sync", option], {
        cwd: temporaryDirectory.path,
        stdout: () => undefined,
        stderr: (message) => errors.push(message),
      }),
    ).resolves.toBe(2);
    expect(errors.join("\n")).toContain(`Unknown option "${option}"`);
  });

  it.each([false, true])(
    "refuses to clear non-empty catalogs when a readable source has no keys, dry-run %s",
    async (dryRun) => {
      const root = temporaryDirectory.path;
      await mkdir(join(root, "src"), { recursive: true });
      await mkdir(join(root, "locales"), { recursive: true });
      await writeFile(join(root, "src", "app.ts"), "// Translation calls removed.\n", "utf8");
      const catalog = join(root, "locales", "en_US.json");
      const original = '{"keep":"Translation"}\n';
      await writeFile(catalog, original, "utf8");
      await writeConfig(root);

      await expect(
        runCli(["sync", "--prune", ...(dryRun ? ["--dry-run"] : [])], {
          cwd: root,
          stdout: () => undefined,
        }),
      ).rejects.toThrow("source scan found no keys");
      expect(await readFile(catalog, "utf8")).toBe(original);
      await expect(access(join(root, "locales", "zh_CN.json"))).rejects.toMatchObject({
        code: "ENOENT",
      });
    },
  );

  it("previews additions and removals without changing catalogs or creating missing ones", async () => {
    const root = temporaryDirectory.path;
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "locales"), { recursive: true });
    await writeFile(join(root, "src", "app.ts"), "tr('new')\n", "utf8");
    const existing = join(root, "locales", "en_US.json");
    const original = '{"old":"Translation"}\n';
    await writeFile(existing, original, "utf8");
    await writeConfig(root);

    await expect(
      runCli(["sync", "--dry-run", "--prune"], {
        cwd: join(root, "src"),
        stdout: () => undefined,
      }),
    ).resolves.toBe(0);

    expect(await readFile(existing, "utf8")).toBe(original);
    await expect(access(join(root, "locales", "zh_CN.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    const report = JSON.parse(await readFile(join(root, ".bubbles-i18n", "report.json"), "utf8"));
    expect(report).toMatchObject({ command: "sync", dryRun: true, clean: true });
    expect(report.files).toContainEqual(
      expect.objectContaining({
        locale: "en_US",
        added: ["new"],
        deleted: ["old"],
      }),
    );
  });

  it("validates all selected projects before writing to the first project", async () => {
    const root = temporaryDirectory.path;
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "app.ts"), "tr('new')\n", "utf8");
    const firstCatalog = join(root, "first.json");
    const invalidCatalog = join(root, "invalid.json");
    await writeFile(firstCatalog, '{"old":"Translation"}', "utf8");
    await writeFile(invalidCatalog, "{ invalid JSON", "utf8");
    await writeFile(
      join(root, "i18n.config.mjs"),
      `export default {
      projects: {
        first: { include: ['src/**/*.ts'], catalogs: { en: 'first.json' } },
        second: { include: ['src/**/*.ts'], catalogs: { en: 'invalid.json' } }
      }
    }`,
      "utf8",
    );

    const errors: string[] = [];
    await expect(
      main(["sync"], {
        cwd: root,
        stdout: () => undefined,
        stderr: (message) => errors.push(message),
      }),
    ).resolves.toBe(2);
    expect(errors.join("\n")).toContain("invalid JSON");
    expect(await readFile(firstCatalog, "utf8")).toBe('{"old":"Translation"}');
  });

  it("refuses prune when every matched file is binary", async () => {
    const root = temporaryDirectory.path;
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "locales"), { recursive: true });
    await writeFile(join(root, "src", "app.ts"), "\0tr('binary')", "utf8");
    await writeFile(join(root, "locales", "en_US.json"), '{"keep":"Translation"}', "utf8");
    await writeConfig(root);

    await expect(
      runCli(["sync", "--prune"], {
        cwd: root,
        stdout: () => undefined,
      }),
    ).rejects.toThrow("no readable source files");
    expect(await readFile(join(root, "locales", "en_US.json"), "utf8")).toBe(
      '{"keep":"Translation"}',
    );
  });

  it.each([
    ["invalid"],
    ["sync", "--unknown"],
    ["sync", "--config"],
    ["sync", "--project="],
    ["check", "--prune"],
    ["check", "--dry-run"],
    ["sync", "--fail-on-stale"],
  ])("returns exit code 2 with a usage diagnostic for %j", async (...arguments_) => {
    const errors: string[] = [];
    await expect(
      main(arguments_, {
        stdout: () => undefined,
        stderr: (message) => errors.push(message),
      }),
    ).resolves.toBe(2);
    expect(errors[0]).toMatch(/^Error:/);
    expect(errors[1]).toBe('Run "bubbles-i18n --help" for usage.');
  });

  it("returns exit code 1 and help when no command is provided", async () => {
    const output: string[] = [];
    await expect(main([], { stdout: (message) => output.push(message) })).resolves.toBe(1);
    expect(output.join("\n")).toContain("用法：");
  });
});

/** 在测试根目录写入 ESM 配置，可选择覆盖或关闭默认 JSON 报告。 */
async function writeConfig(root: string, report?: string | false): Promise<void> {
  await writeFile(
    join(root, "i18n.config.mjs"),
    `export default {
  projects: {
    web: {
      include: ['src/**/*.ts'],
      catalogs: {
        zh_CN: 'locales/zh_CN.json',
        en_US: 'locales/en_US.json'
      }
    }
  }${report === undefined ? "" : `,\n  report: ${JSON.stringify(report)}`}
}\n`,
    "utf8",
  );
}
