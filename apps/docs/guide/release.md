# 版本与发布

四个公开包的首次版本统一为 `0.0.1`：

- `@bubblesjs/i18n-core`
- `@bubblesjs/i18n-react`
- `@bubblesjs/i18n-vue`
- `@bubblesjs/i18n-cli`

根项目、docs 和 playground 设置为私有项目，跳过 npm 发布。以下命令说明发布流程；当前工作只准备包、文档与测试，不表示已经发布。

## 首次发布

在自己的实际 Git 仓库中维护发布代码，先建立默认分支 `main` 的有效提交。Changesets 的默认 `baseBranch` 为 `main`，分支对比和发布标签需要对应的 Git 上下文；未初始化 Git 时，`changeset status` 等分支比较命令不可用。使用其他默认分支时同步调整配置与工作流。

四包已经配置 `publishConfig.access: public`，registry 指向 npmjs。实际发布前，使用有 `@bubblesjs` scope 发布权限的 npm 账户登录，并确认目标版本尚未占用：

```sh
npm login
npm whoami
pnpm install --frozen-lockfile
pnpm ready
```

`pnpm ready` 先运行质量检查、类型和测试，再构建所有工作区项目，最后执行 `verify:packages` 与 `verify:release`。后者在隔离目录安装真实 pnpm tarball，验证 ESM/CJS、NodeNext 声明、框架消费和 CLI，检查 workspace/catalog 协议已经转换。

首次发布直接使用清单里的 `0.0.1`。无需先创建 changeset 或运行版本更新，否则会把首发版本提前递增。在确认发布对象和产物后执行：

```sh
pnpm release
```

`release` 会再次执行 `pnpm ready`，然后调用 `changeset publish`，这一步会实际上传 npm。认证与 npm 账户要求由发布环境提供；GitHub 工作流则使用仓库配置的 token。

包产物包含 dist、README 与 MIT 许可证，不包含测试、开发配置或源模板。原模板目录继续保留，仓库中的公开包是迁入后独立维护的版本。

## 后续版本

`.changeset/config.json` 把四个公开包列入同一个 fixed 版本组。修改影响使用者的行为或 API 后添加变更记录：

```sh
pnpm changeset
```

选择受影响的包和合适的版本级别，描述使用者可观察到的变化。固定版本组会协调四包版本，适配层的 core 依赖随版本更新。

准备下一次发布时：

```sh
pnpm version-packages
pnpm install --frozen-lockfile
pnpm ready
```

`version-packages` 消费 changeset，修改版本和变更日志，并更新锁文件。检查并提交版本变更后，再运行 `pnpm release` 发布新版本。私有项目不需要记录 npm 版本变更。

根目录脚本 `ci` 也执行完整验证，但在 pnpm 12 中，应使用 `pnpm run ci` 调用项目脚本；`pnpm ci` 是 pnpm 的内置安装命令。`pnpm ready` 已显式调用正确的项目脚本。

## GitHub 自动发布

`.github/workflows/release.yml` 在推送到 `main` 时自动运行，也支持在 Actions 页面手动触发，仅在 `main` 分支执行发布。

配置具有目标包发布权限的 `NPM_TOKEN` secret 后：

1. 工作流安装依赖并执行 `pnpm ready`。
2. 有待消费的 changeset 时，Changesets Action 自动创建或更新版本 PR。
3. 版本 PR 合并后推送触发工作流，自动发布新版本到 npm。

没有 `NPM_TOKEN` 时，工作流只提供创建版本 PR 的步骤。完成首次发布所需的仓库、账户与权限配置后，再启用工作流；文档没有填写尚未确定的远程仓库地址。

## 构建与部署文档

文档本身不发布 npm。静态产物位于 `apps/docs/.vitepress/dist/`：

```sh
pnpm docs:build
```

默认站点路径是 `/`。部署到子路径时设置 `DOCS_BASE`，例如 PowerShell：

```powershell
$env:DOCS_BASE = "/my-repository/"
pnpm docs:build
```

GitHub Pages 工作流 `.github/workflows/docs.yml` 也手动触发，并根据仓库名设置 base。将仓库 Pages 来源设置为 GitHub Actions，再运行该工作流。用户/组织首页仓库和自定义域名应按实际部署路径设置 base。仓库内的工作流配置并不表示已经执行线上发布或部署。
