# 快速开始

先准备语言包和容器，再按所用框架接入 Provider。需要自动维护词条时，安装 CLI。整体设计见[实现思路](./architecture)，版本更新见 [GitHub Releases](https://github.com/bubblesplant/i18n/releases)。

## 选择你的接入方式

| 场景             | 安装命令                                              | 完整教程                    |
| ---------------- | ----------------------------------------------------- | --------------------------- |
| Vue 3 应用       | `pnpm add @bubblesjs/i18n-core @bubblesjs/i18n-vue`   | [Vue 接入与使用](./vue)     |
| React 应用       | `pnpm add @bubblesjs/i18n-core @bubblesjs/i18n-react` | [React 接入与使用](./react) |
| Node.js 后端     | `pnpm add @bubblesjs/i18n-core`                       | [Node.js / Hono](./node)    |
| 普通 JavaScript  | `pnpm add @bubblesjs/i18n-core`                       | [核心容器](./core)          |
| 开发时维护语言包 | `pnpm add -D @bubblesjs/i18n-cli`                     | [命令行工具](./cli)         |

React 应用需提供 React `>=18.0.0` 和对应渲染器；Vue 应用需提供 Vue `^3.5.43`。CLI 要求 Node.js `>=22.18.0`。运行时与 CLI 可分别安装。

## AI Skill

使用 AI 编程助手接入 BubblesJS i18n、维护 JSON 与 Excel 翻译词条时，可以安装 `bubblesjs-i18n`，见 [Skill 安装与使用](./skill)。

## 准备语言 JSON

在 `src/locales/` 下创建两个文件，使用相同 key：

::: code-group

```json [src/locales/zh-CN.json]
{
  "你好，{name}！": "你好，{name}！",
  "切换语言": "切换语言"
}
```

```json [src/locales/en-US.json]
{
  "你好，{name}！": "Hello, {name}!",
  "切换语言": "Switch language"
}
```

:::

词条是扁平的 `Record<string, string>`，各语言的 key 保持一致，译文写在 value 中。这里使用中文原文作为 key，也可以使用 `welcome`、`menu.home` 等语义 key；点号不表示嵌套路径。翻译时保留 `{name}` 等占位符。

## 创建容器与切换语言

在 `src/i18n.ts` 中只导入默认中文包，显式传入默认语言、初始词条和切换时使用的加载器：

```ts
import { createI18n } from "@bubblesjs/i18n-core";
import zhCN from "./locales/zh-CN.json";

export const store = createI18n({
  locale: "zh-CN",
  message: zhCN,
  loaderMessage: async (locale = "zh-CN") => (await import(`./locales/${locale}.json`)).default,
});
```

`createI18n` 同步返回容器，首屏使用 `message`，初始化不调用加载器。普通脚本可以直接翻译和切换：

```ts
import { store } from "./i18n";

const { tr, loadLocale } = store.getState();
tr("你好，{name}！", { name: "Bubbles" }); // 你好，Bubbles！

await loadLocale("en-US"); // 此时通过 loaderMessage 加载英文包
tr("你好，{name}！", { name: "Bubbles" }); // Hello, Bubbles!
```

语言名应与 JSON 文件名一致；Vite 等构建器负责将动态导入的 JSON 拆成按需资源。TypeScript 项目需开启 `resolveJsonModule`。加载器也可以使用接口或资源 URL；缓存、重试由应用实现。

首屏也需异步加载或恢复语言偏好时，改用 `await initI18n(...)`，见[核心容器](./core#持久化语言偏好)。

## 在 Vue / React 中显示译文

将上面的 `store` 交给 `I18nProvider`，在后代组件中调用 `useI18n()`：

| 框架  | 根组件 / 入口                   | 子组件                                                     |
| ----- | ------------------------------- | ---------------------------------------------------------- |
| Vue   | `<I18nProvider :store="store">` | [Vue 入口与业务组件](./vue#_4-接入-provider-并启动应用)    |
| React | `<I18nProvider store={store}>`  | [React 入口与业务组件](./react#_4-在应用入口接入-provider) |

继续按对应教程创建入口和组件，即可显示译文并切换语言。需要独立切换某个区域的语言，见[全局与局部使用](./scopes)。

## 用 CLI 扫描项目并维护 JSON

安装 CLI 后，按[安装与配置](./cli#安装与配置)创建 `i18n.config.ts`，指定源码范围和上述 JSON 路径：

```sh
# 扫描静态翻译调用，先预览差异
pnpm exec bubbles-i18n sync --dry-run

# 补齐缺失 key，保留已有翻译
pnpm exec bubbles-i18n sync

# 检查源码与 JSON 的 key 差异
pnpm exec bubbles-i18n check
```

新增 key 的值先等于 key，需要填写译文；`check` 检查 key 是否齐全，不判断翻译是否完成。需要交给译者编辑时，使用 [JSON ⇄ Excel 工作流](./cli#excel-workflow)。

## 在本仓库开发文档与示例

克隆仓库后：

```sh
pnpm install --frozen-lockfile
pnpm docs:dev
```

文档默认端口为 5174，`pnpm docs:build` 构建静态文档。运行框架示例见 [Playground](./scopes#运行-playground)，完整开发与检查命令见 [README](https://github.com/bubblesplant/i18n#本地开发)。
