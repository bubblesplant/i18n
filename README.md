# BubblesJS i18n

一套用于 React、Vue 和普通 JavaScript 项目的国际化工具：core 负责加载词条与翻译，框架适配器让组件随语言变化更新，CLI 从项目源码收集 key、维护 JSON 语言包，并与 Excel 翻译表双向同步。

[GitHub 仓库](https://github.com/bubblesplant/i18n) · [版本发布 / GitHub Releases](https://github.com/bubblesplant/i18n/releases) · [实现思路](apps/docs/guide/architecture.md) · [快速开始](apps/docs/guide/getting-started.md)

四个公开包当前均为 `0.0.2`，已发布到 npm。后续版本和变更记录请查看 GitHub Releases。

## 实现思路

```text
开发时：项目源码中的 tr("key")
             │ CLI 扫描、去重、保留译文并补齐缺失 key
             ▼
        各语言 JSON ⇄ Excel 翻译表

首屏：默认 JSON → message → core store → React / Vue 订阅 → 组件译文
切换：目标语言 → loaderMessage → 目标 JSON → 更新 core store
```

JSON 是开发维护与运行时加载之间的共同格式。词条是扁平的 `Record<string, string>`；`tr` 查找 key 并替换 `{name}` 等占位符，缺失词条时返回 key。切换语言时先异步加载，再一次更新语言和词条，组件通过订阅自动更新。

| 包                      | 用途                                               |
| ----------------------- | -------------------------------------------------- |
| `@bubblesjs/i18n-core`  | 框架无关的翻译、语言状态、异步加载与语言偏好持久化 |
| `@bubblesjs/i18n-react` | React Provider 与 Hooks                            |
| `@bubblesjs/i18n-vue`   | Vue 3 Provider 与响应式 Composables                |
| `@bubblesjs/i18n-cli`   | 扫描静态 key，同步与检查 JSON，JSON ⇄ Excel 转换   |

CLI 独立于运行时，按需安装。本仓库已实现 `excel export` 和 `excel import`，分别把 JSON 导出为翻译表、把 Excel 译文写回 JSON；使用 npm 包时请通过 [GitHub Releases](https://github.com/bubblesplant/i18n/releases) 确认所用版本的功能。完整架构与源码入口见[实现思路](apps/docs/guide/architecture.md)。

## Vue / React 接入

已有 Vue 或 React 应用，选择对应适配器：

```bash
# Vue 3
pnpm add @bubblesjs/i18n-core @bubblesjs/i18n-vue

# React
pnpm add @bubblesjs/i18n-core @bubblesjs/i18n-react
```

两种框架共用同样的词条和 core 容器。例如先准备 `src/locales/zh-CN.json` 与 `src/locales/en-US.json`：

```json
{
  "welcome": "你好，{name}！",
  "menu.home": "首页"
}
```

英文文件使用相同 key，值分别为 `Hello, {name}!`、`Home`。然后在 `src/i18n.ts` 导入默认中文词条，同步创建容器，并提供切换语言时使用的加载器：

```ts
import { createI18n } from "@bubblesjs/i18n-core";
import zhCN from "./locales/zh-CN.json";

export const store = createI18n({
  locale: "zh-CN",
  message: zhCN,
  loaderMessage: async (locale = "zh-CN") => (await import(`./locales/${locale}.json`)).default,
});
```

首屏只静态导入默认中文包；`createI18n` 使用 `message: zhCN` 同步返回 `store`，不调用加载器。入口直接导入 `store` 并挂载 Provider。切换到英文时，`loadLocale("en-US")` 才通过 `loaderMessage` 动态加载英文 JSON。加载器由应用提供，也可以使用应用自己的资源请求方法。

| 框架  | 在入口接入                                    | 在业务组件使用                                        | 完整示例                                     |
| ----- | --------------------------------------------- | ----------------------------------------------------- | -------------------------------------------- |
| Vue   | 用 `<I18nProvider :store="store">` 包裹子组件 | `useI18n()` 返回 `tr`、`loadLocale` 和响应式 `locale` | [Vue 接入与使用](apps/docs/guide/vue.md)     |
| React | 用 `<I18nProvider store={store}>` 包裹应用    | `useI18n()` 返回 `tr`、`loadLocale` 和当前 `locale`   | [React 接入与使用](apps/docs/guide/react.md) |

Vue 需要 `^3.5.43`，React 需要 `>=18.0.0`。没有框架时，直接调用 `store.getState().tr("welcome", { name: "Bubbles" })`，用 `await store.getState().loadLocale("en-US")` 切换语言。

如果首屏词条也需要异步获取，或需要先恢复语言偏好，可选用 `await initI18n({ locale, loaderMessage, ... })`，等待加载完成后再挂载应用。`createI18n` 直接使用传入的 `message`；`initI18n` 先调用加载器取得初始词条，再返回容器。完整 API 与持久化见[核心容器](apps/docs/guide/core.md)。

## CLI：扫描项目 → JSON ⇄ Excel

安装开发工具，CLI 要求 Node.js `>=22.18.0`：

```bash
pnpm add -D @bubblesjs/i18n-cli
```

在项目根目录创建 `i18n.config.ts`：

```ts
import { defineConfig } from "@bubblesjs/i18n-cli";

export default defineConfig({
  callNames: ["tr"],
  projects: {
    web: {
      include: ["src/**/*.{js,jsx,ts,tsx,vue}"],
      catalogs: {
        "zh-CN": "src/locales/zh-CN.json",
        "en-US": "src/locales/en-US.json",
      },
      excel: { file: "translations/web.xlsx" },
    },
  },
});
```

```bash
# 扫描源码并预览 JSON 的变化
pnpm exec bubbles-i18n sync --dry-run

# 扫描源码，保留已有译文，补齐各语言缺失的 key
pnpm exec bubbles-i18n sync

# 检查 JSON 是否缺少源码使用的 key，供本地或 CI 使用
pnpm exec bubbles-i18n check

# 导出 JSON 词条；默认工作表为 translations
pnpm exec bubbles-i18n excel export

# 译者填写 Excel 后，把译文写回 JSON
pnpm exec bubbles-i18n excel import
```

扫描包含在 `sync` / `check` 中，没有独立 `scan` 命令。新增 key 的初始值为 key 本身，需要填写译文；`check` 不判断翻译是否完成。默认保留未使用词条，显式传入 `--prune` 才清理，扫描命令继续兼容 `--clean`。

JSON ⇄ Excel 使用「key × 语言」表，交给译者填写后导入回 JSON。两个方向默认保留目标端多出的 key，使用 `--prune` 才删除；已有值冲突使用 `-f` 才覆盖。只做 JSON / Excel 转换的项目可以省略 `include`，扫描时必须配置它。配置、扫描范围、报告、冲突规则与 CI 用法见[CLI 使用指南](apps/docs/guide/cli.md)。

## 本地开发

```bash
pnpm install --frozen-lockfile
pnpm docs:dev
```

文档默认运行在 `http://localhost:5174`。首次运行 Playground，先构建本地依赖，再启动开发服务：

```bash
pnpm --filter "playground^..." build
pnpm dev
```

Playground 默认端口为 5173，展示 React / Vue 的全局与局部国际化示例；运行方式和源码说明见 [Playground README](apps/playground/README.md)。

| 命令                                           | 用途                                           |
| ---------------------------------------------- | ---------------------------------------------- |
| `pnpm test` / `pnpm typecheck`                 | 单元测试与类型检查                             |
| `pnpm lint` / `pnpm format:check`              | 代码与格式检查                                 |
| `pnpm docs:build`                              | 构建静态文档                                   |
| `pnpm build`                                   | 构建所有包、应用与文档                         |
| `pnpm verify:packages` / `pnpm verify:release` | 验证本地产物和隔离安装的发布 tarball，需先构建 |
| `pnpm ready`                                   | 完整质量检查、构建及产物验证，不执行发布       |

四个公开包支持 ESM、CommonJS 和 TypeScript 声明，发布内容为 `dist`、README 和 LICENSE。根项目、docs 与 playground 为私有工作区。MIT 许可证。
