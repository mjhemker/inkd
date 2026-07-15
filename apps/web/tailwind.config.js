const preset = require("@inkd/config/tailwind-preset");
const tokens = require("@inkd/ui/tokens");

/** @type {import("tailwindcss").Config} */
module.exports = {
  presets: [preset],
  content: [
    "./src/app/**/*.{ts,tsx,mdx}",
    "./src/components/**/*.{ts,tsx,mdx}",
    "./src/**/*.{ts,tsx,mdx}",
    // Component library source consumed via @inkd/ui/web.
    "../../packages/ui/src/web/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // Put the next/font-loaded faces in front of the token fallback stacks.
      fontFamily: {
        display: ["var(--font-display)", ...tokens.fontFamily.display],
        sans: ["var(--font-sans)", ...tokens.fontFamily.sans],
        mono: ["var(--font-mono)", ...tokens.fontFamily.mono],
      },
    },
  },
  plugins: [],
};
