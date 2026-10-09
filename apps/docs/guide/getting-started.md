# 快速开始

BubblesJS i18n 提供核心翻译容器、React / Vue 适配层和词条 CLI，可按项目需要独立使用：

| 包                      | 用途                                 | 环境                 |
| ----------------------- | ------------------------------------ | -------------------- |
| `@bubblesjs/i18n-core`  | 翻译、语言加载、状态订阅和持久化     | 浏览器、Node.js、SSR |
| `@bubblesjs/i18n-react` | React Provider 与 Hooks              | React `>=18.0.0`     |
| `@bubblesjs/i18n-vue`   | Vue Provider 与 Composables          | Vue `^3.5.43`        |
| `@bubblesjs/i18n-cli`   | 扫描静态 key、同步和检查 JSON 语言包 | Node.js `>=22.18.0`  |

下面的安装命令默认使用 npm 的 `latest` 标签。

## 选择需要的包

只使用核心容器：

```sh
pnpm add @bubblesjs/i18n-core
```

React 应用：

```sh
pnpm add @bubblesjs/i18n-core @bubblesjs/i18n-react
```

应用同时需要 React 和对应渲染器；尚未安装时添加 `react`、`react-dom`。适配层把 React 声明为 peer dependency，避免在包内携带第二份 React。本仓库使用 React 19 验证。

Vue 应用：

```sh
pnpm add @bubblesjs/i18n-core @bubblesjs/i18n-vue
```

应用需提供兼容的 Vue `^3.5.43`。两个适配层都普通依赖 core；示例直接导入 `createI18n`，因此显式声明 core 依赖。

在开发期间维护语言包：

```sh
pnpm add -D @bubblesjs/i18n-cli
```

运行时包和 CLI 可以分别使用，不必为了翻译组件安装 CLI。

## 创建第一个国际化容器

```ts
import { createI18n } from "@bubblesjs/i18n-core";

const store = createI18n({
  locale: "zh-CN",
  message: {
    welcome: "你好，{name}！",
  },
});

console.log(store.getState().tr("welcome", { name: "Bubbles" }));
// 你好，Bubbles！
```

初始词条选项是单数 `message`，词条为扁平的字符串对象。`createI18n` 同步返回容器，不会自动调用语言加载器；需要先异步加载首屏词条时，使用 `await initI18n(...)`。

继续阅读[核心容器](./core)、[React](./react)或[Vue](./vue)，了解语言切换、Provider 与订阅。在[词条 CLI](./cli)中配置源码扫描和 JSON 同步。

## 在本仓库开发

本地验证环境为 Node.js `24.21.0` 和 pnpm `12.10.1`，`mise.toml` 提供可选的 Node 环境配置。TypeScript 为 6.x，VitePress 为 `2.0.0-alpha.20`。

```sh
pnpm install --frozen-lockfile
pnpm ready
```

`pnpm ready` 完成格式、lint、类型、测试、构建，以及本地产物和真实发布 tarball 的消费验证，不执行 npm 发布。

| 根目录命令             | 用途                                                     |
| ---------------------- | -------------------------------------------------------- |
| `pnpm test`            | 运行各包单元测试                                         |
| `pnpm typecheck`       | 检查工作区类型                                           |
| `pnpm build`           | 构建包、应用和文档                                       |
| `pnpm docs:build`      | 只构建文档                                               |
| `pnpm verify:packages` | 验证本地 ESM/CJS、声明和 npm 文件清单，需要先构建        |
| `pnpm verify:release`  | 打包并隔离安装四包，验证实际导入、类型和 CLI，需要先构建 |
| `pnpm ready`           | 执行全部发布前验证                                       |
| `pnpm changeset`       | 记录后续发布的包变更                                     |
| `pnpm release`         | 验证完成后实际发布 npm                                   |

需要本地交互时，`pnpm dev` 启动 Playground，`pnpm docs:dev` 启动文档；两个命令会启动持续运行的开发服务。仓库的私有应用和 utils 不参与 npm 发布，详见[工作区约定](./workspace)。版本维护与发布流程见[版本与发布](./release)。
