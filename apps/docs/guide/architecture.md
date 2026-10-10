# 实现思路

BubblesJS i18n 把国际化分成两条链路：开发时，CLI 从项目代码收集 key 并维护 JSON；运行时，core 加载 JSON、保存当前语言，React / Vue 适配层订阅变化并更新组件。JSON 是两条链路共同使用的词条格式。

## 先看完整流程

```text
开发与翻译维护

项目源码中的 tr("welcome", { name })
               │
               │ CLI：扫描静态 key，比较并同步
               ▼
    zh-CN.json / en-US.json
               ⇅
        Excel 翻译表

应用运行

默认中文 JSON ── message ──────► core store
                                  ▲
其他语言 JSON ── loaderMessage ───┘
                                  │
                           locale + message
                                  │ 状态订阅
                       ┌──────────┴──────────┐
                       ▼                     ▼
                  React Hooks          Vue Composables
                       │                     │
                       └───── tr(key) ───────┘
                                  ▼
                             组件中的文本
```

本仓库已实现「项目扫描 → JSON」、JSON ⇄ Excel 双向转换和运行时翻译。Excel 交给译者维护，`excel export` 负责导出，`excel import` 负责将译文写回各语言 JSON，应用继续读取 JSON。

| 层         | 包                      | 负责的事情                                 |
| ---------- | ----------------------- | ------------------------------------------ |
| 词条维护   | `@bubblesjs/i18n-cli`   | 扫描项目、维护 JSON、转换 Excel 翻译表     |
| 翻译运行时 | `@bubblesjs/i18n-core`  | 保存语言与词条、插值、异步切换、通知订阅者 |
| React 接入 | `@bubblesjs/i18n-react` | Context Provider 与外部状态订阅 Hooks      |
| Vue 接入   | `@bubblesjs/i18n-vue`   | provide / inject 与响应式 Composables      |

CLI 独立于运行时，也不依赖 React 或 Vue。应用可以只安装 core 与所用框架的适配器，开发环境再按需安装 CLI。

## 词条为何使用扁平 JSON

源码使用稳定的 key，JSON 保存每种语言对应的文本：

```ts
tr("welcome", { name: "Bubbles" });
tr("menu.home");
```

::: code-group

```json [zh-CN.json]
{
  "welcome": "你好，{name}！",
  "menu.home": "首页"
}
```

```json [en-US.json]
{
  "welcome": "Hello, {name}!",
  "menu.home": "Home"
}
```

:::

词条类型为 `Record<string, string>`。`menu.home` 是一个完整字符串键，不会展开成嵌套路径。这样扫描、同步、运行时查找和 Excel 的 key 列都使用同一种标识。

key 也可以直接使用中文，如 `tr("保存")`。无论选择语义 key 还是中文 key，都应在项目中保持一致，译文填写在对应语言的 JSON 中。

## CLI 如何把项目扫描成 JSON

1. 读取 `i18n.config.*`，按 `projects` 确定源码范围和各语言的 JSON 路径。
2. 用 glob 枚举源码文件，排除依赖、构建产物和配置中忽略的文件，跳过二进制文件。
3. 根据 `callNames` 匹配翻译调用，解析第一个静态字符串参数，记录 key、文件、行和列。
4. 每个项目合并并去重 key 集合，与各语言 JSON 的现有 key 比较。
5. `sync` 补入缺失 key，保留已有译文；`check` 只计算差异，用退出码供 CI 判断。

例如源码新增 `tr("menu.about")` 后执行 `sync`，各语言 JSON 都会补入：

```json
{
  "menu.about": "menu.about"
}
```

新增值先使用 key 本身，不会自动生成译文。之后把中文改为「关于」、英文改为「About」。已有的 `welcome` 和 `menu.home` 译文保持原值。

扫描包含在 `sync` / `check` 中，没有独立的 `scan` 命令。可以用 `sync --dry-run` 预览差异，默认不会删除未使用词条；只有显式使用 `--clean` 才清理。

