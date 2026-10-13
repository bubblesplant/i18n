<script setup lang="ts">
import { I18nProvider } from "@bubblesjs/i18n-vue";
import { projectStore } from "@/i18n";
import ProjectPanel from "./ProjectPanel.vue";
</script>

<template>
  <!-- 局部写法：只有 ProjectPanel 及其后代读取 projectStore。 -->
  <I18nProvider :store="projectStore">
    <ProjectPanel />
  </I18nProvider>
</template>
