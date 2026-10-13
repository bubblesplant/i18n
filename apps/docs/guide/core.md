# 核心容器

`@bubblesjs/i18n-core` 是框架无关的轻量国际化库，提供词条翻译、占位符插值、异步语言切换、状态订阅与可选的语言偏好持久化。支持浏览器、Node.js 与 SSR，发布 ESM、CommonJS 和 TypeScript 声明。

## 安装

```sh
pnpm add @bubblesjs/i18n-core
```

## 默认语言与按需切换

语言包与 `src/i18n.ts` 的完整准备步骤见[快速开始](./getting-started#准备语言-json)。`createI18n` 同步使用传入的 `locale` 和 `message`；`loadLocale` 才调用加载器。两种初始化方式的区别是：

| 入口                                             | 首屏词条           | 恢复已保存的语言               |
| ------------------------------------------------ | ------------------ | ------------------------------ |
| `createI18n({ locale, message, ... })`           | 直接使用 `message` | 不读取                         |
| `await initI18n({ locale, loaderMessage, ... })` | 等待加载器返回     | 优先读取，无偏好时使用默认语言 |

`loaderMessage` 接收可选语言，返回 `Promise<Messages | undefined>`。语言包地址、缓存、重试和词条回退由应用决定。

切换期间保留当前语言和词条，加载完成后一起更新。多个 `loadLocale` 并发时，最后一次调用优先；较早请求即使后完成，也不会覆盖新请求。

切换时，加载器返回 `undefined` 或抛出异常都会使用空词条；异常通过 `console.warn` 记录。切换失败后仍提交目标 `locale` 与空 `message`，`loadLocale` 不会因此拒绝，翻译回退到 key。仅在加载器中抛出异常不能保留旧语言；需要阻止失败的语言切换时，应由应用在调用前确认资源可用或自行管理状态更新。

## 初始词条与翻译

`message` 也可以直接传入词条对象：

```ts
import { createI18n } from "@bubblesjs/i18n-core";

const store = createI18n({
  locale: "zh-CN",
  message: {
    welcome: "你好，{name}！",
    "menu.home": "首页",
    count: "共 {count} 项",
  },
});

store.getState().tr("welcome", { name: "Bubbles" }); // 你好，Bubbles！
store.getState().tr("count", { count: 0 }); // 共 0 项
store.getState().tr("unknown"); // unknown
```

初始词条字段是 `message`，不是 `messages`。词条类型为 `Record<string, string>`，不自动展开嵌套对象，`"menu.home"` 直接作为字符串键。

不传选项时，语言为 `undefined`，词条为空。缺失词条回退到原始 key，空字符串翻译会保留。

## 插值

```ts
import { formatMessage } from "@bubblesjs/i18n-core";

formatMessage("你好，{name}，共 {count} 项", { name: "Alex", count: 0 });
// 你好，Alex，共 0 项

formatMessage("你好，{name}");
// 你好，{name}
```

占位符为 `{name}`，名称支持字母、数字和下划线。参数为字符串或数字；缺少参数时保留占位符。只读取词条与参数对象的自有属性，不把原型成员当作翻译内容。

库不包含 ICU 消息语法、复数规则、HTML 渲染或地区词条合并。它返回字符串，具体渲染交给应用和框架。

## 订阅与状态

使用[快速开始](./getting-started#创建容器与切换语言)导出的 `store`：

```ts
import { store } from "./i18n";

const unsubscribe = store.subscribe(() => {
  const { locale, message } = store.getState();
  console.log(locale, message);
});

await store.getState().loadLocale("zh-CN");
unsubscribe();
```

容器提供 `getState()`、`setState(updater)` 和 `subscribe(listener)`。状态包含 `locale`、`message`、`tr`、`loadLocale`。通知同步执行，浅比较相等的更新不通知；退订函数可用于清理。

使用 `setState` 时返回新的完整状态并保留方法，不要直接修改当前对象。`tr` 即使提前解构，也会读取容器中的最新词条。React 和 Vue 的适配层会替组件建立订阅并自动清理。

## 在组件外使用

普通 TypeScript 业务函数可以接收容器，通过 `getState()` 翻译，无需框架 Hook：

```ts
import type { I18nStore } from "@bubblesjs/i18n-core";

export function formatGreeting(store: I18nStore, name: string) {
  return store.getState().tr("你好，{name}！", { name });
}
```

调用 `formatGreeting(store, "Bubbles")` 返回当前译文，不建立界面订阅。需要随语言变化更新的文本，应在框架组件中通过 `useI18n()` 翻译。

## 持久化语言偏好

`initI18n` 不接收 `message`。需要异步首屏或恢复语言偏好时，可将 `src/i18n.ts` 改为导出加载器和存储：

```ts
import { createJsonStorage } from "@bubblesjs/i18n-core";

export const storage = createJsonStorage(
  typeof window === "undefined" ? undefined : window.localStorage,
);

export const loaderMessage = async (locale = "zh-CN") =>
  (await import(`./locales/${locale}.json`)).default;
```

入口显式传入初始化配置并等待后再挂载 Provider：

```ts
import { initI18n } from "@bubblesjs/i18n-core";
import { loaderMessage, storage } from "./i18n";

const store = await initI18n({
  locale: "zh-CN",
  storage,
  storageKey: "app:locale",
  loaderMessage,
});
```

例如保存的是 `en-US`，首屏只加载英文包；没有保存值时加载默认中文。初始加载器返回 `undefined` 或抛错时使用空词条，异常记录为警告。

同时提供 `storage` 和 `storageKey` 后，两种初始化入口都会在状态变化时保存语言；不保存词条，也不在初始化时主动写入默认值。

`createJsonStorage` 包装同步的 `getItem/setItem/removeItem` 字符串存储。损坏 JSON 会尝试删除并返回 `null`，底层存储和序列化异常被忽略；写入 `undefined` 会删除旧值。SSR 不传底层存储时，读取返回 `null`，写入不执行操作。适配器不校验缓存结构，语言偏好应保持字符串。

## 服务端渲染

为每个请求创建独立容器，用 `await initI18n(...)` 预加载该请求的语言。客户端水合前提供相同的初始语言与词条。容器放在请求作用域中，避免不同用户共享可变状态。

Node.js API 服务也可以按请求同步创建容器，并直接调用 `store.getState().tr()` 返回译文。请求头语言匹配、Hono 中间件和全局 / 局部路由示例见 [Node.js / Hono 后端](./node)。

## API 参考

| 导出                                  | 用途                           |
| ------------------------------------- | ------------------------------ |
| `createI18n(options?)`                | 同步创建容器                   |
| `createI18nStore(options?)`           | `createI18n` 的兼容别名        |
| `initI18n(options?)`                  | 恢复语言偏好并异步加载初始词条 |
| `i18n.init(options?)`                 | `initI18n` 的兼容类式入口      |
| `formatMessage(message, values?)`     | 独立插值                       |
| `createJsonStorage(storage?)`         | JSON 存储适配器                |
| `createStore(initialState, onChange)` | 通用可订阅状态容器             |
| `shallowEqualObject(a, b)`            | 比较自有可枚举字符串键与值     |

`CreateI18nOptions` 字段：

| 字段            | 类型                                                  | 用途                 |
| --------------- | ----------------------------------------------------- | -------------------- |
| `locale`        | `string`                                              | 初始语言，可选       |
| `message`       | `Messages`                                            | 初始扁平词条，可选   |
| `loaderMessage` | `(locale?: string) => Promise<Messages \| undefined>` | 异步词条加载器，可选 |
| `storage`       | `JsonStorage`                                         | 语言偏好存储，可选   |
| `storageKey`    | `string`                                              | 语言偏好存储键，可选 |

`I18nInitOptions` 使用相同选项，但不包含 `message`。主要类型包括 `Locale`、`Messages`、`MessageValues`、`LoadMessages`、`I18nState`、`I18nStore`、`JsonStorage`、`StateStorage`、`Store` 和 `StoreListener`。
