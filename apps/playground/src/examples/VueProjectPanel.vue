<script setup lang="ts">
import { useI18n } from "@bubblesjs/i18n-vue";
import { ref } from "vue";

const { tr, locale, loadLocale } = useI18n();
const pending = ref(false);
const count = ref(0);

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
  <section class="project-scope" aria-label="局部项目示例">
    <header class="project-header">
      <div>
        <p class="scope-label">局部项目</p>
        <h3>{{ tr("项目工作区") }}</h3>
      </div>
      <div class="language-switch" role="group" aria-label="项目语言" :aria-busy="pending">
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

    <div class="project-content">
      <p class="welcome-text">{{ tr("欢迎，{name}！", { name: "Alex" }) }}</p>
      <p class="muted-copy">{{ tr("这里的内容使用项目自己的语言。") }}</p>
      <p class="muted-copy">
        {{ tr("当前语言") }}：<span class="locale-value">{{ locale }}</span>
      </p>
      <div class="task-row">
        <span>{{ tr("进行中的任务") }}</span>
        <span class="task-status">{{ tr("待审核") }}</span>
      </div>
      <button class="task-button" type="button" @click="count += 1">{{ tr("创建任务") }}</button>
      <p class="action-message" aria-live="polite">
        {{ tr("已创建 {count} 个任务", { count }) }}
      </p>
    </div>
  </section>
</template>
