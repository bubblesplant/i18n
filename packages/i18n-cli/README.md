# @bubblesjs/i18n-cli

扫描静态翻译调用，补齐 JSON 语言包，在 JSON 与 Excel 之间同步词条，并在 CI 中检查 key 是否完整。提供 `bubbles-i18n` 命令及 ESM / CommonJS API，需要 Node.js `>=22.18.0`。

[GitHub 仓库](https://github.com/bubblesplant/i18n) · [版本发布](https://github.com/bubblesplant/i18n/releases)

## 实现思路

```text
源码中的 tr("key")
  → sync：扫描项目，汇总 key，补齐各语言 JSON
  → excel export：JSON → Excel 翻译表
  → 译员填写或修改翻译
  → excel import：Excel → JSON
  → Vue / React 应用加载 JSON

check：检查源码 key 是否已存在于各语言 JSON
```

扫描按 `include` / `exclude` 选择文件，按 `callNames` 识别静态调用。`sync` 将缺失词条写为 `"key": "key"`，保留已有翻译；源码未发现的 JSON key 默认保留并逐项报告。

Excel 转换共用项目的 `catalogs`，按 key 和 locale 直接比较两边当前字符串值，不扫描源码、不依赖历史同步记录。同 key、同语言值不同，普通命令输出冲突报告并失败；新增 key 和目标端独有 key 分别处理。

CLI 维护文件，运行时加载与语言切换由核心容器和框架适配包负责，参见 [Vue 接入](https://github.com/bubblesplant/i18n/blob/main/apps/docs/guide/vue.md)、[React 接入](https://github.com/bubblesplant/i18n/blob/main/apps/docs/guide/react.md)。

## 安装与配置

```sh
pnpm add -D @bubblesjs/i18n-cli
```

项目根目录创建 `i18n.config.ts`：

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
      excel: {
        file: "translations/web.xlsx",
        sheet: "translations",
      },
    },
  },
  // 可选扫描 JSON 报告；自动 Markdown 报告独立生成。
  report: ".bubbles-i18n/report.json",
});
```

| 配置                          | 含义                                               |
| ----------------------------- | -------------------------------------------------- |
| `callNames`                   | 扫描调用名，默认 `["tr"]`                          |
| `projects.<name>.include`     | 扫描时必需的非空 glob 列表；仅维护 Excel 时可省略  |
| `projects.<name>.exclude`     | 扫描时额外排除的 glob 列表                         |
| `projects.<name>.catalogs`    | locale 到扁平字符串 JSON 的映射，扫描与 Excel 共用 |
| `projects.<name>.excel.file`  | Excel 转换时必需，一个项目对应一个 `.xlsx`         |
| `projects.<name>.excel.sheet` | CLI 管理的翻译 sheet 名，默认 `translations`       |
| `report`                      | 可选扫描 JSON 报告路径，Excel 命令不使用此配置     |

所有路径相对配置文件所在目录。默认向上查找配置，同目录依次尝试 `i18n.config.ts`、`.mts`、`.js`、`.mjs`、`.cts`、`.cjs`。ESM 使用 `export default`，CommonJS 使用 `module.exports`；TypeScript 配置由 Node.js 原生加载，使用可擦除类型语法。

不传 `--project` 时选择全部项目；不会自动跳过用途配置缺失的项目。扫描所选项目必须有 `include`，Excel 所选项目必须有 `excel`，否则返回 `2`，可通过 `--project` 选择适用项目。只维护 Excel 的项目可仅配置 `catalogs` 和 `excel`。

## 完整工作流

源码写 `tr("保存")` 和 `tr("你好 {name}", { name: "Ada" })`，先预览再同步：

```sh
pnpm exec bubbles-i18n sync --project web --dry-run
pnpm exec bubbles-i18n sync --project web
pnpm exec bubbles-i18n excel export --project web --dry-run
pnpm exec bubbles-i18n excel export --project web
```

已有 `"保存": "Save"` 会保留，新 key 初始值等于 key。缺失 JSON 自动创建。首次导出创建 Excel，第一列 `key` 是原文 / JSON key，横向每列是一种语言：

| key         | zh-CN       | en-US       |
| ----------- | ----------- | ----------- |
| 保存        | 保存        | Save        |
| 你好 {name} | 你好 {name} | 你好 {name} |

译员将英文值改为 `Hello {name}` 后，普通导入会报告 Excel 与 JSON 值不同并返回 `1`。确认采用 Excel 的译文后执行：

```sh
pnpm exec bubbles-i18n excel import --project web
pnpm exec bubbles-i18n excel import --project web --force --dry-run
pnpm exec bubbles-i18n excel import --project web --force
pnpm exec bubbles-i18n check --project web
```

`--force` 默认采用 Excel。要将 JSON 的改动覆盖到已有 Excel，使用 `excel export --force --prefer json`。应用继续加载原来的 JSON 文件。

```json
{
  "scripts": {
    "i18n:sync": "bubbles-i18n sync --project web",
    "i18n:check": "bubbles-i18n check --project web",
    "i18n:export": "bubbles-i18n excel export --project web",
    "i18n:import": "bubbles-i18n excel import --project web"
  }
}
```

## 参数与常见情况

| 参数                   | 适用范围                        | 含义                                       |
| ---------------------- | ------------------------------- | ------------------------------------------ |
| `--config <path>`      | 扫描 / Excel                    | 指定配置文件                               |
| `--project <name>`     | 扫描 / Excel                    | 项目选择，可以重复；默认全部               |
| `--locale <locale>`    | Excel                           | 语言选择，可以重复；默认项目全部语言       |
| `--dry-run`            | `sync` / Excel                  | 写预览报告，不改 JSON 或 Excel             |
| `--prune`              | `sync` / Excel                  | 删除目标端独有 key；Excel 必须显式选择项目 |
| `--clean`              | `sync`                          | 兼容旧清理参数，与 `--prune` 同义          |
| `--allow-empty`        | `sync --prune` / `sync --clean` | 有可读取源码但 key 为空时，允许清空 JSON   |
| `--force` / `-f`       | Excel                           | 解决值冲突，默认 Excel；不隐含删除         |
| `--prefer excel\|json` | Excel                           | 明确冲突优先方，必须搭配 `--force`         |
| `--fail-on-stale`      | `check`                         | 多余 key 也导致检查失败                    |

`targetOnly` 表示目标端存在、来源端不存在的 key。扫描以源码 key 集合为准；导出以项目全部已配置语言 JSON 的 key 并集为准；导入以 Excel 的 key 行为准。

| 情况 / 目的               | 命令示例                                                                         | 行为                                         |
| ------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------- |
| 扫描补齐 JSON             | `bubbles-i18n sync --project web`                                                | 缺失 key 补入，已有译文保留                  |
| 来源新增 key              | `bubbles-i18n excel export --project web` / `excel import --project web`         | 按方向补入目标端，不属于值冲突               |
| 目标端多余 key            | 普通 `sync` / `excel export` / `excel import`                                    | 保留并逐项报告，普通命令可成功               |
| 同 key、同语言值相同      | 普通 `excel export` / `excel import`                                             | 保持不变                                     |
| 同 key、同语言值不同      | 普通 `excel export` / `excel import`                                             | 报告冲突，返回 `1`，所有选中项目不写数据     |
| Excel 译文更新 JSON       | `bubbles-i18n excel import --project web --force`                                | 采用 Excel，等同于 `--force --prefer excel`  |
| JSON 译文更新 Excel       | `bubbles-i18n excel export --project web --force --prefer json`                  | 采用 JSON                                    |
| 导出保留 Excel 冲突值     | `bubbles-i18n excel export --project web --force`                                | 保留目标冲突值，仍补新 key，不回写 JSON      |
| 导入保留 JSON 冲突值      | `bubbles-i18n excel import --project web --force --prefer json`                  | 保留目标冲突值，仍补新 key，不回写 Excel     |
| 删除 JSON 多余 key        | `bubbles-i18n sync --project web --prune` / `excel import --project web --prune` | 分别以源码 / Excel key 集合为准              |
| 删除 Excel 多余行         | `bubbles-i18n excel export --project web --prune`                                | 删除不在全部语言 JSON 并集中的行             |
| 解决冲突并删除多余 key    | `bubbles-i18n excel import --project web --force --prune`                        | 值冲突与删除分别处理                         |
| 预览上述写入组合          | 追加 `--dry-run`                                                                 | 生成报告，不写 JSON / Excel                  |
| Excel 空单元格 / 空字符串 | `bubbles-i18n excel import --project web`                                        | 保留 JSON 原值，不新增空值，不按整行缺失删除 |
| CI 检查缺失 key           | `bubbles-i18n check --project web`                                               | 缺失 key 返回 `1`，多余项默认允许            |
| CI 同时检查多余 key       | `bubbles-i18n check --project web --fail-on-stale`                               | 缺失或多余 key 都返回 `1`                    |

`--prune` 只删除目标端独有 key，不解决值冲突；`--force` 只决定冲突取值，不删除 key。普通转换遇到冲突时，计划新增和删除也不执行。采用目标端值时，两边仍可能不同，再次运行普通命令仍会报告这些差异。

导出 `--locale` 只筛选语言值，不缩小用于判断多余行的全部语言 key 并集；导入只更新或删除所选语言的 JSON。可以重复指定项目和语言，例如 `--project web --project admin --locale zh-CN --locale en-US`。

`check` 不修改语言包，不接受 `--dry-run`、`--prune` 或 `--clean`。`--force` 不跳过参数、格式、重复 key、表头或路径校验。

| 退出码 | 含义                                                                               |
| ------ | ---------------------------------------------------------------------------------- |
| `0`    | 同步成功、检查通过或显示帮助                                                       |
| `1`    | Excel 值冲突未解决；检查缺失 key 或启用 `--fail-on-stale` 后有多余 key；未提供命令 |
| `2`    | 参数、配置、数据格式或文件操作错误                                                 |

## 报告与文件行为

三种同步命令自动生成 Markdown 报告，路径相对配置目录：

| 命令           | 报告                                    | 多余项明细                         |
| -------------- | --------------------------------------- | ---------------------------------- |
| `sync`         | `.bubbles-i18n/reports/sync.md`         | 项目、locale、JSON 路径、key       |
| `excel export` | `.bubbles-i18n/reports/excel-export.md` | 项目、Excel 路径、sheet、行号、key |
| `excel import` | `.bubbles-i18n/reports/excel-import.md` | 项目、locale、JSON 路径、key       |

报告逐项列出多余 key、处理结果和冲突两边的值；末尾提供保持配置、项目和语言范围的 `--prune --dry-run` 预览及 `--prune` 清理命令。冲突报告还提供手动处理和强制取值方式。无多余项也生成本次报告，预览中的计划不标为已执行。

现有 `report` 配置继续控制扫描的可选 JSON 报告，`sync`、预览和 `check` 按配置写出；`added`、`unused`、`deleted` 保持现有含义。省略 `report` 仅取消此 JSON 报告，`sync` 仍写 Markdown。Excel 不写扫描 JSON 报告。

所有所选项目先校验和比较，再写数据；未解决冲突时全部不写。扫描 JSON 沿用 BOM、换行、缩进和末尾换行，并用同目录临时文件原子替换；多文件写入不构成跨文件事务。

Excel 转换实际修改已有目标文件时，备份到目标同目录的 `.bubbles-i18n-backups/<runId>/<filename>`，报告列出路径。先准备全部临时文件和备份，再提交；失败时尽力回滚，不能保证多文件事务。预览不创建数据临时文件或备份。

## 扫描与 Excel 边界

扫描支持 `tr("保存")`、静态模板字符串和调用边界上的注释；不提取 `tr(key)`、字符串拼接或带插值的模板字符串。扫描采用文本匹配，不使用 AST，注释和普通字符串中完整的调用文本也会被识别。动态 key 自行维护，删除前应先预览。CLI 不生成 `generated.ts`。

默认排除 `.git`、`.pnpm-store`、`.vite`、`build`、`coverage`、`dist`、`node_modules`，以及 `.bubbles-i18n/**`、`.bubbles-i18n-backups/**` 下的报告和备份，不跟随符号链接，跳过含空字节的二进制文件。没有可读取源码时拒绝扫描清理，`--allow-empty` 也不能绕过；有源码但未扫描到 key 时，清空非空语言包需此参数。

Excel 仅支持 `.xlsx`，一项目一文件、一个托管翻译 sheet，保留其他 sheet 和备注列。第一列表头是 `key`，语言表头是 `catalogs` 的 locale ID，locale 不能使用保留名 `key`。新文件包含全部语言表头；已有文件只要求本次所选语言的表头，未选语言缺列不阻断操作。key 和译文精确匹配，不自动 trim。

重复 key、缺失所选语言列、空 key 带有翻译或不支持的数据类型会报错。翻译 sheet 的 key 与所选语言单元格不能合并，其他 sheet 的合并单元格可以保留。key 与所选语言的非空单元格必须是字符串，数字、布尔值、日期、公式、rich text 等会报错。导出文件不存在时创建；已有文件缺少指定翻译 sheet 或导入文件不存在时返回错误。

导出到 Excel 的单元格文本最多 32,767 个 UTF-16 代码单元，支持 Tab、LF / CR / CRLF、emoji、占位符和字面 `_xHHHH_` 文本。XML 不支持的控制字符、未配对的 UTF-16 代理项、U+FFFE 和 U+FFFF 会报错。写入时通过 ExcelJS 重写整本工作簿，对普通字符串单元格编码并重读验证，覆盖未选语言、备注列和其他 sheet；不符合限制的待保留字符串也会阻止导出。富文本、超链接、公式等复杂附加单元格若在重写后不能保持原值，会拒绝整个导出，不写数据。单元格值校验不保证嵌入对象等 Excel 高级特性完整保留，建议使用专门的翻译工作簿。

Excel `--prune` 拒绝用空 JSON key 并集清空已有 Excel，或用空翻译 sheet 清空非空 JSON；本版 `--allow-empty` 只用于扫描。

## 编程 API

```ts
import { runCli, scanSource, scanFiles } from "@bubblesjs/i18n-cli";

const occurrences = scanSource("tr('保存')");
// [{ key: "保存", index: 0, line: 1, column: 1 }]

const result = await scanFiles({
  rootDir: process.cwd(),
  include: ["src/**/*.{js,jsx,ts,tsx,vue}"],
  callNames: ["tr"],
});
console.log([...result.keys]);
console.log(result.occurrences); // 文件、行号和列号

