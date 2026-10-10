<script setup lang="ts">
import type { ExampleProps } from "./types";
import { I18nProvider } from "@bubblesjs/i18n-vue";
import VueGlobalPanel from "./VueGlobalPanel.vue";

defineProps<ExampleProps>();
</script>

<template>
  <I18nProvider :store="globalStore">
    <VueGlobalPanel :project-store="projectStore" />
  </I18nProvider>
</template>
