import { chromium, type Page } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { CanvasUI } from "../../game/src/ui/ui.ts";
import type { ArenaGame } from "../../game/src/arena-entry.ts";
import type {
  BodyState,
  Direction,
  Element,
} from "../../game/src/animation-contract.ts";

type Win = Window & {
  __ui: {
    snapshot(): ReturnType<CanvasUI["snapshot"]>;
    performance(): { frames: number[]; cpu: number[] };
    resetPerformance(): void;
  };
  __arena: {
    snapshot(): ReturnType<ArenaGame["snapshot"]>;
    artFixture(kind?: Element | "stress" | "fallbacks"): void;
    artPose(state: BodyState, direction: Direction): void;
    reset(kind: string): void;
    setBot(kind: string): void;
  };
  __artReview: { clock(): Record<string, unknown> };
};
const out = resolve("docs/waves/U4-evidence");
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
    "4196",
    "--strictPort",
  ],
  {
    windowsHide: true,
    stdio: "pipe",
    env: {
      ...process.env,
      CAMP_DIRECTOR: "offline",
      MAGE_SAVE_DIRECTORY: mkdtempSync(join(tmpdir(), "mage-u4-")),
    },
  },
);
let serverLog = "";
server.stdout.on("data", (b) => {
  serverLog += String(b);
});
server.stderr.on("data", (b) => {
  serverLog += String(b);
});
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=d3d11"],
});
const errors: string[] = [],
  runs: unknown[] = [],
  screens: string[] = [],
  faults: unknown[] = [];
let current: Page | undefined;
const ui = (p: Page) =>
  p.evaluate(() => (window as unknown as Win).__ui.snapshot());
const arena = (p: Page) =>
  p.evaluate(() => (window as unknown as Win).__arena.snapshot());
