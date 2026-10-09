<!-- Adapted from antv-next-pro (MIT). -->
<script setup lang="ts">
import { onContentUpdated, useData } from "vitepress";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

interface OutlineHeading {
  id: string;
  text: string;
  depth: number;
}

interface HeadingSnapshot {
  element: HTMLElement;
  id: string;
  text: string | null;
  level: number;
}

const { frontmatter, theme, lang, page } = useData();
const headings = ref<OutlineHeading[]>([]);
const activeId = ref("");
const label = computed(
  () => theme.value.outline?.label ?? (lang.value.startsWith("en") ? "On this page" : "本页目录"),
);
let elements: HTMLElement[] = [];
let headingSnapshots: HeadingSnapshot[] = [];
let positions: { id: string; top: number }[] = [];
let content: HTMLElement | null = null;
let contentRoot: Element | null = null;
let contentKey = "";
let offset = 0;
let maxScroll = 0;
let scrollFrame = 0;
let measureFrame = 0;
let mounted = false;
let tracking = false;
let trackingVersion = 0;
let media: MediaQueryList | undefined;
let resizeObserver: ResizeObserver | undefined;
let hashTarget = "";
let hashReached = false;

function headingRange(): [number, number] | null {
  const outline = frontmatter.value.outline ?? theme.value.outline;
  const level =
    outline && typeof outline === "object" && !Array.isArray(outline) ? outline.level : outline;

  if (level === false) return null;
  if (level === "deep") return [2, 6];
  if (typeof level === "number") return [level, level];
  if (Array.isArray(level) && typeof level[0] === "number" && typeof level[1] === "number") {
    return [level[0], level[1]];
  }
  return [2, 3];
}

function updateActive() {
  scrollFrame = 0;
  if (!tracking || !positions.length) {
    activeId.value = "";
    return;
  }

  // The scroll path reads only scrollY. All layout metrics are cached separately.
  const scrollY = window.scrollY;
  const target = hashTarget && positions.find((heading) => heading.id === hashTarget);
  if (target) {
    const targetY = Math.max(0, Math.min(target.top - offset, maxScroll));
    if (Math.abs(scrollY - targetY) <= 2) {
      hashReached = true;
      activeId.value = target.id;
      return;
    }
    if (hashReached) hashTarget = "";
  }

  let low = 0;
  let high = positions.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    const heading = positions[middle];
    if (heading && heading.top <= scrollY + offset + 1) low = middle + 1;
    else high = middle;
  }
  const index =
    maxScroll > 2 && scrollY >= maxScroll - 2 ? positions.length - 1 : Math.max(0, low - 1);
  activeId.value = positions[index]?.id ?? "";
}

function scheduleUpdate() {
  if (tracking && !measureFrame && !scrollFrame) {
    scrollFrame = window.requestAnimationFrame(updateActive);
  }
}

function measure() {
  measureFrame = 0;
  const firstHeading = elements[0];
  if (!tracking || !firstHeading) return;

  // Batch all layout reads before updating reactive state.
  const scrollY = window.scrollY;
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const nextOffset =
    Number.parseFloat(getComputedStyle(firstHeading).scrollMarginTop) ||
    (Number.parseFloat(styles.getPropertyValue("--vp-nav-height")) || 0) +
      (Number.parseFloat(styles.getPropertyValue("--vp-layout-top-height")) || 0) +
      24;
  const nextMaxScroll = Math.max(0, root.scrollHeight - window.innerHeight);
  const nextPositions = elements
    .map((element) => ({ id: element.id, top: element.getBoundingClientRect().top + scrollY }))
    .sort((a, b) => a.top - b.top);

  offset = nextOffset;
  maxScroll = nextMaxScroll;
  positions = nextPositions;
  updateActive();
}

function scheduleMeasure() {
  if (!tracking || !elements.length || measureFrame) return;
  window.cancelAnimationFrame(scrollFrame);
  scrollFrame = 0;
  measureFrame = window.requestAnimationFrame(measure);
}

function readHash() {
  try {
    hashTarget = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    hashTarget = "";
  }
  hashReached = false;
  scheduleUpdate();
}

function selectHeading(id: string, event: MouseEvent) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return;
  // Clicking the current hash again does not emit hashchange in VitePress.
  hashTarget = id;
  hashReached = false;
  scheduleUpdate();
}

function observeLayout() {
  resizeObserver?.disconnect();
  const sizes = new WeakMap<Element, { width: number; height: number }>();
  resizeObserver = new ResizeObserver((entries) => {
    let changed = false;
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      const previous = sizes.get(entry.target);
      if (previous && (previous.width !== width || previous.height !== height)) changed = true;
      sizes.set(entry.target, { width, height });
    }
    // Initial observations share the explicit first measurement; unchanged boxes do no work.
    if (changed) scheduleMeasure();
  });
  for (const element of [
    content,
    content?.closest(".VPDoc"),
    document.documentElement,
    document.querySelector(".VPNav"),
  ]) {
    if (element) resizeObserver.observe(element);
  }
}

