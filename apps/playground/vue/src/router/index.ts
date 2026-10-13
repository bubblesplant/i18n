import type { App } from "vue";
import { createRouter, createWebHistory } from "vue-router";

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", redirect: "/home" },
    { path: "/home", component: () => import("@/views/home/index.vue") },
  ],
});

export function setupRouter(app: App) {
  app.use(router);
}
