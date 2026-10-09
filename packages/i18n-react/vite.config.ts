import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.tsx"],
    format: ["esm", "cjs"],
    dts: { generator: "tsc" },
    platform: "neutral",
    target: "es2022",
    sourcemap: true,
    outputOptions: { exports: "named" },
    deps: {
      neverBundle: ["react", /^react\//, "@bubblesjs/i18n-core"],
    },
  },
  test: {
    include: ["tests/**/*.test.tsx"],
    environment: "jsdom",
    alias: {
      "@bubblesjs/i18n-core": fileURLToPath(new URL("../i18n-core/src/index.ts", import.meta.url)),
    },
  },
  run: {
    tasks: {
      bundle: { command: "vp pack", cache: { env: ["NODE_ENV"] } },
    },
  },
});