扫描器是文本扫描，不解析完整的 JavaScript / Vue AST，也不执行源码。`tr(variable)`、拼接表达式和带插值的模板字符串无法提取；注释或其他字符串中形似调用的文本也可能被识别。使用动态 key 或清理词条前，应检查扫描报告。

同步会先校验一个项目的所有语言包，计算增删计划，再写入文件。写入通过临时文件替换完成，原子性以单个 JSON 文件为单位。具体命令、配置和报告见[CLI 使用](./cli)。

## core 如何翻译和切换语言

core 的中心是一个自建的可订阅状态容器，暴露 `getState()`、`setState()` 和 `subscribe()`。国际化状态包含四项：

| 状态                 | 作用                             |
| -------------------- | -------------------------------- |
| `locale`             | 当前语言，如 `zh-CN`             |
| `message`            | 当前语言的扁平词条               |
| `tr(key, values?)`   | 查找文本并替换 `{name}` 等占位符 |
| `loadLocale(locale)` | 异步加载并切换语言               |

`tr` 每次从容器读取最新的 `message`，查找 key 后交给 `formatMessage` 插值。缺失 key 返回 key 本身，缺失插值参数保留原占位符；空字符串译文会保留。

应用提供 `loaderMessage(locale)` 来加载对应语言包。默认示例直接使用 ``import(`./locales/${nextLocale}.json`)``，路径由应用提供，构建器负责 JSON 分包。core 不规定资源路径或请求方法，也可以通过加载器请求应用自己的接口。默认按需加载流程为：

1. 静态导入默认中文 JSON，再调用 `createI18n({ locale: "zh-CN", message: zhCN, loaderMessage })` 同步创建容器；初始化不调用加载器。
2. 把返回的容器交给 React / Vue 的 Provider，再挂载应用；其他语言包此时尚未加载。
3. 用户切换时调用 `loadLocale("en-US")`，才通过同一个 `loaderMessage` 动态加载英文 JSON。

创建容器有两种方式：

| 入口                                             | 适用场景                     | 首屏词条来自哪里            |
| ------------------------------------------------ | ---------------------------- | --------------------------- |
| `createI18n({ locale, message, loaderMessage })` | 已有首屏词条，直接同步创建   | 传入的 `message`            |
| `await initI18n({ locale, loaderMessage })`      | 先按语言异步加载，再启动应用 | 等待 `loaderMessage` 的结果 |

接入教程默认使用 `createI18n`：通过 `message` 提供静态导入的首屏词条，切换时再调用加载器。需要异步获取首屏词条时，使用 `initI18n`。只有 `initI18n` 会在初始化时读取保存的语言偏好，再回退到默认语言；`createI18n` 直接使用传入的 `locale` 与 `message`。

切换时，`loadLocale` 先调用应用提供的 `loaderMessage`。加载期间保留原语言和词条，完成后一起提交 `locale` 与 `message`，再通知组件。每次请求都有递增编号，较早请求的结果不会覆盖较晚的语言选择。

如果加载器抛出异常，core 会记录警告，并把目标语言与空词条提交到容器，翻译回退到 key。需要缓存或地区回退时，应在加载器中明确实现相应策略。持久化只保存语言偏好，JSON 词条仍由加载器提供。

完整 API 和边界行为见[核心容器](./core)。

## React 与 Vue 如何更新组件

两个适配器都接收同一种 core store，不重复实现翻译规则：

| 过程             | React                                        | Vue                                                    |
| ---------------- | -------------------------------------------- | ------------------------------------------------------ |
| 向组件树提供容器 | `I18nProvider` / Context                     | `I18nProvider` / provide                               |
| 在子组件取得容器 | Context                                      | inject                                                 |
| 订阅状态变化     | `useSyncExternalStore`                       | `shallowRef` 保存状态快照                              |
| 暴露组件可用值   | `useI18n()` 返回翻译方法、切换方法和当前语言 | `useI18n()` 返回翻译方法、切换方法和 computed 语言引用 |
| 清理订阅         | React 订阅生命周期                           | `onScopeDispose`                                       |

