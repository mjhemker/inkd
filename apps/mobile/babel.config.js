module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      // Must be listed last. Enables react-native-reanimated / worklets.
      "react-native-worklets/plugin",
    ],
  };
};
