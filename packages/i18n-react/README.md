# @bubblesjs/i18n-react

React 18 及以上的国际化适配层，基于 `@bubblesjs/i18n-core` 的外部状态容器。提供 Provider、翻译 Hook 和选择器订阅，支持 ESM、CommonJS 和 TypeScript 类型声明。

## 安装

```sh
pnpm add @bubblesjs/i18n-core @bubblesjs/i18n-react react react-dom
```

`i18n-core` 是普通依赖，安装适配包时会自动安装；直接调用 `createI18n` 等核心 API 时建议显式声明依赖。React 是 peer dependency，由应用提供。本仓库测试使用 React 19。

## 快速开始

下面按文件接入已有的 React + TypeScript 项目。先准备 `src/locales/zh-CN.json`：

```json
{
  "greeting": "你好，{name}！",
  "switchLanguage": "切换语言"
}
```

`src/locales/en-US.json` 使用相同 key：

```json
{
  "greeting": "Hello, {name}!",
  "switchLanguage": "Switch language"
}
```

在 `src/i18n.ts` 中显式导入默认中文，通过 `createI18n` 同步创建并导出容器。`loaderMessage` 用于切换时动态导入目标语言：

```ts
import { createI18n } from "@bubblesjs/i18n-core";
import zhCN from "./locales/zh-CN.json";

export const store = createI18n({
  locale: "zh-CN",
  message: zhCN,
  loaderMessage: async (locale = "zh-CN") => (await import(`./locales/${locale}.json`)).default,
});
```

`src/main.tsx` 直接导入 `store` 并挂载应用：

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

`src/App.tsx` 中翻译和切换语言：

```tsx
import { useI18n } from "@bubblesjs/i18n-react";

export default function App() {
  const { tr, locale, loadLocale } = useI18n();

  return (
    <section>
      <p>{tr("greeting", { name: "Bubbles" })}</p>
      <button onClick={() => void loadLocale(locale === "zh-CN" ? "en-US" : "zh-CN")}>
        {tr("switchLanguage")}
      </button>
    </section>
  );
}
```

这个例子的加载顺序是：

```text
首屏：import zhCN from "./locales/zh-CN.json"
      → createI18n 使用 locale: "zh-CN" 和 message: zhCN
      → 同步创建 store 并挂载 Provider

切换：loadLocale("en-US")
      → 调用同一个 loaderMessage("en-US")
      → 加载英文 JSON
      → 更新容器，订阅组件重新渲染
```

这里只静态导入默认中文 JSON，首屏无需异步初始化；调用 `loadLocale("en-US")` 时才通过 `loaderMessage` 动态导入英文 JSON。语言名应与 JSON 文件名一致；Vite 等支持这种动态导入的打包工具负责对其他语言分包。如果 TypeScript 无法识别 JSON 导入，请开启 `resolveJsonModule`。

`createI18n` 创建时直接使用 `message`，不会调用 `loaderMessage`；后续通过 `loadLocale` 加载目标语言，完成后订阅组件自动刷新。缺失词条回退到原始键；多个语言加载并发时，以最后一次调用为准。容器在 `src/i18n.ts` 中创建一次，避免每次组件渲染都重新创建。

## API

| 导出                            | 用途                                                                     |
| ------------------------------- | ------------------------------------------------------------------------ |
| `I18nProvider`（默认导出）      | 接收 `store` 和 `children`，为子树提供容器；嵌套 Provider 使用最近的容器 |
| `useI18n()`                     | 返回 `{ tr, loadLocale, locale }`，必须位于 Provider 内                  |
| `useI18nStore(store)`           | 返回当前完整 `I18nState`，可独立于 Provider 使用                         |
| `useI18nStore(store, selector)` | 返回选择器结果；结果 `Object.is` 相等时不触发状态订阅重渲染              |
| `I18nContext`                   | React Context，适合需要直接读取容器的集成                                |
| `I18nProviderProps`             | Provider 的 TypeScript 属性类型                                          |

只关注语言时可以使用选择器，将入口导入的容器作为属性传入组件：

```tsx
import type { I18nStore } from "@bubblesjs/i18n-core";
import { useI18nStore } from "@bubblesjs/i18n-react";

export function LocaleLabel({ store }: { store: I18nStore }) {
  const locale = useI18nStore(store, (state) => state.locale);
  return <span>{locale}</span>;
}
```

选择器应保持纯函数；需要避免不相关状态更新导致重渲染时，返回原始值或保持对象引用稳定。组件卸载会自动取消订阅。

## 服务端渲染

适配层使用 `useSyncExternalStore` 的服务端快照，可以在服务端读取已初始化的词条。每个请求分别创建容器，向 `createI18n` 传入该请求的 `locale` 和 `message`；若词条需异步加载，可使用 `await initI18n(...)`。服务器应使用请求内的容器，客户端水合使用相同初始语言和词条。

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
