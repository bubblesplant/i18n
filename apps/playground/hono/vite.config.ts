import { fileURLToPath } from "node:url";
import devServer from "@hono/vite-dev-server";
import { defineConfig } from "vite-plus";

export default defineConfig({
  appType: "custom",
  server: { port: 5176, strictPort: true },
  plugins: [devServer({ entry: "src/app.ts", injectClientScript: false })],
  pack: {
    entry: { index: "src/index.ts" },
    platform: "node",
    target: "node22",
    format: ["esm"],
    dts: false,
    sourcemap: true,
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    alias: {
      "@bubblesjs/i18n-core": fileURLToPath(
        new URL("../../../packages/i18n-core/src/index.ts", import.meta.url),
      ),
    },
  },
});
