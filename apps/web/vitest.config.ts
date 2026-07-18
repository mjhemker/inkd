import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Light component-test setup (jsdom). Scoped to *.test.tsx so it never touches
// the Next build. Used for the Ask-a-Question modal focus regression test and
// the Daily Drop reveal link-death regression test.
export default defineConfig({
  plugins: [react()],
  // Mirror the Next.js "@/*" -> "src/*" path alias so component tests can import
  // real app components (which import via "@/...") rather than stubbing them.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    // Scoped to *.test.tsx (jsdom component tests) only. Pure *.test.ts files
    // (e.g. discover/mapStyle) use Node's built-in runner via `node --test` and
    // must not be picked up here.
    include: ["src/**/*.test.tsx"],
  },
});
