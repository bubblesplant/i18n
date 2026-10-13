# 实现思路

BubblesJS i18n 把国际化分成两条链路：开发时，CLI 从项目代码收集 key 并维护 JSON；运行时，core 加载 JSON、保存当前语言，React / Vue 适配层订阅变化并更新组件。JSON 是两条链路共同使用的词条格式。

## 先看完整流程

```text
开发时：源码 tr("key") → CLI 扫描与同步 → 各语言 JSON ⇄ Excel 翻译表

运行时：默认 JSON ── message ──────► core store
                                      ▲
        其他 JSON ── loaderMessage ───┘
                                      │ 状态订阅
                              React / Vue 适配器
                                      │ tr(key)
                                   组件文本
```

| 层         | 包                      | 负责的事情                                 |
| ---------- | ----------------------- | ------------------------------------------ |
| 词条维护   | `@bubblesjs/i18n-cli`   | 扫描项目、维护 JSON、转换 Excel 翻译表     |
| 翻译运行时 | `@bubblesjs/i18n-core`  | 保存语言与词条、插值、异步切换、通知订阅者 |
| React 接入 | `@bubblesjs/i18n-react` | Context Provider 与外部状态订阅 Hooks      |
| Vue 接入   | `@bubblesjs/i18n-vue`   | provide / inject 与响应式 Composables      |

CLI 独立于运行时，也不依赖 React 或 Vue。应用可以只安装 core 与所用框架的适配器，开发环境再按需安装 CLI。

## 词条为何使用扁平 JSON

词条使用 `Record<string, string>`：源码中的 key、JSON 的键和 Excel 的 key 列共享同一种标识，扫描去重和运行时查找都可以直接比较字符串。`menu.home` 是完整的键，不展开成嵌套路径；也可以使用中文原文作为 key。

可直接使用的语言包示例见[快速开始](./getting-started#准备语言-json)。

## CLI 如何把项目扫描成 JSON

1. 按配置中的 `include` / `exclude` 枚举源码，以 `callNames` 匹配调用并记录 key 的文件、行和列。
2. 每个项目去重 key，与各语言 JSON 比较，生成差异计划。
3. `sync` 写入缺失 key，保留已有译文；`check` 只检查差异并返回退出码。

扫描器使用文本匹配，不解析完整 AST，也不执行源码；同步不会自动翻译。命令、扫描限制和写入规则见 [命令行工具使用指南](./cli)。

## core 如何翻译和切换语言

core 使用自建的可订阅容器，通过 `getState()`、`setState()` 和 `subscribe()` 管理状态：

- `tr` 每次读取最新的 `message`，查找 key 后交给 `formatMessage` 插值。
- `loadLocale` 调用应用提供的加载器，完成后一次提交 `locale` 和 `message`，再通知订阅者。
- 请求使用递增编号，较早请求的结果不会覆盖较晚的语言选择。

资源加载与缓存由应用实现；core 负责状态和翻译。初始化方式、失败处理和持久化见[核心容器](./core)。

## React 与 Vue 如何更新组件

两个适配器都接收同一种 core store，不重复实现翻译规则：

| 过程             | React                                        | Vue                                                    |
| ---------------- | -------------------------------------------- | ------------------------------------------------------ |
| 向组件树提供容器 | `I18nProvider` / Context                     | `I18nProvider` / provide                               |
| 在子组件取得容器 | Context                                      | inject                                                 |
| 订阅状态变化     | `useSyncExternalStore`                       | `shallowRef` 保存状态快照                              |
| 暴露组件可用值   | `useI18n()` 返回翻译方法、切换方法和当前语言 | `useI18n()` 返回翻译方法、切换方法和 computed 语言引用 |
| 清理订阅         | React 订阅生命周期                           | `onScopeDispose`                                       |

Vue 的 `tr` 包装函数读取响应式快照，在模板或 computed 中调用时建立依赖；React 通过外部状态订阅触发重新渲染。切换语言的路径是：**组件调用 `loadLocale` → core 更新状态 → 适配器收到通知 → 组件更新译文**。

具体接入见 [React](./react)和 [Vue](./vue)，多个容器的隔离规则见[全局与局部使用](./scopes)。

## JSON ⇄ Excel 如何协作

Excel 中每行是一个 key，每个语言占一列。CLI 导出 JSON 供译者填写，再将译文导入回 JSON；应用始终加载 JSON，Excel 只参与开发时的维护。

转换直接比较两端当前值，不依赖历史同步记录。配置、表结构与冲突规则见 [命令行工具工作流](./cli#excel-workflow)。

## 对照源码阅读

| 实现                 | 源码入口                                                                                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 状态、翻译与语言加载 | [core / i18n.ts](https://github.com/bubblesplant/i18n/blob/main/packages/i18n-core/src/i18n.ts)、[store.ts](https://github.com/bubblesplant/i18n/blob/main/packages/i18n-core/src/store.ts)                |
| React 订阅           | [react / index.tsx](https://github.com/bubblesplant/i18n/blob/main/packages/i18n-react/src/index.tsx)、[use-store.ts](https://github.com/bubblesplant/i18n/blob/main/packages/i18n-react/src/use-store.ts) |
| Vue 响应式订阅       | [vue / index.ts](https://github.com/bubblesplant/i18n/blob/main/packages/i18n-vue/src/index.ts)、[use-store.ts](https://github.com/bubblesplant/i18n/blob/main/packages/i18n-vue/src/use-store.ts)         |
| 扫描与 JSON 同步     | [cli / scanner.ts](https://github.com/bubblesplant/i18n/blob/main/packages/i18n-cli/src/scanner.ts)、[sync.ts](https://github.com/bubblesplant/i18n/blob/main/packages/i18n-cli/src/sync.ts)               |
