const preset = require("@inkd/config/tailwind-preset");

/** @type {import("tailwindcss").Config} */
module.exports = {
  presets: [preset],
  content: [
    "./src/app/**/*.{ts,tsx,mdx}",
    "./src/components/**/*.{ts,tsx,mdx}",
    "./src/**/*.{ts,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