function collectHeadings() {
  if (!tracking) return;
  const range = headingRange();
  const nextContent = document.querySelector<HTMLElement>(".VPDoc .vp-doc");
  const nextRoot = nextContent?.firstElementChild ?? null;
  const nextKey = `${page.value.relativePath}:${range?.join(",") ?? "off"}`;
  // DOM identity and text reads detect in-place HMR without forcing layout.
  const nextSnapshots: HeadingSnapshot[] =
    range && nextContent
      ? Array.from(
          nextContent.querySelectorAll<HTMLElement>("h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]"),
        )
          .map((element) => ({
            element,
            id: element.id,
            text: element.textContent,
            level: Number(element.tagName.slice(1)),
          }))
          .filter(({ level }) => level >= range[0] && level <= range[1])
      : [];
  const unchanged =
    headingSnapshots.length === nextSnapshots.length &&
    nextSnapshots.every((next, index) => {
      const previous = headingSnapshots[index];
      return (
        previous !== undefined &&
        previous.element === next.element &&
        previous.id === next.id &&
        previous.text === next.text &&
        previous.level === next.level
      );
    });
  if (content === nextContent && contentRoot === nextRoot && contentKey === nextKey && unchanged) {
    // Hash-only navigation can also invoke onContentUpdated; reuse its layout cache.
    readHash();
    return;
  }

  content?.removeEventListener("load", scheduleMeasure, true);
  content = nextContent;
  contentRoot = nextRoot;
  contentKey = nextKey;
  positions = [];
  headingSnapshots = nextSnapshots;
  elements = nextSnapshots.map(({ element }) => element);
  headings.value = elements.map((heading) => {
    const copy = heading.cloneNode(true) as HTMLElement;
    copy.querySelectorAll(".header-anchor, .VPBadge").forEach((node) => node.remove());
    return {
      id: heading.id,
      text: copy.textContent?.trim() || heading.id,
      depth: Number(heading.tagName.slice(1)) - (range?.[0] ?? 2),
    };
  });
  content?.addEventListener("load", scheduleMeasure, true);
  observeLayout();
  readHash();
  scheduleMeasure();
}

onContentUpdated(collectHeadings);

function stopTracking() {
  tracking = false;
  trackingVersion++;
  window.removeEventListener("scroll", scheduleUpdate);
  window.removeEventListener("resize", scheduleMeasure);
  window.removeEventListener("hashchange", readHash);
  document.fonts.removeEventListener("loadingdone", scheduleMeasure);
  content?.removeEventListener("load", scheduleMeasure, true);
  resizeObserver?.disconnect();
  resizeObserver = undefined;
  window.cancelAnimationFrame(scrollFrame);
  window.cancelAnimationFrame(measureFrame);
  scrollFrame = measureFrame = 0;
  content = null;
  contentRoot = null;
  contentKey = "";
  elements = [];
  headingSnapshots = [];
  positions = [];
  headings.value = [];
  activeId.value = "";
}

function syncTracking() {
  if (!mounted || tracking === media?.matches) return;
  if (!media?.matches) {
    stopTracking();
    return;
  }

  tracking = true;
  const version = ++trackingVersion;
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleMeasure, { passive: true });
  window.addEventListener("hashchange", readHash);
  document.fonts.addEventListener("loadingdone", scheduleMeasure);
  if (document.fonts.status === "loading") {
    void document.fonts.ready.then(() => {
      if (tracking && trackingVersion === version) scheduleMeasure();
    });
  }
  collectHeadings();
}

onMounted(() => {
  mounted = true;
  media = window.matchMedia("(min-width: 1180px)");
  media.addEventListener("change", syncTracking);
  syncTracking();
});

onBeforeUnmount(() => {
  mounted = false;
  media?.removeEventListener("change", syncTracking);
  stopTracking();
});
</script>

<template>
  <nav v-if="headings.length" class="bubbles-outline" :aria-label="label">
    <p class="outline-title">{{ label }}</p>
    <ul class="outline-list">
      <li v-for="heading in headings" :key="heading.id">
        <a
          class="outline-link"
          :class="{ 'is-active': activeId === heading.id }"
          :href="`#${encodeURIComponent(heading.id)}`"
          :aria-current="activeId === heading.id ? 'location' : undefined"
          :style="{ '--outline-depth': heading.depth }"
          :title="heading.text"
          @click="selectHeading(heading.id, $event)"
          >{{ heading.text }}</a
        >
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.outline-title {
  margin: 0 0 12px;
  color: var(--vp-c-text-1);
  font-size: 12px;
  font-weight: 650;
  line-height: 24px;
}

.outline-list {
  margin: 0;
  padding: 0;
  border-left: 1px solid var(--vp-c-divider);
  list-style: none;
}

.outline-link {
  display: block;
  overflow: hidden;
  margin-left: -1px;
  padding: 5px 0 5px calc(14px + var(--outline-depth) * 12px);
  border-left: 2px solid transparent;
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-weight: 450;
  line-height: 1.6;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.15s;
}

.outline-link:hover,
.outline-link.is-active {
  color: var(--vp-c-brand-1);
}

.outline-link.is-active {
  border-left-color: var(--vp-c-brand-1);
}

.outline-link:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .outline-link {
    transition: none;
  }
}
</style>
