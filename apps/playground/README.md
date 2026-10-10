# 国际化 Playground

这个应用运行 Vue 和 React 两套可切换示例，用真实的工作区包展示默认词条、按需切换、Provider、翻译 Hook，以及同一页面中的全局和局部国际化作用域。

接入顺序为：导入默认中文，显式传入 `locale`、`message` 和 `loaderMessage`，同步创建容器并挂载 Provider，业务组件通过 Hook 读取最近的容器。切换时由应用提供的加载器获取目标语言。这里直接使用本仓库的 `@bubblesjs/i18n-core`、`@bubblesjs/i18n-vue` 和 `@bubblesjs/i18n-react`，运行时无需外部 portal 项目。

## 运行与构建

在仓库根目录执行：

```sh
pnpm install

# 首次运行先构建 Playground 依赖的 core / React / Vue 工作区包
pnpm --filter "playground^..." build

pnpm dev
```

这些本地包的导出指向 `dist`，安装依赖不会生成构建产物；`playground^...` 选择 Playground 的工作区依赖并按依赖顺序构建。修改包源码后也应重新构建对应包，再运行示例。

打开 [http://localhost:5173](http://localhost:5173)，在页面中切换 Vue / React 示例。

```sh
# 检查 Playground 类型
pnpm --filter playground typecheck

# 构建 Playground 及它依赖的工作区包
pnpm --filter "playground..." build
```

页面由 Vue 宿主管理，React 示例通过 DOM 包装组件挂载自己的 React 根。这个包装组件用于在同一演示页展示两个框架；接入普通 Vue 或 React 应用时，直接使用对应框架的入口和 Provider。

## 默认语言与按需加载

`src/i18n/index.ts` 只静态导入全局中文和项目中文，通过 `createI18n` 同步创建 `globalStore` 和 `projectStore`。`src/main.ts` 直接导入两个容器并挂载应用，无需 `await`。两个容器显式传入 `locale: "zh-CN"`、各自的默认 `message` 和 `loaderMessage`：

| 容器           | 默认加载的词条                   | 切换英文时加载的词条             |
| -------------- | -------------------------------- | -------------------------------- |
| `globalStore`  | `src/locales/global/zh-CN.json`  | `src/locales/global/en-US.json`  |
| `projectStore` | `src/locales/project/zh-CN.json` | `src/locales/project/en-US.json` |

`loaderMessage` 根据作用域和 `locale` 动态 `import()` 对应 JSON。`createI18n` 首屏直接使用传入的默认中文词条，不调用加载器；英文包在对应容器首次执行 `loadLocale("en-US")` 时才动态加载。加载过程没有人为增加的延迟。

```text
启动 → 静态导入全局中文 + 项目中文 → 同步创建容器 → 挂载应用
全局切换英文 → 全局 loaderMessage → 全局英文 JSON → 更新全局组件
项目切换英文 → 项目 loaderMessage → 项目英文 JSON → 更新项目组件
```

这个示例没有配置语言持久化，刷新页面后两个容器都从默认中文开始。容器在入口一次创建，再传给示例组件；保持容器引用稳定。

## 全局与局部作用域

外层 Provider 接收 `globalStore`，内层项目 Provider 接收 `projectStore`。项目区域的后代组件读取最近的项目 Provider，因此可以使用独立的语言和词条：

```text
全局 Provider（globalStore）
  ├─ 全局文案、全局语言切换
  └─ 项目 Provider（projectStore）
       └─ 项目文案、项目语言切换
```

可以在页面中验证以下行为：

1. 初次打开时，全局和项目区域都显示中文。
2. 切换项目区域为英文，全局区域保持中文。
3. 切换全局区域为英文，项目区域维持自己的语言。
4. 切换其中一个区域回中文，另一个区域不受影响。

两个 Provider 的词条也彼此独立；项目区域使用项目 JSON，全局区域使用全局 JSON。

Vue / React 示例复用入口创建的同一组容器，切换框架会保留两个区域各自的语言状态。页面底部的「语言包加载记录」可以观察加载时机：刷新后两份中文包已静态导入，两份英文包尚未加载，所有加载器调用次数均为 0；切换对应区域到英文后，只有该区域的英文记录更新。记录展示的是 `loaderMessage` 调用次数，重复切换仍会调用加载器，动态 `import()` 可以复用浏览器的模块缓存。

源码入口：

| 文件                               | 用途                                      |
| ---------------------------------- | ----------------------------------------- |
| `src/main.ts`                      | 导入两个容器并直接挂载应用                |
| `src/i18n/index.ts`                | 创建全局 / 项目容器，提供动态语言加载器   |
| `src/examples/types.ts`            | 通过 `ExampleProps` 传递已初始化的容器    |
| `src/examples/ReactExample.tsx`    | React 的全局 Provider 和内层项目 Provider |
| `src/examples/ReactExample.vue`    | 在 Vue 宿主中挂载 / 卸载 React 根         |
| `src/examples/VueExample.vue`      | Vue 的全局 Provider 和内层项目 Provider   |
| `src/examples/VueGlobalPanel.vue`  | 订阅全局语言和词条                        |
| `src/examples/VueProjectPanel.vue` | 订阅项目语言和词条                        |

## 在自己的页面增加局部 Provider

把初始化完成的项目容器传给局部区域。下面的 `projectStore` 来自入口初始化，词条 key 根据项目 JSON 调整。

### React

```tsx
import type { I18nStore } from "@bubblesjs/i18n-core";
import { I18nProvider, useI18n } from "@bubblesjs/i18n-react";

export function ProjectRegion({ projectStore }: { projectStore: I18nStore }) {
  return (
    <I18nProvider store={projectStore}>
      <ProjectContent />
    </I18nProvider>
  );
}

function ProjectContent() {
  const { tr, locale, loadLocale } = useI18n();

  return (
    <section>
      <h2>{tr("项目工作区")}</h2>
      <button onClick={() => void loadLocale(locale === "zh-CN" ? "en-US" : "zh-CN")}>
        {locale === "zh-CN" ? "English" : "中文"}
      </button>
    </section>
  );
}
```

`ProjectRegion` 可以放在应用全局 Provider 的任意位置；`ProjectContent` 会使用内层的项目容器。

### Vue

`ProjectRegion.vue` 提供容器：

```vue
<script setup lang="ts">
import type { I18nStore } from "@bubblesjs/i18n-core";
import { I18nProvider } from "@bubblesjs/i18n-vue";
import ProjectContent from "./ProjectContent.vue";

defineProps<{ projectStore: I18nStore }>();
</script>

<template>
  <I18nProvider :store="projectStore">
    <ProjectContent />
  </I18nProvider>
</template>
```

`ProjectContent.vue` 在 Provider 的后代中读取语言和词条：

```vue
<script setup lang="ts">
import { useI18n } from "@bubblesjs/i18n-vue";

const { tr, locale, loadLocale } = useI18n();
</script>

<template>
  <section>
    <h2>{{ tr("项目工作区") }}</h2>
    <button @click="loadLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')">
      {{ locale === "zh-CN" ? "English" : "中文" }}
    </button>
  </section>
</template>
```

两个框架都要求在 Provider 的后代组件中调用 `useI18n()`。组件自身渲染了一个局部 Provider 时，组件自身的 Hook 仍只能读取外层 Provider；把需要使用局部词条的逻辑放进它的后代组件。
