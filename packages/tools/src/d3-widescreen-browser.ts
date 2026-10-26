import { chromium, type Page } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { startPreview, type Preview } from "./smoke/preview.ts";
import { artSettled, click, screen, ui, uiReady } from "./smoke/driver.ts";
import { outsideViewport } from "./smoke/checks.ts";
import { writePin } from "./evidence-record.ts";
import type { HarnessWindow } from "../../game/src/harness-contract.ts";

/**
 * D3 step 3 proof: the camp screen at 1080p, 1440p and 21:9 has no letterbox bars and no text outside the viewport,
 * and a changed setting is still there after a page reload.
 */
const out = resolve("docs/waves/D3-evidence");
mkdirSync(join(out, "screens"), { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=d3d11"],
});
const errors: string[] = [],
  results: unknown[] = [];
let current: Page | undefined, preview: Preview | undefined, base = "";
/** The share of pixels in a thin strip of the screenshot that are not the flat clear colour a letterbox bar would be. */
async function stripLive(p: Page, png: Buffer, side: "left" | "right") {
  return p.evaluate(
    async ({ data, side }) => {
      const bitmap = await createImageBitmap(
        await (await fetch(`data:image/png;base64,${data}`)).blob(),
      );
      const c = new OffscreenCanvas(bitmap.width, bitmap.height),
        g = c.getContext("2d")!;
      g.drawImage(bitmap, 0, 0);
      const x = side === "left" ? 0 : bitmap.width - 4,
        y = Math.floor(bitmap.height * 0.3),
        h = Math.floor(bitmap.height * 0.4);
      const px = g.getImageData(x, y, 4, h).data;
      // The renderer clears to ink (#080f16); a letterbox bar is exactly that colour.
      let live = 0;
      for (let i = 0; i < px.length; i += 4)
        if (
          Math.abs(px[i]! - 0x08) > 2 ||
          Math.abs(px[i + 1]! - 0x0f) > 2 ||
          Math.abs(px[i + 2]! - 0x16) > 2
        )
          live++;
      return live / (px.length / 4);
    },
    { data: png.toString("base64"), side },
  );
}
async function openCamp(p: Page) {
  await p.goto(`${base}/?harness=1`);
  await screen(p, "menu");
  await click(p, "pick-character", "character");
  await click(p, "choose-water", "camp");
  await artSettled(p);
  await p.mouse.move(8, 8);
  await p.waitForTimeout(400);
}
/** The arena from the training route: the bout screen with its HUD built and the art settled. */
async function openArena(p: Page) {
  await p.goto(`${base}/training?harness=1`);
  await screen(p, "training");
  await click(p, "training-magic", "composition");
  await click(p, "composition-start", "arena");
  await artSettled(p);
  await p.mouse.move(8, 8);
  await p.waitForTimeout(1200);
}
try {
  preview = await startPreview({ savePrefix: "mage-d3-" });
  base = preview.base;
  for (const [name, width, height] of [
    ["1080p", 1920, 1080],
    ["1440p", 2560, 1440],
    ["21x9", 3440, 1440],
  ] as const) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    const p = (current = await context.newPage());
    p.on("pageerror", (e) => errors.push(String(e)));
    await openCamp(p);
    const s = await ui(p);
    const png = await p.screenshot({
      path: join(out, "screens", `${name}-camp.png`),
    });
    const left = await stripLive(p, png, "left"),
      right = await stripLive(p, png, "right");
    assert(left > 0.9, `${name}: left edge is a letterbox bar (${left})`);
    assert(right > 0.9, `${name}: right edge is a letterbox bar (${right})`);
    assert.deepEqual(
      outsideViewport(s, width, height),
      [],
      `${name}: text or controls outside the viewport`,
    );
    results.push({
      name,
      width,
      height,
      scale: s.layout.scale,
      edges: s.layout.edges,
      leftLive: left,
      rightLive: right,
      texts: s.texts.length,
    });
    await context.close();
  }
  // The arena stage and its HUD: live pixels on both side strips and no HUD element outside the viewport, at each size
  // and after a window resize inside the bout.
  const arenaResults: unknown[] = [];
  for (const [name, width, height] of [
    ["1080p", 1920, 1080],
    ["1440p", 2560, 1440],
    ["21x9", 3440, 1440],
  ] as const) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    const p = (current = await context.newPage());
    p.on("pageerror", (e) => errors.push(String(e)));
    await openArena(p);
    const s = await ui(p);
    const png = await p.screenshot({
      path: join(out, "screens", `${name}-arena.png`),
    });
    const left = await stripLive(p, png, "left"),
      right = await stripLive(p, png, "right");
    assert(left > 0.9, `${name} arena: left edge is a letterbox bar (${left})`);
    assert(
      right > 0.9,
      `${name} arena: right edge is a letterbox bar (${right})`,
    );
    assert.deepEqual(
      outsideViewport(s, width, height),
      [],
      `${name} arena: HUD outside the viewport`,
    );
    arenaResults.push({
      name,
      width,
      height,
      edges: s.layout.edges,
      leftLive: left,
      rightLive: right,
      hud: s.texts.length,
    });
    if (name === "1080p") {
      // Widen the window inside the bout: the HUD must re-anchor to the new edges.
      await p.setViewportSize({ width: 3440, height: 1440 });
      await p.waitForTimeout(600);
      const w = await ui(p);
      const png2 = await p.screenshot({
        path: join(out, "screens", "1080p-to-21x9-arena.png"),
      });
      assert.deepEqual(
        outsideViewport(w, 3440, 1440),
        [],
        "resized arena: HUD outside the viewport",
      );
      assert(
        w.layout.edges.right > 2200,
        `resized arena: edges did not follow (${w.layout.edges.right})`,
      );
      const pause = w.buttons.find((b) => b.id === "pause")!;
      assert(
        Math.abs(pause.x + pause.w - (3440 - 96 * w.layout.scale)) < 2,
        "resized arena: Pause stays on the right edge",
      );
      arenaResults.push({
        name: "1080p-to-21x9",
        edges: w.layout.edges,
        leftLive: await stripLive(p, png2, "left"),
        rightLive: await stripLive(p, png2, "right"),
      });
    }
    await context.close();
  }
  results.push({ arena: arenaResults });
  // A Fire and an Air bout at 1080p (D3 4.2 follow-up): the opponent wears its Heat or Momentum meter at its feet.
  // Screenshots only (git-ignored); the pin keeps the schools and the viewport check, not the live HUD's text count.
  const schoolBouts: unknown[] = [];
  for (const school of ["fire", "air"] as const) {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });
    const p = (current = await context.newPage());
    p.on("pageerror", (e) => errors.push(String(e)));
    await p.goto(`${base}/?harness=1`);
    await screen(p, "menu");
    await click(p, "combat-feel-lab");
    await click(p, "lab-config-opponent"); // Dummy -> Mage AI
    // The opponent starts on Fire with no build; each press cycles Water, Fire, Air and loads the school's preset.
    for (let i = 0; i < (school === "fire" ? 3 : 1); i++)
      await click(p, "lab-config-school");
    for (let i = 0; i < (school === "fire" ? 1 : 2); i++)
      await click(p, "lab-config-player-school");
    await click(p, "lab-config-start");
    await p.waitForFunction(
      () => !!(window as unknown as HarnessWindow).__arena?.snapshot().lab,
    );
    await artSettled(p);
    await p.mouse.move(8, 8);
    await p.waitForTimeout(1200);
    const schools = await p.evaluate(() =>
      (window as unknown as HarnessWindow).__arena
        .snapshot()
        .state.actors.map((a) => a.schoolState?.school ?? "water"),
    );
    assert.deepEqual(schools, [school, school], `${school} bout schools`);
    const s = await ui(p);
    assert.deepEqual(
      outsideViewport(s, 1920, 1080),
      [],
      `${school} bout: HUD outside the viewport`,
    );
    await p.screenshot({
      path: join(out, "screens", `1080p-arena-${school}.png`),
    });
    schoolBouts.push({ school, player: schools[0], opponent: schools[1] });
    await context.close();
  }
  results.push({ schoolBouts });
  // A setting survives a restart (a full page reload).
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const p = (current = await context.newPage());
  p.on("pageerror", (e) => errors.push(String(e)));
  await openCamp(p);
  await p.keyboard.press("Escape");
  await screen(p, "pause");
  await click(p, "open-settings", "settings");
  await click(p, "ui-scale", "settings");
  await click(p, "motion", "settings");
  const scaled = await ui(p);
  assert(
    Math.abs(scaled.layout.scale - 1.15) < 0.001,
    `UI scale applied (${scaled.layout.scale})`,
  );
  const stored = await p.evaluate(() => ({
    settings: JSON.parse(localStorage.getItem("mage-settings") ?? "{}"),
    motion: localStorage.getItem("mage-motion"),
  }));
  assert.equal(stored.settings.uiScale, 1.15);
  assert.equal(stored.settings.reducedMotion, true);
  assert.equal(stored.motion, "reduced");
  await p.reload();
  await uiReady(p);
  const after = await p.evaluate(() => ({
    settings: JSON.parse(localStorage.getItem("mage-settings") ?? "{}"),
    motion: localStorage.getItem("mage-motion"),
  }));
  assert.deepEqual(after, stored, "Settings survive a reload");
  const reloaded = await ui(p);
  assert(
    Math.abs(reloaded.layout.scale - 1.15) < 0.001,
    `UI scale survives a reload (${reloaded.layout.scale})`,
  );
  results.push({ persisted: after, reloadedScale: reloaded.layout.scale });
  await context.close();
  assert.deepEqual(errors, [], "No page errors");
  // Two runs agree on every value (D3 8.9); writing only on a change keeps a CRLF checkout's pin untouched.
  writePin(join(out, "d3-widescreen.json"), JSON.stringify({ results }, null, 2));
  console.log(JSON.stringify({ ok: true, results }, null, 2));
} catch (error) {
  if (current) {
    await current
      .screenshot({ path: join(out, "d3-failure.png") })
      .catch(() => {});
  }
  writeFileSync(
    join(out, "d3-failure.json"),
    JSON.stringify(
      { error: String(error), errors, serverLog: preview?.log() ?? "" },
      null,
      2,
    ),
  );
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  preview?.close();
}
