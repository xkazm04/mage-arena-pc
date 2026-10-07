import { chromium, type Page } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import type { CampView } from "@mage/core";
const evidence = process.env.W7_EVIDENCE ? "docs/waves/W7-evidence/camp" : "docs/waves/W5-evidence";
const out = `${evidence}/screens`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors: string[] = [],
  checks: string[] = [];
const base = process.env.CAMP_URL ?? "http://127.0.0.1:5173";
const state = (page: Page) =>
  page.evaluate(async () =>
    (await fetch("/api/session")).json(),
  ) as Promise<CampView>;
async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${out}/${name}.png` });
}
async function boot(page: Page) {
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/camp`);
  await page.waitForSelector('body[data-ready="true"]');
  assert.equal(await page.locator("canvas").count(), 1);
}
try {
  for (const height of [1080, 1440]) {
    const context = await browser.newContext({
      viewport: { width: height === 1080 ? 1920 : 2560, height },
    });
    const page = await context.newPage();
    await boot(page);
    assert.equal(await page.locator(".day").count(), 42);
    assert.equal(await page.locator("[data-place]").count(), 8);
    await shot(page, `${height}-day-map`);
    await page.locator('[data-place="yard"]').click();
    await page.locator("[data-visit]").click();
    await page.waitForSelector('[data-action="0"]');
    assert.equal((await state(page)).location, "yard");
    assert.equal((await state(page)).hoursRemaining, 14);
    await shot(page, `${height}-yard-visit`);
    await page.locator('[data-action="0"]').click();
    await page.waitForFunction(
      () => document.querySelector(".slots .current")?.textContent === "Dusk",
    );
    assert.equal((await state(page)).player.points.vigor, 3);
    await shot(page, `${height}-dusk-map`);
    await page.locator('[data-command="wait"]').click();
    await page.waitForFunction(
      () => document.querySelector(".slots .current")?.textContent === "Night",
    );
    await shot(page, `${height}-night-map`);
    await page.locator('[data-place="tent"]').click();
    await page.locator("[data-visit]").click();
    await page.waitForSelector('[data-command="listen"]');
    await page.locator('[data-command="listen"]').click();
    await page.waitForSelector(".listen-hold");
    await page.keyboard.press("Digit2");
    await page.keyboard.down("Space");
    await page.waitForTimeout(1300);
    await page.keyboard.up("Space");
    await shot(page, `${height}-listening`);
    // Browser reload reattaches to server-owned progress and day; it does not restart inference.
    const prior = await state(page);
    await page.reload();
    await page.waitForSelector('body[data-ready="true"]');
    assert.equal((await state(page)).day.day, prior.day.day);
    assert.ok((await state(page)).listening!.tick >= prior.listening!.tick);
    if (height === 1080) {
      const deadline = Date.now() + 55000;
      while (!(await state(page)).nightFinished && Date.now() < deadline) {
        const n = (await state(page)).listening!;
        await page.keyboard.press(`Digit${n.beacon + 1}`);
        if (n.beacon !== n.patrol || n.warning)
          await page.keyboard.down("Space");
        else await page.keyboard.up("Space");
        await page.waitForTimeout(200);
      }
      await page.keyboard.up("Space");
      assert.equal((await state(page)).nightFinished, true);
      assert.equal((await state(page)).listening!.learned, "K-nysa-bread");
      await page.locator('[data-command="dawn"]').click();
      await page.waitForFunction(() =>
        document.querySelector(".eyebrow")?.textContent?.includes("DAY 2"),
      );
      assert.equal((await state(page)).day.day, 2);
      await shot(page, `${height}-hollow-board`);
      await page.locator('[data-scene="journal"]').click();
      await shot(page, `${height}-journal`);
      assert.ok(
        await page
          .locator(".side")
          .innerText()
          .then((text) => text.includes("southern tent")),
      );
      await page.setViewportSize({ width: 2560, height: 1440 });
      await page.locator('[data-scene="board"]').click();
      await shot(page, "1440-hollow-board");
      checks.push(
        "real-time listening reward, refresh continuity, single dawn, board and journal at both resolutions",
      );
    }
    checks.push(
      `${height}: calendar, eight nodes, travel, training, dusk, night, listening input`,
    );
    await context.close();
  }
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  await page.route("**/assets/accepted/**", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await boot(page);
  await shot(page, "1080-placeholder-fallback");
  await page.locator('[data-place="exchange"]').click();
  await page.locator("[data-visit]").click();
  await page.waitForSelector('[data-action="0"]');
  assert.equal((await state(page)).location, "exchange");
  checks.push("missing manifest uses playable placeholders");
  await context.close();
  assert.deepEqual(errors, []);
  writeFileSync(
    `${evidence}/browser.json`,
    JSON.stringify(
      {
        label: "measured",
        checks,
        pageErrors: errors,
        resolutions: [
          [1920, 1080],
          [2560, 1440],
        ],
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ passed: true, checks, errors }));
} finally {
  await browser.close();
}
