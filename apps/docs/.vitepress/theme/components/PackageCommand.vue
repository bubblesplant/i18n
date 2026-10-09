<!-- Adapted from antv-next-pro. Copyright (c) 2026 bubblesplant. MIT License. -->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId } from "vue";

const panelId = `package-command-${useId()}`;
const managers = [
  {
    name: "npm",
    command: "npm install @bubblesjs/i18n-core",
    color: "#cb3837",
    mark: "n",
  },
  {
    name: "yarn",
    command: "yarn add @bubblesjs/i18n-core",
    color: "#2c8ebb",
    mark: "y",
  },
  {
    name: "pnpm",
    command: "pnpm add @bubblesjs/i18n-core",
    color: "#e7a528",
    mark: "p",
  },
  {
    name: "bun",
    command: "bun add @bubblesjs/i18n-core",
    color: "#ac8767",
    mark: "b",
  },
];
const activeIndex = ref(0);
const tabButtons = ref<HTMLButtonElement[]>([]);
const copyState = ref<"idle" | "success" | "error">("idle");
let resetTimer: ReturnType<typeof setTimeout> | undefined;
let copyRequest = 0;

const labels = { tabs: "包管理器", copy: "复制命令", success: "已复制！", error: "复制失败" };
const copyLabel = computed(() =>
  copyState.value === "idle" ? labels.copy : labels[copyState.value],
);

function selectManager(index: number) {
  activeIndex.value = index;
  copyState.value = "idle";
  copyRequest += 1;
  clearTimeout(resetTimer);
}

async function handleTabKeydown(event: KeyboardEvent, index: number) {
  let nextIndex: number;
  switch (event.key) {
    case "ArrowRight":
      nextIndex = (index + 1) % managers.length;
      break;
    case "ArrowLeft":
      nextIndex = (index + managers.length - 1) % managers.length;
      break;
    case "Home":
      nextIndex = 0;
      break;
    case "End":
      nextIndex = managers.length - 1;
      break;
    default:
      return;
  }
  event.preventDefault();
  selectManager(nextIndex);
  await nextTick();
  tabButtons.value[nextIndex]?.focus();
}

async function copyCommand(command: string) {
  const request = ++copyRequest;
  clearTimeout(resetTimer);
  try {
    await navigator.clipboard.writeText(command);
    if (request !== copyRequest) return;
    copyState.value = "success";
  } catch {
    if (request !== copyRequest) return;
    copyState.value = "error";
  }
  resetTimer = setTimeout(() => {
    copyState.value = "idle";
  }, 2500);
}

onBeforeUnmount(() => {
  copyRequest += 1;
  clearTimeout(resetTimer);
});
</script>

<template>
  <div class="package-command">
    <div class="package-command__tabs" role="tablist" :aria-label="labels.tabs">
      <button
        v-for="(manager, index) in managers"
        :id="`${panelId}-tab-${index}`"
        :key="manager.name"
        ref="tabButtons"
        class="package-command__tab"
        :class="{ 'is-active': activeIndex === index }"
        type="button"
        role="tab"
        :tabindex="activeIndex === index ? 0 : -1"
        :aria-selected="activeIndex === index"
        :aria-controls="`${panelId}-panel-${index}`"
        @click="selectManager(index)"
        @keydown="handleTabKeydown($event, index)"
      >
        <span
          class="package-command__mark"
          :style="{ '--manager-color': manager.color }"
          aria-hidden="true"
          >{{ manager.mark }}</span
        >
        {{ manager.name }}
      </button>
    </div>

    <div
      v-for="(manager, index) in managers"
      :id="`${panelId}-panel-${index}`"
      :key="manager.name"
      class="package-command__panel"
      :class="{ 'is-active': activeIndex === index }"
      role="tabpanel"
      :aria-labelledby="`${panelId}-tab-${index}`"
      :aria-hidden="activeIndex !== index"
      :inert="activeIndex !== index"
      :tabindex="activeIndex === index ? 0 : -1"
    >
      <code class="package-command__code"
        ><span>{{ manager.name }}</span
        >{{ manager.command.slice(manager.name.length) }}</code
      >
      <button
        class="package-command__copy"
        :class="{ 'is-success': copyState === 'success', 'is-error': copyState === 'error' }"
        type="button"
        :title="copyLabel"
        :aria-label="copyLabel"
        @click="copyCommand(manager.command)"
      >
        <svg v-if="copyState === 'success'" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m5 12 4 4L19 6" />
        </svg>
        <svg v-else-if="copyState === 'error'" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6m0 4h.01" />
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true">
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
        </svg>
      </button>
    </div>
    <span
      class="package-command__status"
      :class="{ 'is-visible': copyState !== 'idle' }"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      >{{ copyState === "idle" ? "" : copyLabel }}</span
    >
  </div>
