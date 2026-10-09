# React 适配层

`@bubblesjs/i18n-react` 将核心容器接入 React 的外部状态订阅。要求 React `>=18.0.0`；本仓库使用 React 19 验证组件与服务端渲染。

安装：

```sh
pnpm add @bubblesjs/i18n-core @bubblesjs/i18n-react
```

React 是 peer dependency，由应用提供；尚未安装框架时还需添加 `react` 和对应渲染器 `react-dom`。

## Provider 与翻译

```tsx
import { createI18n } from "@bubblesjs/i18n-core";
import { I18nProvider, useI18n } from "@bubblesjs/i18n-react";

const store = createI18n({
  locale: "zh-CN",
  message: { greeting: "你好，{name}" },
  loaderMessage: async (locale) =>
    locale === "en" ? { greeting: "Hello, {name}" } : { greeting: "你好，{name}" },
});

function Greeting() {
  const { tr, locale, loadLocale } = useI18n();

  return (
    <section>
      <p>{tr("greeting", { name: "Bubbles" })}</p>
      <button onClick={() => void loadLocale(locale === "en" ? "zh-CN" : "en")}>切换语言</button>
    </section>
  );
}

export default function App() {
  return (
    <I18nProvider store={store}>
      <Greeting />
    </I18nProvider>
  );
}
```

`useI18n()` 返回 `tr`、异步的 `loadLocale` 和当前 `locale`。语言加载完成后组件自动刷新。必须在 Provider 子树内调用，否则抛出 `useI18n must be used within I18nProvider`。

容器在应用初始化处创建，并保持引用稳定。嵌套 Provider 使用最近的容器，允许不同子树使用独立语言。

## 直接订阅与选择器

不需要 Provider 时，可显式传入容器：

```tsx
import { useI18nStore } from "@bubblesjs/i18n-react";
import { store } from "./i18n";

function LocaleLabel() {
  const locale = useI18nStore(store, (state) => state.locale);
  return <span>{locale}</span>;
}
```

`useI18nStore(store)` 返回完整 `I18nState`；传入 selector 时返回选取结果。`Object.is` 判断结果相等时，不触发外部状态更新带来的重渲染。选择器应为纯函数，返回原始值或保持对象引用稳定，可以避免不相关更新导致重渲染。

适配层使用 `useSyncExternalStore`，组件卸载时自动取消订阅。

## 服务端渲染

Hook 提供服务端快照，可使用已初始化的容器渲染首屏。每个请求分别创建 store，不在服务器模块顶层保存全局可变容器：

```tsx
import { initI18n, type Messages } from "@bubblesjs/i18n-core";
import { I18nProvider } from "@bubblesjs/i18n-react";
import { renderToString } from "react-dom/server";

async function renderPage(locale: string, message: Messages) {
  const store = await initI18n({
    locale,
    loaderMessage: async () => message,
  });

  return renderToString(
    <I18nProvider store={store}>
      <Greeting />
    </I18nProvider>,
  );
}
```

示例的 `Greeting` 与上面的组件相同。实际应用应将服务端初始语言和词条传给客户端，在水合前创建相同状态的容器。客户端词条更新和动态加载仍按[核心容器](./core)的行为处理。

## API

| 导出                            | 用途                              |
| ------------------------------- | --------------------------------- |
| `I18nProvider`（默认导出）      | 接收 `store` 和 `children`        |
| `useI18n()`                     | 返回 `{ tr, loadLocale, locale }` |
| `useI18nStore(store)`           | 订阅完整状态                      |
| `useI18nStore(store, selector)` | 订阅选取结果                      |
| `I18nContext`                   | 直接读取容器的 React Context      |
| `I18nProviderProps`             | Provider 属性类型                 |

所有导出提供 ESM、CommonJS 和对应 TypeScript 声明。React 是框架依赖，core 是普通依赖；打包时不会内联框架。
