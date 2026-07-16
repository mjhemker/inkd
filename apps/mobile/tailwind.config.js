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
  // Theme flip is class-based: the ThemeProvider toggles the `dark` scheme
  // (default) so semantic CSS vars in global.css re-skin the app for light mode.
  darkMode: "class",
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
        // Hand-marked voice (Caveat) — annotations / stamps only, never body.
        hand: ["Caveat_600SemiBold"],
        "hand-bold": ["Caveat_700Bold"],
      },
    },
  },
  plugins: [],
};
