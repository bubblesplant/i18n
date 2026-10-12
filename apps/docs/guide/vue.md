# Vue 接入与使用

Vue 适配层用 Provider 注入核心容器，并将状态转为响应式引用。以下示例基于已有的 Vue + TypeScript 项目；Vue peer 版本要求为 `^3.5.43`。

## 1. 安装

```sh
pnpm add @bubblesjs/i18n-core @bubblesjs/i18n-vue
```

应用需提供兼容版本的 `vue`。

## 2. 准备容器 {#_2-准备容器}

先按快速开始[准备语言 JSON](./getting-started#准备语言-json)，再[创建容器与切换语言](./getting-started#创建容器与切换语言)，得到 `src/i18n.ts` 导出的 `store`。下面沿用其中的中文 key：`你好，{name}！`、`切换语言`。

## 3. 接入 Provider 并启动应用 {#_4-接入-provider-并启动应用}

根组件 `src/App.vue` 接收容器，并提供给后代组件：

```vue
<script setup lang="ts">
import type { I18nStore } from "@bubblesjs/i18n-core";
import { I18nProvider } from "@bubblesjs/i18n-vue";
import Greeting from "./Greeting.vue";

defineProps<{ store: I18nStore }>();
</script>

<template>
  <I18nProvider :store="store">
    <Greeting />
  </I18nProvider>
</template>
```

入口 `src/main.ts`：

```ts
import { createApp } from "vue";
import App from "./App.vue";
import { store } from "./i18n";

createApp(App, { store }).mount("#app");
```

容器创建一次并保持引用稳定。Provider 原样渲染默认插槽，通过 `provide` / `inject` 注入容器。

## 4. 在组件中翻译和切换语言 {#_5-在组件中翻译和切换语言}

`src/Greeting.vue`：

```vue
<script setup lang="ts">
import { useI18n } from "@bubblesjs/i18n-vue";

const { tr, locale, loadLocale } = useI18n();

async function switchLocale() {
  await loadLocale(locale.value === "zh-CN" ? "en-US" : "zh-CN");
}
</script>

<template>
  <main>
    <p>{{ tr("你好，{name}！", { name: "Bubbles" }) }}</p>
    <p>{{ locale }}</p>
    <button @click="switchLocale">{{ tr("切换语言") }}</button>
  </main>
</template>
```

点击按钮后，问候语由 `你好，Bubbles！` 切换为 `Hello, Bubbles!`。`locale` 是 `ComputedRef<string | undefined>`：脚本中读取 `.value`，模板中自动解包。需要随语言更新的文字，应在模板或计算属性中调用 `tr`；在 setup 中保存的普通字符串不会自动变化。

`useI18n()` 必须在 Provider 后代组件的 `setup` 或 `<script setup>` 中调用；渲染 Provider 的组件无法读取自己提供的容器。缺少 Provider 时抛出 `useI18n must be used within I18nProvider`。

语言加载、失败处理与持久化见[核心容器](./core)。

## 局部使用：独立项目语言

按[全局与局部使用](./scopes)准备 `globalStore` 和 `projectStore`，在持有这两个容器、已导入 `I18nProvider` 的组件中嵌套 Provider：

```vue
<template>
  <I18nProvider :store="globalStore">
    <GlobalContent />
    <I18nProvider :store="projectStore">
      <ProjectContent />
    </I18nProvider>
  </I18nProvider>
</template>
```

两个后代组件使用相同的 `useI18n()` 写法，各自读取最近的容器。可[运行 Playground](./scopes#运行-playground)验证独立切换，或查看 [Vue 示例源码](https://github.com/bubblesplant/i18n/blob/main/apps/playground/src/examples/VueExample.vue)。

## 在组件外使用

普通 TypeScript 函数可通过容器调用翻译和切换方法，见[在组件外使用](./core#在组件外使用)。这些调用不建立 Vue 响应式订阅。

## 直接订阅与生命周期

`useI18nStore` 可以直接订阅传入的容器，无需 Provider：

```vue
<script setup lang="ts">
import type { I18nStore } from "@bubblesjs/i18n-core";
import { useI18nStore } from "@bubblesjs/i18n-vue";

const props = defineProps<{ store: I18nStore }>();
const state = useI18nStore(props.store);
const locale = useI18nStore(props.store, (snapshot) => snapshot.locale);
</script>

<template>
  <p>{{ state.locale }} / {{ locale }}</p>
</template>
```

完整状态返回 `ShallowRef<I18nState>`，脚本中通过 `state.value` 读取；选择器返回 `ComputedRef<T>`。只订阅语言时，语言未变的词条更新不会使该组件重渲染。

适配层通过替换浅引用快照更新状态，并用 `onScopeDispose` 自动退订。请在组件 `setup`、`<script setup>` 或活动的 `effectScope` 中调用，通过容器方法更新状态，避免直接修改浅引用内部词条。

## Provider 容器与服务端渲染

Provider 初始化后不会随 `store` 属性替换重新注入。更换容器时，同时更新 Provider 的 `key`，让子树重新挂载：

```vue
<template>
  <I18nProvider :key="providerKey" :store="currentStore">
    <Greeting />
  </I18nProvider>
</template>
```

服务端的请求隔离、预加载和客户端水合要求见[服务端渲染](./core#服务端渲染)。

## 导出 API

| 导出                                 | 用途                                       |
| ------------------------------------ | ------------------------------------------ |
| `I18nProvider`（也是默认导出）       | 接收 `store`，注入容器并渲染默认插槽       |
| `useI18n()`                          | 返回 `tr`、`loadLocale`、计算引用 `locale` |
| `useI18nStore(store)`                | 完整状态浅引用                             |
| `useI18nStore(store, selector)`      | 选取结果的计算引用                         |
| `I18nKey`                            | `InjectionKey<I18nStore>`                  |
| `I18nProviderProps`、`UseI18nReturn` | 属性与返回值类型                           |

包提供 ESM、CommonJS 和 TypeScript 声明。Vue 是 peer dependency，打包时不会内联框架。
