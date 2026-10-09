# @bubblesjs/i18n-react

React 18 及以上的国际化适配层，基于 `@bubblesjs/i18n-core` 的外部状态容器。提供 Provider、翻译 Hook 和选择器订阅，支持 ESM、CommonJS 和 TypeScript 类型声明。

## 安装

```sh
pnpm add @bubblesjs/i18n-core @bubblesjs/i18n-react react react-dom
```

`i18n-core` 是普通依赖，安装适配包时会自动安装；直接调用 `createI18n` 时建议显式声明依赖。React 是 peer dependency，由应用提供。本仓库测试使用 React 19。

## 快速开始

```tsx
import { createI18n } from "@bubblesjs/i18n-core";
import { I18nProvider, useI18n } from "@bubblesjs/i18n-react";

const store = createI18n({
  locale: "zh-CN",
  message: { greeting: "你好，{name}" },
  loaderMessage: async (locale) => {
    if (locale === "en") return { greeting: "Hello, {name}" };
    return { greeting: "你好，{name}" };
  },
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

`loaderMessage` 也可以动态导入 JSON 文件，例如 `return (await import("./locales/en.json")).default`。语言加载完成后，订阅组件自动刷新。缺失词条回退到原始键；多个语言加载并发时，以最后一次调用为准。请在应用初始化时创建容器，避免每次组件渲染都重新创建。

## API

| 导出                            | 用途                                                                     |
| ------------------------------- | ------------------------------------------------------------------------ |
| `I18nProvider`（默认导出）      | 接收 `store` 和 `children`，为子树提供容器；嵌套 Provider 使用最近的容器 |
| `useI18n()`                     | 返回 `{ tr, loadLocale, locale }`，必须位于 Provider 内                  |
| `useI18nStore(store)`           | 返回当前完整 `I18nState`，可独立于 Provider 使用                         |
| `useI18nStore(store, selector)` | 返回选择器结果；结果 `Object.is` 相等时不触发状态订阅重渲染              |
| `I18nContext`                   | React Context，适合需要直接读取容器的集成                                |
| `I18nProviderProps`             | Provider 的 TypeScript 属性类型                                          |

只关注语言时可以使用选择器：

```tsx
import { useI18nStore } from "@bubblesjs/i18n-react";

const locale = useI18nStore(store, (state) => state.locale);
```

选择器应保持纯函数；需要避免不相关状态更新导致重渲染时，返回原始值或保持对象引用稳定。组件卸载会自动取消订阅。

## 服务端渲染

适配层使用 `useSyncExternalStore` 的服务端快照，可以在服务端读取已初始化的词条。每个请求分别创建容器；使用 `await initI18n(...)` 预加载语言，并让客户端水合使用相同初始语言和词条。

## 本仓库验证

```sh
pnpm --filter @bubblesjs/i18n-react typecheck
pnpm --filter @bubblesjs/i18n-react test
pnpm --filter @bubblesjs/i18n-react build
pnpm --filter @bubblesjs/i18n-react verify:package
```

测试覆盖组件翻译、异步语言切换、嵌套 Provider、完整状态和选择器订阅、卸载清理、缺少 Provider 的错误与服务端渲染。发布前应运行仓库的完整验证，以检查实际 npm tarball、依赖和类型消费。

## 许可证

MIT。
