import { chromium, type Page } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { CanvasUI } from "../../game/src/ui/ui.ts";
import type { ArenaGame } from "../../game/src/arena-entry.ts";
type Shape = "ring" | "cone" | "line" | "ward" | "cast" | "status";
type Element = "water" | "fire" | "earth" | "air";
type Win = Window & {
  __ui: {
    snapshot(): ReturnType<CanvasUI["snapshot"]>;
    performance(): { frames: number[]; cpu: number[] };
    resetPerformance(): void;
  };
  __arena: {
    snapshot(): ReturnType<ArenaGame["snapshot"]>;
    sigilFixture(k: Shape, e: Element, p: number, a: number, u: boolean): void;
    artFixture(k?: "stress"): void;
    setPalette(p: string): void;
    feedbackFixture(k: "perfect" | "cast"): void;
    stepInput(n: number): void;
  };
};
const out = resolve("docs/waves/U6-evidence");
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
    "4197",
    "--strictPort",
  ],
  {
    windowsHide: true,
    stdio: "pipe",
    env: {
      ...process.env,
      CAMP_DIRECTOR: "offline",
      MAGE_SAVE_DIRECTORY: mkdtempSync(join(tmpdir(), "mage-u6-")),
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
  screens: unknown[] = [],
  runs: unknown[] = [];
let current: Page | undefined;
const ui = (p: Page) =>
  p.evaluate(() => (window as unknown as Win).__ui.snapshot());
const arena = (p: Page) =>
  p.evaluate(() => (window as unknown as Win).__arena.snapshot());
async function click(p: Page, id: string) {
  const b = (await ui(p)).buttons.find((b) => b.id === id && !b.disabled);
  assert(b, id);
  await p.mouse.click(b.x + b.w / 2, b.y + b.h / 2);
  await p.waitForTimeout(200);
}
async function shot(p: Page, name: string, height: number) {
  await p.mouse.move(10, 10);
  await p.waitForFunction(
    () => (window as unknown as Win).__ui.snapshot().art.pending === 0,
  );
  await p.waitForTimeout(220);
  const s = await ui(p);
  assert.deepEqual(s.overflow, [], name);
  assert.deepEqual(s.art.diagnostics, []);
  assert.deepEqual(s.diagnostics, []);
  assert.equal(await p.locator("input,select,textarea,button").count(), 0);
  const file = `${height}-${name}.png`;
  await p.screenshot({ path: join(out, "screens", file) });
  screens.push({ file, screen: s.screen, texts: s.texts });
}
const quantile = (a: number[], q: number) =>
  a.toSorted((a, b) => a - b)[Math.floor(a.length * q)]!;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:4197/api/health")).ok) break;
    } catch {
      /*starting*/
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  for (const height of [1080, 1440]) {
    const context = await browser.newContext({
        viewport: { width: (height * 16) / 9, height },
        deviceScaleFactor: 1,
      }),
      p = await context.newPage();
    current = p;
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await p.goto("http://127.0.0.1:4197/lab?harness=1");
    await p.waitForFunction(
      () => (window as unknown as Win).__ui?.snapshot().screen === "lab-setup",
    );
    await shot(p, "lab-setup", height);
    await click(p, "lab-config-start");
    await p.keyboard.press("KeyT");
    const tabs = (await ui(p)).buttons
      .filter((b) => b.id.startsWith("lab-tab-"))
      .map((b) => b.id);
    for (const tab of tabs) {
      await click(p, tab);
      await shot(p, tab, height);
    }
    await click(p, "lab-tab-Movement");
    await click(p, "lab-number-walkMps");
    await shot(p, "lab-number", height);
    await p.keyboard.press("Escape");
    await click(p, "lab-import");
    await shot(p, "lab-import", height);
    await p.keyboard.press("Escape");
    await click(p, "lab-tuning-close");
    const fixtures: unknown[] = [];
    for (const element of ["water", "fire", "earth", "air"] as Element[])
      for (const shape of ["ring", "cone", "line"] as Shape[]) {
        await p.evaluate(
          ({ shape, element }) =>
            (window as unknown as Win).__arena.sigilFixture(
              shape,
              element,
              0.5,
              0.45,
              element === "fire",
            ),
          { shape, element },
        );
        await p.waitForTimeout(400);
        await shot(p, `sigil-${element}-${shape}`, height);
        const a = await arena(p);
        assert(a.sigils.clips.includes(`threat.${element}.${shape}`));
        assert.deepEqual(a.sigils.diagnostics, []);
        fixtures.push({ element, shape, sigils: a.sigils });
      }
    for (const progress of [0, 0.25, 0.75, 1]) {
      await p.evaluate(
        (progress) =>
          (window as unknown as Win).__arena.sigilFixture(
            "cone",
            "water",
            progress,
            1.2,
            true,
          ),
        progress,
      );
      await shot(p, `charge-${progress}`, height);
    }
    for (const [shape, progress, name] of [
      ["ward", 0.1, "perfect-window"],
      ["ward", 0.8, "ward-hold"],
      ["cast", 0.35, "cast-start"],
      ["cast", 0.85, "cast-hold"],
      ["status", 0.5, "status"],
    ] as [Shape, number, string][]) {
      await p.evaluate(
        ({ shape, progress }) =>
          (window as unknown as Win).__arena.sigilFixture(
            shape,
            "water",
            progress,
            0.4,
            false,
          ),
        { shape, progress },
      );
      await shot(p, name, height);
    }
    await p.evaluate(() =>
      (window as unknown as Win).__arena.feedbackFixture("perfect"),
    );
    await shot(p, "perfect-confirmed", height);
    for (const palette of ["verdigris", "rust-sand", "moonlit"]) {
      await p.evaluate(
        (p) => (window as unknown as Win).__arena.setPalette(p),
        palette,
      );
      await p.waitForTimeout(450);
      await shot(p, `floor-${palette}`, height);
    }
    await p.evaluate(() =>
      (window as unknown as Win).__arena.artFixture("stress"),
    );
    await p.waitForTimeout(5500);
    await p.evaluate(() => (window as unknown as Win).__ui.resetPerformance());
    const counts: number[] = [];
    for (let i = 0; i < 14; i++) {
      await p.waitForTimeout(500);
      counts.push((await arena(p)).visibleProjectiles);
    }
    const perf = await p.evaluate(() =>
        (window as unknown as Win).__ui.performance(),
      ),
      s = await ui(p),
      a = await arena(p);
    const fps =
        1000 / (perf.frames.reduce((n, v) => n + v, 0) / perf.frames.length),
      bytes =
        s.art.rgbaBytes +
        s.uiTextureBytes +
        s.fontTextureBytes +
        a.derivedTextureBytes;
    assert(counts.every((n) => n === 100));
    assert(fps >= 58.8, `60fps +/-2%: ${fps}`);
    assert(quantile(perf.cpu, 0.95) < 8);
    await shot(p, "stress-100-projectiles", height);
    const cdp = await context.newCDPSession(p),
      heap = await cdp.send("Runtime.getHeapUsage");
    await cdp.detach();
    runs.push({
      height,
      fps,
      frameP95: quantile(perf.frames, 0.95),
      cpuP95: quantile(perf.cpu, 0.95),
      decodedTextureBytes: bytes,
      decodedTextureMiB: bytes / 1048576,
      heap,
      art: s.art,
      sigils: a.sigils,
      fixtures,
    });
    await p.evaluate(() => (window as unknown as Win).__arena.artFixture());
    await p.keyboard.press("Escape");
    await p.waitForFunction(
      () => (window as unknown as Win).__ui.snapshot().screen === "pause",
    );
    await click(p, "main-menu");
    await p.waitForTimeout(500);
    const after = await ui(p);
    assert(
      !after.art.residentKeys.some((k) =>
        /^a13\.(page\.(cast|threat|ward|status|floor|selection|target|warning|absorb)|mask\.|cleanup\.)/.test(
          k,
        ),
      ),
      JSON.stringify(after.art.residentKeys),
    );
    await context.close();
    current = undefined;
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    join(out, "browser.json"),
    JSON.stringify(
      {
        passed: true,
        command:
          "npm run build:game && npx tsx packages/tools/src/u6-browser.ts",
        runs,
        screens,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      passed: true,
      runs: runs.map((r) => {
        const v = r as {
          height: number;
          fps: number;
          decodedTextureMiB: number;
        };
        return {
          height: v.height,
          fps: v.fps,
          textureMiB: v.decodedTextureMiB,
        };
      }),
      screens: screens.length,
    }),
  );
} catch (e) {
  if (current) await current.screenshot({ path: join(out, "failure.png") });
  writeFileSync(
    join(out, "browser-failure.json"),
    JSON.stringify({ error: String(e), errors, serverLog }, null, 2),
  );
  throw e;
} finally {
  await browser.close();
  server.kill();
}
