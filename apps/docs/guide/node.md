# Node.js / Hono 后端

Node.js 后端直接使用 `@bubblesjs/i18n-core`，通过 `store.getState().tr()` 翻译。core 不依赖浏览器、Vue 或 React，支持 ESM 与 CommonJS。Hono 中间件负责从请求识别语言，并把当前请求的容器放入 Context。

```text
前端当前语言 → Accept-Language 请求头
                       ↓
Hono 识别语言 → 创建当前请求的 globalI18n
                       ↓
全局接口翻译 / 创建项目路由的 projectI18n
                       ↓
返回稳定的 code、当前 locale 和翻译后的 message
```

词条可以统一加载、共享只读数据；可变容器应按请求创建。多个用户共用一个容器并调用 `loadLocale()`，会让并发请求互相影响。后端的“全局”表示各路由共用一套词条和接入方式，容器仍然属于当前请求。

## 安装与运行 {#setup}

在已有 Hono 后端中安装运行时：

```sh
pnpm add @bubblesjs/i18n-core hono @hono/node-server
```

本仓库的 `apps/playground/hono` 提供完整 Hono + Vite+ 示例，使用 Node.js 22.18 或更新版本。在仓库根目录运行：

```sh
pnpm install --frozen-lockfile
pnpm --filter @bubblesjs/i18n-core build
pnpm --filter playground-hono dev
```

