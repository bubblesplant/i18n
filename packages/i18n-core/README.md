# @bubblesjs/i18n-core

与框架无关的轻量国际化库，提供字符串词条翻译、占位符插值、异步语言切换、可订阅状态和可选的语言偏好持久化。支持浏览器、Node.js 与 SSR，发布 ESM、CommonJS 和 TypeScript 声明。

## 安装

```sh
pnpm add @bubblesjs/i18n-core
```

React 和 Vue 项目可以使用 `@bubblesjs/i18n-react`、`@bubblesjs/i18n-vue` 适配层；它们使用相同的核心状态容器。

## 默认词条与按需切换语言

默认接入静态导入中文词条，用 `createI18n` 同步创建容器；其他语言在切换时由 `loaderMessage` 动态加载。core 不内置语言包路径，应用显式提供默认语言、词条和加载器。

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

在 `src/i18n.ts` 中导入默认中文包，并配置按目标语言动态导入的加载器：

```ts
import { createI18n } from "@bubblesjs/i18n-core";
import zhCN from "./locales/zh-CN.json";

export const store = createI18n({
  locale: "zh-CN",
  message: zhCN,
  loaderMessage: async (locale = "zh-CN") => (await import(`./locales/${locale}.json`)).default,
});
```

入口 `src/main.ts` 直接导入同步创建的容器，即可翻译或挂载 Provider：

```ts
import { store } from "./i18n";

store.getState().tr("welcome", { name: "Alex" }); // 你好，Alex！
```

首屏只静态导入默认中文包，英文包尚未加载。用户选择英文时，再执行：

```ts
await store.getState().loadLocale("en-US");
store.getState().tr("welcome", { name: "Alex" }); // Hello, Alex!
```

调用 `loadLocale("en-US")` 时才动态加载英文 JSON。语言名应与 JSON 文件名一致，构建器负责将动态导入资源分包。如果 TypeScript 无法识别 JSON 导入，请开启 `resolveJsonModule`。

`createI18n` 同步使用传入的 `locale` 和 `message`，不自动调用 `loaderMessage`。之后只有调用 `loadLocale` 才请求对应词条；资源地址、缓存、重试和词条回退规则由应用的加载器决定。

切换期间维持当前语言和词条，加载结束后一起更新状态。并发切换采用最后一次调用的语言，较早请求的结果不会覆盖它。加载器返回 `undefined` 或抛出异常都会使用空词条；异常通过 `console.warn` 记录。切换失败后仍提交目标语言与空词条，`loadLocale` 不会因此拒绝，翻译回退到 key。仅在加载器中抛出异常不能保持旧语言；需要阻止失败的切换时，应由应用在调用前确认资源可用或自行管理状态更新。

## 可选：异步初始化

如果默认语言也需要通过加载器获取，可在异步应用入口中使用 `initI18n`，等待初始词条后再挂载界面：

```ts
import { initI18n } from "@bubblesjs/i18n-core";

const store = await initI18n({
  locale: "zh-CN",
  loaderMessage: async (locale = "zh-CN") => (await import(`./locales/${locale}.json`)).default,
});
```

这个方案的中文包也通过动态导入加载。`initI18n` 确定初始语言后调用一次 `loaderMessage`，返回 `Promise<I18nStore>`；`createI18n` 直接使用传入的 `message`，同步返回 `I18nStore`。两种方案都在切换时加载目标语言。异步初始化加载失败时会记录警告，并返回空词条容器。框架接入见 [Vue 接入](../../apps/docs/guide/vue.md)和 [React 接入](../../apps/docs/guide/react.md)。

## 词条、插值与订阅

也可以直接传入内存词条，并订阅状态：

```ts
import { createI18n } from "@bubblesjs/i18n-core";

const store = createI18n({
  locale: "zh-CN",
  message: {
    welcome: "你好，{name}！",
    count: "共 {count} 项",
  },
});

store.getState().tr("welcome", { name: "小明" }); // 你好，小明！
store.getState().tr("count", { count: 0 }); // 共 0 项
store.getState().tr("unknown"); // unknown

const unsubscribe = store.subscribe(() => {
  console.log(store.getState().locale);
});
unsubscribe();
```

