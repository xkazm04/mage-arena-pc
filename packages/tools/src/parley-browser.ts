import { chromium, type Page } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { CampService } from "@mage/director";
type View = ReturnType<CampService["view"]>;
const out = "docs/waves/W6-evidence/screens";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const base = process.env.CAMP_URL ?? "http://127.0.0.1:5174";
const errors: string[] = [],
  checks: string[] = [];
const view = (page: Page) =>
  page.evaluate(async () =>
    (await fetch("/api/session")).json(),
  ) as Promise<View>;
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${out}/${name}.png` });
const ledgerCount = () => {
  try {
    return (
      JSON.parse(
        readFileSync(".director-runtime/camp-ledger.json", "utf8"),
      ) as { reservations: unknown[] }
    ).reservations.length;
  } catch {
    return 0;
  }
};
const beforeCalls = ledgerCount();
try {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForSelector('body[data-ready="true"]');
  assert.equal(
    (await view(page)).parley.canType,
    true,
    "Run this gate against a local-mode server",
  );
  await page.locator("[data-visit]").click();
  assert.equal(await page.locator("[data-parley-target]").count(), 0);
  assert.equal(await page.locator("textarea").count(), 0);
  await page.locator('[data-command="wait"]').click();
  await page.waitForFunction(
    () => document.querySelector(".slots .current")?.textContent === "Dusk",
  );
  await page.locator('[data-command="wait"]').click();
  await page.waitForFunction(
    () => document.querySelector(".slots .current")?.textContent === "Night",
  );
  await page.locator("[data-visit]").click();
  await page.locator('[data-command="listen"]').click();
  await page.waitForSelector(".listen-hold");
  const deadline = Date.now() + 60000;
  while (!(await view(page)).nightFinished && Date.now() < deadline) {
    const n = (await view(page)).listening!;
    await page.keyboard.press(`Digit${n.beacon + 1}`);
    if (n.beacon !== n.patrol || n.warning) await page.keyboard.down("Space");
    else await page.keyboard.up("Space");
    await page.waitForTimeout(180);
  }
  await page.keyboard.up("Space");
  assert.equal((await view(page)).listening!.learned, "K-nysa-bread");
  await page.locator('[data-command="dawn"]').click();
  await page.waitForFunction(() =>
    document.querySelector(".eyebrow")?.textContent?.includes("DAY 2"),
  );
  await page.locator('[data-scene="map"]').click();
  await page.locator('[data-place="commons"]').click();
  await page.locator("[data-visit]").click();
  await page.waitForSelector('[data-parley-target="nysa"]');
  await shot(page, "1080-knowing-moment");
  await page.locator('[data-parley-target="nysa"]').click();
  const field = page.locator("#parley-text");
  await field.fill(
    "Nysa, I know you leave bread by the southern tent rope after dusk. Stand with me when the camp falls quiet.",
  );
  assert.equal(await field.getAttribute("maxlength"), "280");
  await shot(page, "1080-typed-parley");
  await page.setViewportSize({ width: 2560, height: 1440 });
  await shot(page, "1440-typed-parley");
  const callStart = ledgerCount();
  await page.locator("[data-parley-speak]").click();
  await page.waitForFunction(
    () => document.querySelector(".parley-result .reply") !== null,
  );
  const result = (await view(page)).parley.last!;
  assert.equal(result.effect, "flip_next_intent");
  assert.equal(result.usedCard, false);
  assert.equal((await view(page)).slot, "dusk");
  assert.ok(ledgerCount() - callStart <= 1);
  await shot(page, "1440-parley-reply");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await shot(page, "1080-parley-reply");
  await page.locator("[data-parley-close]").click();
  assert.equal(await page.locator("[data-parley-target]").count(), 0);
  checks.push(
    "typing absent without Knowing; real listening earns moment; typed local reply flips intended act; one slot and daily cap enforced",
  );
  await page.locator('[data-command="wait"]').click();
  await page.waitForFunction(
    () => document.querySelector(".slots .current")?.textContent === "Night",
  );
  await page.locator('[data-command="wait"]').click();
  await page.waitForSelector('[data-command="dawn"]');
  await page.locator('[data-command="dawn"]').click();
  await page.waitForFunction(() =>
    document.querySelector(".eyebrow")?.textContent?.includes("DAY 3"),
  );
  await page.locator('[data-scene="map"]').click();
  await page.locator('[data-place="commons"]').click();
  await page.locator("[data-visit]").click();
  await page.waitForSelector('[data-parley-target="nysa"]');
  await page.locator('[data-parley-target="nysa"]').click();
  const beforeCard = ledgerCount();
  await page.locator('[data-parley-card="ask"]').click();
  await page.waitForFunction(
    () => document.querySelector(".parley-result .reply") !== null,
  );
  assert.equal(ledgerCount(), beforeCard);
  assert.equal((await view(page)).parley.last!.usedCard, true);
  await shot(page, "1080-authored-card-result");
  checks.push(
    "authored card uses identical core path with zero transport calls even when local inference is available",
  );
  await context.close();
  assert.deepEqual(errors, []);
  const report = {
    label: "measured browser play with local typed reply and authored card",
    checks,
    errors,
    result,
    resolutions: [
      [1920, 1080],
      [2560, 1440],
    ],
    gameplayReservationsAdded: ledgerCount() - beforeCalls,
  };
  writeFileSync(
    "docs/waves/W6-evidence/browser.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
