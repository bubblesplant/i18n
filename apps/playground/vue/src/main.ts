import { I18nProvider } from "@bubblesjs/i18n-vue";
import { createApp, h } from "vue";
import App from "./App.vue";
import { globalStore } from "./i18n";
import { setupRouter } from "./router";
import "./styles/index.scss";
import "virtual:uno.css";

// 全局写法：在入口提供 globalStore，路由和所有后代组件共享这个容器。
const app = createApp({
  render: () => h(I18nProvider, { store: globalStore }, { default: () => h(App) }),
});
setupRouter(app);
app.mount("#app");
