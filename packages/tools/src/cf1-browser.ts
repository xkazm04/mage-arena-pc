import { chromium, type Page } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from "node:fs";
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
    feedbackFixture(kind: "hit" | "perfect" | "cast" | "warning"): void;
    stepInput(count: number): void;
  };
};
const wave = process.env.MAGE_EVIDENCE ?? "CF1";
if (!["CF1", "CF2"].includes(wave)) throw Error("Invalid evidence wave");
const out = resolve(`docs/waves/${wave}-evidence`);
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
      MAGE_SAVE_DIRECTORY: mkdtempSync(join(tmpdir(), "mage-cf1-")),
    },
  },
);
let _log = "";
server.stdout.on("data", (b) => {
  _log += String(b);
});
server.stderr.on("data", (b) => {
  _log += String(b);
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
      /* server starting */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  for (const height of [1080, 1440]) {
    const context = await browser.newContext({
      viewport: { width: (height * 16) / 9, height },
      deviceScaleFactor: 1,
      acceptDownloads: true,
    });
    const p = await context.newPage();
    p.on("pageerror", (e) => errors.push(String(e)));
    await p.goto("http://127.0.0.1:4195/?harness=1");
    await p.waitForFunction(
      () => (window as unknown as Win).__ui?.snapshot().screen === "menu",
    );
    await click(p, "combat-feel-lab");
    await shot(p, `${height}-setup`);
    await click(p, "lab-config-opponent");
    await click(p, "lab-config-school");
    await click(p, "lab-config-player-school");
    await click(p, "lab-config-competence");
    await click(p, "lab-compose");
    await click(p, "preset-1");
    await click(p, "composition-start");
    assert.equal((await arena(p)).state.actors.length, 2);
    assert.equal((await arena(p)).lab!.config.competence, 3);
    await p.keyboard.press("KeyH");
    await p.waitForTimeout(1000);
    await p.keyboard.press("KeyP");
    const frozen = (await arena(p)).state.tick;
    await p.waitForTimeout(200);
    assert.equal((await arena(p)).state.tick, frozen);
    await p.keyboard.press("Period");
    assert.equal((await arena(p)).state.tick, frozen + 1);
    await p.keyboard.press("KeyT");
    await click(p, "lab-preset-Snappier");
    await click(p, "lab-number-walkMps");
    await p.keyboard.type("5.7");
    await p.keyboard.press("Enter");
    assert.equal((await arena(p)).state.tuning!.walkMps, 5.7);
    const slider = (await ui(p)).buttons.find(
      (b) => b.id === "lab-slider-accelerationMps2",
    )!;
    await p.mouse.move(slider.x + 20, slider.y + slider.h / 2);
    await p.mouse.down();
    await p.mouse.move(slider.x + slider.w * 0.6, slider.y + slider.h / 2, {
      steps: 6,
    });
    await p.mouse.up();
    assert((await arena(p)).state.tuning!.accelerationMps2 > 60);
    const downloadPromise = p.waitForEvent("download");
    await click(p, "lab-export");
    const download = await downloadPromise;
    await download.saveAs(join(out, "exported-tuning.json"));
    await shot(p, `${height}-tuning`);
    await click(p, "lab-tab-Spells");
    await click(p, "lab-number-spell-castS");
    await p.keyboard.type("0.12");
    await p.keyboard.press("Enter");
    assert.equal(
      (await arena(p)).state.tuning!.spells["bolt:0:base"]!.castS,
      0.12,
    );
    await shot(p, `${height}-spells`);
    await click(p, "lab-import");
    const json = readFileSync(join(out, "exported-tuning.json"), "utf8");
    await p.evaluate((json) => {
      const data = new DataTransfer();
      data.setData("text/plain", json);
      window.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: data }),
      );
    }, json);
    await p.keyboard.press("Enter");
    assert.equal((await ui(p)).screen, "lab-tuning");
    assert.deepEqual((await arena(p)).state.tuning!.spells, {});
    await click(p, "lab-tuning-close");
    await p.keyboard.press("KeyR");
    await p.keyboard.press("KeyP");
    assert.equal((await arena(p)).lab!.metrics.landed, 0);
    const seed = (await arena(p)).lab!.config.seed;
    await p.keyboard.press("KeyP");
    await p.mouse.move(height * 0.9, height * 0.52);
    await p.mouse.down();
    await p.waitForTimeout(700);
    await p.mouse.up();
    await p.keyboard.down("KeyD");
    await p.waitForTimeout(200);
    await p.keyboard.up("KeyD");
    await p.waitForTimeout(3500);
    await p.keyboard.press("KeyP");
    const live = (await arena(p)).state;
    await p.keyboard.press("KeyV");
    await p.waitForTimeout(400);
    assert((await arena(p)).lab!.replayTick !== undefined);
    assert.equal((await arena(p)).state.tick, live.tick);
    await shot(p, `${height}-replay`);
    await p.keyboard.press("KeyV");
    assert.deepEqual((await arena(p)).state, live);
    await p.keyboard.press("KeyR");
    assert.equal((await arena(p)).lab!.config.seed, seed);
    await p.evaluate(() => (window as unknown as Win).__ui.resetPerformance());
    await p.waitForTimeout(6200);
    const perf = await p.evaluate(() =>
      (window as unknown as Win).__ui.performance(),
    );
    await shot(p, `${height}-combat`);
    runs.push({
      height,
      frameP95: q(perf.frames, 0.95),
      cpuP95: q(perf.cpu, 0.95),
      lab: (await arena(p)).lab,
      overflow: (await ui(p)).overflow,
    });
    await p.keyboard.press("Escape");
    await p.waitForFunction(
      () => (window as unknown as Win).__ui.snapshot().screen === "pause",
    );
    await click(p, "pause-combat-lab");
    assert.equal((await ui(p)).screen, "lab-setup");
    assert.equal(await p.locator("input,textarea,select").count(), 0);
    if (wave === "CF2") {
      await click(p, "lab-config-start");
      for (const kind of ["hit", "perfect", "cast", "warning"] as const) {
        await p.evaluate(
          (k) => (window as unknown as Win).__arena.feedbackFixture(k),
          kind,
        );
        await p.waitForTimeout(300);
        let snap = await arena(p);
        if (kind === "hit") assert(snap.feedback.numbers > 0);
        if (kind === "perfect") {
          assert(
            snap.state.events.some((e) => e.kind === "perfect" && e.value > 0),
          );
          assert(snap.feedback.numbers > 0);
        }
        if (kind === "cast" || kind === "warning") {
          const pending = snap.player.pending!;
          assert(pending);
          if(kind === "warning") { assert.equal(pending.spell!.family,"unblockable");assert(pending.releaseTick-pending.startTick>=48); }
          assert(
            !snap.state.events.some(
              (e) =>
                e.kind === "release" && e.activationId === pending.activationId,
            ),
          );
          await shot(p, `${height}-${kind}-windup`);
          await p.evaluate(
            (n) => (window as unknown as Win).__arena.stepInput(n),
            pending.releaseTick - snap.state.tick,
          );
          await p.waitForTimeout(100);
          snap = await arena(p);
          assert.equal(
            snap.state.events.filter(
              (e) =>
                e.kind === "release" && e.activationId === pending.activationId,
            ).length,
            1,
          );
          assert(snap.effects.counts["water.cast"] > 0);
        }
        await shot(p, `${height}-${kind}-feedback`);
      }
      await p.evaluate(() => localStorage.setItem("mage-motion", "reduced"));
      await p.evaluate(() =>
        (window as unknown as Win).__arena.feedbackFixture("hit"),
      );
      await p.waitForTimeout(100);
      assert.equal((await arena(p)).impactClock.stopS, 0);
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    join(out, "browser.json"),
    JSON.stringify({ runs, screens, errors }, null, 2),
  );
  console.log(JSON.stringify({ runs, screens, errors }, null, 2));
} finally {
  await browser.close();
  server.kill();
  if (errors.length) console.error(errors);
}
