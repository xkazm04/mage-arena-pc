import { chromium, type Page } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { CanvasUI } from "../../game/src/ui/ui.ts";
import type { ArenaGame } from "../../game/src/arena-entry.ts";
type Win = Window & {
  __ui: {
    snapshot(): ReturnType<CanvasUI["snapshot"]>;
    performance(): { frames: number[]; cpu: number[] };
    resetPerformance(): void;
  };
  __arena: {
    snapshot(): ReturnType<ArenaGame["snapshot"]>;
    artFixture(k?: "stress"): void;
    setPalette(p: string): void;
    propFixture(front: boolean): void;
    visualFixture(k: string): void;
    panPlayer(p: { x: number; y: number }): void;
    reset(): void;
  };
};
const out = resolve("docs/waves/U5-evidence");
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
    "4195",
    "--strictPort",
  ],
  {
    windowsHide: true,
    stdio: "pipe",
    env: {
      ...process.env,
      CAMP_DIRECTOR: "offline",
      MAGE_SAVE_DIRECTORY: mkdtempSync(join(tmpdir(), "mage-u5-")),
    },
  },
);
let log = "";
server.stdout.on("data", (b) => {
  log += String(b);
});
server.stderr.on("data", (b) => {
  log += String(b);
});
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=d3d11"],
});
const errors: string[] = [],
  runs: unknown[] = [],
  screens: string[] = [];
const ui = (p: Page) =>
  p.evaluate(() => (window as unknown as Win).__ui.snapshot());
const arena = (p: Page) =>
  p.evaluate(() => (window as unknown as Win).__arena.snapshot());
async function click(p: Page, id: string) {
  const b = (await ui(p)).buttons.find((b) => b.id === id && !b.disabled);
  assert(b, id);
  await p.mouse.click(b.x + b.w / 2, b.y + b.h / 2);
  await p.waitForTimeout(250);
}
async function enter(p: Page) {
  await p.goto("http://127.0.0.1:4195/training?harness=1");
  await p.waitForFunction(
    () => (window as unknown as Win).__ui?.snapshot().screen === "training",
  );
  await click(p, "training-magic");
  await click(p, "composition-start");
  await p.waitForFunction(() =>
    ["A12", "tiled-fallback"].includes(
      (window as unknown as Win).__arena?.snapshot().groundSource,
    ),
  );
  await p.waitForTimeout(500);
}
async function shot(p: Page, name: string) {
  await p.mouse.move(10, 10);
  await p.screenshot({ path: join(out, "screens", name + ".png") });
  screens.push(name + ".png");
}
const q = (a: number[], f: number) =>
  a.toSorted((a, b) => a - b)[Math.floor(a.length * f)]!;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:4195/api/health")).ok) break;
    } catch {
      /* starting */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  for (const height of [1080, 1440]) {
    const context = await browser.newContext({
        viewport: { width: (height * 16) / 9, height },
        deviceScaleFactor: 1,
      }),
      p = await context.newPage();
    p.on("pageerror", (e) => errors.push(String(e)));
    await enter(p);
    const a = await arena(p);
    assert.equal(a.groundSource, "A12");
    assert.equal(a.cameraMetrics.figureHeightPx, (60.75 * height) / 1080);
    await p.evaluate(() =>
      (window as unknown as Win).__arena.visualFixture("scale"),
    );
    for (const palette of ["verdigris", "rust-sand", "moonlit"]) {
      await p.evaluate(
        (v) => (window as unknown as Win).__arena.setPalette(v),
        palette,
      );
      await p.waitForFunction(() => {
        const a = (window as unknown as Win).__arena.snapshot();
        return a.groundSource === "A12";
      });
      await p.waitForTimeout(350);
      await shot(p, `${height}-${palette}-scale`);
      for (const front of [false, true]) {
        await p.evaluate(
          (v) => (window as unknown as Win).__arena.propFixture(v),
          front,
        );
        await p.waitForTimeout(180);
        const s = await arena(p);
        const actor = s.depthOrder.find((x) => x.id.startsWith("actor:"))!,
          props = s.depthOrder.filter((x) => x.id.startsWith("prop:"));
        assert(props.some((o) => (front ? actor.y > o.y : actor.y < o.y)));
        await shot(p, `${height}-${palette}-${front ? "front" : "behind"}`);
      }
    }
    await p.evaluate(() => (window as unknown as Win).__arena.reset());
    const start = (await arena(p)).player.pos.x;
    await p.keyboard.down("KeyD");
    await p.waitForTimeout(450);
    await p.keyboard.up("KeyD");
    assert((await arena(p)).player.pos.x > start);
    await p.evaluate(() =>
      (window as unknown as Win).__arena.artFixture("stress"),
    );
    await p.waitForTimeout(2200);
    await p.evaluate(() => (window as unknown as Win).__ui.resetPerformance());
    await p.waitForTimeout(6500);
    const perf = await p.evaluate(() =>
        (window as unknown as Win).__ui.performance(),
      ),
      u = await ui(p),
      s = await arena(p);
    const bytes =
      u.art.rgbaBytes +
      u.uiTextureBytes +
      u.fontTextureBytes +
      s.derivedTextureBytes;
    const fps =
      1000 / (perf.frames.reduce((a, b) => a + b, 0) / perf.frames.length);
    assert(fps >= 58);
    assert(q(perf.cpu, 0.95) < 8);
    assert(bytes < 300 * 1048576);
    assert.equal(s.visibleProjectiles, 100);
    await shot(p, `${height}-stress`);
    runs.push({
      height,
      figurePx: s.cameraMetrics.figureHeightPx,
      fps,
      frameP95Ms: q(perf.frames, 0.95),
      cpuP95Ms: q(perf.cpu, 0.95),
      frames: perf.frames.length,
      textureMiB: bytes / 1048576,
      art: u.art,
      ground: s.groundSource,
    });
    await context.close();
  }
  for (const fault of ["missing", "corrupt"]) {
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
      }),
      p = await context.newPage();
    p.on("pageerror", (e) => errors.push(String(e)));
    await p.route("**/a12/plates/verdigris.png", (r) =>
      r.fulfill({
        status: fault === "missing" ? 404 : 200,
        body: "injected failure",
      }),
    );
    await enter(p);
    assert.equal((await arena(p)).groundSource, "tiled-fallback");
    await shot(p, `1080-${fault}-plate-fallback`);
    await context.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    join(out, "browser.json"),
    JSON.stringify(
      {
        label:
          "measured headless Chromium ANGLE D3D11; decoded RGBA8 estimate excludes driver/framebuffer",
        runs,
        screens,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ runs, screens: screens.length, errors }));
} finally {
  await browser.close();
  server.kill();
  writeFileSync(join(out, "server.log"), log);
}
