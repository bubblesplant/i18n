export const initCode = `import { createI18n } from "@bubblesjs/i18n-core";
import zhCN from "./locales/global/zh-CN.json";

export const globalStore = createI18n({
  locale: "zh-CN",
  message: zhCN,
  loaderMessage: async (locale = "zh-CN") =>
    (await import(\`./locales/global/\${locale}.json\`)).default,
});`;

export const vueGlobalCode = `// main.ts：应用入口
createApp({
  render: () => h(
    I18nProvider,
    { store: globalStore },
    { default: () => h(App) },
  ),
}).use(router).mount("#app");

// 后代组件
const { tr, locale, loadLocale } = useI18n();`;

export const vueLocalCode = `<!-- ProjectRegion.vue -->
<I18nProvider :store="projectStore">
  <ProjectPanel />
</I18nProvider>

// ProjectPanel.vue：读取最近的 Provider
const { tr, locale, loadLocale } = useI18n();
await loadLocale("en-US");`;

export const reactGlobalCode = `// main.tsx：应用入口
createRoot(document.getElementById("root")!).render(
  <I18nProvider store={globalStore}>
    <App />
  </I18nProvider>,
);

// 后代组件
const { tr, locale, loadLocale } = useI18n();`;

export const reactLocalCode = `// ProjectRegion.tsx
<I18nProvider store={projectStore}>
  <ProjectPanel />
</I18nProvider>

// ProjectPanel.tsx：读取最近的 Provider
const { tr, locale, loadLocale } = useI18n();
await loadLocale("en-US");`;
