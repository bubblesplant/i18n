# 词条 CLI

`@bubblesjs/i18n-cli` 扫描源码中的静态翻译调用，将缺失 key 同步到扁平 JSON 语言包，并在 CI 检查缺失或废弃词条。执行命令为 `bubbles-i18n`，也提供 ESM / CommonJS 编程 API。

需要 Node.js `>=22.18.0`。安装：

```sh
pnpm add -D @bubblesjs/i18n-cli
```

CLI 只维护词条文件。运行时翻译与语言加载由应用或[核心容器](./core)处理。

## 配置

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
        "zh-CN": "src/locales/zh-CN.json",
        "en-US": "src/locales/en-US.json",
      },
    },
  },
  report: ".bubbles-i18n/report.json",
});
```

所有相对路径基于配置文件所在目录。默认从当前工作目录向上查找配置，在同一目录按 `.ts`、`.mts`、`.js`、`.mjs`、`.cts`、`.cjs` 顺序尝试 `i18n.config` 文件。

ESM 配置使用 `export default`，CommonJS 使用 `module.exports`。TypeScript 配置由 Node.js 原生加载，需使用可擦除的类型语法，不能依赖额外 TS 转译配置。

| 字段                       | 含义                                                    |
| -------------------------- | ------------------------------------------------------- |
| `callNames`                | 调用名列表，默认 `["tr"]`，例如 `["tr", "$t"]`          |
| `projects`                 | 至少一个项目，独立维护源码与语言包                      |
| `projects.<name>.include`  | 非空 glob 列表                                          |
| `projects.<name>.exclude`  | 额外排除 glob 列表                                      |
| `projects.<name>.catalogs` | locale 到 JSON 路径的映射，文件内容必须是扁平字符串对象 |
| `report`                   | 可选 JSON 报告路径，省略时不生成报告                    |

默认排除 `.git`、`.pnpm-store`、`.vite`、`build`、`coverage`、`dist`、`node_modules`，不跟随符号链接，跳过包含空字节的二进制文件。多个项目或语言不能共用同一个语言包输出路径。

## 扫描边界

识别静态字符串调用：

```ts
tr("保存");
tr("Open");
tr(`用户`);
tr("你好 {name}", { name });
tr(/* 说明 */ "保存" /* 说明 */);
```

不提取动态表达式：

```ts
tr(key);
tr(getKey());
tr("prefix-" + value);
tr(`你好 ${name}`);
```

扫描使用文本匹配，不使用 AST。注释和普通字符串中完整的 `tr('key')` 文本也可能被识别。动态 key 要自行维护；使用清理前先查看预览，避免删除扫描器无法识别的词条。支持常见字符串转义、静态模板字符串和调用边界上的空白、行注释与块注释；字符串内部的注释符号作为正文保留。

## 同步和检查

```sh
# 先预览，再写入语言包
pnpm exec bubbles-i18n sync --dry-run
pnpm exec bubbles-i18n sync

# 检查缺失 key
pnpm exec bubbles-i18n check

# 检查时也把废弃 key 视为失败
pnpm exec bubbles-i18n check --fail-on-stale

# 指定配置与项目；--project 可重复传入
pnpm exec bubbles-i18n sync --config ./config/i18n.config.mjs --project web
```

源码出现 `tr("保存")` 后，缺少 key 的 JSON 新增 `"保存": "保存"`；已经存在的 `"保存": "Save"` 保持原样。文件不存在时自动创建。

默认保留废弃 key。需要删除时先预览，再清理：

```sh
pnpm exec bubbles-i18n sync --clean --dry-run
pnpm exec bubbles-i18n sync --clean
```

有可读取文本源文件但完全没有静态 key 时，清空非空语言包需显式增加 `--allow-empty`。如果完全没有匹配到可读取文本源文件，`--clean` 会拒绝执行，`--allow-empty` 也不能绕过。

`check` 不写语言 JSON，不能与 `--clean` 或 `--dry-run` 组合。`--fail-on-stale` 只用于 check，`--allow-empty` 必须与 `sync --clean` 一起使用。

| 退出码 | 含义                                                                          |
| ------ | ----------------------------------------------------------------------------- |
| `0`    | 同步成功、检查通过或显示帮助                                                  |
| `1`    | 检查发现缺失词条，或使用 `--fail-on-stale` 时发现废弃词条；未提供命令也返回 1 |
| `2`    | 参数、配置、语言包校验或文件操作错误                                          |

## 报告与写入行为

配置 `report` 后，`sync`、`sync --dry-run` 和 `check` 都会写报告。预览和检查保证不改语言 JSON，并不保证整个命令没有文件写入；只想查看终端输出时省略 report。

报告路径不能覆盖配置文件、语言包、扫描源码或已有的非 CLI 报告文件。所有选中项目的 JSON 先校验，再开始写入；每个文件通过同目录临时文件原子替换，沿用原文件的 BOM、换行、缩进和末尾换行。多文件写入不是跨文件事务。

```json
{
  "command": "sync",
  "clean": false,
  "dryRun": true,
  "files": [
    {
      "project": "web",
      "path": "src/locales/en-US.json",
      "locale": "en-US",
      "added": ["保存"],
      "unused": ["旧文案"],
      "deleted": [],
      "unchangedCount": 2
    }
  ]
}
```

每个 `files` 项对应一个 JSON 文件。路径相对配置目录展示；`added` 是缺失 key，`unused` 是保留的废弃 key，`deleted` 是清理删除的 key，`unchangedCount` 是已有且仍被使用的 key 数量。

## 编程 API

```ts
import { runCli, scanSource } from "@bubblesjs/i18n-cli";

const occurrences = scanSource("tr('保存')");
// [{ key: "保存", index: 0, line: 1, column: 1 }]

const exitCode = await runCli(["check"], { cwd: process.cwd() });
```

CommonJS 使用 `const { scanSource } = require("@bubblesjs/i18n-cli")`。

| API                                    | 用途                                                   |
| -------------------------------------- | ------------------------------------------------------ |
| `defineConfig` / `loadConfig`          | 配置类型提示、发现与校验                               |
| `scanSource` / `scanFiles`             | 扫描文本或文件集合，返回 key 与出现位置                |
| `syncCatalog` / `syncProject`          | 同步语言包，传入路径须为绝对路径                       |
| `createSyncReport` / `writeSyncReport` | 创建与写入报告                                         |
| `runCli` / `main`                      | 执行命令；runCli 抛出异常，main 输出诊断并转为退出码 2 |

CLI 不生成 `generated.ts`。Excel 导入和导出尚未实现，源模板中的 Excel 文档只是后续规划。
