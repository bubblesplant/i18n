# Changesets

公开包为 `@bubblesjs/i18n-core`、`@bubblesjs/i18n-react`、`@bubblesjs/i18n-vue` 和 `@bubblesjs/i18n-cli`，首发版本均为 `0.0.1`。四包属于同一 fixed 版本组，后续变更统一维护版本。

根项目、`docs` 和 `playground` 保持 `private: true`，不参与 npm 发布。根 `tsconfig/` 是普通配置目录。

首次发布无需为现有 `0.0.1` 再创建版本变更。先确认 npm 登录、`@bubblesjs` scope 发布权限，再执行 `pnpm release`；它会先执行完整验证，然后发布公开包。

后续修改公开包时运行 `pnpm changeset`，选择包、版本类型并写明变更。运行 `pnpm version-packages` 更新版本、CHANGELOG 和锁文件，再执行 `pnpm release`。

`pnpm ready` 检查格式、lint、类型、测试、构建、本地产物和隔离 npm tarball 消费。验证命令不会发布包。完整流程见 [发布指南](../apps/docs/guide/release.md)。
