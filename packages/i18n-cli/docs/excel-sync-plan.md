# 扫描、JSON 与 Excel 同步规则参考

本文记录 CLI 的配置、比较、写入和报告规则。入门示例见 [CLI 指南](https://github.com/bubblesplant/i18n/blob/main/apps/docs/guide/cli.md)，发布记录见 [GitHub Releases](https://github.com/bubblesplant/i18n/releases)。

## 1. 命令与流程

```text
源码静态 key ── sync ──→ 各语言 JSON
                           │      ↑
                    excel export  excel import
                           ↓      │
                         Excel 翻译表

check：只检查源码 key 与 JSON 的完整性
```

| 命令                        | 来源                       | 写入目标                | 默认 Markdown 报告                      |
| --------------------------- | -------------------------- | ----------------------- | --------------------------------------- |
| `bubbles-i18n sync`         | 项目源码中扫描到的静态 key | 项目的各语言 JSON       | `.bubbles-i18n/reports/sync.md`         |
| `bubbles-i18n check`        | 项目源码与各语言 JSON      | 不写语言包              | 保持可选扫描 JSON 报告行为              |
| `bubbles-i18n excel export` | 项目的 JSON catalogs       | 项目的 Excel 翻译 sheet | `.bubbles-i18n/reports/excel-export.md` |
| `bubbles-i18n excel import` | 项目的 Excel 翻译 sheet    | 项目的 JSON catalogs    | `.bubbles-i18n/reports/excel-import.md` |

命令方向决定写入目标。强制选择哪一方只影响值冲突，不反向写入来源。JSON 是应用运行时语言包，Excel 是维护译文的入口。

## 2. 安装与统一配置

需要 Node.js `>=22.18.0`：

```sh
pnpm add -D @bubblesjs/i18n-cli
```

`i18n.config.ts`：

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
  report: ".bubbles-i18n/report.json",
});
```

Excel 配置放在 `projects.<name>.excel`，直接复用同项目的 `catalogs`。`excel.file` 是 `.xlsx` 路径，`excel.sheet` 默认 `translations`。扫描参数 `callNames`、`include`、`exclude` 不参与 Excel 转换。

扫描所选项目必须配置非空 `include`；只维护 Excel 的项目可以省略 `include`。Excel 所选项目必须配置 `excel`。不传 `--project` 时默认选择全部项目，不会自动跳过缺少用途配置的项目；不符合当前命令要求时返回 `2`，并提示用 `--project` 选择适用项目。

所有路径以配置文件所在目录为基准，包括 JSON、Excel、默认 Markdown 报告和配置中的扫描 JSON 报告。每个项目使用独立的 Excel 文件；不同项目 / locale 不共用同一个 JSON 输出文件。

## 3. 表格结构与校验

一项目一份 `.xlsx`，一个 CLI 管理的翻译 sheet：

| key         | zh-CN       | en-US        |
| ----------- | ----------- | ------------ |
| 保存        | 保存        | Save         |
| 你好 {name} | 你好 {name} | Hello {name} |

第一列的 `key` 同时是待翻译原文与 JSON key，横向每个语言列使用 `catalogs` 中的 locale ID。`key` 是保留表头，不能同时用作 locale ID。

- 新 Excel 包含项目全部 locale 的表头。
- 已有 Excel 要求第一列是 `key`，并包含本次所选 locale 的表头；未选语言缺少表头不阻断本次操作。
- 语言按表头匹配，不依赖列顺序；key 精确匹配，不自动 trim 或标准化 Unicode。
- 完全空白行忽略；空 key 带有翻译、重复 key、重复表头或缺少所选语言列会报错。
- key 与本次所选语言的非空单元格必须是字符串；数字、布尔值、日期、公式、rich text 等类型会报错。
- 翻译 sheet 的 key 与所选语言单元格不能合并，避免写入一个单元格时连带修改其他 key 或译文；其他 sheet 的合并单元格可以保留。
- 其他备注列及其他 sheet 保留，不参与翻译值比较。
- 已有 Excel 缺少配置指定的翻译 sheet 时返回错误，不悄悄新建一个 sheet。
- 导出文件不存在时创建；导入来源文件不存在时返回错误，不能当作空表删除 JSON。
- 仅支持 `.xlsx`，不支持 `.xls` 或 `.xlsm`。

`--force` 不能绕过上述校验。首尾空格、换行、emoji 和占位符按字符串原样处理。

导出到 Excel 的单元格文本最多 32,767 个 UTF-16 代码单元。支持 Tab、LF / CR / CRLF 以及字面 `_xHHHH_` 文本；XML 不支持的控制字符、未配对的 UTF-16 代理项、U+FFFE 和 U+FFFF 会报错。发生写入时通过 ExcelJS 重写整本工作簿，对普通字符串单元格编码并重读验证，覆盖未选语言、备注列和其他 sheet；不符合限制的待保留普通字符串也会阻止导出。富文本、超链接、公式等复杂附加单元格若在重写后不能保持原值，会拒绝整个导出，不写数据。单元格值校验不保证嵌入对象等 Excel 高级特性完整保留，建议使用专门的翻译工作簿。

## 4. 参数规则

| 参数                   | 适用范围                        | 默认 / 规则                                                  |
| ---------------------- | ------------------------------- | ------------------------------------------------------------ |
| `--config <path>`      | 所有命令                        | 默认向上查找配置                                             |
| `--project <name>`     | 所有业务命令                    | 可以重复；不传则全部项目                                     |
| `--locale <locale>`    | Excel 导出 / 导入               | 可以重复；不传则项目全部语言                                 |
| `--dry-run`            | `sync`、Excel 导出 / 导入       | 计算计划并写报告，不写 JSON / Excel 数据                     |
| `--prune`              | `sync`、Excel 导出 / 导入       | 只删除目标端独有 key；Excel 必须显式传入至少一个 `--project` |
| `--clean`              | `sync`                          | 与 `--prune` 相同的兼容写法，同时传入也只清理一次            |
| `--allow-empty`        | `sync --prune` / `sync --clean` | 有可读取源码但静态 key 为空时，允许清空非空 JSON             |
| `--force` / `-f`       | Excel 导出 / 导入               | 解决值冲突，默认采用 Excel；不隐含删除                       |
| `--prefer excel\|json` | Excel 导出 / 导入               | 必须搭配 `--force`，指定冲突优先方                           |
| `--fail-on-stale`      | `check`                         | 除缺失 key 外，多余 key 也使检查失败                         |

`check` 不接受删除或预览参数，保持只检查语义。扫描的 `--prune` 保留 `--clean` 原有范围规则，不强制要求显式项目；Excel 的清理必须显式选择项目。

本版没有可配置空白策略参数，Excel 导入固定保留空单元格对应的 JSON 原值。`--allow-empty` 只用于扫描，Excel 不支持用空来源清空已有目标。

## 5. 新增、值冲突与删除分别处理

### 5.1 key 集合

| 流程         | 来源 key 基准                       | `targetOnly`                    |
| ------------ | ----------------------------------- | ------------------------------- |
| 扫描 → JSON  | 当前项目扫描到的静态 key            | JSON 有、源码未扫描到的 key     |
| JSON → Excel | 项目全部已配置语言 JSON 的 key 并集 | Excel 有、JSON 并集中没有的行   |
| Excel → JSON | 翻译 sheet 中的 key 行              | JSON 有、Excel 中整行没有的 key |

来源独有 key 按方向补入目标。目标独有 key 默认保留，终端和报告逐项列出；没有值冲突时，存在 `targetOnly` 也不影响普通命令成功。只有 `--prune` 才删除目标独有 key，不需要额外加 `--force`。

导出 `--locale` 只筛选语言值，不缩小判断 Excel 多余行的全部语言 key 并集；仅存在于未选语言 JSON 的 key 仍然属于来源。导入只更新或清理所选语言的 JSON，Excel 中整行存在但单个语言为空，不属于 `targetOnly`。

扫描以源码为准只涉及 key 集合，不比较源码与 JSON 译文。已有 JSON 译文始终保留，不改回原文。

### 5.2 当前值比较

按 `project × key × locale` 比较当前字符串值。单边缺失按新增 / 保留规则处理；两边有可比较的值时精确比较，不 trim、不改换行、不根据修改时间推断优先方。译文等于 key 也是有效值。

| 当前情况                             | 普通转换行为                                     |
| ------------------------------------ | ------------------------------------------------ |
| 来源有 key，目标没有                 | 计划新增，不属于值冲突                           |
| 来源没有 key，目标有                 | 保留并逐项报告，`--prune` 才删除                 |
| 同 key、同 locale 值相同             | 保持不变                                         |
| 同 key、同 locale 值不同             | 完整报告两边值并返回 `1`                         |
| 导出时 Excel 语言单元格为空          | JSON 有值则补入；该语言缺 key 则保留现有值或空白 |
| 导入的语言单元格为空 cell 或空字符串 | 跳过，不覆盖 JSON 原值，不新增空值               |

普通转换存在未解决的值冲突时，所有选中项目的 JSON / Excel 都不写入，包括原本计划新增和删除的项。比较直接使用当前数据，不依赖隐藏 metadata 或历史同步基线。

### 5.3 强制取值

两个 Excel 方向使用同一套参数：

```sh
# 默认采用 Excel
pnpm exec bubbles-i18n excel export --project web --force
pnpm exec bubbles-i18n excel import --project web --force

