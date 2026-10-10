import { fileURLToPath, URL } from "node:url";
import { defineConfig, postcssIsolateStyles } from "vitepress";

const basePath = (process.env.DOCS_BASE ?? "/").trim().replace(/^\/+|\/+$/g, "");
const base = basePath ? `/${basePath}/` : "/";

export default defineConfig({
  title: "BubblesJS i18n",
  description: "了解国际化实现思路，接入 Vue 与 React，并用 CLI 扫描项目、维护 JSON 词条",
  lang: "zh-CN",
  base,
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["link", { rel: "icon", href: `${base}mark.svg`, type: "image/svg+xml" }],
    ["meta", { name: "theme-color", content: "#f6f7ff" }],
  ],
  markdown: {
    theme: { light: "github-light", dark: "github-dark" },
  },
  vite: {
    css: {
      postcss: {
        plugins: [postcssIsolateStyles({ includeFiles: [/vp-doc\.css$/] })],
      },
    },
    resolve: {
      alias: [
        {
          find: /^.*\/VPDocAsideOutline\.vue$/,
          replacement: fileURLToPath(
            new URL("./theme/components/BubblesOutline.vue", import.meta.url),
          ),
        },
      ],
    },
  },
  themeConfig: {
    logo: { src: "/mark.svg", alt: "BubblesJS i18n" },
    nav: [
      { text: "快速开始", link: "/guide/getting-started" },
      { text: "实现思路", link: "/guide/architecture" },
      { text: "核心容器", link: "/guide/core" },
      {
        text: "框架适配",
        items: [
          { text: "React", link: "/guide/react" },
          { text: "Vue", link: "/guide/vue" },
          { text: "全局与局部使用", link: "/guide/scopes" },
        ],
      },
      { text: "词条 CLI", link: "/guide/cli" },
      { text: "版本发布", link: "https://github.com/bubblesplant/i18n/releases" },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/bubblesplant/i18n" }],
    sidebar: {
      "/guide/": [
        {
          text: "使用指南",
          items: [
            { text: "快速开始", link: "/guide/getting-started" },
            { text: "实现思路", link: "/guide/architecture" },
            { text: "核心容器", link: "/guide/core" },
            { text: "React 接入与使用", link: "/guide/react" },
            { text: "Vue 接入与使用", link: "/guide/vue" },
            { text: "全局与局部使用", link: "/guide/scopes" },
            { text: "词条 CLI", link: "/guide/cli" },
          ],
        },
      ],
    },
    search: {
      provider: "local",
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: "搜索文档", buttonAriaLabel: "搜索文档" },
              modal: {
                displayDetails: "显示详细列表",
                resetButtonTitle: "清除搜索",
                backButtonTitle: "返回",
                noResultsText: "没有找到相关结果",
                footer: {
                  selectText: "选择",
                  navigateText: "切换",
                  closeText: "关闭",
                },
              },
            },
          },
        },
      },
    },
    outline: { label: "本页目录", level: [2, 3] },
    docFooter: { prev: "上一篇", next: "下一篇" },
    lastUpdated: { text: "最后更新于" },
    returnToTopLabel: "返回顶部",
    sidebarMenuLabel: "菜单",
    darkModeSwitchLabel: "主题",
    lightModeSwitchTitle: "切换到浅色模式",
    darkModeSwitchTitle: "切换到深色模式",
    skipToContentLabel: "跳转到内容",
    footer: {
      message: "BubblesJS i18n · MIT License",
    },
  },
});
