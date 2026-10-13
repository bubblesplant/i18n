# 命令行工具

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

扫描按 `include` / `exclude` 选择文件，以 `callNames` 识别静态调用，并记录 key 的文件、行号和列号。`sync` 将缺失项写为 `"key": "key"`，保留已有译文，默认保留多余项并报告。

Excel 转换复用 `catalogs`，按 key 和 locale 比较 JSON 与 Excel 的当前字符串值，不扫描源码，也不依赖上次同步记录。同 key、同语言的值不同会报告冲突并停止，详见[处理规则](#各种情况如何处理)。

应用加载 JSON，接入方式见 [Vue](./vue)、[React](./react)和[核心容器](./core)。扫描包含在 `sync` / `check` 中；单独获取结果可用 `scanSource` / `scanFiles`，没有独立的 `scan` 子命令。

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
      // excel: { file: "translations/web.xlsx", sheet: "review" },
    },
  },
  // report: false, // 关闭扫描 JSON 报告
  // report: "reports/i18n.json", // 自定义扫描 JSON 报告路径
});
```

| 字段                              | 含义                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| `callNames`                       | 扫描调用名，默认 `["tr"]`，例如 `["tr", "$t"]`                                             |
| `projects`                        | 至少一个项目，每个项目维护自己的语言包                                                     |
| `projects.<name>.include`         | 扫描时必需的非空 glob 列表；仅维护 Excel 时可省略                                          |
| `projects.<name>.exclude`         | 扫描时额外排除的 glob 列表                                                                 |
| `projects.<name>.catalogs`        | locale 到 JSON 路径的映射；JSON 必须是扁平字符串对象                                       |
| `projects.<name>.excel.file`      | 可选 `.xlsx` 路径，默认 `.bubbles-i18n/<项目名>.xlsx`                                      |
| `projects.<name>.excel.sheet`     | 可选托管翻译 sheet 名，默认精确小写 `sheet1`                                               |
| `projects.<name>.excel.backupDir` | 可选备份目录，默认 `.bubbles-i18n/backups`，支持相对或绝对路径                             |
| `report`                          | 省略时写 `.bubbles-i18n/report.json`；`false` 关闭，字符串自定义路径；只影响扫描 JSON 报告 |

`excel` 可以省略或设为 `{}`，各字段可独立覆盖。每个项目解析独立的 Excel 路径；项目名中的特殊字符及 Windows 保留名会安全编码。只维护 Excel 的项目保留 `catalogs` 即可；`sync` / `check` 所选项目缺少非空 `include` 时返回 `2`，混合项目可用 `--project` 限定扫描范围。

所有相对路径基于配置目录。默认从当前工作目录向上查找配置，同目录按 `.ts`、`.mts`、`.js`、`.mjs`、`.cts`、`.cjs` 顺序尝试 `i18n.config` 文件。ESM 使用 `export default`，CommonJS 使用 `module.exports`；TypeScript 配置由 Node.js 原生加载，需使用可擦除类型语法。

备份目录不能与任一项目的 JSON / Excel 文件、三个默认 Markdown 报告或启用的扫描 JSON 报告路径相同，也不能位于这些文件路径之下；校验覆盖全部项目，包括本次未选中的项目。

## 从源码到翻译表，再回到应用 {#excel-workflow}

在 Vue 模板 / 脚本、React JSX / TSX 或普通源码中调用 `tr("保存")`、`tr("你好 {name}", { name: "Ada" })`。`sync` 保留已有的 `"保存": "Save"`，补入 `"你好 {name}": "你好 {name}"`；缺失的语言 JSON 会自动创建。完整流程：

```sh
pnpm exec bubbles-i18n sync --project web
pnpm exec bubbles-i18n excel export --project web
# 译员填写 Excel 后，采用其中的译文
pnpm exec bubbles-i18n excel import --project web --force
pnpm exec bubbles-i18n check --project web
```

首次导出会创建 Excel 文件。翻译表填写后如下，第一列是 JSON key，后续表头对应 `catalogs` 的 locale：

| key         | zh-CN       | en-US        |
| ----------- | ----------- | ------------ |
| 保存        | 保存        | Save         |
| 你好 {name} | 你好 {name} | Hello {name} |

填写前将 key 和语言列设置为「文本」，具体要求及修复方法见 [Excel 单元格格式与报错排查](#excel-cell-format)。

写入命令都可追加 `--dry-run` 预览。译员修改后，普通导入会报告当前值冲突并返回 `1`；`--force` 默认采用 Excel，确认后导入，应用继续加载同一路径的 JSON。若要把 JSON 译文更新到已有 Excel，使用 `excel export --force --prefer json`。命令不会根据修改时间选择覆盖方。

`check` 只检查 key 是否齐全，不判断翻译质量、默认值是否已翻译或占位符是否一致。

## 命令、参数与退出码

| 命令                        | 用途                   | 数据写入目标     |
| --------------------------- | ---------------------- | ---------------- |
| `bubbles-i18n sync`         | 扫描源码，补齐缺失 key | 所选项目的 JSON  |
| `bubbles-i18n check`        | 检查源码 key 是否完整  | 不写语言包       |
| `bubbles-i18n excel export` | JSON → Excel           | 所选项目的 Excel |
| `bubbles-i18n excel import` | Excel → JSON           | 所选项目的 JSON  |
| `bubbles-i18n --help`       | 查看帮助               | 不写数据         |

| 参数                   | 适用命令                  | 用途                                                   |
| ---------------------- | ------------------------- | ------------------------------------------------------ |
| `--config <path>`      | 所有命令                  | 指定配置文件                                           |
| `--project <name>`     | 所有业务命令              | 选择项目，可以重复传入；默认全部                       |
| `--locale <locale>`    | Excel 导出 / 导入         | 选择语言，可以重复传入；默认项目全部语言               |
| `--dry-run`            | `sync`、Excel 导出 / 导入 | 生成预览报告，不写 JSON 语言包 / Excel 数据            |
| `--prune`              | `sync`、Excel 导出 / 导入 | 删除目标端独有 key；Excel 转换必须显式指定 `--project` |
| `--force` / `-f`       | Excel 导出 / 导入         | 解决值冲突；默认采用 Excel，不隐含删除                 |
| `--prefer excel\|json` | Excel 导出 / 导入         | 指定冲突优先方；必须搭配 `--force`                     |
| `--fail-on-stale`      | `check`                   | 把源码未使用的 JSON key 也视为检查失败                 |

预览导入多个项目和语言：`excel import --project web --project admin --locale zh-CN --locale en-US --force --dry-run`。`check` 不接受 `--dry-run` 或 `--prune`；`--force` 不跳过格式、路径、重复 key 或表头校验。

| 退出码 | 含义                                                                                        |
| ------ | ------------------------------------------------------------------------------------------- |
| `0`    | 同步成功、检查通过或显示帮助                                                                |
| `1`    | Excel 存在未解决的值冲突；检查缺失 key，启用 `--fail-on-stale` 后也包括多余 key；未提供命令 |
| `2`    | 参数、配置、数据格式或文件操作错误                                                          |

## 各种情况如何处理

`sync` 的来源是扫描到的 key，目标是 JSON；导出是 JSON → Excel，导入是 Excel → JSON。

| 情况                                    | 默认行为                           | 可选处理                                                |
| --------------------------------------- | ---------------------------------- | ------------------------------------------------------- |
| 来源有，目标没有                        | 补入目标                           | —                                                       |
| `sync` 中 key 已存在                    | 保留 JSON 译文                     | —                                                       |
| 目标有，来源没有                        | 保留并逐项报告                     | `--prune` 删除                                          |
| Excel 转换中，同 key、同语言的值不同    | 报告冲突，返回 `1`，不修改数据文件 | `--force` 采用 Excel；`--force --prefer json` 采用 JSON |
| 导出时 Excel 语言单元格为空             | 从 JSON 补入译文                   | —                                                       |
| 导入时 Excel 语言单元格为空或为空字符串 | 保留 JSON 原值                     | `--prune` 也不会清空译文                                |

`--prune` 与 `--force` 相互独立。任一选中项目存在未解决的值冲突时，全部所选项目的数据文件都不写入，包括计划新增和删除项。

命令只写箭头目标端。导出采用 Excel 值、导入采用 JSON 值时，两边仍可能不同，再次运行普通命令仍会报告差异。导出按全部已配置语言的 key 并集判断多余行，`--locale` 只筛选语言值，不会删除仅存在于未选语言 JSON 中的 key 行；导入只更新或清理所选语言的 JSON。

### 导出时保留 Excel 译文并清理多余行 {#excel-export-prefer-excel}

```sh
pnpm exec bubbles-i18n excel export --project portal --prune --force --prefer excel
```

这条命令保留冲突项的 Excel 译文，从 JSON 补入缺失行或空语言单元格，删除全部已配置语言 JSON 中都不存在的 key 行。例如 JSON 是 `"保存": "Save"`、Excel 是 `Store`，导出后仍分别为 `Save` 和 `Store`。

若要将 Excel 译文写回 JSON，改用 `excel import --project portal --force --prefer excel`；未加 `--prune` 时保留 JSON 独有 key。

## 报告与写入行为 {#reports}

`sync` 和 Excel 转换自动生成 Markdown 报告，路径相对配置目录：

| 命令           | 报告文件                                | 多余 key 的明细                       |
| -------------- | --------------------------------------- | ------------------------------------- |
| `sync`         | `.bubbles-i18n/reports/sync.md`         | project、locale、JSON 路径、key       |
| `excel export` | `.bubbles-i18n/reports/excel-export.md` | project、Excel 路径、sheet、行号、key |
| `excel import` | `.bubbles-i18n/reports/excel-import.md` | project、locale、JSON 路径、key       |

没有多余项也生成本次报告。报告区分已保留、计划删除、已删除和未执行，预览不会记为已执行；同一个 key 出现在两个语言文件中表示两个 JSON 条目。报告末尾给出保持配置、项目和语言范围的清理预览与执行命令。

Excel 冲突报告列出 key、locale、两端当前值和文件 / 单元格位置，并提供手动处理或指定优先方的办法。

`sync`、`sync --dry-run` 和 `check` 还按顶层 `report` 配置写扫描 JSON 报告；字段 `added`、`unused`、`deleted` 在预览中表示计划。Excel 命令只生成 Markdown 报告，`report` 不影响 Markdown 报告。

所有选中项目先校验、比较，再写入。扫描写入 JSON 时通过同目录临时文件原子替换，沿用原文件的 BOM、换行、缩进和末尾换行；多个数据文件不构成跨文件事务。

Excel 转换实际修改已有目标文件时，先准备全部临时文件和备份，再提交。备份路径为 `<backupDir>/<runId>/<fileIndex>-<filename>`，`fileIndex` 是本次全部计划写入文件中从 1 开始的序号，报告列出实际路径。提交失败时尽力回滚，不能保证所有文件操作失败都完全无变化。预览不创建数据临时文件或备份。

## 扫描与 Excel 的边界

扫描支持 JavaScript、TypeScript、JSX / TSX、Vue 模板等文本中的静态调用：

```ts
tr("保存");
tr(`用户`);
tr("你好 {name}", { name });
tr(/* 说明 */ "保存" /* 说明 */);
```

不会提取 `tr(key)`、`tr(getKey())`、`tr("prefix-" + value)` 或带插值的模板字符串。扫描使用文本匹配，不使用 AST；注释和普通字符串中的完整调用文本也会识别。动态 key 需自行维护，清理前应预览。

默认排除 `.git`、`.pnpm-store`、`.vite`、`build`、`coverage`、`dist`、`node_modules`，以及 `.bubbles-i18n/**`、`.bubbles-i18n-backups/**` 和全部项目解析后的备份目录，不跟随符号链接，跳过含空字节的二进制文件。自定义 `backupDir` 应使用专用目录，避免其中的源码被排除。

扫描清理时，没有可读取源码就拒绝删除；有源码但没有静态 key 时，也拒绝清空非空语言包。CLI 没有绕过空来源保护的参数，应核实扫描范围、函数名和动态 key。

Excel 只支持 `.xlsx`。每个项目使用独立文件、一个托管翻译 sheet，其他 sheet 保留。已有文件缺少指定 sheet 时返回错误；导出目标文件不存在时可创建，导入来源文件不存在时返回错误。

第一列表头为 `key`，语言表头为 `catalogs` 的 locale ID，locale 不能使用保留名 `key`。新 Excel 包含全部语言表头；已有 Excel 只要求所选语言表头，未选语言缺列不阻断本次操作，其他备注列保留。

重复 key、空 key 带有内容、缺失所选语言表头会报错。翻译 sheet 的 key 与所选语言单元格不能合并，其他 sheet 的合并单元格可保留。key 和译文精确匹配，不去除首尾空格或改写换行；单元格类型要求见[报错排查](#excel-cell-format)。

导出文本最多 32,767 个 UTF-16 代码单元，支持 Tab、LF / CR / CRLF、emoji、占位符和字面 `_xHHHH_`。XML 不支持的控制字符、未配对的 UTF-16 代理项、U+FFFE 和 U+FFFF 会报错。

发生写入时，ExcelJS 重写整本工作簿，对普通字符串单元格编码并重读验证，包括未选语言、备注列和其他 sheet；待保留的字符串不符合上述限制，也会阻止导出。富文本、超链接、公式等复杂附加单元格若重写后不能保持原值，会拒绝整个导出。校验不保证嵌入对象等 Excel 高级特性完整保留，建议使用专门的翻译工作簿。

Excel 清理同样拒绝空来源：导出时所有 JSON 的 key 并集为空，或导入时 sheet 没有 key 而目标 JSON 非空，都不能全量删除。

### Excel 单元格格式与报错排查 {#excel-cell-format}

导出和导入都按单元格实际值类型校验 `key` 与所选语言列。非空值只接受字符串，数字、布尔值、日期、公式（即使返回字符串）、rich text 等都会报错；语言单元格可留空，空 key 要求整行没有内容。`--force` 不跳过校验。

填写或粘贴前，将这些列设置为「文本」，避免数字、日期、前导零或以 `=` 开头的内容被自动转换。仅修改已有单元格显示格式不一定转换实际类型。

例如：

```text
Error: Invalid key cell at translations!A4 in "i18n/portal.xlsx"; only text and blank cells are supported.
```

这表示 `translations` 工作表 A4 的 key 不是文本；`Invalid translation (en-US) cell` 则指向英文译文单元格。修复步骤：

1. 定位提示的文件、sheet 和单元格，设置为「文本」后重新输入原始内容；也可输入 `'00123`，保存的文本为 `00123`。
2. 已被转换的前导零或日期写法应按原文重录；公式改为文本 key / 译文，粘贴公式结果后也需确认保存为文本。
3. 无需保留的记录删除整行或清空整行；只清空 key 而保留译文或备注会触发 `Empty key`。
4. 保存后重跑原命令。

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
| `scanSource` / `scanFiles`                                                      | 返回 key 与出现位置，不修改语言包                  |
| `syncCatalog` / `syncProject`                                                   | 同步语言包，传入路径须为绝对路径                   |
| `createSyncReport` / `writeSyncReport`                                          | 创建与写入扫描 JSON 报告                           |
| `planExcel` / `applyExcel`                                                      | 生成 Excel 转换计划 / 执行计划                     |
| `ExcelOptions` / `ExcelPlan` / `ExcelProjectInput` 等类型                       | 描述转换参数、输入、差异与冲突                     |
| `ExcelValidationError` / `ExcelConcurrentModificationError` / `ExcelApplyError` | 区分 Excel 校验、并发修改与写入错误                |
| `runCli` / `main`                                                               | `runCli` 抛出异常，`main` 输出诊断并转为退出码 `2` |

直接调用 `planExcel` 时，`ExcelProjectInput.backupDir` 可选；省略时在生成计划阶段按当前工作目录解析 `.bubbles-i18n/backups`。CLI 传入按配置目录解析的绝对备份路径。

CLI 不生成 `generated.ts`。完整规则见 [JSON 与 Excel 同步规则参考](https://github.com/bubblesplant/i18n/blob/main/packages/i18n-cli/docs/excel-sync-plan.md)。
