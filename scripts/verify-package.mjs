import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { run, runPackageManager } from "./commands.mjs";

const packageRoot = process.cwd();
const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
const requiredFiles = new Set(["package.json", "README.md", "LICENSE"]);

assert.match(manifest.name, /^@bubblesjs\/i18n-(core|react|vue|cli)$/);
assert.notEqual(manifest.private, true, "i18n packages must be publishable");
assert.equal(manifest.publishConfig?.access, "public");
assert.equal(manifest.publishConfig?.registry?.replace(/\/$/, ""), "https://registry.npmjs.org");
assert.equal(manifest.license, "MIT");

/** 检查包入口存在且没有越出当前包，收集 npm 文件清单所需路径。 */
function verifyTarget(target) {
  assert.equal(typeof target, "string");
  const path = resolve(packageRoot, target);
  const portable = relative(packageRoot, path).replaceAll("\\", "/");
  assert.ok(portable && !portable.startsWith("../") && !isAbsolute(portable));
  assert.ok(existsSync(path), `Missing package entry: ${target}`);
  requiredFiles.add(portable);
}

/** 遍历条件导出，检查 ESM、CJS 和类型声明对应的真实文件。 */
function verifyExports(value) {
  if (typeof value === "string") return verifyTarget(value);
  assert.ok(value && typeof value === "object");
  for (const target of Object.values(value)) verifyExports(target);
}

for (const field of ["main", "module", "types"]) verifyTarget(manifest[field]);
verifyExports(manifest.exports);
const entry = manifest.exports["."];
assert.ok(entry.import.types.endsWith(".d.ts"));
assert.ok(entry.require.types.endsWith(".d.cts"));
assert.equal(manifest.type, "module");
const require = createRequire(join(packageRoot, "package.json"));
const esm = await import(pathToFileURL(resolve(packageRoot, entry.import.default)).href);
const cjs = require(manifest.name);
const expectedExports = {
  core: ["createI18n", "initI18n", "createStore", "formatMessage", "createJsonStorage"],
  react: ["I18nProvider", "useI18n", "useI18nStore"],
  vue: ["I18nProvider", "useI18n", "useI18nStore"],
  cli: ["defineConfig", "scanSource", "scanFiles", "main", "runCli"],
}[manifest.name.split("-").at(-1)];
for (const module of [esm, cjs]) {
  for (const name of expectedExports) assert.ok(module[name], `Missing export ${name}`);
}
for (const target of Object.values(manifest.bin ?? {})) {
  verifyTarget(target);
  assert.ok(readFileSync(resolve(packageRoot, target), "utf8").startsWith("#!/usr/bin/env node"));
  assert.match(
    run(process.execPath, [resolve(packageRoot, target), "--help"], packageRoot),
    /bubbles-i18n/,
  );
}

const [packed] = JSON.parse(
  runPackageManager("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], packageRoot),
);
const files = new Set(packed.files.map(({ path }) => path.replaceAll("\\", "/")));
for (const target of requiredFiles) assert.ok(files.has(target), `npm package misses ${target}`);
for (const path of files) {
  assert.ok(
    !/^(src|test|tests|scripts|node_modules)\//.test(path),
    `Unexpected published file: ${path}`,
  );
}
assert.ok(!readFileSync(join(packageRoot, "LICENSE"), "utf8").includes("[copyright holder]"));
console.log(`Verified ${manifest.name}: ESM, CJS, declarations, bin and npm file list.`);
