import { chromium } from "playwright";

const OUT = "/home/claude/inkd/review/round4-search";
const BASE = "http://localhost:3123";

const shots = [
  { path: "/dev/search-preview", file: "01-search-overlay-desktop.png", w: 1280, h: 900, wait: 1200 },
  { path: "/dev/feed-filter-preview", file: "02-feed-filter-panel-desktop.png", w: 1280, h: 980, wait: 700 },
  { path: "/dev/feed-preview", file: "03-feed-with-filters.png", w: 1280, h: 1000, wait: 1400 },
  { path: "/dev/search-preview", file: "04-search-overlay-mobile.png", w: 402, h: 850, wait: 1200 },
  { path: "/dev/feed-filter-preview", file: "05-feed-filter-panel-mobile.png", w: 402, h: 900, wait: 700 },
];

const browser = await chromium.launch();
for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 2 });
  await page.goto(`${BASE}${s.path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(s.wait);
  await page.screenshot({ path: `${OUT}/${s.file}` });
  console.log("captured", s.file);
  await page.close();
}
await browser.close();
console.log("done");