# 显式选择 Excel
pnpm exec bubbles-i18n excel export --project web --force --prefer excel
pnpm exec bubbles-i18n excel import --project web --force --prefer excel

# 显式选择 JSON
pnpm exec bubbles-i18n excel export --project web --force --prefer json
pnpm exec bubbles-i18n excel import --project web --force --prefer json
```

| 方向         | 冲突优先方    | 实际处理                       |
| ------------ | ------------- | ------------------------------ |
| JSON → Excel | Excel（默认） | 保留 Excel 冲突值，不回写 JSON |
| JSON → Excel | JSON          | 用 JSON 值更新 Excel           |
| Excel → JSON | Excel（默认） | 用 Excel 值更新 JSON           |
| Excel → JSON | JSON          | 保留 JSON 冲突值，不回写 Excel |

优先方只决定值冲突，新增仍按方向加入目标。采用目标端值时，成功后两边可能仍有差异，再运行普通命令仍会报告。`--force` 不隐含删除；`--prune` 不解决值冲突。

### 5.4 空输入保护

- 扫描清理：完全没有可读取源码时拒绝删除，`--allow-empty` 也不能绕过；有源码但静态 key 为空，清空非空 JSON 需显式 `--allow-empty`。
- Excel 导出清理：全部语言 JSON 的 key 并集为空时，拒绝删除已有 Excel 中的全部数据行。
- Excel 导入清理：翻译 sheet 没有 key 时，拒绝清空非空 JSON。
- Excel 空单元格固定采用保留行为，不会因为 `--force` 或 `--prune` 清空已有译文。

## 6. 各种情况与命令对照

以下示例使用项目 `web`，命令均可通过 `pnpm exec` 运行。

| 目的 / 情况                           | 命令                                                                                                      | 结果                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 扫描补齐 JSON                         | `bubbles-i18n sync --project web`                                                                         | 新增缺失 key，保留已有译文和多余 key           |
| 扫描删除预览                          | `bubbles-i18n sync --project web --prune --dry-run`                                                       | 生成新增 / 删除计划，不改 JSON                 |
| 扫描清理多余 key                      | `bubbles-i18n sync --project web --prune`                                                                 | 补齐缺失 key，删除源码未扫描到的项             |
| 兼容旧扫描清理命令                    | `bubbles-i18n sync --project web --clean`                                                                 | 与 `--prune` 行为相同                          |
| 源码有文件但静态 key 为空，允许清空   | `bubbles-i18n sync --project web --prune --allow-empty`                                                   | 显式允许清空 JSON；无可读取源码仍拒绝          |
| 首次导出 / 没有值冲突                 | `bubbles-i18n excel export --project web`                                                                 | 创建文件或补入新 key，保留 Excel 独有行        |
| 普通导入 / 没有值冲突                 | `bubbles-i18n excel import --project web`                                                                 | 新 key 加入有值语言的 JSON，保留 JSON 独有 key |
| 普通导出 / 导入有值冲突               | 普通命令不加 `--force`                                                                                    | 返回 `1`，报告两边值，所有数据文件不写         |
| 采用 Excel，更新 JSON                 | `bubbles-i18n excel import --project web --force`                                                         | Excel 冲突译文写入 JSON                        |
| 采用 JSON，更新 Excel                 | `bubbles-i18n excel export --project web --force --prefer json`                                           | JSON 冲突译文写入 Excel                        |
| 导出采用 Excel                        | `bubbles-i18n excel export --project web --force`                                                         | 保留 Excel 冲突值，仍补入新 key，不改 JSON     |
| 导入采用 JSON                         | `bubbles-i18n excel import --project web --force --prefer json`                                           | 保留 JSON 冲突值，仍补入新 key，不改 Excel     |
| 删除 Excel 独有行                     | `bubbles-i18n excel export --project web --prune`                                                         | 无未解决冲突时删除多余行                       |
| 删除 JSON 独有 key                    | `bubbles-i18n excel import --project web --prune`                                                         | 无未解决冲突时删除所选语言多余 key             |
| 用 Excel 解决冲突并删除 JSON 多余 key | `bubbles-i18n excel import --project web --force --prune`                                                 | 值冲突和 key 删除分别执行                      |
| 用 JSON 解决冲突并删除 Excel 多余行   | `bubbles-i18n excel export --project web --force --prefer json --prune`                                   | 值冲突和 key 删除分别执行                      |
| 多项目、多语言导入预览                | `bubbles-i18n excel import --project web --project admin --locale zh-CN --locale en-US --force --dry-run` | 仅计划所选项目 / 语言，写报告，不改数据        |
| 普通检查                              | `bubbles-i18n check --project web`                                                                        | 缺失 key 返回 `1`，多余 key 默认允许           |
| 严格检查多余 key                      | `bubbles-i18n check --project web --fail-on-stale`                                                        | 缺失或多余 key 返回 `1`                        |
| 参数、配置或格式错误                  | 例如 `excel import --prefer json` 未传 `--force`                                                          | 返回 `2`，不绕过校验                           |

任意写入命令追加 `--dry-run` 都只生成计划与报告。预览仍进行格式和冲突校验，未解决冲突仍返回 `1`。

## 7. 默认报告与扫描 JSON 兼容

Markdown 报告自动写入配置目录下的 `.bubbles-i18n/reports/`，分别使用 `sync.md`、`excel-export.md`、`excel-import.md`。没有多余项时也输出本次结果。终端逐项提示并显示完整报告路径。

| 报告项             | 必须展示的信息                                                    |
| ------------------ | ----------------------------------------------------------------- |
| 扫描目标端独有 key | project、locale、JSON 路径、key、处理结果                         |
| 导出目标端独有行   | project、Excel 路径、sheet、行号、key、处理结果                   |
| 导入目标端独有 key | project、locale、JSON 路径、key、处理结果                         |
| 值冲突             | project、key、locale、JSON 当前值、Excel 当前值、文件和单元格位置 |
| 执行状态           | 预览 / 已执行 / 未执行，以及实际发生的新增、更新、删除            |
| Excel 写入备份     | 实际备份文件路径                                                  |

报告末尾给出同范围清理命令，保留本次 `--config`、`--project`、`--locale` 等上下文，先预览再执行：

```sh
pnpm exec bubbles-i18n excel import --project web --locale en-US --prune --dry-run
pnpm exec bubbles-i18n excel import --project web --locale en-US --prune
```

有值冲突时还提供手动处理和采用 Excel / JSON 的办法，并说明 `--prune` 不能解决冲突。已强制处理的差异也显示取值结果；预览中的计划不描述成已写入。

扫描明细示例：

| 项目 | 语言  | JSON 文件              | 多出的 key | 处理结果 |
| ---- | ----- | ---------------------- | ---------- | -------- |
| web  | zh-CN | src/locales/zh-CN.json | 旧登录按钮 | 已保留   |
| web  | en-US | src/locales/en-US.json | 旧登录按钮 | 已保留   |

这是两个 JSON 条目、一个不同的 key。动态 key 未被静态扫描提取时也可能出现在列表中，不能仅凭“多余”认定业务没有使用。

原有顶层 `report` 仍是扫描的可选 JSON 报告配置，不改为 Markdown。`sync`、`sync --dry-run` 和 `check` 按配置写出；省略时不写此 JSON 报告，`sync` 的自动 Markdown 不受影响。Excel 命令不读取或写入这份扫描 JSON 报告。

扫描 JSON 报告中的 `added` 是缺失项，`unused` 是保留的多余项，`deleted` 是清理项；预览时这些变更列表表示计划。报告路径相对配置目录显示。

## 8. 写入与失败边界

先读取并校验全部所选项目，在内存中生成计划。普通转换任何项目存在值冲突时返回 `1`，全部项目的数据都不写；格式、配置或文件操作错误返回 `2`。同步成功返回 `0`。

`--dry-run` 写报告，但不写 JSON / Excel，不创建数据临时文件或备份。扫描 JSON 使用同目录临时文件原子替换，沿用 BOM、换行、缩进与末尾换行。

Excel 转换实际修改已有目标文件时，将其备份到目标同目录的 `.bubbles-i18n-backups/<runId>/<filename>`，备份路径记录在报告中。先准备全部数据临时文件与备份，再提交；提交失败时尽力回滚。多文件写入不具备真正事务保证，不能承诺任何文件操作失败都完全无变化。

扫描默认排除 `.bubbles-i18n/**` 与 `.bubbles-i18n-backups/**`，避免报告、备份成为新的翻译来源。报告和备份目录应加入 `.gitignore`。

## 9. 完整协作示例

```sh
# 1. 扫描源码，补齐语言包
pnpm exec bubbles-i18n sync --project web --dry-run
pnpm exec bubbles-i18n sync --project web

# 2. 导出翻译表；已有表出现冲突时，确认 JSON 后再强制采用 JSON
pnpm exec bubbles-i18n excel export --project web
pnpm exec bubbles-i18n excel export --project web --force --prefer json --dry-run
pnpm exec bubbles-i18n excel export --project web --force --prefer json

# 3. 译员修改 Excel，普通导入先报告差异
pnpm exec bubbles-i18n excel import --project web

# 4. 确认采用 Excel 译文，先预览再导入
pnpm exec bubbles-i18n excel import --project web --force --dry-run
pnpm exec bubbles-i18n excel import --project web --force

# 5. CI 检查源码 key 是否齐全
pnpm exec bubbles-i18n check --project web
```

应用加载原来的 JSON catalogs，不读取 Excel。Vue / React 的接入和语言切换见对应框架指南。
