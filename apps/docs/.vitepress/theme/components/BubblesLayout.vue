<!-- Adapted from antv-next-pro (MIT). -->
<script setup lang="ts">
import { useData, withBase } from "vitepress";
import DefaultTheme from "vitepress/theme";
import { computed } from "vue";

interface SidebarItem {
  text?: string;
  link?: string;
  items?: SidebarItem[];
}

type SidebarConfig = SidebarItem[] | Record<string, SidebarItem[] | { items: SidebarItem[] }>;

const { frontmatter, page, theme } = useData();
const isHome = computed(() => frontmatter.value.layout === "home");

function normalizeLink(link: string) {
  const path = link.split(/[?#]/)[0] ?? "";
  return `/${path.replace(/^\/+/, "")}`
    .replace(/\.(?:md|html)$/, "")
    .replace(/\/index$/, "/")
    .replace(/\/$/, "");
}

const pagePath = computed(() => normalizeLink(page.value.relativePath));

function currentSidebar(): SidebarItem[] {
  const sidebar = theme.value.sidebar as SidebarConfig | undefined;
  if (Array.isArray(sidebar)) return sidebar;
  if (!sidebar || typeof sidebar !== "object") return [];
  const prefix = Object.keys(sidebar)
    .filter((key) => pagePath.value.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  const entry = prefix ? sidebar[prefix] : undefined;
  return Array.isArray(entry) ? entry : (entry?.items ?? []);
}

function includesPage(item: SidebarItem): boolean {
  return (
    (item.link !== undefined && normalizeLink(item.link) === pagePath.value) ||
    (item.items?.some(includesPage) ?? false)
  );
}

function firstLink(item: SidebarItem): string | undefined {
  if (item.link) return item.link;
  for (const child of item.items ?? []) {
    const link = firstLink(child);
    if (link) return link;
  }
  return undefined;
}

const section = computed(() => {
  const group = currentSidebar().find(includesPage);
  if (!group?.text || !group.items?.length) return undefined;
  const link = firstLink(group);
  return link ? { text: group.text, link } : undefined;
});
</script>

<template>
  <DefaultTheme.Layout :class="{ 'bubbles-docs': !isHome }">
    <template #layout-top>
      <div v-if="isHome" class="bubble-announcement">
        <a class="bubble-announcement-main" :href="withBase('/guide/getting-started')">
          <img :src="withBase('/mark.svg')" alt="" width="20" height="20" />
          <span>BubblesJS i18n · 一套词条，连接 React 与 Vue</span>
          <span aria-hidden="true">→</span>
        </a>
        <a class="bubble-announcement-cli" :href="withBase('/guide/cli')">词条 CLI ↗</a>
      </div>
    </template>
    <template #nav-bar-title-after>
      <span v-if="!isHome" class="bubbles-docs-label">文档</span>
    </template>
    <template #doc-before>
      <nav v-if="section" class="bubbles-breadcrumb" aria-label="面包屑导航">
        <a :href="withBase(section.link)">
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M10 5.2C8.3 3.8 5.7 3.4 2.8 4.1v11.4c2.9-.7 5.5-.3 7.2 1.1m0-11.4c1.7-1.4 4.3-1.8 7.2-1.1v11.4c-2.9-.7-5.5-.3-7.2 1.1m0-11.4v11.4"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linejoin="round"
            />
          </svg>
          {{ section.text }}
        </a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{{ page.title }}</span>
      </nav>
    </template>
  </DefaultTheme.Layout>
</template>
