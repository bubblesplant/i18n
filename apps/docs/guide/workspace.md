# 工作区约定

## 目录与发布边界

```text
apps/
  playground/       私有 Vue 示例应用
  docs/             私有 VitePress 文档站点
packages/
  i18n-core/        框架无关的国际化容器
  i18n-react/       React 适配层
  i18n-vue/         Vue 适配层
  i18n-cli/         JSON 词条同步 CLI
  utils/            私有工具包示例
scripts/            包产物与发布消费验证
tsconfig/           共享 TypeScript 配置
.changeset/         版本变更记录
```

`apps/*` 和 `packages/*` 由 `pnpm-workspace.yaml` 纳入工作区。四个 `@bubblesjs/i18n-*` 包公开发布，初始版本为 `0.0.1`；根项目、docs、playground 和 utils 均为私有项目。`tsconfig/` 是普通配置目录，没有包清单，不参与 npm 发布。

包名写在各自的 `package.json` 中。修改根项目名称不会改变子包 scope；新增公开包应显式使用 `@bubblesjs/<包名>`。私有应用可以保留 `docs`、`playground` 名称。

## 包的依赖关系

React 和 Vue 适配包都依赖 core，框架自身是 peer dependency；CLI 独立工作，不依赖运行时容器。CLI 使用 fast-glob 查找文件，运行时语言加载仍由应用配置。

依赖 core 的工作区包使用：

```json
{
  "dependencies": {
    "@bubblesjs/i18n-core": "workspace:*"
  }
}
```

`workspace:*` 强制使用仓库内的包。执行 `pnpm pack` 或发布时，pnpm 将它转换成实际版本。不要用 `npm pack` 的文件清单检查代替 pnpm tarball 验证，因为后者还会转换 workspace 与 catalog 协议。

共享的外部依赖版本在根 `pnpm-workspace.yaml` 的 catalog 中声明，使用方按实际需要引用 `catalog:`。新增依赖后执行 `pnpm install` 并更新根锁文件。React/Vue 的 peer 版本在适配包清单中声明，由使用者应用提供。

## 源码开发和公开入口

公开导入入口统一为包名，例如：

```ts
import { createI18n } from "@bubblesjs/i18n-core";
import { I18nProvider } from "@bubblesjs/i18n-react";
```

各包通过 Vite+ pack 构建 ESM、CommonJS 和类型声明。`main`、`module`、`types` 与条件 `exports` 指向 dist，不把原始 TypeScript 当作 npm 运行入口。适配包构建时保留 core 和框架依赖，不内联第二份运行时。

适配包的单元测试和开发类型检查使用 core 源码映射，因此全新检出可以先执行类型检查与测试。实际发布消费验证在隔离目录安装 tarball，使用 dist 入口，避免源码别名掩盖问题。

`apps/docs` 独立构建，不运行时依赖 utils 或 i18n 包。文档示例是静态代码块，展示使用者应写的代码。

## 测试与验证

测试覆盖核心词条与存储、并发语言加载、React/Vue 组件和订阅生命周期，以及 CLI 的扫描、配置、同步、报告与退出码。

修改某个包后可定向验证，例如：

```sh
pnpm --filter @bubblesjs/i18n-react typecheck
pnpm --filter @bubblesjs/i18n-react test
pnpm --filter @bubblesjs/i18n-react build
pnpm --filter @bubblesjs/i18n-react verify:package
```

发布前在根目录运行 `pnpm ready`，包含：

1. 格式、lint、类型和单元测试。
2. 所有包、应用和文档的构建。
3. `verify:packages` 验证 ESM/CJS、声明、CLI 入口及 npm 文件清单。
4. `verify:release` 生成实际 tarball，在隔离安装后验证运行时导入、NodeNext 类型声明和 CLI 命令。

这些验证不发布 npm。四个公开包采用固定版本组，变更记录与发布步骤见[版本与发布](./release)。

## 共享配置

基础 TypeScript 约束定义在 `tsconfig/base.json`，Node 与 Vue 项目可继续继承对应配置。每个子项目只覆盖自己所需的环境、入口和类型。

提交检查按需启用：初始化自己的 Git 仓库后执行 `pnpm hooks:install`。仓库不会在安装依赖时自动运行 Git 初始化或 hooks 安装。

Changesets 以 `main` 为默认比较分支，应在实际 Git 仓库中建立该分支的有效提交后使用分支状态比较。未初始化 Git 时，`changeset status` 等比较命令不可用，不影响单元测试和包产物验证。远程地址和线上工作流需在自己的仓库中配置并验证。
