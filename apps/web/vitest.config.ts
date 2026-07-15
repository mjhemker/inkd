import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Light component-test setup (jsdom). Scoped to *.test.tsx so it never touches
// the Next build. Used for the Ask-a-Question modal focus regression test.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