开发地址为 `http://localhost:5176`。Vite+ 通过 `@hono/vite-dev-server` 加载 `src/app.ts`，修改 TypeScript 或词条后，后续请求使用更新的代码。也可在根目录执行 `pnpm dev:hono` 独立启动后端；Vue（5173）与 React（5175）分别使用 `pnpm dev:vue` 和 `pnpm dev:react`，见 [Playground](./scopes#运行-playground)。

Hono 项目的 `i18n.config.ts` 分别维护全局和项目语言包。使用 CLI 前先执行 `pnpm --filter @bubblesjs/i18n-cli build`，然后通过 `pnpm --filter playground-hono i18n:check` 检查词条，或运行 `i18n:sync`、`i18n:export`、`i18n:import` 同步 JSON 与 Excel。

## 语言由请求传入 {#request-language}

前端在每次请求里传当前语言标识，后端读取标准请求头：

```http
Accept-Language: en-US
```

示例采用 Hono 的 `languageDetector`，只读取 `Accept-Language`，不使用 Cookie 缓存。匹配规则为：

| 请求头                       | 选择的语言                |
| ---------------------------- | ------------------------- |
| `zh-CN`、`zh`                | `zh-CN`                   |
| `en-US`、`en`、`en-GB`       | `en-US`                   |
| `en-US;q=0.2,zh-CN;q=0.9`    | `zh-CN`，按权重选择       |
| `fr-FR,en-US;q=0.8`          | `en-US`，跳过不支持的语言 |
| 未传、只有不支持的语言或 `*` | 默认 `zh-CN`              |

中文变体统一使用示例提供的简体中文，英文变体统一使用美式英文；`q=0` 的候选语言会跳过。匹配失败时使用应用默认中文。core 本身不解析请求头，语言协商由 Hono 和应用配置处理。

响应包含 `Content-Language` 和 `Vary: Accept-Language`，标明实际语言以及缓存的语言维度。返回 JSON 的 `locale` 也可用于前端确认结果。

## 准备全局和局部词条 {#catalogs}

语言包采用与前端相同的扁平 JSON：

```text
src/locales/
  global/
    zh-CN.json
    en-US.json
  project/
    zh-CN.json
    en-US.json
```

全局英文词条：

<<< ../../playground/hono/src/locales/global/en-US.json

项目英文词条：

<<< ../../playground/hono/src/locales/project/en-US.json

两套词条都包含 `你好，{name}！`，对应各自的文案。局部词条独立查找，缺少 key 时返回原始 key；要使用全局词条时显式读取全局容器。

容器工厂在模块加载时导入两种语言，按请求使用匹配的词条创建容器：

<<< ../../playground/hono/src/i18n/index.ts

这里的 `createI18n({ locale, message })` 同步完成初始化，每次请求都得到独立的状态容器。本例的两种语言已导入内存，请求处理中无需切换语言或重新读文件。应用自己的代码应把共享词条作为只读数据使用。

## 全局写法：请求中间件 {#global}

中间件先识别语言，再为当前请求创建 `globalI18n`，设置响应头：

<<< ../../playground/hono/src/middleware/i18n.ts

在应用入口注册中间件后，所有后续接口都可以通过 `c.get("globalI18n")` 翻译：

```ts
import { Hono } from "hono";
import { detectLanguage, requestI18n } from "./middleware/i18n";
import type { AppEnv } from "./middleware/i18n";

const app = new Hono<AppEnv>();
app.use("*", detectLanguage, requestI18n);

app.get("/api/greeting", (c) => {
  const { tr } = c.get("globalI18n").getState();
  return c.json({
    code: "OK",
    locale: c.get("locale"),
    message: tr("你好，{name}！", { name: c.req.query("name") || "Bubbles" }),
  });
});

export default app;
```

示例完整的 `src/app.ts` 还注册了 CORS、项目路由、404 和异常处理。英文请求访问不存在的接口，会得到状态码 `404` 和 `{ "code": "NOT_FOUND", "locale": "en-US", "message": "Endpoint not found" }`。业务逻辑判断使用稳定的 `code`，展示使用翻译后的 `message`。

## 局部写法：项目路由 {#local}

项目路由继承当前请求的语言，创建独立的项目容器。外层响应使用全局词条，项目数据使用局部词条：

<<< ../../playground/hono/src/routes/projects.ts

在应用入口挂载 `app.route("/api/projects", projects)`。后端通过 Hono Context 和普通函数传递容器，无需前端的 `I18nProvider` 或 `useI18n()`。

本例全局与项目使用相同的请求语言，但词条和容器相互独立。业务需要独立的模块语言时，也可以向项目容器工厂显式传入另一种支持的语言。

## 前端传语言 {#frontend}

在 Vue 或 React 的业务组件中，从当前作用域的 `useI18n()` 获取 `locale`，调用接口时传给请求头。以下使用浏览器原生 `fetch` 展示请求格式：

::: code-group

```ts [Vue 组件的 setup 中]
import { useI18n } from "@bubblesjs/i18n-vue";

const { locale } = useI18n();

async function getGreeting() {
  const response = await fetch("http://localhost:5176/api/greeting?name=Bubbles", {
    headers: { "Accept-Language": locale.value ?? "zh-CN" },
  });
  return response.json();
}
```

```tsx [React 组件或自定义 Hook 中]
import { useI18n } from "@bubblesjs/i18n-react";

const { locale } = useI18n();

async function getGreeting() {
  const response = await fetch("http://localhost:5176/api/greeting?name=Bubbles", {
    headers: { "Accept-Language": locale ?? "zh-CN" },
  });
  return response.json();
}
```

:::

React 中应把上面的代码放进函数组件或自定义 Hook。语言切换后重新调用接口，后端返回新语言的译文；已经取得的响应字符串需要重新请求才会改变。项目组件读取局部 Provider 的语言，就可以传局部 `locale`。

示例 CORS 允许 `http://localhost:5173` 和 `http://localhost:5175`，并暴露 `Content-Language` 响应头。换成自己的前端地址时，同步调整 `src/app.ts` 的 CORS 配置。

## 验证接口与请求隔离 {#verification}

服务启动后，可用 `curl` 调用；Windows PowerShell 使用 `curl.exe`：

```sh
# 未传语言，默认中文
curl "http://localhost:5176/api/greeting?name=Bubbles"

# 英文全局词条
curl -H "Accept-Language: en-US" "http://localhost:5176/api/greeting?name=Bubbles"

# 英文全局响应 + 局部项目词条
curl -H "Accept-Language: en-US" "http://localhost:5176/api/projects/demo?name=Bubbles"

# 按权重选择中文
curl -H "Accept-Language: en-US;q=0.2,zh-CN;q=0.9" "http://localhost:5176/api/greeting"
```

英文项目接口返回：

```json
{
  "code": "OK",
  "locale": "en-US",
  "message": "Request succeeded",
  "data": {
    "id": "demo",
    "title": "Project workspace",
    "greeting": "Welcome to the project, Bubbles!"
  }
}
```

`pnpm --filter playground-hono test` 覆盖默认语言、权重和语言变体匹配、全局 / 局部词条、404 / 异常响应、CORS，以及 20 个中英文请求经过异步业务后的隔离行为。

## 构建与启动 {#build}

```sh
pnpm --filter "playground-hono..." build
pnpm --filter playground-hono start
```

`vp pack` 把 `src/index.ts` 打包成 Node.js ESM 入口 `dist/index.mjs`，再由 `@hono/node-server` 启动真实 HTTP 服务。默认监听 `127.0.0.1:5176`，可通过 `HOST` 和 `PORT` 环境变量调整。开发服务与构建后的服务使用同一个 Hono 应用和词条配置。

源码位于 [Hono Playground](https://github.com/bubblesplant/i18n/tree/main/apps/playground/hono)，运行说明见 [Playground README](https://github.com/bubblesplant/i18n/blob/main/apps/playground/README.md)。
