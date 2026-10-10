<script setup lang="ts">
import type { Root } from "react-dom/client";
import type { ExampleProps } from "./types";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { ReactExample } from "./ReactExample";

const props = defineProps<ExampleProps>();
const host = ref<HTMLDivElement | null>(null);
let reactRoot: Root | undefined;

onMounted(() => {
  reactRoot = createRoot(host.value!);
  reactRoot.render(
    createElement(ReactExample, {
      globalStore: props.globalStore,
      projectStore: props.projectStore,
    }),
  );
});

onBeforeUnmount(() => {
  reactRoot?.unmount();
  reactRoot = undefined;
});
</script>

<template>
  <div ref="host"></div>
</template>
