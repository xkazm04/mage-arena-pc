import { chromium, type Page } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { CanvasUI } from "../../game/src/ui/ui.ts";
import type { ArenaGame } from "../../game/src/arena-entry.ts";
import {
  frameIndex,
  bodyDrawSpec,
  type BodyManifest,
  type BodyState,
  type Direction,
} from "../../game/src/animation-contract.ts";
const bodies = JSON.parse(
  readFileSync("assets/accepted/covenant/a14/packed/characters.json", "utf8"),
) as BodyManifest;
const extra = JSON.parse(
  readFileSync("docs/waves/U6c-evidence/review-extra-manifest.json", "utf8"),
) as { rows: { entity: string; state: BodyState; direction: Direction }[] };
const queue = JSON.parse(
  readFileSync("assets/accepted/covenant/a14/session10/backlog.json", "utf8"),
) as { otherLegacy: string[] };
const extraRuns: unknown[] = [];
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
    artFixture(k?: "stress" | "fallbacks"): void;
    artPose(state: BodyState, direction: Direction): void;
    setPalette(p: string): void;
    feedbackFixture(k: "perfect" | "cast"): void;
    stepInput(n: number): void;
  };
};
const out = resolve("docs/waves/U6c-evidence/performance");
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
    await p.evaluate(() =>
      (window as unknown as Win).__arena.artFixture("fallbacks"),
    );
    await p.waitForTimeout(2500);
    const checked = new Set<string>();
    for (const state of ["idle", "run", "cast", "absorb"] as BodyState[]) {
      for (const direction of ["ne", "se", "sw", "nw"] as Direction[]) {
        // Reset via idle first so repeated casts in new directions start a fresh window.
        await p.evaluate(() =>
          (window as unknown as Win).__arena.artPose("idle", "se"),
        );
        await p.waitForTimeout(60);
        await p.evaluate(
          ({ state, direction }) =>
            (window as unknown as Win).__arena.artPose(state, direction),
          { state, direction },
        );
        const seen = new Map<string, Set<number>>();
        for (let sample = 0; sample < 12; sample++) {
          await p.waitForTimeout(90);
          const a = await arena(p);
          for (const row of extra.rows.filter(
            (r) => r.state === state && r.direction[0] === direction[0],
          )) {
            const pose = a.animation.displayed.find(
              (x) => x.entity === row.entity,
            )!;
            assert(pose, `${row.entity}:${state}:${direction}`);
            assert.equal(pose.selected, `${state}:${direction}`);
            assert.equal(pose.delivery, "A14");
            const clip = bodies.entities[row.entity]!.clips[state]![direction]!;
            assert.equal(
              pose.frame,
              frameIndex(clip, Number(pose.elapsedMs), true),
            );
            assert.equal(pose.mirrorX, direction.endsWith("w"));
            const spec = bodyDrawSpec(
              bodies.entities[row.entity]!,
              clip,
              clip.frames[Number(pose.frame)]!,
              a.cameraMetrics.figureHeightPx,
            );
            assert.deepEqual(pose.anchor, spec.anchor);
            assert.equal(pose.fullFramePx, spec.height);
            const key = `${row.entity}:${state}:${direction}`;
            checked.add(key);
            if (!seen.has(key)) seen.set(key, new Set());
            seen.get(key)!.add(Number(pose.frame));
          }
        }
        for (const [key, frames] of seen)
          assert(frames.size > 1, `${key} must animate: ${[...frames]}`);
        const final = await arena(p);
        if (state === "cast")
          for (const row of extra.rows.filter(
            (r) => r.state === state && r.direction[0] === direction[0],
          )) {
            const pose = final.animation.displayed.find(
              (x) => x.entity === row.entity,
            )!;
            assert.equal(
              pose.frame,
              bodies.entities[row.entity]!.clips.cast![direction]!.frameCount -
                1,
            );
          }
        extraRuns.push({
          height,
          state,
          direction,
          animation: final.animation,
          frames: [...seen].map(([key, f]) => ({ key, seen: [...f] })),
        });
        await shot(p, `extra-${state}-${direction}`, height);
      }
    }
    assert.equal(checked.size, 46);
    const fallbacks = (await arena(p)).animation.fallbacks;
    for (const gap of queue.otherLegacy) {
      const key = gap.replace(":missing", "");
      assert.equal(
        fallbacks.filter((f) => f.startsWith(key + " ")).length,
        1,
        key,
      );
    }
    await p.keyboard.press("F8");
    await shot(p, "fallback-debug", height);
    await p.keyboard.press("F8");
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
    assert.equal(a.animation.displayed.length, 12);
    assert.equal(new Set(a.animation.displayed.map((x) => x.entity)).size, 12);
    assert(a.animation.displayed.every((x) => x.source === "A10"));
    assert(fps >= 58.8, `60fps +/-2%: ${fps}`);
    assert(quantile(perf.cpu, 0.95) < 8);
    await shot(p, "stress-100-projectiles", height);
    const cdp = await context.newCDPSession(p),
      heap = await cdp.send("Runtime.getHeapUsage");
    await cdp.detach();
    runs.push({
      height,
      figures: a.animation.displayed,
      fps,
      frameP95: quantile(perf.frames, 0.95),
      cpuP95: quantile(perf.cpu, 0.95),
      decodedTextureBytes: bytes,
      decodedTextureMiB: bytes / 1048576,
      heap,
      art: s.art,
      sigils: a.sigils,
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
    assert(
      !after.art.residentKeys.some((k) => k.startsWith("a10.packed.")),
      "body atlases release on leaving arena",
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
          "npm run build:game && npx tsx packages/tools/src/u6c-performance.ts",
        runs,
        extraRuns,
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
