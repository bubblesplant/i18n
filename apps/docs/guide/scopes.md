# 全局与局部使用

应用导航、登录信息等内容通常共用全局语言。项目工作区、嵌入模块或预览区域可以使用自己的语言：为该区域创建独立容器，再用局部 `I18nProvider` 包住它的业务组件。

全局与局部使用相同的 API，区别在于组件订阅哪个容器。`useI18n()` 读取最近的 Provider；每个容器独立维护 `locale`、`message` 和 `loaderMessage`。

```text
应用 Provider（globalStore）
  ├─ 全局业务组件 → 使用全局语言与词条
  └─ 项目 Provider（projectStore）
       └─ 项目业务组件 → 使用项目语言与词条
```

| 操作         | 全局应用                   | 局部项目                   |
| ------------ | -------------------------- | -------------------------- |
| 初始化       | 加载全局的默认中文包       | 加载项目的默认中文包       |
| 全局切换英文 | 加载全局英文，更新全局组件 | 维持项目自己的语言         |
| 项目切换英文 | 维持全局自己的语言         | 加载项目英文，更新项目组件 |

## 按作用域准备语言包

全局沿用接入教程中的 `src/locales/zh-CN.json` 和 `src/locales/en-US.json`。项目词条放到单独的 `src/locales/project/` 目录。目录由应用决定，core 不会自行扫描或推导语言包路径。

::: code-group

```json [locales/zh-CN.json]
{
  "你好，{name}！": "你好，{name}！",
  "切换语言": "切换语言"
}
```

```json [locales/en-US.json]
{
  "你好，{name}！": "Hello, {name}!",
  "切换语言": "Switch language"
}
```

```json [locales/project/zh-CN.json]
{
  "项目工作区": "项目工作区",
  "你好，{name}！": "项目欢迎你，{name}！",
  "切换语言": "切换项目语言"
}
```

```json [locales/project/en-US.json]
{
  "项目工作区": "Project workspace",
  "你好，{name}！": "Welcome to the project, {name}!",
  "切换语言": "Switch project language"
}
```

:::

全局和项目可以使用同一个 key，对应各自的翻译。例如这里的 `你好，{name}！` 在全局和项目中显示不同文案。局部容器的词条不会自动与全局词条合并；项目缺少 key 时返回 key 本身。

## 创建两个独立容器

将接入教程的 `src/i18n.ts` 扩展为两个独立容器，供 React 和 Vue 共用。每个容器只静态导入自己的默认中文包：

```ts
import { createI18n } from "@bubblesjs/i18n-core";
import zhCN from "./locales/zh-CN.json";
import projectZhCN from "./locales/project/zh-CN.json";

export const globalStore = createI18n({
  locale: "zh-CN",
  message: zhCN,
  loaderMessage: async (locale = "zh-CN") => (await import(`./locales/${locale}.json`)).default,
});

export const projectStore = createI18n({
  locale: "zh-CN",
  message: projectZhCN,
  loaderMessage: async (locale = "zh-CN") =>
    (await import(`./locales/project/${locale}.json`)).default,
});
```

在应用入口直接导入两个容器，分别传给对应的 Provider：

```ts
import { globalStore, projectStore } from "./i18n";
```

`locale` 和 `message` 明确指定各自的默认语言与词条，`createI18n` 同步创建容器，不会调用 `loaderMessage`。首屏只导入全局中文和项目中文；各自的 `loadLocale("en-US")` 才会调用对应加载器导入英文包。加载器也可以使用接口或资源 URL，仍由应用提供。

容器在所属作用域创建一次，并保持引用稳定。如果项目区域在进入某条路由后才出现，可以把项目容器与默认中文导入放到该路由模块中，在进入该区域时创建，再挂载局部 Provider。多个需要独立语言的项目区域，应分别调用 `createI18n` 创建自己的容器。

## 接入 React 与 Vue

完整入口、Provider 和业务组件示例：

- [React：局部使用与独立项目语言](./react#局部使用-独立项目语言)
- [Vue：局部使用与独立项目语言](./vue#局部使用-独立项目语言)

要让项目语言独立，局部 Provider 必须接收独立的 `projectStore`。两个 Provider 如果传入同一个 store，它们就共享语言与词条状态。

需要读取局部语言的业务组件，应放在项目 Provider 的后代中。在渲染局部 Provider 的同一个组件里调用 `useI18n()`，读到的是该组件外层的容器。

若启用[语言偏好持久化](./core#持久化语言偏好)，为不同作用域设置不同的 `storageKey`，例如 `app:locale` 和 `project:demo:locale`；不同项目再按项目 ID 区分，避免刷新后恢复到其他作用域保存的语言。服务端渲染时，各请求分别创建这些容器。

## 运行 Playground

仓库中的 playground 已提供 React / Vue 两种可切换的运行示例。首次运行，在仓库根目录执行：

```sh
pnpm install
pnpm --filter "playground^..." build
pnpm dev
```

打开开发服务器输出的地址，默认是 `http://localhost:5173/`。本地依赖包的导出指向 `dist`，首次启动前需先构建 core 和两个框架适配包。

可以直接验证：

1. 刷新后，全局与项目都为中文，两个英文包的加载次数都是 0。
2. 只切换项目为英文，全局文案继续显示中文。
3. 切换全局语言，项目继续保持自己选择的语言。
4. 创建任务后切换项目语言，任务数量保留，插值文案随语言更新。
5. 在 React / Vue 之间切换，继续使用同一组容器的语言状态。

页面的加载记录统计 `loaderMessage` 调用次数；默认中文通过静态导入加载，首屏调用次数也是 0。动态 `import()` 可以复用浏览器的模块缓存。任务计数属于各框架示例组件自身，切换框架会重新挂载组件。

[Playground 说明与源码入口](https://github.com/bubblesplant/i18n/blob/main/apps/playground/README.md)列出初始化、语言包和两种框架的具体文件。
