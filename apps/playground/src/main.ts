import { createApp } from "vue";

import App from "./App.vue";
import { globalStore, projectStore } from "./i18n";
import "./style.css";

// 默认词条已静态导入，容器同步创建；其他语言在切换时才加载。
createApp(App, { globalStore, projectStore }).mount("#app");
