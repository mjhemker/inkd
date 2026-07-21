/** Zine AI-staff + dashboard review screenshots — both themes, real harness. */
import { chromium } from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";

const OUT = "/home/claude/inkd/review/zine-aistaff";
const BASE = "http://localhost:3123";
const PATH = "/dev/ai-staff-preview";

const browser = await chromium.launch();

for (const theme of ["dark", "light"]) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1400 },
    deviceScaleFactor: 2,
  });
  await ctx.addInitScript((t) => localStorage.setItem("inkd-theme", t), theme);
  const page = await ctx.newPage();
  await page.goto(`${BASE}${PATH}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);

  // 1 — Dashboard with the violet approvals hero banner + flat stats.
  const dash = page.locator('[data-testid="dashboard-preview"]');
  await dash.scrollIntoViewIfNeeded();
  await dash.screenshot({ path: `${OUT}/dashboard-banner.${theme}.png` });
  console.log("captured", `dashboard-banner.${theme}.png`);

  const view = page.locator('[data-testid="ai-staff-view"]');

  // 2 — Approvals: hero on top card, tier-3 handoff card, expanded sources.
  await view.scrollIntoViewIfNeeded();
  const allBtn = page
    .locator('[data-testid="approval-card"]')
    .first()
    .getByRole("button", { name: /^All / });
  if (await allBtn.count()) {
    await allBtn.first().click();
    await page.waitForTimeout(300);
  }
  await view.screenshot({ path: `${OUT}/approvals.${theme}.png` });
  console.log("captured", `approvals.${theme}.png`);

  // 3 — Activity (condensed rows).
  await page.getByRole("tab", { name: "Activity" }).click();
  await page.waitForTimeout(400);
  await view.scrollIntoViewIfNeeded();
  await view.screenshot({ path: `${OUT}/activity.${theme}.png` });
  console.log("captured", `activity.${theme}.png`);

  // 4 — Playbook (hero + Add entry, flat entry cards).
  await page.getByRole("tab", { name: "Playbook" }).click();
  await page.waitForTimeout(400);
  await view.scrollIntoViewIfNeeded();
  await view.screenshot({ path: `${OUT}/playbook.${theme}.png` });
  console.log("captured", `playbook.${theme}.png`);

  await ctx.close();
}

await browser.close();
console.log("done");
