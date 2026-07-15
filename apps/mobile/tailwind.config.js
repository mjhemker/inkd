const nativewindPreset = require("nativewind/preset");
const inkdPreset = require("@inkd/config/tailwind-preset");

/** @type {import("tailwindcss").Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    // Component library source consumed via @inkd/ui/native.
    "../../packages/ui/src/native/**/*.{ts,tsx}",
  ],
  presets: [nativewindPreset, inkdPreset],
  theme: {
    extend: {
      // React Native registers each weight as its own family (see app/_layout.tsx),
      // so weight is expressed by choosing the family, not a numeric fontWeight.
      // Use font-sans / font-sans-semibold / font-display / font-mono in components.
      fontFamily: {
        display: ["BricolageGrotesque_700Bold"],
        "display-black": ["BricolageGrotesque_800ExtraBold"],
        sans: ["Manrope_400Regular"],
        "sans-medium": ["Manrope_500Medium"],
        "sans-semibold": ["Manrope_600SemiBold"],
        "sans-bold": ["Manrope_700Bold"],
        mono: ["JetBrainsMono_400Regular"],
        "mono-medium": ["JetBrainsMono_500Medium"],
      },
    },
  },
  plugins: [],
};
