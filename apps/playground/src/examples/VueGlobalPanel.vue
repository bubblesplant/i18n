<script setup lang="ts">
import type { I18nStore } from "@bubblesjs/i18n-core";
import { I18nProvider, useI18n } from "@bubblesjs/i18n-vue";
import { ref } from "vue";
import VueProjectPanel from "./VueProjectPanel.vue";

defineProps<{ projectStore: I18nStore }>();

const { tr, locale, loadLocale } = useI18n();
const pending = ref(false);

async function switchLocale(nextLocale: string) {
  if (pending.value || nextLocale === locale.value) return;

  pending.value = true;
  try {
    await loadLocale(nextLocale);
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <section class="scope-demo" aria-label="全局应用示例">
    <header class="scope-heading">
      <div>
        <p class="scope-label">全局应用</p>
        <h2>{{ tr("应用概览") }}</h2>
      </div>
      <div class="language-switch" role="group" aria-label="全局语言" :aria-busy="pending">
        <button
          type="button"
          :aria-pressed="locale === 'zh-CN'"
          :disabled="pending"
          @click="switchLocale('zh-CN')"
        >
          中文
        </button>
        <button
          type="button"
          :aria-pressed="locale === 'en-US'"
          :disabled="pending"
          @click="switchLocale('en-US')"
        >
          English
        </button>
      </div>
    </header>

    <div class="preview-content">
      <p class="welcome-text">{{ tr("欢迎，{name}！", { name: "Bubbles" }) }}</p>
      <p class="muted-copy">{{ tr("这里的内容使用全局语言。") }}</p>
      <dl class="workspace-summary">
        <div class="summary-item">
          <dt>{{ tr("工作空间") }}</dt>
          <dd>{{ tr("设计团队") }}</dd>
        </div>
        <div class="summary-item">
          <dt>{{ tr("当前语言") }}</dt>
          <dd class="locale-value">{{ locale }}</dd>
        </div>
      </dl>
    </div>

    <I18nProvider :store="projectStore">
      <VueProjectPanel />
    </I18nProvider>
  </section>
</template>
