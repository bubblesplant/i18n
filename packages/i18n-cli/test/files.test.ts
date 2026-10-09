import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { scanFiles } from "../src/files.ts";
import { useTemporaryDirectory } from "./temporary-directory.ts";

describe("scanFiles", () => {
  const temporaryDirectory = useTemporaryDirectory();

  it("scans TypeScript, TSX and Vue templates, deduplicates keys and preserves file positions", async () => {
    const root = temporaryDirectory.path;
    const sources = {
      "src/message.ts": "\uFEFFexport const message: string = tr('保存')\r\ntr('重复')",
      "src/view.tsx": "export const View = () => <button>{tr('保存')}</button>\ntr(dynamicKey)",
      "src/View.vue":
        '<template>\n  <p>{{ tr("你好") }}</p>\n</template>\n<script setup lang="ts">\ntr(`重复`)\n</script>',
    };
    for (const [path, source] of Object.entries(sources)) {
      await writeSource(root, path, source);
    }

    const result = await scanFiles({ rootDir: root, include: ["src/**/*.{ts,tsx,vue}"] });

    expect(result.files).toHaveLength(3);
    expect([...result.keys].sort()).toEqual(["你好", "保存", "重复"]);
    expect(result.occurrences).toHaveLength(5);
    const vueOccurrence = result.occurrences.find(({ key }) => key === "你好");
    expect(vueOccurrence).toMatchObject({
      key: "你好",
      index: sources["src/View.vue"].indexOf('tr("你好")'),
      line: 2,
      column: 9,
    });
    expect(resolve(vueOccurrence?.file ?? "")).toBe(join(root, "src", "View.vue"));
    expect(result.skippedBinaryFiles).toEqual([]);
  });

  it("applies default and custom exclusions, custom call names, and skips binary contents", async () => {
    const root = temporaryDirectory.path;
    const paths = [
      "src/use.ts",
      "src/ignored.ts",
      "dist/output.ts",
      "node_modules/library/index.ts",
      ".git/example.ts",
    ];
    for (const path of paths) {
      await writeSource(root, path, "$t('custom')\ntr('default')");
    }
    await writeSource(root, "src/binary.ts", "\0$t('binary')");

    const result = await scanFiles({
      rootDir: root,
      include: ["**/*.ts", "src/**/*.ts"],
      exclude: ["src/ignored.ts"],
      callNames: ["$t"],
    });

    expect(result.files).toHaveLength(2);
    expect([...result.keys]).toEqual(["custom"]);
    expect(result.occurrences).toHaveLength(1);
    expect(result.skippedBinaryFiles.map((file) => resolve(file))).toEqual([
      join(root, "src", "binary.ts"),
    ]);
  });
});

async function writeSource(root: string, path: string, source: string): Promise<void> {
  const absolutePath = join(root, path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, source, "utf8");
}
