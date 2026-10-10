# CLI：扫描项目与 JSON / Excel 同步

`@bubblesjs/i18n-cli` 扫描项目中的静态翻译调用，补齐 JSON 语言包，并在 JSON 与 Excel 之间同步词条。命令名为 `bubbles-i18n`，同时提供 ESM / CommonJS 编程 API。

[GitHub 仓库](https://github.com/bubblesplant/i18n) · [版本发布](https://github.com/bubblesplant/i18n/releases)

## 核心流程与实现思路

```text
Vue / React / JS / TS 源码
  → sync 扫描静态 tr("key")，汇总并去重 key
  → 各语言 JSON
      → excel export → Excel 翻译表
      ← excel import ← 译员填写的 Excel
  → Vue / React 应用加载 JSON，显示翻译

check：检查源码 key 是否已存在于各语言 JSON，供 CI 使用
```

扫描按 `include` / `exclude` 选择文件，以 `callNames` 识别静态调用，并记录 key 的文件、行号和列号。`sync` 把扫描得到的 key 集合与每个语言 JSON 比较：缺失项写为 `"key": "key"`，已有译文原样保留，多余项默认保留并报告。

Excel 转换读取同一份 `catalogs` 与项目的 `.xlsx`，按 key 和 locale 直接比较当前字符串值。同 key、同语言的值不同，普通命令输出冲突报告并停止；单边新增和目标端独有 key 与值冲突分别处理。转换不扫描源码，也不需要上次同步记录。

JSON 是应用运行时加载的语言包，Excel 用于维护译文。应用接入见 [Vue 接入](./vue)、[React 接入](./react)和[核心容器](./core)。扫描包含在 `sync` 和 `check` 中；单独获取扫描结果可用 `scanSource` / `scanFiles`，没有独立的 `scan` 子命令。

## 安装与配置

需要 Node.js `>=22.18.0`：

```sh
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
        "zh-CN": "src/locales/zh-CN.json",
        "en-US": "src/locales/en-US.json",
      },
      excel: {
        file: "translations/web.xlsx",
        sheet: "translations",
      },
    },
  },
  // 可选：保留扫描流程的机器可读 JSON 报告。
  report: ".bubbles-i18n/report.json",
});
```

| 字段                          | 含义                                                                     |
| ----------------------------- | ------------------------------------------------------------------------ |
| `callNames`                   | 扫描调用名，默认 `["tr"]`，例如 `["tr", "$t"]`                           |
| `projects`                    | 至少一个项目，每个项目维护自己的语言包                                   |
| `projects.<name>.include`     | 扫描时必需的非空 glob 列表；仅维护 Excel 时可省略                        |
| `projects.<name>.exclude`     | 扫描时额外排除的 glob 列表                                               |
| `projects.<name>.catalogs`    | locale 到 JSON 路径的映射；JSON 必须是扁平字符串对象                     |
| `projects.<name>.excel.file`  | Excel 转换时必需，一个项目对应一个 `.xlsx`                               |
| `projects.<name>.excel.sheet` | CLI 管理的翻译 sheet 名，默认 `translations`                             |
| `report`                      | 可选扫描 JSON 报告路径；不影响自动 Markdown 报告，Excel 命令不使用此配置 |

Excel 直接复用项目的 `catalogs`，不用重复配置 JSON 路径。只维护 Excel 的项目可以省略 `include`：

```ts
export default defineConfig({
  projects: {
    translations: {
      catalogs: {
        "zh-CN": "locales/zh-CN.json",
        "en-US": "locales/en-US.json",
      },
      excel: { file: "translations/shared.xlsx", sheet: "translations" },
    },
  },
});
```

不传 `--project` 时选择配置中的全部项目，不会自动跳过缺少用途配置的项目。`sync` / `check` 所选项目必须有 `include`，Excel 命令所选项目必须有 `excel`。不满足要求时返回 `2`，可用 `--project` 缩小范围。

所有相对路径基于配置文件所在目录。默认从当前工作目录向上查找配置，同目录按 `.ts`、`.mts`、`.js`、`.mjs`、`.cts`、`.cjs` 顺序尝试 `i18n.config` 文件。ESM 使用 `export default`，CommonJS 使用 `module.exports`；TypeScript 配置由 Node.js 原生加载，需使用可擦除类型语法。

## 从源码到翻译表，再回到应用 {#excel-workflow}

在 Vue 模板 / 脚本、React 的 JSX / TSX 或普通源码中使用静态 key：

```ts
tr("保存");
tr("你好 {name}", { name: "Ada" });
```

先扫描并补齐语言包：

```sh
pnpm exec bubbles-i18n sync --project web --dry-run
pnpm exec bubbles-i18n sync --project web
```

如果英文 JSON 原来只有 `"保存": "Save"`，同步后会保留 `Save`，补上新 key：

```json
{
  "保存": "Save",
  "你好 {name}": "你好 {name}"
}
```

缺失的语言 JSON 会自动创建。接着导出 Excel：

```sh
pnpm exec bubbles-i18n excel export --project web --dry-run
pnpm exec bubbles-i18n excel export --project web
```

首次导出时，Excel 文件不存在就创建文件。表格第一列的 `key` 是原文 / JSON key，后面的表头对应 `catalogs` 中的 locale：

| key         | zh-CN       | en-US       |
| ----------- | ----------- | ----------- |
| 保存        | 保存        | Save        |
| 你好 {name} | 你好 {name} | 你好 {name} |

译员把 `en-US` 列的 `你好 {name}` 改为 `Hello {name}` 后，普通导入会发现 Excel 与 JSON 当前值不同，输出冲突报告并返回 `1`。确认使用 Excel 中的译文，先预览再执行：

```sh
pnpm exec bubbles-i18n excel import --project web
pnpm exec bubbles-i18n excel import --project web --force --dry-run
pnpm exec bubbles-i18n excel import --project web --force
pnpm exec bubbles-i18n check --project web
```

`--force` 默认采用 Excel，也可显式写 `--force --prefer excel`。导入后 JSON 中的值变为 `Hello {name}`，应用继续加载同一路径的 JSON。`check` 只检查 key 是否齐全，不判断翻译质量、默认值是否已翻译或占位符是否一致。

已有 Excel 中存在值冲突时，若要把 JSON 的译文更新到 Excel，使用 `excel export --force --prefer json`。普通命令始终先报告当前值差异，不根据哪一边最近修改过自动覆盖。

常用脚本：

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

## 命令、参数与退出码

| 命令                        | 用途                   | 数据写入目标     |
| --------------------------- | ---------------------- | ---------------- |
| `bubbles-i18n sync`         | 扫描源码，补齐缺失 key | 所选项目的 JSON  |
| `bubbles-i18n check`        | 检查源码 key 是否完整  | 不写语言包       |
| `bubbles-i18n excel export` | JSON → Excel           | 所选项目的 Excel |
| `bubbles-i18n excel import` | Excel → JSON           | 所选项目的 JSON  |
| `bubbles-i18n --help`       | 查看帮助               | 不写数据         |

| 参数                   | 适用命令                        | 用途                                                   |
| ---------------------- | ------------------------------- | ------------------------------------------------------ |
| `--config <path>`      | 所有命令                        | 指定配置文件                                           |
| `--project <name>`     | 所有业务命令                    | 选择项目，可以重复传入；默认全部                       |
| `--locale <locale>`    | Excel 导出 / 导入               | 选择语言，可以重复传入；默认项目全部语言               |
| `--dry-run`            | `sync`、Excel 导出 / 导入       | 生成预览报告，不写 JSON / Excel                        |
| `--prune`              | `sync`、Excel 导出 / 导入       | 删除目标端独有 key；Excel 转换必须显式指定 `--project` |
| `--clean`              | `sync`                          | 兼容旧用法，与 `--prune` 执行相同清理行为              |
| `--allow-empty`        | `sync --prune` / `sync --clean` | 有可读取源码但未扫描到 key 时，明确允许清空语言包      |
| `--force` / `-f`       | Excel 导出 / 导入               | 解决值冲突；默认采用 Excel，不隐含删除                 |
| `--prefer excel\|json` | Excel 导出 / 导入               | 指定冲突优先方；必须搭配 `--force`                     |
| `--fail-on-stale`      | `check`                         | 把源码未使用的 JSON key 也视为检查失败                 |

例如，导入两个项目中的两种语言：

```sh
pnpm exec bubbles-i18n excel import --project web --project admin --locale zh-CN --locale en-US --force --dry-run
```

`check` 不接受 `--dry-run`、`--prune` 或 `--clean`，保持只检查的行为。`--force` 不跳过格式、路径、重复 key 或表头校验。

| 退出码 | 含义                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------- |
| `0`    | 同步成功、检查通过或显示帮助                                                                            |
| `1`    | Excel 存在未解决的值冲突；或检查缺失 key，启用 `--fail-on-stale` 后也包括多余 key；未提供命令也返回 `1` |
| `2`    | 参数、配置、数据格式或文件操作错误                                                                      |

## 各种情况如何处理

`targetOnly` 指目标端有、来源端没有的 key。扫描来源是源码 key 集合；导出来源是项目所有已配置语言 JSON key 的并集；导入来源是 Excel 中的 key 行。

| 当前情况                 | 扫描 → JSON              | JSON → Excel                                     | Excel → JSON                      |
| ------------------------ | ------------------------ | ------------------------------------------------ | --------------------------------- |
| 来源端有 key，目标端没有 | 补入 JSON，值等于 key    | 追加 Excel 行，写入语言值                        | 补入有值语言的 JSON               |
| 目标端有 key，来源端没有 | 保留，逐项报告           | 保留 Excel 行，逐项报告                          | 保留 JSON key，逐项报告           |
| key 存在且值相同         | 保留已有译文             | 保持不变                                         | 保持不变                          |
| 同 key、同语言值不同     | 保留已有译文，不作值比较 | 报告冲突，普通命令失败                           | 报告冲突，普通命令失败            |
| Excel 语言单元格为空     | 不涉及 Excel             | JSON 有值则补入；该语言缺 key 则保留现有值或空白 | 保留 JSON 原值，不新增空值        |
| Excel 整行不存在         | 不涉及 Excel             | JSON 有此 key 时追加行                           | JSON 有此 key 时记为 `targetOnly` |

以下命令都以项目 `web` 为例：

| 操作 / 情况               | 命令                                                                    | 结果                                                 |
| ------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| 扫描补齐 JSON             | `bubbles-i18n sync --project web`                                       | 新增缺失 key，保留已有译文和多余项                   |
| 扫描清理预览              | `bubbles-i18n sync --project web --prune --dry-run`                     | 报告新增 / 删除计划，不改 JSON                       |
| 删除扫描未发现的 JSON key | `bubbles-i18n sync --project web --prune`                               | 补齐缺失 key，删除多余项；`--clean` 同义             |
| 普通导出                  | `bubbles-i18n excel export --project web`                               | 补入新 key，保留 Excel 独有行；有值冲突则失败        |
| 普通导入                  | `bubbles-i18n excel import --project web`                               | 补入新 key，保留 JSON 独有 key；有值冲突则失败       |
| 用 JSON 译文更新 Excel    | `bubbles-i18n excel export --project web --force --prefer json`         | 冲突单元格采用 JSON 值                               |
| 用 Excel 译文更新 JSON    | `bubbles-i18n excel import --project web --force`                       | 冲突项采用 Excel 值；等同于 `--force --prefer excel` |
| 导出时保留 Excel 冲突值   | `bubbles-i18n excel export --project web --force`                       | 补入新 key，保留 Excel 冲突值，不回写 JSON           |
| 导入时保留 JSON 冲突值    | `bubbles-i18n excel import --project web --force --prefer json`         | 补入新 key，保留 JSON 冲突值，不回写 Excel           |
| 删除 Excel 独有行         | `bubbles-i18n excel export --project web --prune`                       | 无未解决值冲突时删除多余行                           |
| 删除 JSON 独有 key        | `bubbles-i18n excel import --project web --prune`                       | 无未解决值冲突时删除所选语言的多余 key               |
| 采用 Excel 并清理 JSON    | `bubbles-i18n excel import --project web --force --prune`               | 分别解决值冲突和删除多余 key                         |
| 采用 JSON 并清理 Excel    | `bubbles-i18n excel export --project web --force --prefer json --prune` | 分别解决值冲突和删除多余行                           |
| 预览任何写入组合          | 上述写入命令追加 `--dry-run`                                            | 仍生成报告，不改 JSON / Excel                        |
| 检查完整性                | `bubbles-i18n check --project web`                                      | 缺失 key 返回 `1`，多余项默认不失败                  |
| 检查完整性和多余项        | `bubbles-i18n check --project web --fail-on-stale`                      | 缺失或多余 key 都返回 `1`                            |

值冲突与删除相互独立：`--prune` 不解决值冲突，`--force` 不删除 key。任一选中项目存在未解决的值冲突时，所有选中项目的数据文件都不写入，包括计划新增和删除项。

命令只写箭头目标端。导出采用 Excel 值、导入采用 JSON 值时，两边仍可能不同；再次执行普通命令仍会报告这些差异。

导出使用全部已配置语言的 key 并集判断多余行，`--locale` 只筛选语言值处理，不会把仅存在于未选语言的 key 行删掉。导入指定 `--locale` 时，只更新或清理所选语言的 JSON；空 cell 和空字符串均保留 JSON 原值，不等同于缺少整行，不会因为 `--prune` 清空译文。

## 报告与写入行为 {#reports}

`sync` 和两种 Excel 转换自动生成 Markdown 报告，路径相对配置目录：

| 命令           | 报告文件                                | 多余 key 的明细                       |
| -------------- | --------------------------------------- | ------------------------------------- |
| `sync`         | `.bubbles-i18n/reports/sync.md`         | project、locale、JSON 路径、key       |
| `excel export` | `.bubbles-i18n/reports/excel-export.md` | project、Excel 路径、sheet、行号、key |
| `excel import` | `.bubbles-i18n/reports/excel-import.md` | project、locale、JSON 路径、key       |

多余项默认保留，终端和报告逐项列出。没有多余项也生成本次报告。报告区分已保留、计划删除、已删除和未执行；`--dry-run` 中的计划不会写成已经执行。

扫描报告明细示例：

| 项目 | 语言  | JSON 文件              | 多出的 key | 处理结果 |
| ---- | ----- | ---------------------- | ---------- | -------- |
| web  | zh-CN | src/locales/zh-CN.json | 旧登录按钮 | 已保留   |
| web  | en-US | src/locales/en-US.json | 旧登录按钮 | 已保留   |

同一个 key 出现在两个语言文件中，表示两个 JSON 条目。报告末尾提供保持配置、项目和语言范围的清理预览与执行命令，例如：

```sh
pnpm exec bubbles-i18n sync --project web --prune --dry-run
pnpm exec bubbles-i18n sync --project web --prune
```

Excel 冲突报告还列出 key、locale、JSON 当前值、Excel 当前值和文件 / 单元格位置，并提供手动处理或指定优先方的办法。即使有冲突，`--prune` 也不能跳过它。

现有 `report` 继续控制扫描的可选 JSON 报告：`sync`、`sync --dry-run` 和 `check` 会按配置写出，字段 `added`、`unused`、`deleted` 保持原有含义。省略 `report` 只取消此 JSON 报告，`sync` 仍自动生成 Markdown；Excel 命令不写这个扫描 JSON 报告。

所有选中项目先校验、比较，再执行写入。扫描 JSON 通过同目录临时文件原子替换，沿用原文件的 BOM、换行、缩进和末尾换行；多个数据文件不构成跨文件事务。

Excel 转换实际修改已有目标文件时，自动备份到目标同目录的 `.bubbles-i18n-backups/<runId>/<filename>`，报告列出备份路径。先准备全部临时文件和备份，再提交；提交失败时尽力回滚，不能保证所有文件操作失败都完全无变化。预览不创建数据临时文件或备份。

## 扫描与 Excel 的边界

扫描支持 JavaScript、TypeScript、JSX / TSX、Vue 模板等文本中的静态调用：

```ts
tr("保存");
tr(`用户`);
tr("你好 {name}", { name });
tr(/* 说明 */ "保存" /* 说明 */);
```

不会提取动态表达式 `tr(key)`、`tr(getKey())`、`tr("prefix-" + value)` 或带插值的模板字符串。扫描使用文本匹配，不使用 AST；注释和普通字符串中完整的调用文本也会被识别。动态 key 需要自行维护，清理前应查看预览。

默认排除 `.git`、`.pnpm-store`、`.vite`、`build`、`coverage`、`dist`、`node_modules`，以及 `.bubbles-i18n/**`、`.bubbles-i18n-backups/**` 下的报告和备份，不跟随符号链接，跳过包含空字节的二进制文件。扫描清理时，没有可读取源码就拒绝删除；有源码但没有静态 key，清空非空语言包需 `--allow-empty`。完全没有可读取源码时，此参数也不能绕过保护。

Excel 只支持 `.xlsx`。每个项目使用独立文件、一个托管翻译 sheet；其他 sheet 保留。已有文件缺少指定翻译 sheet 时返回错误，避免悄悄创建新 sheet。导出目标文件不存在时可以创建；导入来源文件不存在时返回错误。

第一列表头为 `key`，语言表头为 `catalogs` 的 locale ID，locale 不能使用保留名 `key`。新 Excel 包含全部语言表头；已有 Excel 只要求本次所选语言的表头，未选语言缺列不阻断本次操作。其他备注列保留。

重复 key、空 key 带有翻译、缺失所选语言表头或不支持的数据类型会报错。翻译 sheet 的 key 与所选语言单元格不能合并，避免写入一个单元格时连带修改其他 key 或译文；其他 sheet 的合并单元格可以保留。key 与所选语言的非空单元格必须是字符串；数字、布尔值、日期、公式、rich text 等不能作为译文。`--force` 不跳过这些校验。key 和译文精确匹配，不自动去除首尾空格或改写换行。

导出到 Excel 的单元格文本最多 32,767 个 UTF-16 代码单元。支持 Tab、LF / CR / CRLF、emoji、占位符和字面 `_xHHHH_` 文本；XML 不支持的控制字符、未配对的 UTF-16 代理项、U+FFFE 和 U+FFFF 会报错。发生写入时会通过 ExcelJS 重写整本工作簿，对其中的普通字符串单元格编码并重读验证，包括未选语言、备注列和其他 sheet；待保留的普通字符串不符合这些限制，也会阻止导出。富文本、超链接、公式等复杂附加单元格若在重写后不能保持原值，会拒绝整个导出，不写数据。单元格值校验不保证嵌入对象等 Excel 高级特性完整保留，建议使用专门的翻译工作簿。

Excel 清理拒绝用空来源清空已有目标：导出时所有 JSON 的 key 并集为空、导入时翻译 sheet 没有 key 而目标 JSON 非空，都不能执行全量删除。本版 `--allow-empty` 只用于扫描。

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

| API                                                                             | 用途                                                         |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `defineConfig` / `loadConfig`                                                   | 配置类型提示、发现与校验                                     |
| `scanSource` / `scanFiles`                                                      | 只扫描，返回 key 与出现位置，不修改语言包                    |
| `syncCatalog` / `syncProject`                                                   | 同步语言包，传入路径须为绝对路径                             |
| `createSyncReport` / `writeSyncReport`                                          | 创建与写入扫描 JSON 报告                                     |
| `planExcel` / `applyExcel`                                                      | 生成 Excel 转换计划 / 执行计划                               |
| `ExcelOptions` / `ExcelPlan` / `ExcelProjectInput` 等类型                       | 描述转换参数、输入、差异与冲突                               |
| `ExcelValidationError` / `ExcelConcurrentModificationError` / `ExcelApplyError` | 区分 Excel 校验、并发修改与写入错误                          |
| `runCli` / `main`                                                               | 执行命令；`runCli` 抛出异常，`main` 输出诊断并转为退出码 `2` |

CLI 不生成 `generated.ts`。完整规则见 [JSON 与 Excel 同步规则参考](https://github.com/bubblesplant/i18n/blob/main/packages/i18n-cli/docs/excel-sync-plan.md)，版本发布见 [GitHub Releases](https://github.com/bubblesplant/i18n/releases)。
