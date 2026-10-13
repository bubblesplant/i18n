import { defineConfig } from "@bubblesjs/i18n-cli";

const projectFiles = ["src/routes/projects.ts"];
const excludedFiles = ["src/**/*.test.*", "src/locales/**"];

export default defineConfig({
  callNames: ["tr"],
  projects: {
    global: {
      include: ["src/**/*.ts"],
      exclude: [...excludedFiles, ...projectFiles],
      catalogs: {
        "zh-CN": "src/locales/global/zh-CN.json",
        "en-US": "src/locales/global/en-US.json",
      },
    },
    project: {
      include: projectFiles,
      exclude: excludedFiles,
      catalogs: {
        "zh-CN": "src/locales/project/zh-CN.json",
        "en-US": "src/locales/project/en-US.json",
      },
    },
  },
});
