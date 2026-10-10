# 核心容器

`@bubblesjs/i18n-core` 是框架无关的轻量国际化库，提供词条翻译、占位符插值、异步语言切换、状态订阅与可选的语言偏好持久化。支持浏览器、Node.js 与 SSR，发布 ESM、CommonJS 和 TypeScript 声明。

安装：

```sh
pnpm add @bubblesjs/i18n-core
```

默认用 `createI18n`，显式导入默认语言 JSON 并传入 `locale`、`message` 和 `loaderMessage`。首屏直接使用默认词条，切换时才调用加载器。core 本身不知道语言包的路径，加载方法由应用提供。

## 默认语言与按需切换

先创建 `src/locales/zh-CN.json`：

```json
{
  "welcome": "你好，{name}！",
  "menu.home": "首页"
}
```

`src/locales/en-US.json` 保留相同 key：

```json
{
  "welcome": "Hello, {name}!",
  "menu.home": "Home"
}
```

在 `src/i18n.ts` 中只静态导入默认中文，其他语言按语言名动态导入。语言包路径由应用提供，构建器把其他语言拆成按需加载的资源：

```ts
import { createI18n } from "@bubblesjs/i18n-core";
import zhCN from "./locales/zh-CN.json";

export const store = createI18n({
  locale: "zh-CN",
  message: zhCN,
  loaderMessage: async (locale = "zh-CN") => (await import(`./locales/${locale}.json`)).default,
});
```

在入口 `src/main.ts` 直接使用容器，无需等待初始化：

```ts
import { store } from "./i18n";

store.getState().tr("welcome", { name: "Alex" }); // 你好，Alex！
```

`locale` 指定默认语言，`message` 提供中文词条，`loaderMessage` 提供切换时的加载方法。初始化直接使用 `message`，不调用加载器。启动界面后，根据用户的语言选择再调用：

```ts
await store.getState().loadLocale("en-US");
store.getState().tr("welcome", { name: "Alex" }); // Hello, Alex!
```

调用 `loadLocale("en-US")` 时才动态加载英文 JSON。如果 TypeScript 无法识别 JSON 导入，请开启 `resolveJsonModule`。完整入口和 Provider 示例见 [Vue 接入](./vue)和 [React 接入](./react)。

`loaderMessage` 接收可选语言，返回 `Promise<Messages | undefined>`。core 只请求选中的语言；语言包地址、缓存、重试和词条回退规则由应用的加载器决定。

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

`createI18n` 同步返回容器，使用提供的初始词条，不自动调用加载器。不传选项时，语言为 `undefined`，词条为空。缺失词条回退到原始 key，空字符串翻译会保留。

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

下面继续使用前面导出的 `store`：

```ts
const unsubscribe = store.subscribe(() => {
  const { locale, message } = store.getState();
  console.log(locale, message);
});

await store.getState().loadLocale("zh-CN");
unsubscribe();
```

容器提供 `getState()`、`setState(updater)` 和 `subscribe(listener)`。状态包含 `locale`、`message`、`tr`、`loadLocale`。通知同步执行，浅比较相等的更新不通知；退订函数可用于清理。

使用 `setState` 时返回新的完整状态并保留方法，不要直接修改当前对象。`tr` 即使提前解构，也会读取容器中的最新词条。React 和 Vue 的适配层会替组件建立订阅并自动清理。

## 持久化语言偏好

如果首屏词条也需要异步获取，或要恢复保存的语言偏好，可以选择 `initI18n`。它先确定初始语言，等待 `loaderMessage` 完成后再返回容器，不接收 `message`。例如将 `src/i18n.ts` 替换为：

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

`initI18n` 优先读取已保存的语言偏好，没有偏好时才使用默认 `locale`：例如保存的是 `en-US`，首屏只加载英文包；没有保存值时只加载中文包。初始加载器返回 `undefined` 或抛错时，会使用空词条，异常记录为警告。

`createI18n` 初始化只使用传入的 `locale` 与 `message`，不会读取保存的偏好。同时提供 `storage` 和 `storageKey` 后，两种入口都会在状态变化时保存语言；不保存词条，也不在初始化时主动写入默认值。

`createJsonStorage` 包装同步的 `getItem/setItem/removeItem` 字符串存储。损坏 JSON 会尝试删除并返回 `null`，底层存储和序列化异常被忽略；写入 `undefined` 会删除旧值。SSR 不传底层存储时，读取返回 `null`，写入不执行操作。适配器不校验缓存结构，语言偏好应保持字符串。

服务端渲染应为每个请求分别创建容器，并在客户端水合时提供相同初始词条与语言，避免不同用户共享状态。

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
