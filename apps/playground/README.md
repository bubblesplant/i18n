# 国际化 Playground

基于用户指定的两个本地 create-bubbles 模板，分别运行 Vue 和 React 应用，展示全局、局部 Provider 和语言包按需加载；另提供独立的 Hono + Vite+ 后端示例，展示请求语言与容器隔离。

| 应用     | 模板来源                                                              | 保留的技术栈                                                   | 开发地址              |
| -------- | --------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------- |
| `vue/`   | `C:/malei/stu/bubbles/packages/create-bubbles/template-vue-vp-eslint` | Vue 3、Vite+、Vue Router、Antdv Next、UnoCSS、ESLint、自动导入 | http://localhost:5173 |
| `react/` | `C:/malei/stu/bubbles/packages/create-bubbles/template-vp-react`      | React、Vite+、React Router、Ant Design、Tailwind、自动导入     | http://localhost:5175 |
| `hono/`  | 独立后端示例                                                          | Hono、Vite+、Node.js、请求中间件                               | http://localhost:5176 |

Vue / React 的入口、路由和工具配置从这些本地模板复制后适配到本仓库的 pnpm 工作区。依赖统一使用根目录 catalog；Vue 编译和类型检查均使用普通 VDOM 模式。`apps/playground` 下只有 `vue/`、`react/`、`hono/` 三个项目目录，每个项目都有自己的 `package.json`、开发入口、构建配置、示例资源和 `i18n.config.ts`。两个前端应用独立挂载，各自维护全局和项目容器；Hono 按请求创建容器。

## 运行与验证

在仓库根目录执行：

```sh
pnpm install --frozen-lockfile

# 首次运行先构建本地运行时和 CLI，包的导出指向 dist
pnpm --filter "./packages/*" build

# 分别启动需要的应用，每条命令只启动一个服务
pnpm dev:vue   # Vue（5173），pnpm dev 默认也只启动 Vue
pnpm dev:react # React（5175）
pnpm dev:hono  # Hono（5176）

# 也可以使用工作区包名，或进入对应目录执行 pnpm dev
pnpm --filter playground-vue dev
pnpm --filter playground-react dev
pnpm --filter playground-hono dev

# 类型检查、Vue ESLint、构建
pnpm --filter "playground-*" typecheck
pnpm --filter playground-vue lint
pnpm --filter playground-hono test
pnpm --filter "playground-*" build

# 分别运行构建产物，pnpm preview 默认只预览 Vue
pnpm preview:vue
pnpm preview:react
pnpm preview:hono
```

5174 留给文档。需要同时打开多个示例时，在不同终端分别启动。修改 core、框架适配包或 CLI 后，重新构建对应包再运行示例或命令。

## i18n-cli 工作流

三个应用都通过 `workspace:*` 安装 `@bubblesjs/i18n-cli`，在各自目录中自动加载 `i18n.config.ts`。每份配置包含 `global` 和 `project` 两个词条项目，分别维护 `src/locales/global/` 和 `src/locales/project/` 下的中文、英文 JSON。

在仓库根目录执行以下命令，可只维护一个应用；把 `playground-vue` 换成 `playground-react` 或 `playground-hono` 即可：

```sh
# 检查词条，预览同步，再补齐缺失 key
pnpm --filter playground-vue i18n:check
pnpm --filter playground-vue i18n:sync --dry-run
pnpm --filter playground-vue i18n:sync

# 导出全局与项目 Excel；填写译文后预览并采用 Excel 的值
pnpm --filter playground-vue i18n:export
pnpm --filter playground-vue i18n:import --force --dry-run
pnpm --filter playground-vue i18n:import --force

# 只检查局部项目词条
pnpm --filter playground-vue i18n:check --project project

# 汇总检查三个应用
pnpm i18n:check
```

进入任一应用目录后，也可直接执行 `pnpm i18n:check`、`pnpm i18n:sync`、`pnpm i18n:export`、`pnpm i18n:import`。根目录的同名命令处理三个应用。

报告、翻译表和备份独立写入每个应用的 `.bubbles-i18n/`，已被 Git 忽略。Excel 默认是 `global.xlsx` 与 `project.xlsx`，工作表为 `sheet1`。`sync` 保留已有译文；Excel 导入遇到值冲突时需明确使用 `--force` 采用表格值。

扫描范围按词条作用域划分：Vue / React 的 `Project*` 组件只进入 `project`，其余源码进入 `global`；Hono 的 `src/routes/projects.ts` 进入 `project`，其余源码进入 `global`。Hono 跨作用域的成功消息放在 `src/i18n/global.ts`，确保 CLI 不把全局 key 写入项目语言包。新增局部业务文件时，同步调整对应配置中的 `projectFiles`。前端示例代码片段、生成类型和语言包不参与扫描。

