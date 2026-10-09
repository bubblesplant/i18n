# Vue 适配层

`@bubblesjs/i18n-vue` 把核心状态容器接入 Vue 3 响应式系统，提供 Provider、Composables 和自动退订。当前 Vue peer 版本为 `^3.5.43`。

安装：

```sh
pnpm add @bubblesjs/i18n-core @bubblesjs/i18n-vue
```

Vue 由应用提供；尚未安装时添加兼容版本的 `vue`。

## 创建容器

例如在 `src/i18n.ts`：

```ts
import { createI18n } from "@bubblesjs/i18n-core";

export const store = createI18n({
  locale: "zh-CN",
  message: { greeting: "你好，{name}" },
  loaderMessage: async (locale) =>
    locale === "en" ? { greeting: "Hello, {name}" } : { greeting: "你好，{name}" },
});
```

异步加载首屏时使用 `await initI18n(...)`，详见[核心容器](./core)。

## 提供容器

根组件使用 Provider：

```vue
<script setup lang="ts">
import { I18nProvider } from "@bubblesjs/i18n-vue";
import Greeting from "./Greeting.vue";
import { store } from "./i18n";
</script>

<template>
  <I18nProvider :store="store">
    <Greeting />
  </I18nProvider>
</template>
```

Provider 原样渲染默认插槽，并为后代组件注入容器。嵌套 Provider 可以隔离子树的语言。

## 翻译与语言切换

`Greeting.vue`：

```vue
<script setup lang="ts">
import { useI18n } from "@bubblesjs/i18n-vue";

const { tr, locale, loadLocale } = useI18n();
</script>

<template>
  <p>{{ tr("greeting", { name: "Bubbles" }) }}</p>
  <button @click="loadLocale(locale === 'en' ? 'zh-CN' : 'en')">切换语言</button>
</template>
```

`locale` 是计算引用，脚本中使用 `locale.value`，模板会自动解包。`tr` 和 `loadLocale` 始终读取当前容器状态；异步语言切换完成后模板自动刷新。

`useI18n()` 必须在 Provider 后代组件内调用，否则抛出明确错误。

## 选择器与生命周期

```ts
import { useI18nStore } from "@bubblesjs/i18n-vue";
import { store } from "./i18n";

const state = useI18nStore(store);
const locale = useI18nStore(store, (snapshot) => snapshot.locale);
```

完整状态返回 `ShallowRef<I18nState>`；选择器返回 `ComputedRef<T>`，只关注语言时可避免不相关词条变更触发组件重渲染。直接订阅不需要 Provider。

请在组件 `setup`、`<script setup>` 或活动的 `effectScope` 内调用。组件卸载、作用域销毁时自动取消订阅。通过容器的方法更新状态，不要直接修改浅引用内部词条。

## 保持 Provider 容器稳定

Provider 在初始化时提供 store，不跟随属性替换重新注入。保持 `store` 引用稳定；需要更换容器时，给 Provider 更换 key，让整个子树重新挂载：

```vue
<template>
  <I18nProvider :key="providerKey" :store="currentStore">
    <Greeting />
  </I18nProvider>
</template>
```

`currentStore` 和 `providerKey` 由应用维护，在替换 store 时一起更新。服务端渲染也应每请求创建容器，避免用户间共享语言状态。

## API

| 导出                                 | 用途                                       |
| ------------------------------------ | ------------------------------------------ |
| `I18nProvider`（默认导出）           | 接收 `store`，注入容器并渲染默认插槽       |
| `useI18n()`                          | 返回 `tr`、`loadLocale`、计算引用 `locale` |
| `useI18nStore(store)`                | 完整状态浅引用                             |
| `useI18nStore(store, selector)`      | 选取结果的计算引用                         |
| `I18nKey`                            | `InjectionKey<I18nStore>`                  |
| `I18nProviderProps`、`UseI18nReturn` | 属性与返回值类型                           |

包提供 ESM、CommonJS 和 TypeScript 声明，Vue 是 peer dependency，不在产物中内联。
