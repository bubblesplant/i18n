# 快速开始

先选择框架，按「准备 JSON → 创建 core 容器 → Provider 接入 → 组件翻译与切换」完成应用接入。再安装 CLI，让源码中的翻译 key 自动同步到 JSON。

想先理解整体设计，可阅读[实现思路](./architecture)。源码在 [GitHub](https://github.com/bubblesplant/i18n)，版本更新见 [GitHub Releases](https://github.com/bubblesplant/i18n/releases)。四个公开包当前均为 `0.0.2`，已发布到 npm；下面命令使用 `latest` 标签。

## 选择你的接入方式

| 场景                      | 安装命令                                              | 完整教程                    |
| ------------------------- | ----------------------------------------------------- | --------------------------- |
| Vue 3 应用                | `pnpm add @bubblesjs/i18n-core @bubblesjs/i18n-vue`   | [Vue 接入与使用](./vue)     |
| React 应用                | `pnpm add @bubblesjs/i18n-core @bubblesjs/i18n-react` | [React 接入与使用](./react) |
| 普通 JavaScript / Node.js | `pnpm add @bubblesjs/i18n-core`                       | [核心容器](./core)          |
| 开发时维护语言包          | `pnpm add -D @bubblesjs/i18n-cli`                     | [CLI 使用](./cli)           |

React 应用需提供 React `>=18.0.0` 和对应渲染器；Vue 应用需提供 Vue `^3.5.43`。CLI 要求 Node.js `>=22.18.0`。运行时与 CLI 可分别安装。

## 准备语言 JSON

在 `src/locales/` 下创建两个文件，使用相同 key：

::: code-group

```json [src/locales/zh-CN.json]
{
  "welcome": "你好，{name}！",
  "menu.home": "首页"
}
```

```json [src/locales/en-US.json]
{
  "welcome": "Hello, {name}!",
  "menu.home": "Home"
}
```

:::

词条是扁平对象，所有值都是字符串。`menu.home` 直接作为 key，不表示嵌套对象。也可以选择中文原文作为 key，如 `"保存": "Save"`；框架指南使用这种方式演示。

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

`locale` 指定默认语言，`message` 提供默认中文词条，`loaderMessage` 提供切换语言时的加载方法。`createI18n` 同步返回容器，初始化不会调用加载器；英文包在调用 `loadLocale("en-US")` 时才动态加载。普通脚本可以这样使用：

```ts
import { store } from "./i18n";

const { tr, loadLocale } = store.getState();
tr("welcome", { name: "Bubbles" }); // 你好，Bubbles！

await loadLocale("en-US"); // 此时通过 loaderMessage 加载英文包
tr("welcome", { name: "Bubbles" }); // Hello, Bubbles!
```

应用入口直接导入 `store` 并交给 Provider，无需等待初始化。后续切换语言由 `loadLocale` 调用同一个加载器。语言包如何加载由应用决定：可以动态 `import()`，也可以调用已有的资源请求方法；缓存和失败处理可写在加载器中。如果首屏也需要异步获取词条，或要恢复保存的语言偏好，可选择 `initI18n({ locale, loaderMessage, ... })`，见[核心容器](./core)。

## 在 Vue / React 中显示译文

两个框架都把上面的容器交给 `I18nProvider`，由子组件订阅语言变化：

| 框架  | 根组件 / 入口                   | 子组件                                                                    |
| ----- | ------------------------------- | ------------------------------------------------------------------------- |
| Vue   | `<I18nProvider :store="store">` | setup 中调用 `useI18n()`，模板中调用 `tr("welcome", { name: "Bubbles" })` |
| React | `<I18nProvider store={store}>`  | 调用 `useI18n()`，JSX 中调用 `{tr("welcome", { name: "Bubbles" })}`       |

两个框架都通过 `const { tr, locale, loadLocale } = useI18n()` 获取翻译和切换方法，`tr` / `loadLocale` 都是普通函数。Vue 的 `locale` 为 computed 引用，脚本中读取 `locale.value`，模板自动解包；React 的 `locale` 是当前语言值。调用 `loadLocale("en-US")` 后，订阅的组件会更新。

继续按[Vue 完整示例](./vue)或[React 完整示例](./react)创建入口和业务组件；教程包含安装、全部示例文件、切换按钮与按需加载方式。

## 用 CLI 扫描项目并维护 JSON

```sh
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
    },
  },
});
```

```sh
# 扫描静态翻译调用，先预览差异
pnpm exec bubbles-i18n sync --dry-run

# 补齐缺失 key，保留已有翻译
pnpm exec bubbles-i18n sync

# 检查源码与 JSON 的 key 差异
pnpm exec bubbles-i18n check
```

扫描包含在 `sync` / `check` 内部。新增 key 的值先等于 key，需要手动填入译文；`check` 默认检查缺失 key，不判断译文是否完成。需要同时检查未使用 key 时加上 `--fail-on-stale`。Vue 模板和脚本中的 `tr("key")` 都可扫描。

本仓库 CLI 已支持 JSON ⇄ Excel：配置 `projects.<name>.excel.file` 后，使用 `excel export` 导出翻译表，再使用 `excel import` 把译者填写的译文导入回 JSON。流程与冲突规则见[CLI 使用](./cli#excel-workflow)，npm 包的功能发布状态见 [GitHub Releases](https://github.com/bubblesplant/i18n/releases)。

## 在本仓库开发文档与示例

本地环境使用 Node.js `24.21.0`、pnpm `12.10.1`。克隆仓库后：

```sh
pnpm install --frozen-lockfile
pnpm docs:dev
```

文档默认端口为 5174；`pnpm dev` 启动 Vue playground，默认端口为 5173。`pnpm docs:build` 只构建文档，`pnpm ready` 执行完整质量检查和产物验证，不发布 npm。
