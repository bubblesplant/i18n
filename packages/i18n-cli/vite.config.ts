import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      index: "./src/index.ts",
      cli: "./src/cli.ts",
    },
    format: ["esm", "cjs"],
    platform: "node",
    target: "node22",
    dts: { generator: "tsc" },
    deps: { neverBundle: ["fast-glob", "exceljs"] },
    clean: true,
    treeshake: true,
    shims: true,
    sourcemap: true,
    outExtensions: ({ format }) => ({
      js: format === "cjs" ? ".cjs" : ".js",
      dts: format === "cjs" ? ".d.cts" : ".d.ts",
    }),
  },
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    environment: "node",
  },
  run: {
    tasks: {
      bundle: { command: "vp pack", cache: { env: ["NODE_ENV"] } },
    },
  },
});
