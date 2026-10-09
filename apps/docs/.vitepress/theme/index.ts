import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import BubblesLayout from "./components/BubblesLayout.vue";
import BubblesHome from "./components/BubblesHome.vue";
import "./custom.css";
import "./docs.css";
import "./home.css";

export default {
  extends: DefaultTheme,
  Layout: BubblesLayout,
  enhanceApp({ app }) {
    app.component("BubblesHome", BubblesHome);
  },
} satisfies Theme;
