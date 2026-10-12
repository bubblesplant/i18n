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
    },
  },
  // 默认写入 .bubbles-i18n/report.json；可选择以下一种覆盖方式：
  // report: false, // 关闭扫描 JSON 报告
  // report: "reports/i18n.json", // 自定义扫描 JSON 报告路径
});
```

| 字段                              | 含义                                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `callNames`                       | 扫描调用名，默认 `["tr"]`，例如 `["tr", "$t"]`                                                                         |
| `projects`                        | 至少一个项目，每个项目维护自己的语言包                                                                                 |
| `projects.<name>.include`         | 扫描时必需的非空 glob 列表；仅维护 Excel 时可省略                                                                      |
| `projects.<name>.exclude`         | 扫描时额外排除的 glob 列表                                                                                             |
| `projects.<name>.catalogs`        | locale 到 JSON 路径的映射；JSON 必须是扁平字符串对象                                                                   |
| `projects.<name>.excel.file`      | 可选 `.xlsx` 路径，默认 `.bubbles-i18n/<项目名>.xlsx`，相对配置目录                                                    |
| `projects.<name>.excel.sheet`     | 可选托管翻译 sheet 名，默认精确小写 `sheet1`                                                                           |
| `projects.<name>.excel.backupDir` | 可选备份目录，默认配置目录下的 `.bubbles-i18n/backups`；支持相对配置目录的路径或绝对路径                               |
| `report`                          | 省略时写 `.bubbles-i18n/report.json`；`false` 关闭，字符串自定义路径；不影响自动 Markdown 报告，Excel 命令不使用此配置 |

Excel 直接复用项目的 `catalogs`，不用重复配置 JSON 路径。只维护 Excel 的项目可以省略 `include`：

```ts
export default defineConfig({
  projects: {
    translations: {
      catalogs: {
        "zh-CN": "locales/zh-CN.json",
        "en-US": "locales/en-US.json",
      },
    },
  },
});
```

上述仅维护 Excel 的项目默认使用 `.bubbles-i18n/translations.xlsx` 中的 `sheet1`。`excel` 可以完全省略或设为 `{}`，`file` 与 `sheet` 可分别覆盖：

| 项目中的 Excel 配置                                                     | 文件（相对配置目录，以 `web` 项目为例） | 工作表   |
| ----------------------------------------------------------------------- | --------------------------------------- | -------- |
| 省略 `excel` 或 `excel: {}`                                             | `.bubbles-i18n/web.xlsx`                | `sheet1` |
| `excel: { sheet: "review" }`（覆盖工作表）                              | `.bubbles-i18n/web.xlsx`                | `review` |
| `excel: { file: "translations/web.xlsx" }`（覆盖文件）                  | `translations/web.xlsx`                 | `sheet1` |
| `excel: { file: "translations/web.xlsx", sheet: "review" }`（覆盖两项） | `translations/web.xlsx`                 | `review` |

扫描与 Excel 命令加载配置时都会解析每个项目的独立 Excel 路径；例如 `web` 与 `admin` 默认分别使用 `.bubbles-i18n/web.xlsx` 和 `.bubbles-i18n/admin.xlsx`。文件名基于项目名生成，特殊字符及 Windows 保留名会安全编码。

备份默认集中到配置目录下的 `.bubbles-i18n/backups`。每个项目可通过 `excel.backupDir` 自定义目录，例如 `excel: { backupDir: "translation-backups" }` 只覆盖备份目录，文件与工作表仍使用默认值。`backupDir` 支持相对配置目录的字符串路径或绝对路径；省略整个 `excel` 或省略 `backupDir` 均使用默认目录。

备份目录不能与配置中任一项目的 JSON / Excel 文件、三个默认 Markdown 报告或启用的扫描 JSON 报告路径相同，也不能位于这些文件路径之下；校验覆盖全部项目，包括本次未选中的项目。

不传 `--project` 时选择配置中的全部项目。`sync` / `check` 所选项目必须有非空 `include`，缺少时返回 `2`；混合了扫描与仅维护 Excel 的项目时，可用 `--project` 选择要扫描的项目。

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

首次导出时，Excel 文件不存在就创建文件。上面的 `web` 项目默认导出到配置目录下的 `.bubbles-i18n/web.xlsx`，工作表为 `sheet1`。表格第一列的 `key` 是原文 / JSON key，后面的表头对应 `catalogs` 中的 locale：

| key         | zh-CN       | en-US       |
| ----------- | ----------- | ----------- |
| 保存        | 保存        | Save        |
| 你好 {name} | 你好 {name} | 你好 {name} |

::: warning 填写前先设置为文本
`key` 列和语言列的非空单元格必须保存为文本。填写或粘贴前，先在 Excel 中将这些列设置为「文本」，避免纯数字、日期样式、带前导零或以 `=` 开头的内容被自动识别为数字、日期或公式。已有内容仅修改单元格显示格式，不一定会转换实际类型；处理方法见 [Excel 单元格格式与报错排查](#excel-cell-format)。
:::

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
| `--dry-run`            | `sync`、Excel 导出 / 导入       | 生成预览报告，不写 JSON 语言包 / Excel 数据            |
| `--prune`              | `sync`、Excel 导出 / 导入       | 删除目标端独有 key；Excel 转换必须显式指定 `--project` |
| `--force` / `-f`       | Excel 导出 / 导入               | 解决值冲突；默认采用 Excel，不隐含删除                 |
| `--prefer excel\|json` | Excel 导出 / 导入               | 指定冲突优先方；必须搭配 `--force`                     |
| `--fail-on-stale`      | `check`                         | 把源码未使用的 JSON key 也视为检查失败                 |

例如，导入两个项目中的两种语言：

```sh
pnpm exec bubbles-i18n excel import --project web --project admin --locale zh-CN --locale en-US --force --dry-run
```

`check` 不接受 `--dry-run` 或 `--prune`，保持只检查的行为。`--force` 不跳过格式、路径、重复 key 或表头校验。

| 退出码 | 含义                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------- |
| `0`    | 同步成功、检查通过或显示帮助                                                                            |
| `1`    | Excel 存在未解决的值冲突；或检查缺失 key，启用 `--fail-on-stale` 后也包括多余 key；未提供命令也返回 `1` |
| `2`    | 参数、配置、数据格式或文件操作错误                                                                      |

## 各种情况如何处理

表中命令省略 `pnpm exec bubbles-i18n` 前缀。

| 流程           | 情况或意图           | 处理结果             | 命令                                                  |
| ------------ | --------------- | ---------------- | --------------------------------------------------- |
| 代码 → JSON    | 代码有，JSON 没有     | 补入 JSON          | `sync --project web`                                |
| 代码 → JSON    | key 已存在         | 保留已有译文           | `sync --project web`                                |
| 代码 → JSON    | JSON 有，代码没扫描到   | 保留，逐项写入报告        | `sync --project web`                                |
| 代码 → JSON    | 删除上述多余 key      | 补入缺失项，删除多余项      | `sync --project web --prune`                        |
| JSON → Excel | JSON 有，Excel 没有 | 补入 Excel         | `excel export --project web`                        |
| JSON → Excel | Excel 有，JSON 没有 | 保留，逐项写入报告        | `excel export --project web`                        |
| JSON → Excel | 删除 Excel 多余 key | 删除对应行            | `excel export --project web --prune`                |
| JSON → Excel | 同 key、同语言，值不同   | 报告冲突并失败，数据文件不修改  | `excel export --project web`                        |
| JSON → Excel | 冲突采用 Excel      | 保留 Excel 值       | `excel export --project web --force --prefer excel` |
| JSON → Excel | 冲突采用 JSON       | 用 JSON 值更新 Excel | `excel export --project web --force --prefer json`  |
| Excel → JSON | Excel 有，JSON 没有 | 补入 JSON          | `excel import --project web`                        |
| Excel → JSON | JSON 有，Excel 没有 | 保留，逐项写入报告        | `excel import --project web`                        |
| Excel → JSON | 删除 JSON 多余 key  | 删除对应 JSON 条目     | `excel import --project web --prune`                |
| Excel → JSON | 同 key、同语言，值不同   | 报告冲突并失败，数据文件不修改  | `excel import --project web`                        |
| Excel → JSON | 冲突采用 Excel      | 用 Excel 值更新 JSON | `excel import --project web --force --prefer excel` |
| Excel → JSON | 冲突采用 JSON       | 保留 JSON 值        | `excel import --project web --force --prefer json`  |

值冲突与删除相互独立：`--prune` 不解决值冲突，`--force` 不删除 key。任一选中项目存在未解决的值冲突时，所有选中项目的数据文件都不写入，包括计划新增和删除项。

命令只写箭头目标端。导出采用 Excel 值、导入采用 JSON 值时，两边仍可能不同；再次执行普通命令仍会报告这些差异。

导出使用全部已配置语言的 key 并集判断多余行，`--locale` 只筛选语言值处理，不会把仅存在于未选语言的 key 行删掉。导入指定 `--locale` 时，只更新或清理所选语言的 JSON；空 cell 和空字符串均保留 JSON 原值，不等同于缺少整行，不会因为 `--prune` 清空译文。

### 导出时保留 Excel 译文并清理多余行 {#excel-export-prefer-excel}

例如，配置中有 `portal` 项目时：

```sh
pnpm exec bubbles-i18n excel export --project portal --prune --force --prefer excel
```

这条命令仍按 JSON → Excel 导出，`--prefer excel` 只指定值冲突的优先方，不改变同步方向：

- 同 key、同语言的值不同：保留 Excel 中的译文，JSON 原值不变，不反向同步 JSON。
- Excel 缺少 key 行或语言单元格为空：从 JSON 补入缺失行或译文。
- Excel 有某个 key，但项目全部已配置语言的 JSON 中都没有：`--prune` 删除该整行；保留其他语言 JSON 中仍存在的 key 行。

例如 JSON 中 `"保存": "Save"`，Excel 的同一语言单元格为 `Store`，执行后两边仍分别为 `Save` 和 `Store`。命令成功表示已按优先方处理冲突，两边的值仍可能不同；再次执行普通导出仍会报告冲突。

若要将 Excel 译文写回 JSON，改用导入命令：

```sh
pnpm exec bubbles-i18n excel import --project portal --force --prefer excel
```

此时冲突项的 JSON 值会更新为 Excel 值；这条导入命令未指定 `--prune`，会保留 JSON 独有 key。任何写入命令都可先追加 `--dry-run` 查看预览。

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

`sync`、`sync --dry-run` 和 `check` 默认将扫描 JSON 报告写入配置文件所在目录下的 `.bubbles-i18n/report.json`。顶层 `report` 省略时使用此默认路径，设为 `false` 关闭 JSON 报告，设为字符串自定义路径；相对路径以配置文件所在目录为基准。字段 `added`、`unused`、`deleted` 保持原有含义，预览时表示计划。`report` 不影响自动 Markdown 报告；Excel 命令只生成 Markdown 报告，不写扫描 JSON 报告。

所有选中项目先校验、比较，再执行写入。扫描写入 JSON 语言包时通过同目录临时文件原子替换，沿用原文件的 BOM、换行、缩进和末尾换行；多个数据文件不构成跨文件事务。

Excel 转换实际修改已有目标文件时，自动备份到当前项目的 `excel.backupDir`，默认是配置目录下的 `.bubbles-i18n/backups`。备份路径为 `<backupDir>/<runId>/<fileIndex>-<filename>`；`fileIndex` 是本次全部计划写入文件中从 1 开始的序号，避免同名目标文件覆盖，报告列出实际备份路径。先准备全部临时文件和备份，再提交；提交失败时尽力回滚，不能保证所有文件操作失败都完全无变化。预览不创建数据临时文件或备份。

## 扫描与 Excel 的边界

扫描支持 JavaScript、TypeScript、JSX / TSX、Vue 模板等文本中的静态调用：

```ts
tr("保存");
tr(`用户`);
tr("你好 {name}", { name });
tr(/* 说明 */ "保存" /* 说明 */);
```

不会提取动态表达式 `tr(key)`、`tr(getKey())`、`tr("prefix-" + value)` 或带插值的模板字符串。扫描使用文本匹配，不使用 AST；注释和普通字符串中完整的调用文本也会被识别。动态 key 需要自行维护，清理前应查看预览。

默认排除 `.git`、`.pnpm-store`、`.vite`、`build`、`coverage`、`dist`、`node_modules`，以及 `.bubbles-i18n/**`、`.bubbles-i18n-backups/**` 下的报告和备份，不跟随符号链接，跳过包含空字节的二进制文件。扫描清理时，没有可读取源码就拒绝删除；有源码但没有静态 key 时，也拒绝清空非空语言包。CLI 不提供绕过空来源保护的参数，应先核实扫描范围、函数名和动态 key。

CLI 还自动排除配置中全部项目解析后的备份目录，包括本次未选中的项目。自定义 `backupDir` 应使用专用目录，避免其中的源码被排除。

Excel 只支持 `.xlsx`。每个项目使用独立文件、一个托管翻译 sheet；其他 sheet 保留。已有文件缺少指定翻译 sheet 时返回错误，避免悄悄创建新 sheet。导出目标文件不存在时可以创建；导入来源文件不存在时返回错误。

第一列表头为 `key`，语言表头为 `catalogs` 的 locale ID，locale 不能使用保留名 `key`。新 Excel 包含全部语言表头；已有 Excel 只要求本次所选语言的表头，未选语言缺列不阻断本次操作。其他备注列保留。

重复 key、空 key 带有翻译、缺失所选语言表头或不支持的数据类型会报错。翻译 sheet 的 key 与所选语言单元格不能合并，避免写入一个单元格时连带修改其他 key 或译文；其他 sheet 的合并单元格可以保留。key 与所选语言的非空单元格必须是字符串；数字、布尔值、日期、公式、rich text 等不能作为 key 或译文。`--force` 不跳过这些校验。key 和译文精确匹配，不自动去除首尾空格或改写换行。

导出到 Excel 的单元格文本最多 32,767 个 UTF-16 代码单元。支持 Tab、LF / CR / CRLF、emoji、占位符和字面 `_xHHHH_` 文本；XML 不支持的控制字符、未配对的 UTF-16 代理项、U+FFFE 和 U+FFFF 会报错。发生写入时会通过 ExcelJS 重写整本工作簿，对其中的普通字符串单元格编码并重读验证，包括未选语言、备注列和其他 sheet；待保留的普通字符串不符合这些限制，也会阻止导出。富文本、超链接、公式等复杂附加单元格若在重写后不能保持原值，会拒绝整个导出，不写数据。单元格值校验不保证嵌入对象等 Excel 高级特性完整保留，建议使用专门的翻译工作簿。

Excel 清理拒绝用空来源清空已有目标：导出时所有 JSON 的 key 并集为空、导入时翻译 sheet 没有 key 而目标 JSON 非空，都不能执行全量删除。

### Excel 单元格格式与报错排查 {#excel-cell-format}

导出和导入都会校验现有翻译表中的 `key` 列与本次所选语言列，按单元格的实际值类型判断，不按显示格式判断。非空值只接受文本；语言单元格可以留空，空 key 则要求整行没有内容。

例如，导出时出现：

```text
Error: Invalid key cell at translations!A4 in "i18n/portal.xlsx"; only text and blank cells are supported.
```

这表示该文件的 `translations` 工作表中，A4（第 4 行、第 1 列）的 key 不是文本。若报错为 `Invalid translation (en-US) cell`，则检查提示位置的英文译文单元格。处理方法：

1. 打开报错中的文件，定位指定工作表和单元格，将单元格设置为「文本」，再重新输入期望的 key 或译文；也可在输入内容前加英文单引号 `'`，例如输入 `'00123`，保存的文本为 `00123`。
2. 已被自动转换的内容应按原始文本重新录入；前导零或日期写法可能已经改变。公式应改为所需的文本 key 或文本译文，即使公式返回字符串也不能直接保留公式；粘贴公式结果后仍要确保实际保存为文本。
3. 如果该记录不再需要，删除整条记录或清空整行；只清空 key 而保留译文或备注，会触发 `Empty key` 错误。
4. 保存 Excel 后重新运行原命令。

仅将已有数字或日期的格式改为「文本」，不一定能转换实际值类型；加 `--force` 也不会跳过类型校验。应先修复单元格内容，再进行同步。

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

直接调用 `planExcel` 时，`ExcelProjectInput.backupDir` 可选；省略时在生成计划阶段按当前工作目录解析 `.bubbles-i18n/backups`。CLI 会传入按配置目录解析的绝对备份路径。

CLI 不生成 `generated.ts`。完整规则见 [JSON 与 Excel 同步规则参考](https://github.com/bubblesplant/i18n/blob/main/packages/i18n-cli/docs/excel-sync-plan.md)，版本发布见 [GitHub Releases](https://github.com/bubblesplant/i18n/releases)。
