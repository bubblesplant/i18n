# React 接入与使用

React 接入分为三步：显式导入默认中文词条并通过 `createI18n` 同步创建容器，用 `I18nProvider` 提供给组件树，在业务组件中通过 `useI18n()` 翻译和切换语言。首屏使用默认中文，切换时再由 `loaderMessage` 动态加载目标语言；容器负责词条和语言状态，React 适配层负责订阅状态并更新界面。

下面以已有的 React + TypeScript 项目为例，完成中文首屏、英文切换和占位符插值。要求 React `>=18.0.0`；本仓库使用 React 19 验证。

如果项目工作区需要独立切换语言，见本文的[局部使用：独立项目语言](#局部使用-独立项目语言)；全局与局部容器的词条和加载器配置见[全局与局部使用](./scopes)。

## 1. 安装

```sh
pnpm add @bubblesjs/i18n-core @bubblesjs/i18n-react
```

应用需提供 `react` 和 `react-dom`。适配包依赖 core，但示例会直接从 core 导入初始化方法，因此显式声明两个包。

## 2. 准备 JSON 语言包

创建 `src/locales/zh-CN.json`：

```json
{
  "你好，{name}！": "你好，{name}！",
  "切换语言": "切换语言"
}
```

创建 `src/locales/en-US.json`，保留相同的 key，只翻译 value：

```json
{
  "你好，{name}！": "Hello, {name}!",
  "切换语言": "Switch language"
}
```

词条必须是扁平的 `Record<string, string>`。这里使用中文原文作为 key；也可以使用 `greeting`、`menu.home` 等 key，但源码调用和所有语言包的 key 必须一致。`{name}` 是运行时占位符，翻译时也要保留。

这些 JSON 可以手工维护，也可以通过 [CLI 扫描项目并同步](./cli)得到。

## 3. 显式导入默认语言并创建容器

在 `src/i18n.ts` 中静态导入默认中文 JSON，显式配置 `locale`、`message` 和切换时使用的 `loaderMessage`，导出创建好的容器：

```ts
import { createI18n } from "@bubblesjs/i18n-core";
import zhCN from "./locales/zh-CN.json";

export const store = createI18n({
  locale: "zh-CN",
  message: zhCN,
  loaderMessage: async (locale = "zh-CN") => (await import(`./locales/${locale}.json`)).default,
});
```

`createI18n` 同步创建容器，首屏直接使用静态导入的 `zhCN`，创建时不会调用 `loaderMessage`。这里只静态导入默认中文，英文 JSON 尚未加载；入口无需等待异步初始化。

调用 `loadLocale("en-US")` 时，同一个 `loaderMessage` 才动态导入 `./locales/en-US.json`。语言名应与 JSON 文件名一致；Vite 等支持这种动态导入的构建器负责将 JSON 拆成按需加载的资源。加载器也可以改为请求接口或静态资源 URL，加载方式由应用决定。如果 TypeScript 无法识别 JSON 导入，请在应用的 `tsconfig` 中开启 `resolveJsonModule`。

## 4. 在应用入口接入 Provider

`src/main.tsx` 直接导入 `store` 并渲染组件树：

```tsx
import { createRoot } from "react-dom/client";
import { I18nProvider } from "@bubblesjs/i18n-react";
import App from "./App";
import { store } from "./i18n";

createRoot(document.getElementById("root")!).render(
  <I18nProvider store={store}>
    <App />
  </I18nProvider>,
);
```

示例沿用 React 项目常见的 `#root` 挂载节点。容器在应用启动时创建一次，并保持引用稳定。Provider 下的组件都能使用同一个容器；嵌套 Provider 则使用最近的容器，适合需要独立语言的子树。

## 5. 在组件中翻译和切换语言

`src/App.tsx`：

```tsx
import { useI18n } from "@bubblesjs/i18n-react";

export default function App() {
  const { tr, locale, loadLocale } = useI18n();

  return (
    <main>
      <p>{tr("你好，{name}！", { name: "Bubbles" })}</p>
      <p>{locale}</p>
      <button onClick={() => void loadLocale(locale === "zh-CN" ? "en-US" : "zh-CN")}>
        {tr("切换语言")}
      </button>
    </main>
  );
}
```

首次显示 `你好，Bubbles！`。点击时 `loadLocale("en-US")` 将目标语言交给同一个 `loaderMessage`，执行英文 JSON 的动态导入，再显示 `Hello, Bubbles!`；所有订阅此容器的组件一起刷新。

| 返回值               | 使用方式                                                          |
| -------------------- | ----------------------------------------------------------------- |
| `tr(key, values?)`   | 查找当前词条并替换 `{name}` 等占位符，缺失 key 时返回 key 本身    |
| `locale`             | 当前语言，类型为 `string \| undefined`                            |
| `loadLocale(locale)` | 异步加载并切换语言，返回 `Promise<void>`，可使用 `await` 等待完成 |

加载期间维持当前语言和词条；加载完成后一起提交新状态。并发切换以最后一次调用为准。加载器返回 `undefined` 或抛出异常时，核心会切换到目标语言和空词条，异常通过 `console.warn` 记录。按需实现加载提示和加载器的缓存、重试策略，详见[核心容器](./core)。

`useI18n()` 必须位于 Provider 子树内，否则会抛出 `useI18n must be used within I18nProvider`。

若需要在挂载前恢复用户上次选择的语言，可改用 `initI18n` 并配置 `storage` 和 `storageKey`，等待它加载保存的语言后再挂载，见[语言偏好持久化](./core#持久化语言偏好)。

## 局部使用：独立项目语言

应用导航和项目工作区可以使用不同语言：外层 Provider 提供全局容器，项目区域再嵌套一个 Provider，提供独立的项目容器。切换项目语言只更新项目区域，切换全局语言只更新使用全局容器的组件。

先按[全局与局部使用](./scopes)准备全局 JSON（`src/locales/zh-CN.json`、`src/locales/en-US.json`）、项目 JSON（`src/locales/project/zh-CN.json`、`src/locales/project/en-US.json`），以及 `src/i18n.ts` 导出的 `globalStore`、`projectStore`。两个容器分别静态导入各自的默认中文，使用各自的动态加载器切换语言；项目词条包含 `项目工作区`、`你好，{name}！` 和 `切换语言`。

入口 `src/main.tsx` 直接导入两个容器，并交给各自的 Provider：

```tsx
import { createRoot } from "react-dom/client";
import { I18nProvider } from "@bubblesjs/i18n-react";
import App from "./App";
import { globalStore, projectStore } from "./i18n";

createRoot(document.getElementById("root")!).render(
  <I18nProvider store={globalStore}>
    <App projectStore={projectStore} />
  </I18nProvider>,
);
```

`src/App.tsx` 的 Hook 读取全局语言；将项目内容拆成子组件，让它在内层 Provider 下读取项目语言：

```tsx
import type { I18nStore } from "@bubblesjs/i18n-core";
import { I18nProvider, useI18n } from "@bubblesjs/i18n-react";

export default function App({ projectStore }: { projectStore: I18nStore }) {
  const { tr, locale, loadLocale } = useI18n();

  return (
    <main>
      <section>
        <h2>全局应用</h2>
        <p>{tr("你好，{name}！", { name: "Bubbles" })}</p>
        <p>全局语言：{locale}</p>
        <button onClick={() => void loadLocale(locale === "zh-CN" ? "en-US" : "zh-CN")}>
          {tr("切换语言")}
        </button>
      </section>

      <I18nProvider store={projectStore}>
        <ProjectContent />
      </I18nProvider>
    </main>
  );
}

function ProjectContent() {
  const { tr, locale, loadLocale } = useI18n();

  return (
    <section>
      <h2>{tr("项目工作区")}</h2>
      <p>{tr("你好，{name}！", { name: "Project" })}</p>
      <p>项目语言：{locale}</p>
      <button onClick={() => void loadLocale(locale === "zh-CN" ? "en-US" : "zh-CN")}>
        {tr("切换语言")}
      </button>
    </section>
  );
}
```

`App` 自身的 `useI18n()` 读取祖先提供的全局容器。在同一组件返回的 JSX 中渲染内层 Provider，不会改变这个 Hook 的上下文；只有其后代 `ProjectContent` 读取项目容器。

两个容器的词条独立，内层不会自动继承或合并外层词条；项目缺少的 key 会返回 key 本身。两个 store 都应在启动时创建并保持引用稳定，避免在组件每次渲染时重新初始化。若启用语言偏好持久化，应为两个容器设置不同的 `storageKey`，分别保存全局和项目的语言选择。

可以[运行 Playground](./scopes#运行-playground)验证两区独立切换，也可以查看 [React 示例源码](https://github.com/bubblesplant/i18n/blob/main/apps/playground/src/examples/ReactExample.tsx)。

## 在组件外使用

表单校验、请求提示等普通 TypeScript 代码可以通过参数接收启动时创建的容器，不调用 React Hook：

```ts
import type { I18nStore } from "@bubblesjs/i18n-core";

export function formatGreeting(store: I18nStore, name: string) {
  return store.getState().tr("你好，{name}！", { name });
}

export async function switchToEnglish(store: I18nStore) {
  await store.getState().loadLocale("en-US");
}
```

在入口中，可以将从 `./i18n` 导入的 `store` 传给这些业务函数，例如 `formatGreeting(store, "Bubbles")`。普通函数调用不会建立组件订阅；界面中需要自动更新的文字，应在组件渲染时调用 `useI18n()` 返回的 `tr`。

## 直接订阅与选择器

通过组件属性传入已创建的容器，也可以直接订阅完整状态或某个字段：

```tsx
import type { I18nStore } from "@bubblesjs/i18n-core";
import { useI18nStore } from "@bubblesjs/i18n-react";

export function LocaleLabel({ store }: { store: I18nStore }) {
  const locale = useI18nStore(store, (state) => state.locale);
  return <span>{locale}</span>;
}
```

在持有容器的组件中渲染 `<LocaleLabel store={store} />`。`useI18nStore(store)` 返回完整 `I18nState`；传入 selector 时返回选取结果。直接订阅不需要 Provider。适配层通过 `useSyncExternalStore` 连接核心订阅，组件卸载时自动取消订阅。选择器结果 `Object.is` 相等时，不会因容器更新而重渲染；选择器应为纯函数，返回原始值或保持对象引用稳定。

## 服务端渲染

Hook 提供服务端快照，可直接渲染已初始化的容器。每个请求分别创建 store，通过 `await initI18n(...)` 预加载该请求的语言；客户端水合前用相同语言和词条创建容器。服务器模块顶层的共享可变容器会让不同请求互相影响，应将容器放在请求作用域中。

## 导出 API

| 导出                            | 用途                              |
| ------------------------------- | --------------------------------- |
| `I18nProvider`（也是默认导出）  | 接收 `store` 和 `children`        |
| `useI18n()`                     | 返回 `{ tr, loadLocale, locale }` |
| `useI18nStore(store)`           | 订阅完整状态                      |
| `useI18nStore(store, selector)` | 订阅选取结果                      |
| `I18nContext`                   | 直接读取容器的 React Context      |
| `I18nProviderProps`             | Provider 属性类型                 |

包提供 ESM、CommonJS 和 TypeScript 声明。React 是 peer dependency，打包时不会内联框架。
