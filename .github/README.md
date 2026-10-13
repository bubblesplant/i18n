# 流水线与维护者配置

本项目参考 [Vite 的 CI](https://github.com/vitejs/vite/blob/main/.github/workflows/ci.yml) 和[发布工作流](https://github.com/vitejs/vite/blob/main/.github/workflows/publish.yml)，采用固定 Action 提交、按 job 分配权限、pnpm 从 `packageManager` 读取版本，以及独立的质量检查和发布阶段。本项目继续使用 Changesets 管理四个包的版本，并让发布和文档部署等待完整 CI 通过。

## 执行顺序

1. PR 和 `main` 提交执行 `CI`：Linux、Windows 上运行 `pnpm ready`；汇总检查名为 `CI Passed`。
2. 主仓库 `main` 的 CI 成功后，通过 `workflow_run` 触发 `Release` 和 `Deploy docs`。PR 的 CI 不触发发布，Fork 仓库不会自动发布。
3. `Release` 检出通过 CI 的准确提交。有 Changeset 时创建或更新版本 PR；版本 PR 合并并通过 CI 后，发布未发布的 npm 版本，推送 Git 标签并创建 GitHub Release。
4. `Deploy docs` 下载该次 CI 的 `docs-site` 产物，推送到 `gh-pages`；不再重新构建文档。

发布和部署前会比较通过检查的提交与当前 `main`。如果 `main` 已前进，旧提交的发布和部署会跳过，等待新提交通过 CI，避免旧任务覆盖新版本 PR 或文档。

Node.js 使用 `26.x`；pnpm 使用根 `package.json` 的 `packageManager`，当前为 `12.11.2`。`pnpm/setup` 会安装运行时和依赖，并要求锁文件存在、保持冻结。

## GitHub 配置

在仓库 **Settings → Actions → General** 中允许 GitHub Actions 创建 Pull Request。工作流已按 job 声明需要的权限，无需把所有工作流的默认权限改成可写。

在 **Settings → Rules → Rulesets** 为 `main` 配置分支规则，要求通过 PR 合并、要求状态检查 `CI Passed` 成功，并禁止强制推送和删除主分支。首次运行新的 CI 后，即可选择这个检查名。

在 **Settings → Secrets and variables → Actions** 配置以下 Repository secrets：

| Secret                 | 用途                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `NPM_TOKEN`            | 发布四个 `@bubblesjs/i18n-*` 公开包的 npm token，需要拥有这些包的发布权限。未配置时仅维护版本 PR，并在运行摘要中明确说明未发布 npm。  |
| `RELEASE_GITHUB_TOKEN` | 可选的自定义 GitHub token。可使用仅授权本仓库的 fine-grained PAT，授予 Contents、Pull requests 的读写权限，让版本 PR 的 CI 自动运行。 |

未配置 `RELEASE_GITHUB_TOKEN` 时，Changesets 使用默认 `GITHUB_TOKEN`。GitHub 会让自动创建或更新的版本 PR 的工作流等待维护者批准：在 PR 页面点击 **Approve workflows to run**，等待 `CI Passed` 成功后再合并。该批准流程是 [GitHub 的触发规则](https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-when-your-workflow-runs/triggering-a-workflow)，升级 Action 不会自动取消它。

文档沿用现有 GitHub Pages 分支部署。在 **Settings → Pages** 中选择 **Deploy from a branch → gh-pages → / (root)**。项目站点的 base 路径由 CI 自动设置为 `/i18n/`。

Vite 当前使用 npm trusted publishing。本项目保留已经使用的 `NPM_TOKEN` 认证方式；切换 trusted publishing 还需要在 npm 后台为四个包分别配置受信任的 GitHub 仓库和工作流。

## 重试与更新

- 检查失败：修复后提交；发布和部署不会执行。
- 需要手动检查或重新构建：打开 **Actions → CI → Run workflow**，选择 `main`。完整检查通过后才会触发发布和部署。
- 仅发布或部署失败：修复 token 或后台配置后，可以重跑对应的失败 job；如果 `main` 已有新提交，则重新运行最新 `main` 的 CI。
- 文档产物保留 7 天；过期后重新运行 `main` 的 CI，生成新的产物。
- Action 版本固定到完整 commit SHA。升级时同时更新 SHA 和版本注释，并验证 Action 输入参数。
- 提交本地改动前先同步最新 `main`，保留 Changesets 已生成的版本号和 CHANGELOG，避免回退已经发布的包版本。