</template>

<style scoped>
.package-command {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  width: 450px;
  max-width: 100%;
  overflow: visible;
  border: 1px solid var(--vp-c-divider, #dcdfe7);
  border-radius: 16px;
  background: color-mix(in srgb, var(--vp-c-bg) 78%, transparent);
  color: var(--vp-c-text-1);
  text-align: left;
  backdrop-filter: blur(14px);
}

.package-command__tabs {
  grid-area: 1 / 1;
  display: flex;
  gap: 2px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--vp-c-divider, #dcdfe7);
  border-radius: 15px 15px 0 0;
  background: color-mix(in srgb, var(--vp-c-text-1) 2%, transparent);
}

.package-command__tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 64px;
  padding: 6px 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--vp-c-text-1);
  font-size: 13px;
  line-height: 22px;
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease;
}

.package-command__tab:hover {
  background: color-mix(in srgb, var(--vp-c-bg) 66%, transparent);
}

.package-command__tab.is-active {
  border-color: var(--vp-c-divider, #dcdfe7);
  background: var(--vp-c-bg);
  box-shadow: 0 1px 2px rgb(20 30 55 / 6%);
}

.package-command__mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--manager-color);
  border-radius: 3px;
  color: var(--manager-color);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
}

.package-command__panel {
  /* 保留每条命令的布局，让切换标签只改变可见性。 */
  grid-area: 2 / 1;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 56px;
  padding: 10px 12px 10px 20px;
  border-radius: 0 0 15px 15px;
  visibility: hidden;
}

.package-command__panel.is-active {
  visibility: visible;
}

.package-command__code {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  background: transparent;
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  line-height: 24px;
  white-space: pre;
}

.package-command__code span {
  color: var(--vp-c-brand-1);
}

.package-command__copy {
  display: inline-flex;
  flex: 0 0 30px;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--vp-c-text-1);
  opacity: 0.52;
  cursor: pointer;
  transition:
    opacity 160ms ease,
    background 160ms ease;
}

.package-command__copy:hover,
.package-command__copy:focus-visible,
.package-command__copy.is-success,
.package-command__copy.is-error {
  background: color-mix(in srgb, var(--vp-c-brand-1) 8%, transparent);
  color: var(--vp-c-brand-1);
  opacity: 1;
}

.package-command__copy svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.package-command__tab:focus-visible,
.package-command__panel:focus-visible,
.package-command__copy:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.package-command__status {
  position: absolute;
  right: 10px;
  bottom: -30px;
  padding: 2px 8px;
  border: 1px solid var(--vp-c-divider, #dcdfe7);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 11px;
  line-height: 20px;
  opacity: 0;
  pointer-events: none;
}

.package-command__status.is-visible {
  opacity: 1;
}

@media (max-width: 380px) {
  .package-command__tabs {
    padding-inline: 4px;
  }

  .package-command__tab {
    flex: 1;
    min-width: 0;
    gap: 5px;
    padding-inline: 6px;
  }

  .package-command__panel {
    padding-left: 14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .package-command__tab,
  .package-command__copy {
    transition: none;
  }
}
</style>
