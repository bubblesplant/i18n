# 全局与局部使用

应用导航、登录信息等内容通常共用全局语言。项目工作区、嵌入模块或预览区域可以使用自己的语言：为该区域创建独立容器，再用局部 `I18nProvider` 包住它的业务组件。

全局与局部使用相同的 API，区别在于组件订阅哪个容器。`useI18n()` 读取最近的 Provider；每个容器独立维护 `locale`、`message` 和 `loaderMessage`。

```text
应用 Provider（globalStore）
  ├─ 全局业务组件 → 使用全局语言与词条
  └─ 项目 Provider（projectStore）
       └─ 项目业务组件 → 使用项目语言与词条
```

## 按作用域准备语言包

全局沿用[快速开始](./getting-started#准备语言-json)的语言包。项目词条放到 `src/locales/project/`，准备以下两个文件：

::: code-group

```json [src/locales/project/zh-CN.json]
{
  "项目工作区": "项目工作区",
  "你好，{name}！": "项目欢迎你，{name}！",
  "切换语言": "切换项目语言"
}
```

```json [src/locales/project/en-US.json]
{
  "项目工作区": "Project workspace",
  "你好，{name}！": "Welcome to the project, {name}!",
  "切换语言": "Switch project language"
}
```

:::

全局和项目可以使用同一个 key，对应各自的翻译。例如这里的 `你好，{name}！` 在全局和项目中显示不同文案。局部容器的词条不会自动与全局词条合并；项目缺少 key 时返回 key 本身。

## 创建两个独立容器

在快速开始的 `src/i18n.ts` 中新增以下内容，沿用已有的 `createI18n` 导入和 `store` 配置。将原容器导出为 `globalStore`，再创建独立的 `projectStore`：

```ts
import projectZhCN from "./locales/project/zh-CN.json";

export const globalStore = store;
export const projectStore = createI18n({
  locale: "zh-CN",
  message: projectZhCN,
  loaderMessage: async (locale = "zh-CN") =>
    (await import(`./locales/project/${locale}.json`)).default,
});
```

每个容器使用自己的词条和加载器，在所属作用域创建一次并保持引用稳定。路由按需出现的项目区域，可以在路由模块中导入默认语言并创建容器；多个需要独立语言的区域分别创建自己的容器。

## 接入 React 与 Vue

框架中的嵌套 Provider 写法：

- [React：局部使用与独立项目语言](./react#局部使用-独立项目语言)
- [Vue：局部使用与独立项目语言](./vue#局部使用-独立项目语言)

要让项目语言独立，局部 Provider 必须接收独立的 `projectStore`。两个 Provider 如果传入同一个 store，它们就共享语言与词条状态。

需要读取局部语言的业务组件，应放在项目 Provider 的后代中。在渲染局部 Provider 的同一个组件里调用 `useI18n()`，读到的是该组件外层的容器。

若启用[语言偏好持久化](./core#持久化语言偏好)，为不同作用域设置不同的 `storageKey`，例如 `app:locale` 和 `project:demo:locale`；不同项目按 ID 区分。[服务端渲染](./core#服务端渲染)时，各请求分别创建这些容器。

## 运行 Playground

仓库中的 playground 使用 create-bubbles 的 Vue 和 React 模板提供两个独立前端应用，另有 [Hono + Vite+ 后端示例](./node)。首次运行，在仓库根目录执行：

```sh
pnpm install
pnpm --filter "./packages/*" build
pnpm dev:vue
pnpm dev:react
pnpm dev:hono
```

每条开发命令只启动对应应用，需要同时运行时使用不同终端。`pnpm dev` 默认只启动 Vue。Vue 默认地址为 `http://localhost:5173/`，React 默认地址为 `http://localhost:5175/`。另一框架的示例启动后，可通过页面链接打开。本地依赖包的导出指向 `dist`，首次启动前需先构建 core、框架适配包和 CLI。三个项目各有独立的 `i18n.config.ts`，执行 `pnpm i18n:check` 可检查全部示例的词条。

Hono 独立运行在 `http://localhost:5176/`，通过请求头 `Accept-Language` 选择语言，并按请求隔离全局和项目容器。接口调用与后端运行方式见 [Node.js / Hono](./node#verification)。

可以直接验证：

1. 刷新后，全局与项目都为中文，两个英文包的加载次数都是 0。
2. 只切换项目为英文，全局文案继续显示中文。
3. 切换全局语言，项目继续保持自己选择的语言。
4. 创建任务后切换项目语言，任务数量保留，插值文案随语言更新。
5. 打开另一框架的应用，验证两套应用各自维护语言状态。

页面的加载记录统计 `loaderMessage` 调用次数；默认中文通过静态导入加载，首屏调用次数也是 0。动态 `import()` 可以复用浏览器的模块缓存。语言容器和任务计数分别属于各自应用，刷新后回到默认中文和零个任务。

[Playground 说明与源码入口](https://github.com/bubblesplant/i18n/blob/main/apps/playground/README.md)列出初始化、语言包和两种框架的具体文件。
