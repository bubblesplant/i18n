# @bubblesjs/i18n-cli

扫描源码中的静态翻译调用，把缺失的 key 同步到扁平 JSON 语言包，并在 CI 中检查词条是否完整。提供可执行命令和 ESM / CommonJS API，运行需要 Node.js 22.18.0 或更高版本。

## 安装与快速开始

```bash
pnpm add -D @bubblesjs/i18n-cli
```

在项目根目录创建 `i18n.config.ts`：

```ts
import { defineConfig } from "@bubblesjs/i18n-cli";

export default defineConfig({
  callNames: ["tr"],
  projects: {
    web: {
      include: ["src/**/*.{js,jsx,ts,tsx,vue}"],
      exclude: ["src/**/*.test.*"],
      catalogs: {
        zh_CN: "src/locales/zh_CN.json",
        en_US: "src/locales/en_US.json",
      },
    },
  },
  report: ".bubbles-i18n/report.json",
});
```

```bash
# 先预览，再把缺失词条添加到语言包
pnpm exec bubbles-i18n sync --dry-run
pnpm exec bubbles-i18n sync

# CI 检查缺失词条
pnpm exec bubbles-i18n check
```

例如源码中出现 `tr('保存')`，同步时会在缺少该 key 的 JSON 中新增 `"保存": "保存"`；已有的 `"保存": "Save"` 翻译保持原样。语言包不存在时自动创建。

也可以加入应用的 `package.json`：

```json
{
  "scripts": {
    "i18n:sync": "bubbles-i18n sync",
    "i18n:check": "bubbles-i18n check"
  }
}
```

## 配置

所有相对路径均以配置文件所在目录为基准。默认从当前工作目录向上查找配置，依次尝试 `i18n.config.ts`、`.mts`、`.js`、`.mjs`、`.cts`、`.cjs`；同目录存在多个配置时，采用这个顺序中最先找到的文件。ESM 使用 `export default`，CommonJS 使用 `module.exports`。TypeScript 配置由 Node.js 原生加载，使用可擦除类型语法。

| 字段                       | 含义                                               |
| -------------------------- | -------------------------------------------------- |
| `callNames`                | 调用名列表，默认 `['tr']`，可以改为 `['tr', '$t']` |
| `projects`                 | 至少一个项目，每个项目独立维护自己的源码与语言包   |
| `projects.<name>.include`  | 非空 glob 列表，例如 `['apps/web/src/**/*.tsx']`   |
| `projects.<name>.exclude`  | 额外排除的 glob 列表                               |
| `projects.<name>.catalogs` | locale 到 JSON 路径的映射，值必须是扁平字符串对象  |
| `report`                   | 可选 JSON 报告输出路径；省略时不生成报告           |

默认排除 `.git`、`.pnpm-store`、`.vite`、`build`、`coverage`、`dist` 和 `node_modules`，不跟随符号链接，跳过包含空字节的二进制文件。多个项目或语言不能共用同一个语言包输出路径。

## 扫描规则

支持 JavaScript、TypeScript、TSX 和 Vue 模板等文本文件中的静态调用：

```ts
tr("保存");
tr("Open");
tr(`用户`);
tr("你好 {name}", { name });
tr(/* 说明 */ "保存" /* 说明 */);
```

不会提取动态表达式：

```ts
tr(key);
tr(getKey());
tr("prefix-" + value);
tr(`你好 ${name}`);
```

扫描器按文本匹配，不使用 AST。因此注释和普通字符串中完整的 `tr('key')` 文本也会被识别。使用 `--clean` 前应先查看预览；动态 key 需要自行维护，不会自动提取。支持常见字符串转义、静态模板字符串，以及调用边界上的空白、行注释和块注释；字符串内部的注释符号按词条正文保留。

CLI 负责提取和维护 JSON，不生成 `generated.ts`。运行时加载语言包、语言切换和类型定义由应用或 `@bubblesjs/i18n-core` 及框架适配包负责。Excel 导入与导出尚未实现，仓库中的 Excel 文档属于后续规划。

## 命令与退出码

