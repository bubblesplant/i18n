import { I18nProvider } from "@bubblesjs/i18n-react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { globalStore } from "./i18n";
import "./styles/index.css";

// 全局写法：在入口提供 globalStore，路由和所有后代组件共享这个容器。
createRoot(document.getElementById("root")!).render(
  <I18nProvider store={globalStore}>
    <App />
  </I18nProvider>,
);
