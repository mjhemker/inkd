// Expo's flat ESLint config (RN-aware). Kept separate from the shared web/node
// base because React Native has its own globals and plugin set.
// mobile has no "type":"module", so this file is CommonJS.
const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  ...expoConfig,
  {
    ignores: ["dist/**", ".expo/**", "expo-env.d.ts", "**/*.test.ts"],
  },
  {
    // Same guard as the shared web config: a component defined inside another
    // component's render body remounts every render and drops input focus per
    // keystroke. eslint-config-expo already registers the `react` plugin.
    files: ["**/*.{jsx,tsx}"],
    rules: {
      "react/no-unstable-nested-components": ["error", { allowAsProps: true }],
    },
  },
];