const exitCode = await runCli(["check", "--project", "web"], {
  cwd: process.cwd(),
});
```

CommonJS 使用 `const { scanSource } = require("@bubblesjs/i18n-cli")`。

| API                                                                             | 用途                                               |
| ------------------------------------------------------------------------------- | -------------------------------------------------- |
| `defineConfig` / `loadConfig`                                                   | 配置类型提示、发现与校验                           |
| `scanSource` / `scanFiles`                                                      | 只扫描，返回 key 与位置，不修改语言包              |
| `syncCatalog` / `syncProject`                                                   | 同步语言包，传入路径须为绝对路径                   |
| `createSyncReport` / `writeSyncReport`                                          | 创建与写入扫描 JSON 报告                           |
| `planExcel` / `applyExcel`                                                      | 生成 Excel 转换计划 / 执行计划                     |
| `ExcelOptions` / `ExcelPlan` / `ExcelProjectInput` 等类型                       | 描述转换参数、输入、差异与冲突                     |
| `ExcelValidationError` / `ExcelConcurrentModificationError` / `ExcelApplyError` | 区分校验、并发修改与写入错误                       |
| `runCli` / `main`                                                               | 执行命令；`runCli` 抛出异常，`main` 转为退出码 `2` |

完整示例见 [CLI 指南](https://github.com/bubblesplant/i18n/blob/main/apps/docs/guide/cli.md)，详细规则见 [JSON 与 Excel 同步规则参考](https://github.com/bubblesplant/i18n/blob/main/packages/i18n-cli/docs/excel-sync-plan.md)。

## 在本仓库开发

```sh
pnpm --filter @bubblesjs/i18n-cli test
pnpm --filter @bubblesjs/i18n-cli typecheck
pnpm --filter @bubblesjs/i18n-cli build
pnpm --filter @bubblesjs/i18n-cli verify:package
```

发布产物包含编译后的 JavaScript、类型声明、README 和 MIT 许可证。版本发布见 [GitHub Releases](https://github.com/bubblesplant/i18n/releases)。
