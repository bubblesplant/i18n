# Vue 接入与使用

Vue 接入分为三步：显式导入默认中文词条并通过 `createI18n` 同步创建容器，用 `I18nProvider` 提供给后代组件，在业务组件中通过 `useI18n()` 翻译和切换语言。首屏使用默认中文，切换时再由 `loaderMessage` 动态加载目标语言；容器负责词条和语言状态，Vue 适配层将这些状态转为响应式引用。

下面以已有的 Vue + TypeScript 项目为例，完成中文首屏、英文切换和占位符插值。当前 Vue peer 版本要求为 `^3.5.43`。

如果项目工作区需要独立切换语言，见下文[局部使用：独立项目语言](#局部使用-独立项目语言)；容器和语言包的共用准备见[全局与局部使用](./scopes)。

## 1. 安装

```sh
pnpm add @bubblesjs/i18n-core @bubblesjs/i18n-vue
```

应用需提供兼容版本的 `vue`。适配包依赖 core，但示例会直接从 core 导入初始化方法，因此显式声明两个包。

## 2. 准备 JSON 语言包

创建 `src/locales/zh-CN.json`：

```json
{
  "你好，{name}！": "你好，{name}！",
  "切换语言": "切换语言"
}
```

创建 `src/locales/en-US.json`，保留相同的 key，只翻译 value：

```json
{
  "你好，{name}！": "Hello, {name}!",
  "切换语言": "Switch language"
}
```

词条必须是扁平的 `Record<string, string>`。这里使用中文原文作为 key；也可以使用 `greeting`、`menu.home` 等 key，但源码调用和所有语言包的 key 必须一致。`{name}` 是运行时占位符，翻译时也要保留。

这些 JSON 可以手工维护，也可以通过 [CLI 扫描项目并同步](./cli)得到。

## 3. 显式导入默认语言并创建容器

在 `src/i18n.ts` 中静态导入默认中文 JSON，显式配置 `locale`、`message` 和切换时使用的 `loaderMessage`，导出创建好的容器：

```ts
import { createI18n } from "@bubblesjs/i18n-core";
import zhCN from "./locales/zh-CN.json";

export const store = createI18n({
  locale: "zh-CN",
  message: zhCN,
  loaderMessage: async (locale = "zh-CN") => (await import(`./locales/${locale}.json`)).default,
});
```

`createI18n` 同步创建容器，首屏直接使用静态导入的 `zhCN`，创建时不会调用 `loaderMessage`。这里只静态导入默认中文，英文 JSON 尚未加载；入口无需等待异步初始化。

调用 `loadLocale("en-US")` 时，同一个 `loaderMessage` 才动态导入 `./locales/en-US.json`。语言名应与 JSON 文件名一致；Vite 等支持这种动态导入的构建器负责将 JSON 拆成按需加载的资源。加载器也可以改为请求接口或静态资源 URL，加载方式由应用决定。如果 TypeScript 无法识别 JSON 导入，请在应用的 `tsconfig` 中开启 `resolveJsonModule`。

## 4. 接入 Provider 并启动应用

根组件 `src/App.vue` 接收容器，并将它提供给业务组件：

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

在 `src/main.ts` 中直接导入 `store`，传给根组件后挂载：

```ts
import { createApp } from "vue";
import App from "./App.vue";
import { store } from "./i18n";

createApp(App, { store }).mount("#app");
```

示例沿用 Vue 项目常见的 `#app` 挂载节点。容器在应用启动时创建一次，并保持引用稳定。Provider 原样渲染默认插槽，借助 `provide` / `inject` 为后代组件注入容器。嵌套 Provider 使用最近的容器，可以隔离子树的语言。

## 5. 在组件中翻译和切换语言

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

首次显示 `你好，Bubbles！`。点击时 `loadLocale("en-US")` 将目标语言交给同一个 `loaderMessage`，执行英文 JSON 的动态导入，再显示 `Hello, Bubbles!`；所有订阅此容器的组件一起刷新。

| 返回值               | 使用方式                                                                  |
| -------------------- | ------------------------------------------------------------------------- |
| `tr(key, values?)`   | 查找当前词条并替换 `{name}` 等占位符，缺失 key 时返回 key 本身            |
| `locale`             | `ComputedRef<string \| undefined>`；脚本中读 `locale.value`，模板自动解包 |
| `loadLocale(locale)` | 异步加载并切换语言，返回 `Promise<void>`，可使用 `await` 等待完成         |

加载期间维持当前语言和词条；加载完成后一起提交新状态。并发切换以最后一次调用为准。加载器返回 `undefined` 或抛出异常时，核心会切换到目标语言和空词条，异常通过 `console.warn` 记录。按需实现加载提示和加载器的缓存、重试策略，详见[核心容器](./core)。

`useI18n()` 要在 Provider 后代组件的 `setup` 或 `<script setup>` 内调用；在渲染 Provider 的同一个组件中调用，无法读取自己刚提供的容器。缺少 Provider 时抛出 `useI18n must be used within I18nProvider`。

若需要在挂载前恢复用户上次选择的语言，可改用 `initI18n` 并配置 `storage` 和 `storageKey`，等待它加载保存的语言后再挂载，见[语言偏好持久化](./core#持久化语言偏好)。

## 局部使用：独立项目语言

给项目创建独立容器，再在项目子树内嵌套 Provider。先按[全局与局部使用](./scopes)准备 `src/i18n.ts` 导出的 `globalStore` / `projectStore`：两个容器分别静态导入 `src/locales/zh-CN.json` 和 `src/locales/project/zh-CN.json`，切换时才动态导入各自的英文 JSON。下面的文件沿用该页面的容器和 JSON。

`src/main.ts` 直接导入两个容器并挂载：

```ts
import { createApp } from "vue";
import App from "./App.vue";
import { globalStore, projectStore } from "./i18n";

createApp(App, { globalStore, projectStore }).mount("#app");
```

`src/App.vue` 将全局容器提供给整个应用，将项目容器提供给项目子树：

```vue
<script setup lang="ts">
import type { I18nStore } from "@bubblesjs/i18n-core";
import { I18nProvider } from "@bubblesjs/i18n-vue";
import GlobalContent from "./GlobalContent.vue";
import ProjectContent from "./ProjectContent.vue";

defineProps<{ globalStore: I18nStore; projectStore: I18nStore }>();
</script>

<template>
  <I18nProvider :store="globalStore">
    <GlobalContent />
    <I18nProvider :store="projectStore">
      <ProjectContent />
    </I18nProvider>
  </I18nProvider>
</template>
```

`src/GlobalContent.vue` 读取外层容器：

```vue
<script setup lang="ts">
import { useI18n } from "@bubblesjs/i18n-vue";

const { tr, locale, loadLocale } = useI18n();

async function switchLocale() {
  await loadLocale(locale.value === "zh-CN" ? "en-US" : "zh-CN");
}
</script>

<template>
  <section>
    <p>{{ tr("你好，{name}！", { name: "Bubbles" }) }}</p>
    <p>{{ locale }}</p>
    <button type="button" @click="switchLocale">{{ tr("切换语言") }}</button>
  </section>
</template>
```

`src/ProjectContent.vue` 读取最近的项目容器：

```vue
<script setup lang="ts">
import { useI18n } from "@bubblesjs/i18n-vue";

const { tr, locale, loadLocale } = useI18n();

async function switchLocale() {
  await loadLocale(locale.value === "zh-CN" ? "en-US" : "zh-CN");
}
</script>

<template>
  <section>
    <h2>{{ tr("项目工作区") }}</h2>
    <p>{{ tr("你好，{name}！", { name: "Alex" }) }}</p>
    <p>{{ locale }}</p>
    <button type="button" @click="switchLocale">{{ tr("切换语言") }}</button>
  </section>
</template>
```

点击项目按钮只切换项目语言，全局内容保持原语言。词条不会自动继承或合并；项目缺失的 key 会返回 key 本身，即使全局容器中有该词条。

`useI18n()` 必须在 Provider 的后代组件中调用。`App.vue` 的 `setup` 无法读取它自己在模板中渲染的 Provider，因此这里将翻译放在两个后代组件中。两个容器在 `src/i18n.ts` 中各创建一次并保持引用稳定；首屏使用各自静态导入的中文词条，切换时才调用对应容器的加载器，组件卸载时自动退订。

可按[运行 Playground](./scopes#运行-playground)实际验证独立切换，也可以查看 [Vue 示例源码](https://github.com/bubblesplant/i18n/blob/main/apps/playground/src/examples/VueExample.vue)。

## 在组件外使用

表单校验、请求提示等普通 TypeScript 代码可以通过参数接收启动时创建的容器：

```ts
import type { I18nStore } from "@bubblesjs/i18n-core";

export function formatGreeting(store: I18nStore, name: string) {
  return store.getState().tr("你好，{name}！", { name });
}

export async function switchToEnglish(store: I18nStore) {
  await store.getState().loadLocale("en-US");
}
```

在入口中，可以将从 `./i18n` 导入的 `store` 传给这些业务函数，例如 `formatGreeting(store, "Bubbles")`。普通函数调用不会建立 Vue 响应式订阅；界面中需要自动更新的文字，应在模板或计算属性中调用 `useI18n()` 返回的 `tr`。不要在 setup 中把 `tr(...)` 的结果存成普通字符串后期待它自动变化。

## 直接订阅与生命周期

通过组件属性传入已创建的容器，也可以直接订阅完整状态或某个字段，例如 `src/LocaleLabel.vue`：

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

在持有容器的组件中渲染 `<LocaleLabel :store="store" />`。直接订阅不需要 Provider。完整状态返回 `ShallowRef<I18nState>`，在脚本中通过 `state.value` 读取；选择器返回 `ComputedRef<T>`。只订阅语言选择器时，语言未变的词条更新不会导致该组件重渲染。

适配层把核心快照存入 `shallowRef`，订阅后替换快照，并使用 `onScopeDispose` 自动退订。请在组件 `setup`、`<script setup>` 或活动的 `effectScope` 中调用。通过容器的方法更新状态，避免直接修改浅引用内部词条。

## Provider 容器与服务端渲染

Provider 在初始化时提供 store，不跟随属性替换重新注入。保持 `store` 引用稳定；需要更换容器时，同时更换 Provider 的 `key`，让整个子树重新挂载：

```vue
<template>
  <I18nProvider :key="providerKey" :store="currentStore">
    <Greeting />
  </I18nProvider>
</template>
```

`currentStore` 和 `providerKey` 由应用维护，在替换 store 时一起更新。服务端渲染应每请求创建容器，预加载该请求的语言；客户端水合前使用相同语言和词条，避免用户间共享语言状态或首屏不一致。

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
