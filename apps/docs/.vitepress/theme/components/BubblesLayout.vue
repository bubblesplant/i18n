<!-- Adapted from antv-next-pro (MIT). -->
<script setup lang="ts">
import { useData, withBase } from "vitepress";
import { useSidebarControl } from "vitepress/dist/client/theme-default/composables/sidebar.js";
import DefaultTheme from "vitepress/theme";
import { computed } from "vue";

const { frontmatter, page } = useData();
const isHome = computed(() => frontmatter.value.layout === "home");
const isGuide = computed(() => page.value.relativePath.startsWith("guide/"));
const { isOpen: isSidebarOpen, close: closeSidebar } = useSidebarControl();

function closeChapterMenu(event: MouseEvent) {
  if (
    !isSidebarOpen.value ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  const link =
    event.target instanceof Element
      ? event.target.closest<HTMLAnchorElement>(".VPSidebar a[href]")
      : null;
  if (!link || link.target === "_blank") return;
  const target = new URL(link.href);
  // 默认主题只在切页时关闭抽屉，同页章节也应在跳转前关闭。
  if (target.origin === location.origin && target.pathname === location.pathname && target.hash) {
    closeSidebar();
  }
}
</script>

<template>
  <DefaultTheme.Layout :class="{ 'bubbles-docs': !isHome }" @click.capture="closeChapterMenu">
    <template #layout-top>
      <div v-if="isHome" class="bubble-announcement">
        <a class="bubble-announcement-main" :href="withBase('/guide/getting-started')">
          <img :src="withBase('/mark.svg')" alt="" width="20" height="20" />
          <span>BubblesJS i18n · 从核心容器到 React 与 Vue 组件翻译</span>
          <span aria-hidden="true">→</span>
        </a>
        <a class="bubble-announcement-cli" :href="withBase('/guide/cli')">命令行工具 ↗</a>
      </div>
    </template>
    <template #nav-bar-title-after>
      <span v-if="!isHome" class="bubbles-docs-label">文档</span>
    </template>
    <template #doc-before>
      <nav v-if="isGuide" class="bubbles-breadcrumb" aria-label="面包屑导航">
        <a :href="withBase('/')">
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M10 5.2C8.3 3.8 5.7 3.4 2.8 4.1v11.4c2.9-.7 5.5-.3 7.2 1.1m0-11.4c1.7-1.4 4.3-1.8 7.2-1.1v11.4c-2.9-.7-5.5-.3-7.2 1.1m0-11.4v11.4"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linejoin="round"
            />
          </svg>
          文档
        </a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{{ page.title }}</span>
      </nav>
    </template>
  </DefaultTheme.Layout>
</template>
