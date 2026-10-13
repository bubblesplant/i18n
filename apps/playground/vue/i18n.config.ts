import { defineConfig } from "@bubblesjs/i18n-cli";

// CLI 按文件划分作用域，项目组件只写入 project 语言包。
const projectFiles = ["src/components/Project*.vue"];
const excludedFiles = [
  "src/**/*.test.*",
  "src/locales/**",
  "src/types/**",
  "src/shared/snippets.ts",
];

export default defineConfig({
  callNames: ["tr"],
  projects: {
    global: {
      include: ["src/**/*.{ts,vue}"],
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
