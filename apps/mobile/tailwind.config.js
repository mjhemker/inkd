const nativewindPreset = require("nativewind/preset");
const inkdPreset = require("@inkd/config/tailwind-preset");

/** @type {import("tailwindcss").Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  presets: [nativewindPreset, inkdPreset],
  theme: {
    extend: {},
  },
  plugins: [],
};
