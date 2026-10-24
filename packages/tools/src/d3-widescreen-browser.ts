import { chromium, type Page } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { CanvasUI } from "../../game/src/ui/ui.ts";

/**
 * D3 step 3 proof: the camp screen at 1080p, 1440p and 21:9 has no letterbox bars and no text outside the viewport,
 * and a changed setting is still there after a page reload.
 */
type Win = Window & {
  __ui: { snapshot(): ReturnType<CanvasUI["snapshot"]> };
};
const port = 4210;
const base = `http://127.0.0.1:${port}`;
const out = resolve("docs/waves/D3-evidence");
mkdirSync(join(out, "screens"), { recursive: true });
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
    String(port),
    "--strictPort",
  ],
  {
    windowsHide: true,
    stdio: "pipe",
    env: {
      ...process.env,
      CAMP_DIRECTOR: "offline",
      MAGE_SAVE_DIRECTORY: mkdtempSync(join(tmpdir(), "mage-d3-")),
    },
  },
);
let serverLog = "";
server.stdout.on("data", (b) => (serverLog += String(b)));
server.stderr.on("data", (b) => (serverLog += String(b)));
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=d3d11"],
});
const errors: string[] = [],
  results: unknown[] = [];
let current: Page | undefined;
const ui = (p: Page) =>
  p.evaluate(() => (window as unknown as Win).__ui.snapshot());
async function screen(p: Page, id: string) {
  await p.waitForFunction(
    (id) => {
      const s = (window as unknown as Win).__ui?.snapshot();
      return s?.screen === id && !s.busy;
    },
    id,
    { timeout: 20000 },
  );
}
async function click(p: Page, id: string, next?: string) {
  await p.waitForFunction(
    (id) => {
      const s = (window as unknown as Win).__ui?.snapshot();
      return s && !s.busy && s.buttons.some((b) => b.id === id && !b.disabled);
    },
    id,
    { timeout: 15000 },
  );
  const b = (await ui(p)).buttons.find((b) => b.id === id)!;
  await p.mouse.click(b.x + b.w / 2, b.y + b.h / 2);
  if (next) await screen(p, next);
  else await p.waitForTimeout(250);
}
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
  await p.waitForFunction(
    () => (window as unknown as Win).__ui.snapshot().art.pending === 0,
  );
  await p.mouse.move(8, 8);
  await p.waitForTimeout(400);
}
try {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error(serverLog);
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {
      /* starting */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
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
    const outside = s.texts.filter((t) => {
      const x = s.layout.x + t.x * s.layout.scale,
        y = s.layout.y + t.y * s.layout.scale;
      return (
        x < 0 ||
        y < 0 ||
        x + t.w * s.layout.scale > width + 1 ||
        y + t.h * s.layout.scale > height + 1
      );
    });
    assert.deepEqual(outside, [], `${name}: text outside the viewport`);
    for (const b of s.buttons)
      assert(
        b.x >= 0 && b.y >= 0 && b.x + b.w <= width && b.y + b.h <= height,
        `${name}: ${b.id} outside the viewport`,
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
  await p.waitForFunction(
    () => {
      const s = (window as unknown as Win).__ui?.snapshot();
      return !!s && !s.busy && s.buttons.length > 0;
    },
    undefined,
    { timeout: 20000 },
  );
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
  writeFileSync(
    join(out, "d3-widescreen.json"),
    JSON.stringify({ results }, null, 2),
  );
  console.log(JSON.stringify({ ok: true, results }, null, 2));
} catch (error) {
  if (current) {
    await current
      .screenshot({ path: join(out, "d3-failure.png") })
      .catch(() => {});
  }
  writeFileSync(
    join(out, "d3-failure.json"),
    JSON.stringify({ error: String(error), errors, serverLog }, null, 2),
  );
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
