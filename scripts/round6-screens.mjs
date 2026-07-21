/** Round-6 merged review screenshots — offline dev harnesses, both themes. */
import { chromium } from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";

const OUT = "/home/claude/inkd/review/round6-merged";
const BASE = "http://localhost:3123";

const shots = [
  // Body map v3 (front) — real BodyMap primitive in the booking harness.
  { path: "/dev/round4-booking-preview", file: "bodymap-v3", w: 1280, h: 1000, wait: 900 },
  // Star ratings — review form modal (input stars) + review card (row stars).
  { path: "/dev/reviews-preview", file: "star-ratings", w: 1280, h: 950, wait: 900 },
  // Web search expanded two-stage state with dropdown open (initialQuery seeds results).
  { path: "/dev/search-preview", file: "web-search-expanded", w: 1280, h: 900, wait: 1600 },
  // Feed filter panel with ~6 style chips + View more.
  { path: "/dev/feed-filter-preview", file: "feed-filter-view-more", w: 1280, h: 1000, wait: 900 },
];

const browser = await chromium.launch();
for (const theme of ["dark", "light"]) {
  for (const s of shots) {
    const ctx = await browser.newContext({
      viewport: { width: s.w, height: s.h },
      deviceScaleFactor: 2,
    });
    await ctx.addInitScript(
      (t) => localStorage.setItem("inkd-theme", t),
      theme,
    );
    const page = await ctx.newPage();
    await page.goto(`${BASE}${s.path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(s.wait);
    await page.screenshot({ path: `${OUT}/${s.file}.${theme}.png` });
    console.log("captured", `${s.file}.${theme}.png`);
    await ctx.close();
  }
}
await browser.close();
console.log("done");
