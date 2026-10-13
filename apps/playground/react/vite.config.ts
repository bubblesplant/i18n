import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import AutoImport from "unplugin-auto-import/vite";
import { defineConfig } from "vite-plus";

// 来自 template-vp-react，保留 React、Tailwind 和自动导入。
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  server: { port: 5175, strictPort: true },
  preview: { port: 5175, strictPort: true },
  plugins: [
    react(),
    AutoImport({
      imports: ["react", "react-router", "react-dom"],
      dts: "src/types/auto-imports.d.ts",
    }),
    tailwindcss(),
  ],
});