所以切换语言的实际路径是：**组件调用 `loadLocale` → core 更新状态 → 适配器收到通知 → 组件重新渲染译文**。无需刷新页面。

两个框架都使用 `const { tr, locale, loadLocale } = useI18n()`。`tr` 和 `loadLocale` 都是普通函数；React 的 `locale` 是当前语言值，Vue 的 `locale` 是 computed 引用，在脚本中读取 `locale.value`，模板中自动解包。Vue 的 `tr` 包装函数会读取响应式状态快照，在模板或 computed 中调用时建立依赖。服务端渲染时，应为每个请求创建独立容器，并让客户端水合使用相同的初始语言和词条。

可直接照着接入的完整文件示例见[React 接入与使用](./react)和[Vue 接入与使用](./vue)。

同一页面的全局区域和项目区域可以分别初始化独立容器，各自持有 `locale`、`message` 和加载器。外层 Provider 提供全局容器，内层 Provider 提供项目容器；后代组件的 `useI18n()` 读取最近的 Provider，局部切换只更新项目容器，全局切换只更新全局容器。读取局部词条的业务组件应放在局部 Provider 的后代中。

两个容器的词条不会自动合并，局部缺失的 key 仍回退到 key 本身。整体接入方式见[全局与局部使用](./scopes)，可复制的框架示例见 [React 局部使用](./react#局部使用-独立项目语言)和 [Vue 局部使用](./vue#局部使用-独立项目语言)。

## JSON ⇄ Excel 如何协作

每个项目通过 `excel.file` 配置一个 `.xlsx` 文件，默认工作表为 `translations`，可用 `excel.sheet` 指定。行是 key，列是语言：

| key       | 中文           | English        | 备注       |
| --------- | -------------- | -------------- | ---------- |
| welcome   | 你好，{name}！ | Hello, {name}! | 首屏欢迎语 |
| menu.home | 首页           | Home           | 导航       |

协作流程为：扫描项目补齐 JSON → `excel export` 导出 Excel → 译者填写语言列 → `excel import` 导入 JSON → 应用加载新词条。两个方向都会检测已有值冲突，使用 `-f` 才覆盖；目标端多出的 key 默认保留，使用 `--prune` 才清理。

Excel 只参与开发时的词条维护，不进入浏览器运行时。具体命令、表结构和冲突规则见 [CLI 使用](./cli#excel-workflow)；npm 包的功能发布状态请查看 [GitHub Releases](https://github.com/bubblesplant/i18n/releases)。

## 对照源码阅读

| 实现                 | 源码入口                                                                                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 状态、翻译与语言加载 | [core / i18n.ts](https://github.com/bubblesplant/i18n/blob/main/packages/i18n-core/src/i18n.ts)、[store.ts](https://github.com/bubblesplant/i18n/blob/main/packages/i18n-core/src/store.ts)                |
| React 订阅           | [react / index.tsx](https://github.com/bubblesplant/i18n/blob/main/packages/i18n-react/src/index.tsx)、[use-store.ts](https://github.com/bubblesplant/i18n/blob/main/packages/i18n-react/src/use-store.ts) |
| Vue 响应式订阅       | [vue / index.ts](https://github.com/bubblesplant/i18n/blob/main/packages/i18n-vue/src/index.ts)、[use-store.ts](https://github.com/bubblesplant/i18n/blob/main/packages/i18n-vue/src/use-store.ts)         |
| 扫描与 JSON 同步     | [cli / scanner.ts](https://github.com/bubblesplant/i18n/blob/main/packages/i18n-cli/src/scanner.ts)、[sync.ts](https://github.com/bubblesplant/i18n/blob/main/packages/i18n-cli/src/sync.ts)               |