词条类型为 `Record<string, string>`，嵌套对象不会自动展开。例如 `"menu.home"` 可以直接作为键。缺失词条返回原始键，空字符串词条会保留。占位符采用 `{name}` 形式，只支持字母、数字和下划线；没有对应参数时保留占位符。参数可以是字符串或数字。库不包含 ICU 消息语法、复数规则、HTML 渲染或地区词条合并。

应用接入时应显式提供 `locale`、`message` 和 `loaderMessage`；需要首次异步加载时，使用前面的可选 `initI18n` 方案。

## 语言偏好持久化

如果要根据上次保存的语言加载首屏，可在异步应用入口中用 `initI18n` 配合存储初始化。这个可选方案继续按需加载词条：

```ts
import { createJsonStorage, initI18n } from "@bubblesjs/i18n-core";

const storage = createJsonStorage(typeof window === "undefined" ? undefined : window.localStorage);

const store = await initI18n({
  locale: "zh-CN",
  storage,
  storageKey: "app:locale",
  loaderMessage: async (locale = "zh-CN") => (await import(`./locales/${locale}.json`)).default,
});
```

入口等待 `initI18n` 返回容器后再挂载 Provider。`initI18n` 优先读取已保存的语言偏好，没有偏好时才使用默认 `locale`：例如保存的是 `en-US`，首屏只加载英文包；没有保存值时只加载中文包。只有同时设置 `storage` 和 `storageKey` 才会持久化。状态变化后保存当前语言，不保存词条，也不会在初始化时写入默认语言。

`createJsonStorage` 包装兼容 `getItem`、`setItem`、`removeItem` 的同步字符串存储。读取损坏 JSON 时尝试删除对应记录并返回 `null`；底层读写错误和序列化错误被忽略。写入 `undefined` 会删除旧值。SSR 不传底层存储时读取返回 `null`，写入无操作。JSON 适配器不验证数据结构，自定义存储和已有缓存应保持语言为字符串。

## API

| 导出                                  | 用途                                 |
| ------------------------------------- | ------------------------------------ |
| `createI18n(options?)`                | 创建同步国际化容器                   |
| `createI18nStore(options?)`           | `createI18n` 的兼容别名              |
| `initI18n(options?)`                  | 恢复语言偏好、加载初始词条并返回容器 |
| `i18n.init(options?)`                 | `initI18n` 的兼容类式入口            |
| `formatMessage(message, values?)`     | 独立替换占位符                       |
| `createJsonStorage(storage?)`         | 创建 JSON 存储适配器                 |
| `createStore(initialState, onChange)` | 创建可订阅的通用状态容器             |
| `shallowEqualObject(a, b)`            | 比较自有可枚举字符串键和对应值       |

`CreateI18nOptions` 包含 `locale?: string`、`message?: Messages`、`loaderMessage?: (locale?: string) => Promise<Messages | undefined>`、`storage?: JsonStorage` 和 `storageKey?: string`。`I18nInitOptions` 不包含 `message`。

容器提供 `getState()`、`setState(updater)` 和 `subscribe(listener)`。状态包含 `locale`、`message`、`tr(key, values?)`、`loadLocale(locale)`。订阅通知是同步的，浅比较相等的更新不会通知。使用 `setState` 时返回新的完整状态，保留翻译和加载方法；不要直接修改当前状态对象。`tr` 的既有引用会读取最新词条。

主要类型包括 `Locale`、`Messages`、`MessageValues`、`LoadMessages`、`I18nState`、`I18nStore`、`CreateI18nOptions`、`I18nInitOptions`、`JsonStorage`、`StateStorage`、`Store` 和 `StoreListener`。同时保留旧类型别名 `LocaleType`、`MessageType`、`messageType`、`LoadMessage`、`I18nStoreState`、`I18nStoreGetStateType`、`I18nStoreType`、`CreateI18nStoreOptions`。

## 开发与验证

在仓库根目录运行：

```sh
pnpm --filter @bubblesjs/i18n-core test
pnpm --filter @bubblesjs/i18n-core typecheck
pnpm --filter @bubblesjs/i18n-core build
pnpm --filter @bubblesjs/i18n-core verify:package
```

测试覆盖缺失词条回退、占位符边界、异步加载失败、并发语言切换、状态订阅及 JSON 存储异常。发布前需先构建，包产物仅包含 `dist`、README 和 MIT 许可证。
