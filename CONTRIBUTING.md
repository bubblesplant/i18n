# 参与贡献

欢迎为 BubblesJS i18n 提交问题、改进文档、修复 Bug 或增加功能。项目使用 MIT 许可证，贡献的代码和文档也按该许可证发布。

## 反馈问题与讨论需求

提交前请先查看[文档](https://bubblesplant.github.io/i18n/)和[已有 Issues](https://github.com/bubblesplant/i18n/issues)，避免重复反馈。

- Bug：提供使用的包及版本、Node.js 和框架版本、复现步骤、预期行为与实际行为，尽量附上最小复现仓库或示例。
- 功能建议：说明使用场景、当前遇到的问题和期望的行为。较大的 API 或架构调整，请先开 Issue 讨论。
- 文档问题：可以直接提交 PR，说明需要澄清或修正的内容。

没有关联 Issue 的小修复也可以直接提交 PR。

## 开发环境

本仓库使用 pnpm workspace 管理四个公开包、文档和示例应用。

- Node.js：26.x。
- pnpm：12.11.2，以根目录 `package.json` 的 `packageManager` 字段为准；CI 使用同一版本。

以上是开发本仓库的环境要求。使用已发布 npm 包时，请查看对应包的文档与兼容性说明。

先安装 Node.js 26，再安装指定版本的 pnpm：

```sh
npm install --global pnpm@12.11.2
node --version
pnpm --version
```

在 GitHub 上 Fork [本仓库](https://github.com/bubblesplant/i18n)，将下面的用户名替换为自己的 GitHub 用户名：

```sh
git clone https://github.com/<你的用户名>/i18n.git
cd i18n
git remote add upstream https://github.com/bubblesplant/i18n.git
git switch -c fix/describe-your-change
pnpm install --frozen-lockfile
```

## 仓库结构

| 目录                                           | 用途                                       |
| ---------------------------------------------- | ------------------------------------------ |
| `packages/i18n-core`                           | 框架无关的翻译、语言状态、异步加载与持久化 |
| `packages/i18n-react`                          | React Provider 与 Hooks                    |
| `packages/i18n-vue`                            | Vue Provider 与 Composables                |
| `packages/i18n-cli`                            | 扫描 key、维护 JSON 与转换 Excel 翻译表    |
| `apps/docs`                                    | VitePress 文档站                           |
| `apps/playground/vue`、`apps/playground/react` | 前端示例应用                               |
| `apps/playground/hono`                         | Node.js / Hono 后端示例                    |
| `scripts`                                      | 构建产物与发布包验证工具                   |

## 本地运行

首次运行示例前先构建工作区，以生成本地依赖包的 `dist`：

```sh
pnpm build
pnpm dev:vue
pnpm dev:react
pnpm dev:hono
```

Vue、React 和 Hono 示例默认分别使用 5173、5175 和 5176 端口，每条命令独立启动一个应用，需要同时运行时使用不同终端。`pnpm dev` 默认只启动 Vue。执行 `pnpm i18n:check` 可检查三个示例的语言包。修改公开包后，需要重新构建对应包，示例才能使用最新产物。更多说明见 [Playground README](apps/playground/README.md)。

文档可以单独运行：

```sh
pnpm docs:dev
```

文档开发地址为 `http://localhost:5174`。

## 检查与测试

在仓库根目录执行以下命令：

| 命令                | 用途                                       |
| ------------------- | ------------------------------------------ |
| `pnpm format:check` | 检查格式                                   |
| `pnpm format`       | 自动格式化                                 |
| `pnpm lint`         | 检查代码规范                               |
| `pnpm typecheck`    | 检查类型                                   |
| `pnpm test`         | 运行工作区测试                             |
| `pnpm docs:build`   | 检查文档构建与链接                         |
| `pnpm ready`        | 执行 CI 使用的完整质量检查、构建及产物验证 |

开发时可先运行相关包的检查，例如：

```sh
pnpm --filter @bubblesjs/i18n-core test
pnpm --filter @bubblesjs/i18n-react test
pnpm --filter @bubblesjs/i18n-vue test
pnpm --filter @bubblesjs/i18n-cli test
```

提交前建议执行 `pnpm ready`。它会验证本地产物和隔离安装的 npm tarball，不执行发布。修复行为问题或增加功能时，请添加能验证该行为的测试；纯文档和元信息调整通常无需增加单元测试。

可选安装本地 Git hooks：

```sh
pnpm hooks:install
```

Hooks 会检查暂存文件和提交信息。提交信息使用 Conventional Commits，例如 `fix(core): 修复语言切换`、`feat(cli): 增加扫描选项`、`docs: 补充 Vue 示例`。

## Changeset 与版本记录

修改会发布到 npm 的代码、类型、依赖或包元信息时，请添加 Changeset：

```sh
pnpm changeset
```

选择受影响的公开包和变更类型，并写清对使用者的影响：

- `patch`：兼容的 Bug 修复或包元信息调整。
- `minor`：兼容的新功能。
- `major`：不兼容的 API 变更，需要说明迁移方式。

提交生成的 `.changeset/*.md`。四个公开包处于同一个 fixed 版本组，由 Changesets 统一维护版本。只修改文档、示例或开发工具配置时，通常不需要 Changeset。

版本号、CHANGELOG 与正式发布由维护者通过发布流程处理，贡献 PR 无需手动更新版本号或运行 `pnpm release`。

## CI 与发布

PR 会在 Linux 和 Windows 上使用 Node.js 26、根目录指定的 pnpm 版本执行 `pnpm ready`，两个平台都通过后，汇总检查 `CI Passed` 才会通过。

代码合并到 `main` 后，只有该提交的完整 CI 通过，才会创建或更新版本 PR、发布 npm 包和部署文档。文档部署使用该次 CI 构建的产物。版本 PR 合并后，同样需要先通过主分支 CI，才会正式发布。

GitHub 默认要求维护者批准由 `GITHUB_TOKEN` 创建的版本 PR 的工作流。遇到等待批准时，在 PR 页面点击 **Approve workflows to run**，等待 `CI Passed` 通过再合并。维护者也可以配置 `RELEASE_GITHUB_TOKEN`，让版本 PR 的 CI 自动运行。

维护者配置和重试方法见 [流水线说明](.github/README.md)。`pnpm release:ci` 仅供通过 CI 门禁后的自动发布使用；本地发布使用包含完整检查的 `pnpm release`。

## 提交 Pull Request

1. 保持一个 PR 聚焦一个问题，避免混入无关重构或格式调整。
2. 将分支推送到自己的 Fork，向本仓库的 `main` 分支提交 PR。
3. 按 PR 模板填写改动原因、关联 Issue、验证方式及兼容性影响；需要自动关闭 Issue 时写 `Closes #编号`。
4. 涉及公共 API 或使用方式时，同步更新文档、示例和 Changeset。
5. 等待 Linux 与 Windows 的 CI 检查，并根据维护者反馈完善改动。

如果某项检查未执行或失败，请在 PR 中说明命令、结果和原因。尚未完成的改动可以先提交 Draft PR。

普通贡献者通过 Fork 和 PR 参与；PR 由维护者审核并合并，无需申请主仓库的写入权限。
