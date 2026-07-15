// Standalone flat config — @inkd/ui is a leaf package and does not depend on
// @inkd/config (which itself depends on @inkd/ui for tokens).
import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "dist/**", "**/*.d.ts"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,cjs}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
  },
];
