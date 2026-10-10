import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*.{js,jsx,ts,tsx,mjs,cjs,mts,cts,vue,json,jsonc,yaml,yml,md,css,scss}": "vp check --fix",
  },
  fmt: {
    sortPackageJson: true,
    ignorePatterns: [
      "**/dist/**",
      "**/coverage/**",
      "**/.vitepress/cache/**",
      "**/.vitepress/dist/**",
    ],
  },
  lint: {
    ignorePatterns: [
      "**/dist/**",
      "**/coverage/**",
      "**/.vitepress/cache/**",
      "**/.vitepress/dist/**",
    ],
    plugins: ["typescript", "unicorn", "oxc", "vue"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: { scripts: false, tasks: true },
    tasks: {
      quality: {
        command: ["pnpm format:check", "pnpm lint", "pnpm typecheck", "pnpm test"],
        cache: false,
      },
    },
  },
});
