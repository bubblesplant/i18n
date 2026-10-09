# BubblesJS i18n

与框架无关的轻量国际化核心、React / Vue 适配器和静态词条维护 CLI。四个包从 create-bubbles 的 monorepo 模板迁入此仓库，准备统一以 `0.0.1` 首次发布。

| 包                      | 用途                                             |
| ----------------------- | ------------------------------------------------ |
| `@bubblesjs/i18n-core`  | 翻译插值、语言状态、异步词条加载和语言偏好持久化 |
| `@bubblesjs/i18n-react` | React Provider、Hooks 和 SSR 支持                |
| `@bubblesjs/i18n-vue`   | Vue 3 Provider 与响应式 Composables              |
| `@bubblesjs/i18n-cli`   | 扫描静态翻译调用，检查和同步 JSON 语言包         |

根项目、`docs`、`playground` 和 `@bubblesjs/utils` 均保持私有，不发布到 npm。原模板中的包保留原位，本仓库单独维护迁入的版本。

## 使用

以下 npm 安装命令在首次发布完成后可用。开发本仓库时使用 `pnpm install` 安装工作区依赖。

```bash
# 与框架无关
npm install @bubblesjs/i18n-core
# React / Vue 按需选择
npm install @bubblesjs/i18n-core @bubblesjs/i18n-react react
npm install @bubblesjs/i18n-core @bubblesjs/i18n-vue vue
# 开发时维护语言包
npm install -D @bubblesjs/i18n-cli
```

```ts
import { initI18n } from "@bubblesjs/i18n-core";

const catalogs = {
  en: { hello: "Hello {name}" },
  zh: { hello: "你好 {name}" },
};

const store = await initI18n({
  locale: "en",
  loaderMessage: async (locale) => catalogs[locale === "zh" ? "zh" : "en"],
});

store.getState().tr("hello", { name: "Bubbles" }); // Hello Bubbles
await store.getState().loadLocale("zh");
store.getState().tr("hello", { name: "Bubbles" }); // 你好 Bubbles
```

已有首屏词条时可用同步 `createI18n({ locale, message })`。缺失词条返回 key；插值支持 `{name}`，参数值为字符串或数字。React 需要 18 或更高版本，Vue peer 范围为 `^3.5.43`；CLI 需要 Node.js `>=22.18.0`，通过 Node 原生能力读取 TypeScript 配置。

完整使用说明见 [快速开始](apps/docs/guide/getting-started.md)、[Core](apps/docs/guide/core.md)、[React](apps/docs/guide/react.md)、[Vue](apps/docs/guide/vue.md) 和 [CLI](apps/docs/guide/cli.md)。各包的 README 也包含 API 与示例。

## 开发与验证

本地验证环境为 Node.js `24.21.0`、pnpm `12.10.1`。工作区使用 TypeScript 6.x（`^6.0.3`）、Vite+ 和 VitePress `2.0.0-alpha.20`。依赖版本集中在 `pnpm-workspace.yaml` 的 catalog 中。

```bash
pnpm install --frozen-lockfile
pnpm ready
```

| 命令                                       | 作用                                                              |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `pnpm test`                                | 执行所有包的单元测试                                              |
| `pnpm typecheck`                           | 检查包、根配置、应用与文档的类型                                  |
| `pnpm lint` / `pnpm format:check`          | 检查代码与格式                                                    |
| `pnpm build`                               | 按工作区依赖顺序构建包、应用和文档                                |
| `pnpm verify:packages`                     | 验证本地 ESM/CJS 入口、声明、CLI bin 和 npm 文件清单              |
| `pnpm verify:release`                      | 将真实 tarball 安装到隔离 npm 消费者，验证运行时、SSR、声明和 CLI |
| `pnpm ready` / `pnpm run ci`               | 完整质量检查、构建和两类发布产物验证                              |
| `pnpm docs:build`                          | 生成静态文档                                                      |
| `pnpm dev` / `pnpm docs:dev`               | 按需启动 playground / 文档站                                      |
| `pnpm changeset` / `pnpm version-packages` | 记录并应用后续版本变更                                            |
| `pnpm release`                             | 先完整验证，再发布公开包到 npmjs                                  |

`verify:release` 依赖先构建完成的 `dist`；会访问 npm registry 安装框架与类型依赖，结束后删除自己的临时目录。它检查 pnpm 打包时正确转换 `workspace:` 和 `catalog:`，并在独立项目中运行严格的 ESM/CJS NodeNext 类型消费、React/Vue SSR、CLI bin、TypeScript 配置、dry-run 与 sync/check。

pnpm 12 的 `pnpm ci` 是内置安装命令，本项目的完整验证请使用 `pnpm ready` 或 `pnpm run ci`。开发服务仅在手动运行上述 dev 命令时启动；playground 默认端口为 5173，文档为 5174。

## 目录

```text
apps/
  docs/                 VitePress 中文文档，独立于运行时包
  playground/           原模板的 Vue 示例应用（私有）
packages/
  i18n-core/            @bubblesjs/i18n-core
  i18n-react/           @bubblesjs/i18n-react
  i18n-vue/             @bubblesjs/i18n-vue
  i18n-cli/             @bubblesjs/i18n-cli
  utils/                私有共享工具
scripts/                本地产物及隔离 npm 安装验证
tsconfig/               共享 TypeScript 配置
.changeset/             四个公开包的统一版本配置
.github/workflows/      CI、手动发布和文档部署
```

四个发布包的 `files` 仅包含 `dist`、README 和 LICENSE；支持 ESM、CJS 及各自的类型声明。CLI 提供 `bubbles-i18n` 命令。React/Vue 包依赖独立的 core，框架作为 peer，不内嵌另一份框架或核心状态实现。MIT 许可证保留源项目版权。

## 发布

首次发布使用当前 `0.0.1`，完成 npm 登录及 `@bubblesjs` scope 权限确认后执行 `pnpm release`。后续改动通过 Changesets 记录，四个包在 fixed 组中统一维护版本。

```bash
# 首次发布：确认账号与 scope 权限，然后执行
npm login
npm whoami
pnpm release

# 后续版本
pnpm changeset
pnpm version-packages
pnpm release
```

实际仓库地址确定后，填写各包的 `repository`、`homepage` 和 `bugs`。此仓库未预填模板仓库地址；这些字段不是 npm 发布必需项。

CI 在 Windows 和 Linux 上执行 `pnpm ready`。Release 工作流从 `main` 手动触发，需要仓库变量 `RELEASE_ENABLED=true`；配置 `NPM_TOKEN` 后可发布，未配置时只运行版本 PR 流程。文档工作流手动部署 GitHub Pages，通过 `DOCS_BASE` 设置部署子路径。

详见 [版本与发布](apps/docs/guide/release.md) 和 [工作区约定](apps/docs/guide/workspace.md)。
