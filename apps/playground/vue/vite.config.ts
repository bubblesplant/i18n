import path from "node:path";
import { AntdvNextResolver } from "@antdv-next/auto-import-resolver";
import vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { defineConfig } from "vite-plus";

// 来自 template-vue-vp-eslint，保留 Vue、Antdv Next、UnoCSS 和自动导入。
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
  plugins: [
    vue(),
    AutoImport({ imports: ["vue", "vue-router"], dts: "src/types/auto-imports.d.ts" }),
    Components({ resolvers: [AntdvNextResolver()], dts: "src/types/components.d.ts" }),
    UnoCSS(),
  ],
});
