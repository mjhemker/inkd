/** Instagram web-flow review screenshots — offline dev harness, both themes. */
import { chromium } from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";

const OUT = "/home/claude/inkd/review/ig-web";
const BASE = "http://localhost:3130";

const browser = await chromium.launch();

async function shot(page, file) {
  await page.screenshot({ path: `${OUT}/${file}.png` });
  console.log("captured", `${file}.png`);
}

async function newPage(theme, w, h) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
  });
  await ctx.addInitScript((t) => localStorage.setItem("inkd-theme", t), theme);
  const page = await ctx.newPage();
  return { ctx, page };
}

for (const theme of ["dark", "light"]) {
  // Settings section — four server states.
  for (const scenario of ["not-connected", "connected", "token-expired", "coming-soon"]) {
    const { ctx, page } = await newPage(theme, 900, 760);
    await page.goto(`${BASE}/dev/instagram-preview?view=settings&scenario=${scenario}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(700);
    await shot(page, `settings-${scenario}.${theme}`);
    await ctx.close();
  }

  // Picker grid — all badge states visible.
  {
    const { ctx, page } = await newPage(theme, 1160, 900);
    await page.goto(`${BASE}/dev/instagram-preview?view=picker&scenario=connected`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(900);
    await shot(page, `picker-grid.${theme}`);

    // Select all on page, then screenshot the batch bar populated.
    const selectAll = page.getByRole("button", { name: /select all on page/i });
    if (await selectAll.count()) {
      await selectAll.first().click();
      await page.waitForTimeout(400);
      await shot(page, `picker-selected.${theme}`);

      // Import → completion sheet (fake import resolves immediately).
      const importBtn = page.getByRole("button", { name: /^Import \d+ posts?$/ });
      if (await importBtn.count()) {
        await importBtn.first().click();
        await page.waitForTimeout(1200);
        await shot(page, `picker-completion.${theme}`);
      }
    }
    await ctx.close();
  }
}

await browser.close();
console.log("done");
