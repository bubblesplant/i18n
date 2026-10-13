# React 接入与使用

React 适配层用 Provider 注入核心容器，通过订阅状态更新界面。以下示例基于已有的 React + TypeScript 项目；要求 React `>=18.0.0`，本仓库使用 React 19 验证。

## 1. 安装

```sh
pnpm add @bubblesjs/i18n-core @bubblesjs/i18n-react
```

应用需提供 `react` 和 `react-dom`。

## 2. 准备容器 {#_2-准备容器}

先按快速开始[准备语言 JSON](./getting-started#准备语言-json)，再[创建容器与切换语言](./getting-started#创建容器与切换语言)，得到 `src/i18n.ts` 导出的 `store`。下面沿用其中的中文 key：`你好，{name}！`、`切换语言`。

## 3. 在应用入口接入 Provider {#_4-在应用入口接入-provider}

`src/main.tsx`：

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

容器创建一次并保持引用稳定，避免在组件每次渲染时重新初始化。

## 4. 在组件中翻译和切换语言 {#_5-在组件中翻译和切换语言}

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

点击按钮后，问候语由 `你好，Bubbles！` 切换为 `Hello, Bubbles!`。`locale` 是 `string | undefined`；需要随语言更新的文字，应在组件渲染时调用 `tr`。

`useI18n()` 遵循 React Hook 规则，应在函数组件或自定义 Hook 的顶层调用。组件必须位于 Provider 子树内，否则抛出 `useI18n must be used within I18nProvider`。

语言加载、失败处理与持久化见[核心容器](./core)。

## 局部使用：独立项目语言

按[全局与局部使用](./scopes)准备 `globalStore` 和 `projectStore`，在已导入 `I18nProvider` 的组件中嵌套 Provider：

```tsx
<I18nProvider store={globalStore}>
  <GlobalContent />
  <I18nProvider store={projectStore}>
    <ProjectContent />
  </I18nProvider>
</I18nProvider>
```

两个后代组件使用相同的 `useI18n()` 写法，各自读取最近的容器。在同一组件返回的 JSX 中渲染 Provider，不会改变这个组件自身 Hook 的上下文。

可[运行 Playground](./scopes#运行-playground)验证独立切换，或查看 [React 局部示例源码](https://github.com/bubblesplant/i18n/blob/main/apps/playground/react/src/components/ProjectRegion.tsx)。

## 在组件外使用

普通 TypeScript 函数通过容器调用翻译和切换方法，见[在组件外使用](./core#在组件外使用)。普通函数不调用 React Hook，也不会建立组件订阅。

## 直接订阅与选择器

`useI18nStore` 可以直接订阅传入的容器，无需 Provider：

```tsx
import type { I18nStore } from "@bubblesjs/i18n-core";
import { useI18nStore } from "@bubblesjs/i18n-react";

export function LocaleLabel({ store }: { store: I18nStore }) {
  const locale = useI18nStore(store, (state) => state.locale);
  return <span>{locale}</span>;
}
```

`useI18nStore(store)` 返回完整 `I18nState`；传入 selector 时返回选取结果。适配层通过 `useSyncExternalStore` 订阅，组件卸载时自动退订。选择器结果 `Object.is` 相等时，不会因容器更新而重渲染；选择器应为纯函数，返回原始值或保持对象引用稳定。

## 服务端渲染

Hook 提供服务端快照，可直接渲染已初始化的容器。请求隔离、预加载和客户端水合要求见[服务端渲染](./core#服务端渲染)。

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
