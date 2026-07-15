// Shared ESLint flat config base for INKD packages.
// Consumed via: import inkdBase from "@inkd/config/eslint";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import globals from "globals";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.expo/**",
      "**/.turbo/**",
      "**/*.config.js",
      "**/*.config.cjs",
      "**/*.config.mjs",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2023,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // React source (web app + shared TSX). `no-unstable-nested-components` is an
  // ERROR: a component defined inside another component's render body gets a
  // fresh identity every render, so React unmounts/remounts its subtree on each
  // keystroke — the classic "text input loses focus after every letter" bug
  // (see packages/ui Modal/Sheet focus fix). Keeping it at error level prevents
  // the whole class from returning.
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: { react: reactPlugin },
    settings: { react: { version: "detect" } },
    rules: {
      "react/no-unstable-nested-components": ["error", { allowAsProps: true }],
    },
  },
];