## 创建全局和局部容器

两套应用都在自己的 `src/i18n/index.ts` 中创建容器，语言包位于各自的 `src/locales/global/` 和 `src/locales/project/`。

核心写法如下；运行示例额外通过 `observe()` 记录加载次数：

```ts
import { createI18n } from "@bubblesjs/i18n-core";
import globalZhCN from "../locales/global/zh-CN.json";
import projectZhCN from "../locales/project/zh-CN.json";

export const globalStore = createI18n({
  locale: "zh-CN",
  message: globalZhCN,
  loaderMessage: async (locale = "zh-CN") =>
    (await import(`../locales/global/${locale}.json`)).default,
});

export const projectStore = createI18n({
  locale: "zh-CN",
  message: projectZhCN,
  loaderMessage: async (locale = "zh-CN") =>
    (await import(`../locales/project/${locale}.json`)).default,
});
```

首屏静态导入中文，同步创建容器。切换英文时才调用对应的加载器。每个容器创建一次，保持引用稳定。

## Vue 全局写法

`vue/src/main.ts` 在入口提供全局容器，保留模板的路由初始化：

```ts
import { I18nProvider } from "@bubblesjs/i18n-vue";
import { createApp, h } from "vue";
import App from "./App.vue";
import { globalStore } from "./i18n";
import { setupRouter } from "./router";

const app = createApp({
  render: () =>
    h(
      I18nProvider,
      { store: globalStore },
      {
        default: () => h(App),
      },
    ),
});

setupRouter(app);
app.mount("#app");
```

后代组件通过 Hook 读取全局语言：

```vue
<script setup lang="ts">
import { useI18n } from "@bubblesjs/i18n-vue";

const { tr, locale, loadLocale } = useI18n();
</script>

<template>
  <h2>{{ tr("应用概览") }}</h2>
  <p>{{ locale }}</p>
  <button @click="loadLocale('en-US')">English</button>
</template>
```

Vue 的 `locale` 是响应式引用，脚本内读取 `locale.value`，模板内自动解包。

## Vue 局部写法

`vue/src/components/ProjectRegion.vue` 在项目区域嵌套独立 Provider：

```vue
<script setup lang="ts">
import { I18nProvider } from "@bubblesjs/i18n-vue";
import { projectStore } from "@/i18n";
import ProjectPanel from "./ProjectPanel.vue";
</script>

<template>
  <I18nProvider :store="projectStore">
    <ProjectPanel />
  </I18nProvider>
</template>
```

`ProjectPanel.vue` 使用同样的 `useI18n()`，读取最近的局部 Provider：

```vue
<script setup lang="ts">
import { useI18n } from "@bubblesjs/i18n-vue";

const { tr, locale, loadLocale } = useI18n();
</script>

<template>
  <h3>{{ tr("项目工作区") }}</h3>
  <p>{{ locale }}</p>
  <button @click="loadLocale('en-US')">English</button>
</template>
```

## React 全局写法

`react/src/main.tsx` 在应用入口包裹全局 Provider：

```tsx
import { I18nProvider } from "@bubblesjs/i18n-react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { globalStore } from "./i18n";

createRoot(document.getElementById("root")!).render(
  <I18nProvider store={globalStore}>
    <App />
  </I18nProvider>,
);
```

后代组件读取全局语言：

```tsx
import { useI18n } from "@bubblesjs/i18n-react";

export function GlobalPanel() {
  const { tr, locale, loadLocale } = useI18n();
  return (
    <section>
      <h2>{tr("应用概览")}</h2>
      <p>{locale}</p>
      <button onClick={() => void loadLocale("en-US")}>English</button>
    </section>
  );
}
```

## React 局部写法

`react/src/components/ProjectRegion.tsx` 在项目区域提供另一份容器：

```tsx
import { I18nProvider } from "@bubblesjs/i18n-react";
import { projectStore } from "@/i18n";
import ProjectPanel from "./ProjectPanel";

export default function ProjectRegion() {
  return (
    <I18nProvider store={projectStore}>
      <ProjectPanel />
    </I18nProvider>
  );
}
```

`ProjectPanel.tsx` 读取局部词条：

```tsx
import { useI18n } from "@bubblesjs/i18n-react";

export default function ProjectPanel() {
  const { tr, locale, loadLocale } = useI18n();
  return (
    <section>
      <h3>{tr("项目工作区")}</h3>
      <p>{locale}</p>
      <button onClick={() => void loadLocale("en-US")}>English</button>
    </section>
  );
}
```

