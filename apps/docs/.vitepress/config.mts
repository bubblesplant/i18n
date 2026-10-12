import { defineConfig, postcssIsolateStyles } from "vitepress";

import { guidePages, guideSidebar } from "./navigation.ts";

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
  },
  transformPageData(pageData) {
    const index = guidePages.findIndex(
      ({ link }) => `${link.slice(1)}.md` === pageData.relativePath,
    );
    if (index < 0) return;
    const previous = guidePages[index - 1];
    const next = guidePages[index + 1];
    // 章节侧栏不参与跨页翻页，沿用顶部栏目的阅读顺序。
    pageData.frontmatter.prev ??= previous ? { text: previous.text, link: previous.link } : false;
    pageData.frontmatter.next ??= next ? { text: next.text, link: next.link } : false;
  },
  themeConfig: {
    logo: { src: "/mark.svg", alt: "BubblesJS i18n" },
    nav: [
      ...guidePages.map(({ text, link }) => ({ text, link })),
      { text: "版本发布", link: "https://github.com/bubblesplant/i18n/releases" },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/bubblesplant/i18n" }],
    sidebar: guideSidebar,
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
    aside: false,
    outline: false,
    docFooter: { prev: "上一篇", next: "下一篇" },
    lastUpdated: { text: "最后更新于" },
    returnToTopLabel: "返回顶部",
    sidebarMenuLabel: "本页内容",
    navMenuLabel: "文档栏目",
    mobileMenuLabel: "文档栏目",
    extraMenuLabel: "更多栏目与设置",
    darkModeSwitchLabel: "主题",
    lightModeSwitchTitle: "切换到浅色模式",
    darkModeSwitchTitle: "切换到深色模式",
    skipToContentLabel: "跳转到内容",
    footer: {
      message: "BubblesJS i18n · MIT License",
    },
  },
});
