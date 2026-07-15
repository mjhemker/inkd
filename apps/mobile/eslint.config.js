// Expo's flat ESLint config (RN-aware). Kept separate from the shared web/node
// base because React Native has its own globals and plugin set.
// mobile has no "type":"module", so this file is CommonJS.
const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  ...expoConfig,
  {
    ignores: ["dist/**", ".expo/**", "expo-env.d.ts"],
  },
];
