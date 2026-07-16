// Standalone flat config — @inkd/ui is a leaf package and does not depend on
// @inkd/config (which itself depends on @inkd/ui for tokens). Lints the plain-JS
// token files plus the React (web) and React Native (native) component source.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactPlugin from "eslint-plugin-react";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "dist/**", "**/*.d.ts"],
  },
  js.configs.recommended,
  // Plain-JS token / entry files (CommonJS).
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
  // TypeScript / TSX component source (web + native).
  ...tseslint.configs.recommended.map((cfg) => ({
    ...cfg,
    files: ["src/**/*.{ts,tsx}"],
  })),
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks, react: reactPlugin },
    settings: { react: { version: "detect" } },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react/no-unstable-nested-components": ["error", { allowAsProps: true }],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
