# @bubblesjs/i18n-core

与框架无关的轻量国际化库，提供字符串词条翻译、占位符插值、异步语言切换、可订阅状态和可选的语言偏好持久化。支持浏览器、Node.js 与 SSR，发布 ESM、CommonJS 和 TypeScript 声明。

## 安装

```sh
pnpm add @bubblesjs/i18n-core
```

React 和 Vue 项目可以使用 `@bubblesjs/i18n-react`、`@bubblesjs/i18n-vue` 适配层；它们使用相同的核心状态容器。

## 同步词条

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

## 异步词条与语言切换

```ts
import { initI18n, type Messages } from "@bubblesjs/i18n-core";

const dictionaries: Record<string, Messages> = {
  "zh-CN": { welcome: "你好，{name}！" },
  "en-US": { welcome: "Hello, {name}!" },
};

const store = await initI18n({
  locale: "zh-CN",
  loaderMessage: async (locale) => dictionaries[locale ?? "zh-CN"],
});

await store.getState().loadLocale("en-US");
store.getState().tr("welcome", { name: "Alex" }); // Hello, Alex!
```

`initI18n` 会等待初始词条加载完成。`createI18n` 使用立即可用的 `message`，不会自动加载初始词条；需要首次异步加载时使用 `initI18n`。不传入任何选项也可以创建容器，此时语言为 `undefined`、词条为空。

切换语言期间维持当前语言和词条，加载结束后一起更新状态。并发切换采用最后一次调用的语言，较早请求的结果不会覆盖它。加载器返回 `undefined` 或抛出异常时使用空词条，异常会通过 `console.warn` 记录，`loadLocale` 不会因此拒绝。若需要加载失败后保留原语言、复用缓存或地区回退，可以在加载器中实现相应策略。

## 语言偏好持久化

```ts
import { createJsonStorage, initI18n, type Messages } from "@bubblesjs/i18n-core";

const storage = createJsonStorage(typeof window === "undefined" ? undefined : window.localStorage);

const dictionaries: Record<string, Messages> = {
  "zh-CN": { title: "首页" },
  "en-US": { title: "Home" },
};

const store = await initI18n({
  locale: "zh-CN",
  storage,
  storageKey: "app:locale",
  loaderMessage: async (locale) => dictionaries[locale ?? "zh-CN"],
});

await store.getState().loadLocale("en-US");
```

`initI18n` 优先读取存储中的语言，没有存储值时使用 `locale` 默认值。只有同时设置 `storage` 和 `storageKey` 才会持久化。状态变化后保存当前语言，不保存词条，也不会在初始化时写入默认语言。

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
