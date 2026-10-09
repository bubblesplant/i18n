import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { run, runPackageManager } from "./commands.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporaryRoot = mkdtempSync(join(tmpdir(), "bubbles-i18n-release-"));
const consumer = join(temporaryRoot, "consumer");
mkdirSync(consumer);

/** 读取工作区实际安装的依赖版本，让隔离消费者与本次测试使用相同框架。 */
function installedVersion(packageFolder, name) {
  const require = createRequire(join(root, packageFolder, "package.json"));
  return JSON.parse(readFileSync(require.resolve(`${name}/package.json`), "utf8")).version;
}

try {
  const dependencies = {};
  for (const name of ["core", "react", "vue", "cli"]) {
    const tarball = join(temporaryRoot, `i18n-${name}.tgz`);
    runPackageManager(
      "pnpm",
      ["pack", "--out", tarball, "--json"],
      join(root, "packages", `i18n-${name}`),
    );
    assert.ok(existsSync(tarball));
    dependencies[`@bubblesjs/i18n-${name}`] = `file:../i18n-${name}.tgz`;
  }
  for (const [folder, names] of [
    ["packages/i18n-react", ["react", "react-dom", "@types/react", "@types/react-dom"]],
    ["packages/i18n-vue", ["vue"]],
    [".", ["typescript", "@types/node"]],
  ]) {
    for (const name of names) dependencies[name] = installedVersion(folder, name);
  }
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module", dependencies }, null, 2),
  );
  console.log("Installing four packed tarballs into an isolated npm consumer...");
  runPackageManager(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--registry=https://registry.npmjs.org",
    ],
    consumer,
  );
  for (const name of ["core", "react", "vue", "cli"]) {
    const manifest = JSON.parse(
      readFileSync(
        join(consumer, "node_modules/@bubblesjs", `i18n-${name}`, "package.json"),
        "utf8",
      ),
    );
    for (const version of Object.values(manifest.dependencies ?? {})) {
      assert.ok(
        !/^(workspace:|catalog:|link:|file:)/.test(version),
        `Unresolved protocol in packed ${manifest.name}`,
      );
    }
  }
  const esmSmoke = `
import assert from 'node:assert/strict';
import { createI18n, formatMessage } from '@bubblesjs/i18n-core';
import { I18nProvider, useI18n } from '@bubblesjs/i18n-react';
import { I18nProvider as VueProvider, useI18n as useVueI18n } from '@bubblesjs/i18n-vue';
import { defineConfig, scanSource } from '@bubblesjs/i18n-cli';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString as renderVue } from 'vue/server-renderer';
const store = createI18n({ locale: 'en', message: { hello: 'Hello {name}' }, loaderMessage: async () => ({ hello: '你好 {name}' }) });
assert.equal(store.getState().tr('hello', { name: 'Bubbles' }), 'Hello Bubbles');
assert.equal(formatMessage('{n}', { n: 0 }), '0');
function Greeting() { return createElement('p', null, useI18n().tr('hello', { name: 'React' })); }
assert.match(renderToString(createElement(I18nProvider, { store }, createElement(Greeting))), /Hello React/);
const GreetingVue = defineComponent({ setup() { const { tr } = useVueI18n(); return () => h('p', tr('hello', { name: 'Vue' })); } });
assert.match(await renderVue(createSSRApp({ render: () => h(VueProvider, { store }, { default: () => h(GreetingVue) }) })), /Hello Vue/);
await store.getState().loadLocale('zh');
assert.equal(store.getState().tr('hello', { name: 'Bubbles' }), '你好 Bubbles');
assert.ok(defineConfig({ projects: { app: { include: ['src/**/*.ts'], catalogs: { en: 'en.json' } } } }));
assert.ok(scanSource("tr('hello')"));
console.log('Packed ESM runtime and React/Vue SSR passed.');
`;
  writeFileSync(join(consumer, "smoke.mjs"), esmSmoke);
  run(process.execPath, ["smoke.mjs"], consumer);
  writeFileSync(
    join(consumer, "smoke.cjs"),
    `
const assert = require('node:assert/strict');
const core = require('@bubblesjs/i18n-core');
assert.equal(core.createI18n({ message: { hello: 'Hello' } }).getState().tr('hello'), 'Hello');
for (const name of ['react', 'vue']) assert.ok(require('@bubblesjs/i18n-' + name).I18nProvider);
assert.equal(typeof require('@bubblesjs/i18n-cli').runCli, 'function');
console.log('Packed CJS runtime passed.');
`,
  );
  run(process.execPath, ["smoke.cjs"], consumer);
  const typeConsumer = `
import { createI18n, type I18nStore, type MessageValues } from '@bubblesjs/i18n-core';
import { I18nProvider as ReactProvider, useI18nStore as useReactStore } from '@bubblesjs/i18n-react';
import { I18nProvider as VueProvider, useI18nStore as useVueStore } from '@bubblesjs/i18n-vue';
import { defineConfig, type I18nConfig, type ScanOptions } from '@bubblesjs/i18n-cli';
import { createElement } from 'react';
const store: I18nStore = createI18n({ locale: 'en', message: { hello: 'Hello {name}' } });
const values: MessageValues = { name: 'Bubbles' };
const translation: string = store.getState().tr('hello', values);
createElement(ReactProvider, { store, children: translation });
const config: I18nConfig = defineConfig({ projects: { app: { include: ['src/**/*.ts'], catalogs: { en: 'en.json' } } } });
const options: ScanOptions = { callNames: ['tr'] };
void [VueProvider, useReactStore, useVueStore, config, options];
`;
  writeFileSync(join(consumer, "consumer.mts"), typeConsumer);
  writeFileSync(join(consumer, "consumer.cts"), typeConsumer);
  writeFileSync(
    join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        noEmit: true,
        skipLibCheck: false,
      },
      include: ["consumer.mts", "consumer.cts"],
    }),
  );
  run(
    process.execPath,
    [join(consumer, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"],
    consumer,
  );
  assert.ok(
    existsSync(
      join(
        consumer,
        "node_modules/.bin",
        process.platform === "win32" ? "bubbles-i18n.cmd" : "bubbles-i18n",
      ),
    ),
  );
  assert.match(
    runPackageManager("npm", ["exec", "--offline", "--", "bubbles-i18n", "--help"], consumer),
    /bubbles-i18n/,
  );
  mkdirSync(join(consumer, "src"));
  writeFileSync(
    join(consumer, "src/demo.tsx"),
    "tr('hello'); tr('欢迎 {name}', { name: 'Bubbles' });\n",
  );
  writeFileSync(
    join(consumer, "i18n.config.ts"),
    "import { defineConfig } from '@bubblesjs/i18n-cli';\nexport default defineConfig({ projects: { app: { include: ['src/**/*.{ts,tsx}'], catalogs: { en: 'locales/en.json' } } } });\n",
  );
  const cli = join(consumer, "node_modules/@bubblesjs/i18n-cli/dist/cli.js");
  run(process.execPath, [cli, "check"], consumer, 1);
  run(process.execPath, [cli, "sync", "--dry-run"], consumer);
  assert.ok(!existsSync(join(consumer, "locales/en.json")));
  run(process.execPath, [cli, "sync"], consumer);
  assert.deepEqual(JSON.parse(readFileSync(join(consumer, "locales/en.json"), "utf8")), {
    hello: "hello",
    "欢迎 {name}": "欢迎 {name}",
  });
  run(process.execPath, [cli, "check"], consumer);
  console.log(
    "Verified packed installation: ESM/CJS, strict NodeNext types, React/Vue SSR, CLI bin, TS config, dry-run and sync/check.",
  );
} finally {
  assert.equal(dirname(consumer), temporaryRoot);
  assert.ok(temporaryRoot.startsWith(resolve(tmpdir())));
  rmSync(temporaryRoot, { recursive: true, force: true });
}
