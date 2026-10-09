import { defineConfig } from "vitepress";

const basePath = (process.env.DOCS_BASE ?? "/").trim().replace(/^\/+|\/+$/g, "");

export default defineConfig({
  title: "BubblesJS i18n",
  description: "轻量国际化核心、React 与 Vue 适配层，以及 JSON 词条维护 CLI",
  lang: "zh-CN",
  base: basePath ? `/${basePath}/` : "/",
  cleanUrls: true,
  lastUpdated: true,
  markdown: {
    theme: { light: "github-light", dark: "github-dark" },
  },
  themeConfig: {
    nav: [
      { text: "快速开始", link: "/guide/getting-started" },
      { text: "核心容器", link: "/guide/core" },
      { text: "词条 CLI", link: "/guide/cli" },
      { text: "版本与发布", link: "/guide/release" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "使用指南",
          items: [
            { text: "快速开始", link: "/guide/getting-started" },
            { text: "核心容器", link: "/guide/core" },
            { text: "React 适配层", link: "/guide/react" },
            { text: "Vue 适配层", link: "/guide/vue" },
            { text: "词条 CLI", link: "/guide/cli" },
          ],
        },
        {
          text: "维护与发布",
          items: [
            { text: "工作区约定", link: "/guide/workspace" },
            { text: "版本与发布", link: "/guide/release" },
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