async function screen(p: Page, id: string) {
  await p.waitForFunction((id) => {
    const s = (window as unknown as Win).__ui?.snapshot();
    return s?.screen === id && !s.busy;
  }, id);
}
async function click(p: Page, id: string, next?: string) {
  const b = (await ui(p)).buttons.find((b) => b.id === id && !b.disabled);
  assert(b, `Missing enabled control ${id}`);
  await p.mouse.click(b.x + b.w / 2, b.y + b.h / 2);
  if (next) await screen(p, next);
  else await p.waitForTimeout(200);
}
async function shot(p: Page, name: string, height: number) {
  const file = `${height}-${name}.png`;
  await p.mouse.move(20, height - 20);
  await p.screenshot({ path: join(out, "screens", file) });
  screens.push(file);
}
async function enter(p: Page) {
  await p.goto("http://127.0.0.1:4196/training?harness=1");
  await screen(p, "training");
  await click(p, "training-magic", "composition");
  await click(p, "composition-start", "arena");
  await p.waitForFunction(
    () => (window as unknown as Win).__ui.snapshot().art.pending === 0,
  );
  await p.waitForTimeout(600);
}
const percentile = (a: number[], q: number) =>
  a.toSorted((a, b) => a - b)[Math.floor(a.length * q)]!;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:4196/api/health")).ok) break;
    } catch {
      /* starting */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  for (const height of [1080, 1440]) {
    const context = await browser.newContext({
      viewport: { width: (height * 16) / 9, height },
      deviceScaleFactor: 1,
    });
    const p = (current = await context.newPage());
    p.on("pageerror", (e) => errors.push(String(e)));
    await enter(p);
    const elements: unknown[] = [];
    for (const element of ["water", "fire", "earth", "air"] as Element[]) {
      await p.evaluate(
        (e) => (window as unknown as Win).__arena.artFixture(e),
        element,
      );
      await p.waitForFunction(
        () =>
          (window as unknown as Win).__arena
            .snapshot()
            .animation.displayed.filter((b) => b.source === "A10").length ===
          12,
      );
      await p.waitForTimeout(2200);
      const a = await arena(p);
      assert.equal(
        a.animation.displayed.filter((b) => b.source === "A10").length,
        12,
      );
      assert(a.animation.displayed.every((b) => b.rotation === 0));
      for (const b of a.animation.displayed)
        assert(Math.abs(Number(b.fullFramePx) - (97.2 * height) / 1080) < 0.01);
      for (const event of ["cast", "hit", "impact"])
        assert((a.effects.counts[`${element}.${event}`] ?? 0) > 0);
      assert((a.effects.counts["absorb.contact"] ?? 0) > 0);
      assert((a.effects.counts["absorb.perfect"] ?? 0) > 0);
      await shot(p, `arena-${element}-motion-a`, height);
      await p.waitForTimeout(220);
      const b = await arena(p);
      assert.notDeepEqual(
        a.animation.displayed.map((b) => b.frame),
        b.animation.displayed.map((b) => b.frame),
      );
      await shot(p, `arena-${element}-motion-b`, height);
      elements.push({ element, animation: b.animation, effects: b.effects });
    }
    await p.evaluate(() =>
      (window as unknown as Win).__arena.artFixture("fallbacks"),
    );
    const poseResults: unknown[] = [];
    for (const state of [
      "idle",
      "run",
      "cast",
      "absorb",
      "hit",
      "death",
    ] as BodyState[])
      for (const direction of ["ne", "se", "sw", "nw"] as Direction[]) {
        await p.evaluate(
          ({ state, direction }) =>
            (window as unknown as Win).__arena.artPose(state, direction),
          { state, direction },
        );
        await p.waitForTimeout(280);
        const s = await arena(p);
        assert(
          s.animation.displayed.some(
            (b) => b.entity === "cinder_hound" && b.source === "procedural",
          ),
        );
        assert(
          s.animation.displayed
            .filter((b) => b.entity !== "cinder_hound")
            .every((b) => b.source === "A10"),
        );
        poseResults.push({
          state,
          direction,
          displayed: s.animation.displayed,
        });
      }
    await p.keyboard.press("F8");
    await shot(p, "fallback-overlay", height);
    await p.keyboard.press("F8");
    await p.evaluate(() =>
      (window as unknown as Win).__arena.artFixture("stress"),
    );
    await p.waitForTimeout(2000);
    await p.evaluate(() => (window as unknown as Win).__ui.resetPerformance());
    const samples: unknown[] = [],
      effectCpu: number[] = [];
    for (let i = 0; i < 12; i++) {
      await p.waitForTimeout(500);
      const s = await arena(p);
      assert.equal(s.visibleProjectiles, 100);
      assert.equal(
        s.animation.displayed.filter((b) => b.source === "A10").length,
        12,
      );
      assert(s.effects.allocated <= 256);
      samples.push({
        tick: s.state.tick,
        visibleProjectiles: s.visibleProjectiles,
        figures: s.animation.displayed,
        effects: s.effects,
      });
      effectCpu.push(s.effects.cpuMs);
    }
    const perf = await p.evaluate(() =>
      (window as unknown as Win).__ui.performance(),
    );
    const u = await ui(p),
      a = await arena(p);
    const bytes =
      u.art.rgbaBytes +
      u.uiTextureBytes +
      u.fontTextureBytes +
      a.derivedTextureBytes;
    const fps =
      1000 / (perf.frames.reduce((n, v) => n + v, 0) / perf.frames.length);
    assert(fps >= 58, `60fps target tolerance: ${fps}`);
    assert(percentile(perf.cpu, 0.95) < 8);
    assert(bytes < 300 * 1048576, `Texture memory ${bytes / 1048576} MiB`);
    await shot(p, "stress-100-projectiles-12-figures", height);
    const cdp = await context.newCDPSession(p),
      heap = await cdp.send("Runtime.getHeapUsage");
    await cdp.detach();
    // Leave arena and prove its leased body/effect sources are actually released.
    await p.evaluate(() => (window as unknown as Win).__arena.artFixture());
    await p.keyboard.press("Escape");
    await screen(p, "pause");
    await click(p, "main-menu", "menu");
    await p.waitForTimeout(400);
    const after = await ui(p);
    assert(
      !after.art.residentKeys.some((k) => /^a(8\.page|10\.packed)\./.test(k)),
    );
    const clockStates: unknown[] = [];
    await click(p, "pick-character", "character");
    await click(p, "choose-water", "camp");
    await p.waitForTimeout(1800);
    clockStates.push(
      await p.evaluate(() => (window as unknown as Win).__artReview.clock()),
    );
    await shot(p, "camp-dawn-tideglass", height);
    for (let i = 0; i < 2; i++) {
      await click(p, "place-yard");
      await click(p, "visit-place", "visit");
      const action = await p.evaluate(async () => {
        const v = await (await fetch("/api/session")).json();
        return (v.actions as { id: string; intent: string }[]).find(
          (a) => a.intent === "TRAIN",
        )!.id;
      });
      await click(p, `action-${action}`, "camp");
    }
    await p.waitForTimeout(1800);
    let clock = await p.evaluate(() =>
      (window as unknown as Win).__artReview.clock(),
    );
    assert.equal(clock.phaseTo, "midday");
    assert.equal(clock.source, "A11 Tideglass");
    clockStates.push(clock);
    await shot(p, "camp-midday-tideglass", height);
    for (const phase of ["dusk", "night"]) {
      await click(p, "wait", "camp");
      await p.waitForTimeout(1800);
      clock = await p.evaluate(() =>
        (window as unknown as Win).__artReview.clock(),
      );
      assert.equal(clock.phaseTo, phase);
      clockStates.push(clock);
      await shot(p, `camp-${phase}-tideglass`, height);
    }
    await p.evaluate(() => localStorage.setItem("mage-motion", "reduced"));
    await click(p, "wait", "camp");
    await p.waitForTimeout(250);
    clock = await p.evaluate(() =>
      (window as unknown as Win).__artReview.clock(),
    );
    assert.equal(clock.fraction, 1);
    assert.equal(clock.waterHeight, 0);
    assert.equal(clock.reducedMotion, true);
    clockStates.push(clock);
    await shot(p, "camp-empty-reduced-motion", height);
    assert.deepEqual(u.art.diagnostics, []);
    assert.deepEqual(a.animation.diagnostics, []);
    assert.deepEqual(a.effects.diagnostics, []);
    runs.push({
      height,
      clockStates,
      elements,
      poseResults,
      performance: {
        fps,
        frameP95Ms: percentile(perf.frames, 0.95),
        cpuP95Ms: percentile(perf.cpu, 0.95),
        effectCpuP95Ms: percentile(effectCpu, 0.95),
        frames: perf.frames.length,
        samples,
        textureBytes: bytes,
        textureMiB: bytes / 1048576,
        art: u.art,
        uiBytes: u.uiTextureBytes,
        fontBytes: u.fontTextureBytes,
        derivedBytes: a.derivedTextureBytes,
        heap,
      },
      afterArena: after.art,
    });
    await context.close();
    current = undefined;
  }
  for (const fault of ["missing-body", "corrupt-effect", "missing-clock"]) {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    const p = (current = await context.newPage());
    p.on("pageerror", (e) => errors.push(String(e)));
    await p.route(
      fault === "missing-body"
        ? "**/a10/packed/cassia.png"
        : fault === "corrupt-effect"
          ? "**/a8/atlases/water.png"
          : "**/ui/atlases/daily-stats.png",
      (r) =>
        r.fulfill({
          status: fault === "corrupt-effect" ? 200 : 404,
          body: "injected art failure",
        }),
    );
    await enter(p);
    await p.mouse.move(1200, 540);
    await p.keyboard.down("KeyD");
    await p.mouse.down();
    await p.waitForTimeout(700);
    await p.mouse.up();
    await p.keyboard.up("KeyD");
    const a = await arena(p),
      u = await ui(p);
    assert(a.state.tick > 0);
    assert.deepEqual(u.overflow, []);
    if (fault === "missing-body")
      assert(
        a.animation.fallbacks.some((f) => f.includes("entity page failed")),
      );
    if (fault === "corrupt-effect")
      assert(u.art.failed.includes("a8.page.water"));
    if (fault === "missing-clock") {
      assert.equal(u.kit, "/assets/accepted/covenant/ui/kit.json");
      assert(u.diagnostics.some((d) => d.includes("Optional daily art")));
    }
    if (fault === "missing-clock") {
      await p.keyboard.press("Escape");
      await screen(p, "pause");
      await click(p, "main-menu", "menu");
      await click(p, "pick-character", "character");
      await click(p, "choose-water", "camp");
      const clock = await p.evaluate(() =>
        (window as unknown as Win).__artReview.clock(),
      );
      assert.equal(clock.source, "procedural failure fallback");
    }
    await shot(p, fault, 1080);
    faults.push({
      fault,
      animation: a.animation,
      art: u.art,
      diagnostics: u.diagnostics,
    });
    await context.close();
    current = undefined;
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    join(out, "art-browser.json"),
    JSON.stringify(
      {
        label:
          "Measured presentation fixtures, not new elemental gameplay or owner feel",
        runs,
        faults,
        errors,
        screens,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      passed: true,
      runs: runs.length,
      faults: faults.length,
      screens: screens.length,
    }),
  );
} catch (e) {
  if (current) await current.screenshot({ path: join(out, "failure.png") });
  writeFileSync(
    join(out, "art-browser-failure.json"),
    JSON.stringify({ error: String(e), errors, serverLog, runs }, null, 2),
  );
  throw e;
} finally {
  await browser.close();
  server.kill();
}
