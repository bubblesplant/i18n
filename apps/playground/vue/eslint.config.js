import antfu from "@antfu/eslint-config";
import oxlint from "eslint-plugin-oxlint";

// 样式由仓库统一的 vp fmt 管理，ESLint 检查 Vue 组件规则。
export default antfu({
  vue: true,
  stylistic: false,
  ignores: ["src/types/**", "dist/**"],
  rules: {
    "jsonc/sort-keys": "off",
    "vue/html-indent": "off",
    "vue/html-self-closing": "off",
    "vue/html-closing-bracket-newline": "off",
    "vue/singleline-html-element-content-newline": "off",
  },
}).append(...oxlint.configs["flat/recommended"]);
