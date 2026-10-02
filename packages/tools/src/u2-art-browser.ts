import { chromium, type Page } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import type { CanvasUI } from "../../game/src/ui/ui.ts";

type Win = Window & {
  __ui: { snapshot(): ReturnType<CanvasUI["snapshot"]> };
  __artReview: {
    portrait(id: string): void;
    place(id: string): void;
    slot(id: string): void;
    stories(): void;
    preload(): Promise<unknown>;
  };
};
const out = "docs/waves/U2-evidence";
mkdirSync(`${out}/art`, { recursive: true });
mkdirSync(`${out}/fallbacks`, { recursive: true });
const server = spawn(
  process.execPath,
  [
    "--import",
    "tsx",
    "node_modules/vite/bin/vite.js",
    "preview",
    "--config",
    "packages/game/vite.config.ts",
    "--host",
    "127.0.0.1",
    "--port",
    "4189",
    "--strictPort",
  ],
  {
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      CAMP_DIRECTOR: "offline",
      MAGE_SAVE_DIRECTORY: mkdtempSync(join(tmpdir(), "mage-u2-art-")),
    },
  },
);
const browser = await chromium.launch({ headless: true });
const errors: string[] = [],
  results: unknown[] = [];
const snap = (p: Page) =>
  p.evaluate(() => (window as unknown as Win).__ui.snapshot());
const ready = async (p: Page) => {
  await p.waitForFunction(
    () =>
      !!(window as unknown as Win).__ui?.snapshot().screen &&
      document.body.dataset.ready === "true",
  );
};
const settled = async (p: Page) => {
  await p.waitForFunction(
    () => (window as unknown as Win).__ui.snapshot().art.pending === 0,
  );
  await p.waitForTimeout(220);
};
async function click(p: Page, id: string) {
  const s = await snap(p),
    b = s.buttons.find((b) => b.id === id && !b.disabled);
  assert(b, id);
  await p.mouse.click(b.x + b.w / 2, b.y + b.h / 2);
  await p.waitForTimeout(220);
}
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:4189")).ok) break;
    } catch {
      /*starting*/
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  for (const height of [1080, 1440]) {
    const page = await browser.newPage({
      viewport: { width: (height * 16) / 9, height },
    });
    page.on("pageerror", (e) => errors.push(e.message));
    const requests: string[] = [];
    page.on("request", (r) => requests.push(new URL(r.url()).pathname));
    await page.goto("http://127.0.0.1:4189/?harness=1");
    await ready(page);
    await page.evaluate(() => (window as unknown as Win).__artReview.preload());
    const manifest = JSON.parse(
      readFileSync("assets/accepted/covenant/manifest.json", "utf8"),
    );
    for (const c of manifest.characters) {
      await page.evaluate(
        (id) => (window as unknown as Win).__artReview.portrait(id),
        c.id,
      );
      await settled(page);
      await page.screenshot({
        path: `${out}/art/${height}-expressions-${c.id}.png`,
      });
    }
    for (const p of manifest.places) {
      await page.evaluate(
        (id) => (window as unknown as Win).__artReview.place(id),
        p.id,
      );
      await settled(page);
      await page.screenshot({ path: `${out}/art/${height}-place-${p.id}.png` });
    }
    for (const slot of ["day", "dusk", "night"]) {
      await page.evaluate(
        (slot) => (window as unknown as Win).__artReview.slot(slot),
        slot,
      );
      await settled(page);
      await page.screenshot({ path: `${out}/art/${height}-map-${slot}.png` });
    }
    await page.evaluate(() => (window as unknown as Win).__artReview.stories());
    await settled(page);
    await page.screenshot({ path: `${out}/art/${height}-stories.png` });
    assert(
      !requests.some((p) =>
        /\/art\/(raw|delivery|review)|\/assets\/accepted\/camp\//.test(p),
      ),
    );
    const s = await snap(page);
    assert.deepEqual(s.art.diagnostics, []);
    assert.deepEqual(s.diagnostics, []);
    results.push({
      height,
      portraits: 112,
      backdrops: 8,
      mapSlots: 3,
      stories: 6,
      art: s.art,
      requests,
    });
    await page.close();
  }
  for (const mode of [
    "all-art-missing",
    "ui-missing",
    "ui-corrupt",
    "portrait-corrupt",
    "backdrop-missing",
    "fonts-missing",
  ]) {
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
    });
    page.on("pageerror", (e) => errors.push(`${mode}: ${e.message}`));
    await page.route("**/assets/accepted/covenant/**", async (route) => {
      const p = new URL(route.request().url()).pathname;
      const missing =
        mode === "all-art-missing" ||
        (mode === "ui-missing" && p.endsWith("/ui/kit.json")) ||
        (mode === "backdrop-missing" && p.endsWith("/backdrops/door.png")) ||
        (mode === "fonts-missing" && p.endsWith(".ttf"));
      if (missing) {
        await route.fulfill({ status: 404, body: "missing fixture" });
        return;
      }
      const corrupt =
        (mode === "ui-corrupt" && /\/ui\/atlases\/.+\.png$/.test(p)) ||
        (mode === "portrait-corrupt" &&
          p.endsWith("/portraits/cassia/neutral.png"));
      if (corrupt) {
        await route.fulfill({
          status: 200,
          contentType: "image/png",
          body: Buffer.from("corrupt fixture"),
        });
        return;
      }
      await route.continue();
    });
    await page.goto("http://127.0.0.1:4189/?harness=1");
    await ready(page);
    await settled(page);
    const initial = await snap(page);
    if (mode.startsWith("ui-") || mode === "all-art-missing")
      assert.equal(initial.kit, "procedural");
    else assert.equal(initial.kit, "/assets/accepted/covenant/ui/kit.json");
    assert(
      initial.diagnostics.length +
        initial.art.diagnostics.length +
        initial.fontDiagnostics.length >
        0,
      "Failure recorded",
    );
    await page.screenshot({ path: `${out}/fallbacks/${mode}.png` });
    await click(page, "pick-character");
    assert.equal((await snap(page)).screen, "character");
    await click(page, "choose-water");
    await page.waitForFunction(
      () => (window as unknown as Win).__ui.snapshot().screen === "camp",
    );
    await click(page, "nav-journal");
    assert.equal((await snap(page)).screen, "journal");
    await page.keyboard.press("Escape");
    await click(page, "settings");
    await click(page, "main-menu");
    await click(page, "training-arena");
    await click(page, "training-magic");
    await click(page, "composition-start");
    await page.waitForFunction(
      () => (window as unknown as Win).__ui.snapshot().screen === "arena",
    );
    await settled(page);
    await page.keyboard.down("KeyD");
    await page.mouse.down();
    await page.waitForTimeout(300);
    await page.mouse.up();
    await page.keyboard.up("KeyD");
    await page.screenshot({ path: `${out}/fallbacks/${mode}-arena.png` });
    results.push({ mode, playable: true, initial });
    await page.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    `${out}/art-browser.json`,
    JSON.stringify(
      {
        passed: true,
        command: "npx tsx packages/tools/src/u2-art-browser.ts",
        label:
          "Delivery fixtures use production art helpers; not gameplay outcomes",
        results,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, results: results.length }));
} finally {
  await browser.close();
  server.kill();
}
