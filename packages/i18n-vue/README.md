# @bubblesjs/i18n-vue

Vue 3.5 的国际化适配层，将 `@bubblesjs/i18n-core` 的状态接入 Vue 响应式系统。提供 Provider、Composables 和作用域自动退订，支持 ESM、CommonJS 和 TypeScript 类型声明。

## 安装

```sh
pnpm add @bubblesjs/i18n-core @bubblesjs/i18n-vue vue
```

`i18n-core` 是普通依赖，安装适配包时会自动安装；直接调用 `createI18n` 等核心 API 时建议显式声明依赖。Vue 是 peer dependency，由应用提供，当前要求 `^3.5.43`。

## 快速开始

下面按文件接入已有的 Vue + TypeScript 项目。先准备 `src/locales/zh-CN.json`：

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

根组件 `src/App.vue` 接收初始化完成的容器，并提供给业务组件：

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

`src/main.ts` 直接导入 `store` 并挂载应用：

```ts
import { createApp } from "vue";
import App from "./App.vue";
import { store } from "./i18n";

createApp(App, { store }).mount("#app");
```

在 `src/Greeting.vue` 内翻译和切换语言：

```vue
<script setup lang="ts">
import { useI18n } from "@bubblesjs/i18n-vue";

const { tr, locale, loadLocale } = useI18n();
</script>

<template>
  <p>{{ tr("greeting", { name: "Bubbles" }) }}</p>
  <button @click="loadLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')">
    {{ tr("switchLanguage") }}
  </button>
</template>
```

这个例子的加载顺序是：

```text
首屏：import zhCN from "./locales/zh-CN.json"
      → createI18n 使用 locale: "zh-CN" 和 message: zhCN
      → 同步创建 store 并挂载 Provider

切换：loadLocale("en-US")
      → 调用同一个 loaderMessage("en-US")
      → 加载英文 JSON
      → 更新容器，订阅组件刷新
```

这里只静态导入默认中文 JSON，首屏无需异步初始化；调用 `loadLocale("en-US")` 时才通过 `loaderMessage` 动态导入英文 JSON。语言名应与 JSON 文件名一致；Vite 等支持这种动态导入的打包工具负责对其他语言分包。如果 TypeScript 无法识别 JSON 导入，请开启 `resolveJsonModule`。

`createI18n` 创建时直接使用 `message`，不会调用 `loaderMessage`；后续通过 `loadLocale` 加载目标语言，完成后词条自动刷新。模板会自动解包 `locale`，脚本中应使用 `locale.value`。多个语言加载并发时，以最后一次调用为准，缺失词条回退到原始键。

## API

| 导出                                 | 用途                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `I18nProvider`（默认导出）           | 接收 `store`，原样渲染默认插槽，并注入容器                                        |
| `useI18n()`                          | 返回 `{ tr, loadLocale, locale }`；`locale` 是 `ComputedRef<string \| undefined>` |
| `useI18nStore(store)`                | 返回完整状态的 `ShallowRef<I18nState>`                                            |
| `useI18nStore(store, selector)`      | 返回选择器结果的 `ComputedRef<T>`                                                 |
| `I18nKey`                            | 用于 `provide` / `inject` 的 `InjectionKey<I18nStore>`                            |
| `I18nProviderProps`、`UseI18nReturn` | Provider 属性和 Composable 返回值类型                                             |

`useI18n()` 必须在 Provider 的后代组件中调用，否则抛出明确错误。Provider 在初始化时提供容器，请保持 `store` 属性引用稳定；需要替换容器时给 Provider 更换 `key` 并重新挂载。嵌套 Provider 可隔离不同子树的语言。

直接订阅或只取某个状态时不需要 Provider。将入口导入的容器作为属性传入组件，在组件的 `<script setup>` 中订阅：

```vue
<script setup lang="ts">
import type { I18nStore } from "@bubblesjs/i18n-core";
import { useI18nStore } from "@bubblesjs/i18n-vue";

const props = defineProps<{ store: I18nStore }>();
const state = useI18nStore(props.store);
const locale = useI18nStore(props.store, (value) => value.locale);
console.log(state.value.message, locale.value);
</script>

<template>
  <span>{{ locale }}</span>
</template>
```

请在组件 `setup`、`<script setup>` 或活动的 `effectScope` 中调用。组件卸载或作用域销毁时自动取消订阅。完整状态是浅引用，应通过 `store.getState().loadLocale(...)` 或容器状态更新接口改变状态，避免直接改动引用内的词条。

## 本仓库验证

```sh
pnpm --filter @bubblesjs/i18n-vue typecheck
pnpm --filter @bubblesjs/i18n-vue test
pnpm --filter @bubblesjs/i18n-vue build
pnpm --filter @bubblesjs/i18n-vue verify:package
```

测试覆盖组件翻译、异步语言切换、嵌套 Provider、完整状态和选择器响应、组件卸载和 effectScope 清理、缺少 Provider 的错误。发布前应运行仓库的完整验证，以检查实际 npm tarball、依赖和类型消费。

## 许可证

MIT。