```bash
# 添加缺失 key；已有翻译保持不变
pnpm exec bubbles-i18n sync

# 指定配置文件；指定项目可以重复传入
pnpm exec bubbles-i18n sync --config ./config/i18n.config.mjs --project web

# 预览删除与新增，不写入语言包
pnpm exec bubbles-i18n sync --dry-run --clean

# 删除源码中已不存在的 key
pnpm exec bubbles-i18n sync --clean

# 源文件存在但没有静态 key 时，明确允许清空非空语言包
pnpm exec bubbles-i18n sync --clean --allow-empty

# 检查时把废弃 key 也视为失败
pnpm exec bubbles-i18n check --fail-on-stale

pnpm exec bubbles-i18n --help
```

| 退出码 | 含义                                                                                      |
| ------ | ----------------------------------------------------------------------------------------- |
| `0`    | 同步成功、检查通过，或显示帮助                                                            |
| `1`    | 检查发现缺失词条；使用 `--fail-on-stale` 时也包括废弃词条；未提供命令时显示帮助并返回 `1` |
| `2`    | 命令参数、配置、语言包校验或文件操作错误                                                  |

`check` 不修改语言包，不能与 `--clean` / `--dry-run` 组合。`--fail-on-stale` 仅用于 `check`；`--allow-empty` 必须与 `sync --clean` 一起使用。

`--clean` 会拒绝完全没有匹配到可读取文本源文件的项目，包括仅匹配二进制文件的情况。即使传入 `--allow-empty` 也不能绕过此项保护。

## 同步与报告

缺失 key 写为 `"key": "key"`，已有翻译保持不变。默认把废弃 key 放入 `unused` 而不删除；`--clean` 将它们删除并记录在 `deleted`。所有选中项目的 JSON 会先校验，再开始写入；每个文件使用同目录临时文件和原子替换，沿用原文件的 BOM、换行、缩进和末尾换行。多个文件的写入不构成跨文件事务。

配置 `report` 后，`sync`、`sync --dry-run` 和 `check` 都会写出报告；其中预览和检查只保证不改语言包。报告路径不能覆盖配置文件、语言包、扫描到的源码或已有非 CLI 报告文件。

```json
{
  "command": "sync",
  "clean": false,
  "dryRun": false,
  "files": [
    {
      "project": "web",
      "path": "src/locales/en_US.json",
      "locale": "en_US",
      "added": ["English", "中文"],
      "unused": ["旧文案"],
      "deleted": [],
      "unchangedCount": 2
    }
  ]
}
```

每个 `files` 项代表一个 JSON 文件。报告中的路径相对配置目录显示，`unchangedCount` 表示语言包内已有且仍在源码中使用的 key 数量。

## 编程 API

```ts
import { runCli, scanSource } from "@bubblesjs/i18n-cli";

const occurrences = scanSource("tr('保存')");
// [{ key: '保存', index: 0, line: 1, column: 1 }]

const exitCode = await runCli(["check"], { cwd: process.cwd() });
```

CommonJS 可以使用 `const { scanSource } = require('@bubblesjs/i18n-cli')`。

| API                                    | 用途                                                         |
| -------------------------------------- | ------------------------------------------------------------ |
| `defineConfig` / `loadConfig`          | 配置类型提示、发现与校验                                     |
| `scanSource` / `scanFiles`             | 扫描文本或文件集合，返回 key 与出现位置                      |
| `syncCatalog` / `syncProject`          | 同步单个或多个语言包；路径须为绝对路径                       |
| `createSyncReport` / `writeSyncReport` | 创建与写入报告                                               |
| `runCli` / `main`                      | 执行命令；`runCli` 抛出异常，`main` 输出诊断并转为退出码 `2` |

## 在本仓库开发

```bash
pnpm --filter @bubblesjs/i18n-cli test
pnpm --filter @bubblesjs/i18n-cli typecheck
pnpm --filter @bubblesjs/i18n-cli build
pnpm --filter @bubblesjs/i18n-cli verify:package
```

测试覆盖扫描与转义、TSX / Vue 文件、配置发现、保留翻译、预览、清理保护、跨项目校验、报告和退出码。发布产物包含编译后的 JavaScript、类型声明、README 和 MIT 许可证。