两个框架都要求在 Provider 的后代组件里调用 `useI18n()`。在渲染局部 Provider 的组件自身调用 Hook，读取的是外层容器。局部词条独立查找，缺少 key 时返回原始 key；不会自动回退到全局词条。

## Hono 后端写法

Hono 使用 `@bubblesjs/i18n-core`，通过 `Accept-Language` 请求头匹配 `zh-CN` / `en-US`。Hono 的语言中间件处理权重、大小写与语言变体；未传语言或无支持的候选时默认中文。

`hono/src/middleware/i18n.ts` 为每个请求创建独立 `globalI18n` 并放入 Context；`hono/src/routes/projects.ts` 为项目路由创建局部 `projectI18n`，继承当前请求语言。词条在模块加载时导入并共享，只读使用；可变容器不跨请求共享。后端不需要 Provider，直接使用 `c.get("globalI18n").getState().tr()`。

服务运行后调用以下接口，Windows PowerShell 使用 `curl.exe`：

```sh
# 全局中文 / 英文
curl "http://localhost:5176/api/greeting?name=Bubbles"
curl -H "Accept-Language: en-US" "http://localhost:5176/api/greeting?name=Bubbles"

# 全局响应 + 局部项目词条
curl -H "Accept-Language: en-US" "http://localhost:5176/api/projects/demo?name=Bubbles"
```

`/api/greeting` 的英文 `message` 为 `Hello, Bubbles!`；项目接口的全局 `message` 为 `Request succeeded`，局部 `data.greeting` 为 `Welcome to the project, Bubbles!`。响应带有 `Content-Language` 和 `Vary: Accept-Language`，404 / 异常也返回对应语言的文案与稳定错误码。

CORS 允许 Vue / React 的本地开发地址。前端每次请求传入当前 `locale`；已有响应不会自动翻译，语言切换后需重新请求。

```sh
# 开发
pnpm --filter @bubblesjs/i18n-core build
pnpm --filter playground-hono dev

# 构建并启动 Node.js 服务（默认 127.0.0.1:5176）
pnpm --filter "playground-hono..." build
pnpm --filter playground-hono start

# 接口、语言匹配、并发隔离和 CORS 测试
pnpm --filter playground-hono test
```

开发使用 `vp dev`；构建使用 `vp pack` 生成 `dist/index.mjs`，通过 `@hono/node-server` 启动，可用 `HOST` / `PORT` 环境变量调整监听地址。完整教程见 [Node.js / Hono 后端](../docs/guide/node.md)。

## 验证作用域和加载行为

1. 刷新后全局和项目都显示中文，四条加载记录的调用次数均为 0。
2. 只切换项目为英文，项目英文包加载一次，全局文案保持中文。
3. 切换全局为英文，全局英文包才加载，项目保留自己的语言。
4. 创建任务再切换项目语言，任务数量保留，插值文案随语言更新。
5. 打开另一框架的应用，两个应用分别维护语言和加载记录。

刷新会恢复默认中文及零个任务。记录统计 `loaderMessage` 调用次数；重复切换仍会调用加载器，动态 `import()` 可复用浏览器模块缓存。加载失败时记录为“加载失败”，可切回中文，刷新页面后重试。

## 源码入口

| 位置                                                             | 用途                                 |
| ---------------------------------------------------------------- | ------------------------------------ |
| `vue/src/main.ts`、`react/src/main.tsx`                          | 全局 Provider                        |
| 两套 `src/i18n/index.ts`                                         | 两份独立容器、默认词条及异步加载器   |
| 三个应用的 `i18n.config.ts`                                      | CLI 扫描范围、JSON 与 Excel 词条配置 |
| 两套 `src/components/ProjectRegion.*`                            | 局部 Provider                        |
| 两套 `src/components/GlobalPanel.*`、`ProjectPanel.*`            | 翻译、独立切换、任务插值             |
| `vue/src/views/home/index.vue`、`react/src/pages/home/index.tsx` | 运行示例和全局 / 局部代码展示        |
| 两套 `src/shared/load-monitor.ts`                                | 各应用独立的加载记录                 |
| 两套 `src/shared/style.css`、`src/shared/snippets.ts`            | 各应用的演示样式与代码片段           |
| `hono/src/app.ts`、`hono/src/index.ts`                           | Hono 路由应用与 Node.js 服务入口     |
| `hono/src/middleware/i18n.ts`、`hono/src/i18n/index.ts`          | 请求语言识别、全局容器与词条工厂     |
| `hono/src/i18n/global.ts`                                        | 跨路由复用的全局翻译调用             |
| `hono/src/routes/projects.ts`                                    | 项目路由的局部容器                   |
| `hono/tests/app.test.ts`                                         | 接口、语言协商和并发隔离验证         |
