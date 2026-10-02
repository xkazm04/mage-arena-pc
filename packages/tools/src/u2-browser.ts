import { chromium, type Page } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  applyBoutInput,
  bridgeRules,
  linkBout,
  type SeasonBout,
  type TrialStance,
} from "@mage/core";
import { idleInput, type InputFrame } from "@mage/core/arena";
import { hash } from "@mage/director";
import { SeasonPolicy } from "./season-policy.ts";
import type { SeasonView } from "../../game/src/season-api.ts";
import type { CanvasUI } from "../../game/src/ui/ui.ts";
import type { ArenaGame } from "../../game/src/arena-entry.ts";
import { nextFocus } from "../../game/src/ui/layout.ts";

type Snapshot = ReturnType<CanvasUI["snapshot"]>;
type Win = Window & {
  __pad: {
    connected: boolean;
    axes: number[];
    buttons: { pressed: boolean; value: number }[];
  };
  __ui: {
    snapshot(): Snapshot;
    performance(): { frames: number[]; cpu: number[] };
    resetPerformance(): void;
  };
  __arena: {
    snapshot(): ReturnType<ArenaGame["snapshot"]>;
    project(p: { x: number; y: number }): { x: number; y: number };
    setBot(kind: string): void;
    reset(kind: string): void;
    visualFixture(kind: string, direction: number): void;
    stepInput(count: number): void;
    panPlayer(pos: { x: number; y: number }): void;
    setPalette(palette: "verdigris" | "rust-sand" | "moonlit"): void;
    propFixture(front: boolean): void;
  };
  __seasonArena: {
    snapshot(): SeasonBout;
    inputs(frames: InputFrame[]): Promise<void>;
    pause(value: boolean): void;
  };
};
const out = resolve("docs/waves/U2-evidence");
mkdirSync(join(out, "screens"), { recursive: true });
const saveDirectory = mkdtempSync(join(tmpdir(), "mage-u2-browser-"));
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
    "4188",
    "--strictPort",
  ],
  {
    cwd: process.cwd(),
    windowsHide: true,
    stdio: "pipe",
    env: {
      ...process.env,
      CAMP_DIRECTOR: "offline",
      MAGE_SAVE_DIRECTORY: saveDirectory,
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
const errors: string[] = [],
  runs: unknown[] = [],
  screens: unknown[] = [];
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=d3d11"],
});
let current: Page | undefined;
const snap = (p: Page) =>
  p.evaluate(() => (window as unknown as Win).__ui.snapshot());
const view = (p: Page) =>
  p.evaluate(async () =>
    (await fetch("/api/session")).json(),
  ) as Promise<SeasonView>;
const screen = async (p: Page, id: string) => {
  await p.waitForFunction(
    (id) => {
      const s = (window as unknown as Win).__ui?.snapshot();
      return s?.screen === id && !s.busy;
    },
    id,
    { timeout: 20000 },
  );
};
async function click(p: Page, id: string, next?: string) {
  await p.waitForFunction(
    (id) => {
      const s = (window as unknown as Win).__ui?.snapshot();
      return s && !s.busy && s.buttons.some((b) => b.id === id && !b.disabled);
    },
    id,
    { timeout: 15000 },
  );
  const b = (await snap(p)).buttons.find((b) => b.id === id)!;
  await p.mouse.click(b.x + b.w / 2, b.y + b.h / 2);
  await p.waitForFunction(
    () => !(window as unknown as Win).__ui.snapshot().busy,
  );
  if (next) await screen(p, next);
}
async function shot(p: Page, name: string, height: number) {
  await p.mouse.move((1880 * height) / 1080, (1050 * height) / 1080);
  await p.waitForFunction(
    () => (window as unknown as Win).__ui.snapshot().art.pending === 0,
  );
  await p.waitForTimeout(180);
  const s = await snap(p);
  assert.equal(s.kit, "/assets/accepted/covenant/ui/kit.json");
  assert.deepEqual(s.diagnostics, []);
  assert.deepEqual(s.art.diagnostics, []);
  assert.deepEqual(s.fontDiagnostics, []);
  assert.deepEqual(s.overflow, [], `Button text overflow: ${name}`);
  const enabled = s.buttons.filter((b) => !b.disabled),
    seen = new Set<string>(enabled.length ? [enabled[0]!.id] : []),
    queue = [...seen];
  for (let i = 0; i < queue.length; i++)
    for (const direction of ["left", "right", "up", "down"] as const) {
      const id = nextFocus(s.buttons, queue[i]!, direction);
      if (id && !seen.has(id)) {
        seen.add(id);
        queue.push(id);
      }
    }
  assert.equal(
    seen.size,
    enabled.length,
    `${name}: all controls reachable with D-pad`,
  );
  assert.equal(await p.locator("canvas").count(), 1);
  assert.equal(
    await p.locator("button,select,input,textarea,dialog").count(),
    0,
  );
  assert.equal(
    await p.evaluate(
      () =>
        document.documentElement.scrollHeight > innerHeight ||
        document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  for (const b of s.buttons) {
    assert(
      b.x >= ((height * 16) / 9) * 0.05 - 1 &&
        b.y >= height * 0.05 - 1 &&
        b.x + b.w <= ((height * 16) / 9) * 0.95 + 1 &&
        b.y + b.h <= height * 0.95 + 1,
      `${name}: ${b.id} outside safe area`,
    );
    assert(
      b.w >= (64 * height) / 1080 && b.h >= (64 * height) / 1080,
      `${name}: ${b.id} target too small`,
    );
  }
  const filename = `${height}-${name}.png`;
  await p.screenshot({ path: join(out, "screens", filename) });
  screens.push({
    filename,
    screen: s.screen,
    focus: s.focus,
    kit: s.kit,
    controls: s.buttons.length,
    texts: s.texts,
  });
}
async function pad(
  p: Page,
  buttons: number[] = [],
  axes = [0, 0, 0, 0],
  connected = true,
) {
  await p.evaluate(
    ({ buttons, axes, connected }) => {
      const pad = (window as unknown as Win).__pad;
      pad.connected = connected;
      pad.axes = axes;
      pad.buttons = Array.from({ length: 17 }, (_, i) => ({
        pressed: buttons.includes(i),
        value: buttons.includes(i) ? 1 : 0,
      }));
    },
    { buttons, axes, connected },
  );
  await p.waitForTimeout(100);
}
async function visit(p: Page, place: string) {
  if ((await snap(p)).screen !== "camp") await click(p, "nav-camp", "camp");
  await click(p, `place-${place}`);
  await click(p, "visit-place", "visit");
}
async function train(p: Page, place: string) {
  await visit(p, place);
  const v = await view(p),
    a = v.actions.find((a) => a.intent === "TRAIN");
  await click(p, a ? `action-${a.id}` : "wait", "camp");
}
async function saveLoad(p: Page) {
  await p.keyboard.press("Escape");
  await screen(p, "pause");
  await click(p, "open-saves", "saves");
  const before = await view(p),
    bout = await p.evaluate(async () => (await fetch("/api/bout")).json());
  await click(p, "save-season");
  await click(p, "load-season", "saves");
  assert.deepEqual(
    await view(p),
    before,
    "Camp view exactly survives save/load",
  );
  assert.equal(
    hash(await p.evaluate(async () => (await fetch("/api/bout")).json())),
    hash(bout),
    "Combat replay/checkpoint survives load",
  );
  await click(p, "resume-loaded");
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error(serverLog);
    try {
      if ((await fetch("http://127.0.0.1:4188")).ok) {
        ready = true;
        break;
      }
    } catch {
      /* startup */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  assert(ready, "Preview started");
  const heights = process.argv.includes("--quick") ? [1080] : [1080, 1440];
  for (const height of heights) {
    const context = await browser.newContext({
        viewport: { width: (height * 16) / 9, height },
      }),
      p = await context.newPage();
    current = p;
    p.on("pageerror", (e) => errors.push(e.message));
    await p.addInitScript(
      `const testPad={connected:false,index:0,mapping:'standard',id:'U1 test standard controller',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0,touched:false})),timestamp:0};window.__pad=testPad;Object.defineProperty(navigator,'getGamepads',{value:()=>testPad.connected?[testPad]:[]});`,
    );
    await p.goto("http://127.0.0.1:4188/?harness=1");
    await screen(p, "menu");
    await shot(p, "main-menu", height);
    const initialFocus = (await snap(p)).focus;
    await p.keyboard.press("Tab");
    assert.notEqual((await snap(p)).focus, initialFocus);
    await p.keyboard.press("Shift+Tab");
    assert.equal((await snap(p)).focus, initialFocus);
    await pad(p, [0]);
    await screen(p, "character");
    await p.waitForTimeout(200);
    assert.equal(
      (await snap(p)).screen,
      "character",
      "Held A does not auto-confirm the next screen",
    );
    await pad(p);
    assert.equal(
      (await snap(p)).buttons.filter(
        (b) => b.id.startsWith("choose-") && b.disabled,
      ).length,
      3,
    );
    await shot(p, "character-pick", height);
    await pad(p, [0]);
    await screen(p, "camp");
    await pad(p);
    await shot(p, "camp-map", height);
    await click(p, "nav-calendar", "calendar");
    await shot(p, "season-calendar", height);
    await click(p, "nav-board", "board");
    await shot(p, "hollow-board-first-night", height);
    await click(p, "nav-journal", "journal");
    await shot(p, "journal-first-night", height);
    await click(p, "journal-cast", "cast");
    await shot(p, "cast-journal-first-page", height);
    await click(p, "cast-next", "cast");
    await shot(p, "cast-journal-second-page", height);
    await click(p, "cast-nysa", "cast-detail");
    await shot(p, "cast-portrait", height);
    await click(p, "back", "cast");
    await click(p, "back", "journal");
    await click(p, "nav-camp", "camp");
    await visit(p, "yard");
    await shot(p, "camp-place", height);
    await p.keyboard.press("Escape");
    await screen(p, "pause");
    await shot(p, "pause", height);
    await click(p, "open-settings", "settings");
    await shot(p, "settings", height);
    await click(p, "sound");
    await click(p, "sound");
    await click(p, "back", "pause");
    await click(p, "open-saves", "saves");
    await shot(p, "save-load", height);
    await click(p, "resume-loaded", "visit");
    await saveLoad(p);
    await p.keyboard.press("Escape");
    await screen(p, "pause");
    await click(p, "main-menu", "menu");
    await click(p, "training-arena", "training");
    await shot(p, "training", height);
    await click(p, "training-magic", "composition");
    await shot(p, "composition", height);
    await click(p, "branch");
    await click(p, "preset-2");
    await click(p, "composition-start", "arena");
    await p.waitForTimeout(300);
    const before = await p.evaluate(() =>
      (window as unknown as Win).__arena.snapshot(),
    );
    await p.keyboard.down("KeyD");
    await p.waitForTimeout(600);
    await p.keyboard.up("KeyD");
    const after = await p.evaluate(() =>
      (window as unknown as Win).__arena.snapshot(),
    );
    assert(after.player.pos.x > before.player.pos.x + 1);
    assert.deepEqual(
      after.camera.centre,
      before.camera.centre,
      "Camera remains fixed during central movement",
    );
    const target = after.state.actors.find((a) => a.id !== after.player.id)!;
    const point = await p.evaluate(
      (pos) => (window as unknown as Win).__arena.project(pos),
      target.pos,
    );
    await p.mouse.move(point.x, point.y);
    await p.mouse.down();
    await p.waitForTimeout(450);
    await p.mouse.up();
    assert(
      (await p.evaluate(() => (window as unknown as Win).__arena.snapshot()))
        .player.metrics.casts > 0,
    );
    await p.mouse.down({ button: "right" });
    await p.waitForTimeout(180);
    assert(
      (await p.evaluate(() => (window as unknown as Win).__arena.snapshot()))
        .player.absorb,
    );
    await shot(p, "arena-hud", height);
    await p.mouse.up({ button: "right" });
    const padBefore = await p.evaluate(() =>
      (window as unknown as Win).__arena.snapshot(),
    );
    await pad(p, [7, 5], [0.7, 0, 1, -1]);
    await p.waitForTimeout(550);
    await pad(p);
    const padAfter = await p.evaluate(() =>
      (window as unknown as Win).__arena.snapshot(),
    );
    assert(padAfter.player.pos.x > padBefore.player.pos.x);
    assert.equal(padAfter.slot, (padBefore.slot + 1) % 4);
    const projectedAim = await p.evaluate(() => {
      const a = (window as unknown as Win).__arena,
        s = a.snapshot();
      return { a: a.project(s.aim), p: a.project(s.player.pos) };
    });
    assert(
      Math.abs(
        Math.abs(projectedAim.a.x - projectedAim.p.x) -
          Math.abs(projectedAim.a.y - projectedAim.p.y),
      ) < 0.1,
      "Right stick diagonal inverts oblique projection",
    );
    await pad(p, [6], [0, 0, 1, 0]);
    assert(
      (await p.evaluate(() => (window as unknown as Win).__arena.snapshot()))
        .player.absorb,
    );
    await pad(p);
    await pad(p, [9]);
    await screen(p, "pause");
    await pad(p);
    await pad(p, [0]);
    await screen(p, "arena");
    await pad(p);
    await pad(p, [], [0, 0, 0, 0], false);
    await screen(p, "pause");
    await click(p, "resume", "arena");
    await p.evaluate(() =>
      (window as unknown as Win).__arena.setBot("perfect"),
    );
    await p.waitForTimeout(1800);
    await shot(p, "arena-absorb", height);
    let pointerHits = 0;
    for (let direction = 0; direction < 8; direction++) {
      await p.evaluate(
        (angle) =>
          (window as unknown as Win).__arena.visualFixture("aim", angle),
        (direction * Math.PI) / 4,
      );
      const aim = await p.evaluate(() => {
        const a = (window as unknown as Win).__arena,
          s = a.snapshot();
        return a.project(s.state.actors[1]!.pos);
      });
      await p.mouse.move(aim.x, aim.y);
      await p.mouse.down();
      await p.waitForFunction(
        () =>
          (window as unknown as Win).__arena.snapshot().state.actors[1]!.metrics
            .hits > 0,
        undefined,
        { timeout: 4000 },
      );
      await p.mouse.up();
      pointerHits++;
    }
    await p.evaluate(() =>
      (window as unknown as Win).__arena.visualFixture("scale", 0),
    );
    await shot(p, "camera-far-fixed", height);
    const anchored = await p.evaluate(() =>
      (window as unknown as Win).__arena.snapshot(),
    );
    assert.equal(anchored.cameraMetrics.figureHeightPx, height * 0.0375);
    await p.evaluate(
      (pos) => (window as unknown as Win).__arena.panPlayer(pos),
      { x: anchored.player.pos.x + 40, y: anchored.player.pos.y },
    );
    await p.waitForTimeout(400);
    const edged = await p.evaluate(() =>
      (window as unknown as Win).__arena.snapshot(),
    );
    assert(
      edged.camera.centre.x > anchored.camera.centre.x &&
        edged.camera.centre.x < edged.player.pos.x,
    );
    await shot(p, "camera-edge-follow-fixture", height);
    for (const front of [false, true]) {
      await p.evaluate(
        (front) => (window as unknown as Win).__arena.propFixture(front),
        front,
      );
      await shot(p, `arena-prop-${front ? "front" : "behind"}-fixture`, height);
      const s = await p.evaluate(() =>
        (window as unknown as Win).__arena.snapshot(),
      );
      const actor = s.depthOrder.findIndex(
          (v) => v.id === `actor:${s.player.id}`,
        ),
        prop = s.depthOrder.findIndex((v) => v.id === "prop:1");
      assert(
        front ? actor > prop : actor < prop,
        "Prop and actor sort by feet",
      );
    }
    for (const palette of ["verdigris", "rust-sand", "moonlit"] as const) {
      await p.evaluate(
        (palette) => (window as unknown as Win).__arena.setPalette(palette),
        palette,
      );
      await shot(p, `arena-palette-${palette}`, height);
    }
    await p.evaluate(() =>
      (window as unknown as Win).__arena.setPalette("verdigris"),
    );
    await p.evaluate(() =>
      (window as unknown as Win).__arena.reset("performance"),
    );
    await p.waitForFunction(
      () =>
        (window as unknown as Win).__arena.snapshot().visibleProjectiles ===
        100,
    );
    await p.waitForTimeout(500);
    await p.evaluate(() => (window as unknown as Win).__ui.resetPerformance());
    const counts: number[] = [];
    for (let i = 0; i < 60; i++) {
      counts.push(
        await p.evaluate(
          () =>
            (window as unknown as Win).__arena.snapshot().visibleProjectiles,
        ),
      );
      await p.waitForTimeout(100);
    }
    const perf = await p.evaluate(() =>
      (window as unknown as Win).__ui.performance(),
    );
    const textureSnapshot = await snap(p);
    const arenaTextureSnapshot = await p.evaluate(() =>
      (window as unknown as Win).__arena.snapshot(),
    );
    const cdp = await context.newCDPSession(p);
    const heap = await cdp.send("Runtime.getHeapUsage");
    await cdp.detach();
    const sorted = perf.cpu.toSorted((a, b) => a - b),
      cpuP95 = sorted[Math.floor(sorted.length * 0.95)]!,
      fps =
        1000 / (perf.frames.reduce((a, b) => a + b, 0) / perf.frames.length);
    assert(counts.every((n) => n === 100));
    assert(cpuP95 < 8, `HUD and 100 projectiles CPU p95 ${cpuP95}`);
    assert(fps >= 50, `Frame rate ${fps}`);
    await shot(p, "arena-projectile-field", height);
    await p.keyboard.press("Escape");
    await screen(p, "pause");
    await click(p, "main-menu", "menu");
    await click(p, "continue-season", "camp");
    // Real camp commands and native listening input earn the Knowing used by Parley.
    if ((await view(p)).slot === "day") await train(p, "yard");
    if ((await view(p)).slot === "dusk") await train(p, "pit");
    await visit(p, "tent");
    await click(p, "listen", "listen");
    await shot(p, "listening", height);
    const deadline = Date.now() + 65000;
    while (!(await view(p)).nightFinished && Date.now() < deadline) {
      const n = (await view(p)).listening!;
      await p.keyboard.press(`Digit${n.beacon + 1}`);
      if (n.beacon !== n.patrol || n.warning) await p.keyboard.down("Space");
      else await p.keyboard.up("Space");
      await p.waitForTimeout(180);
    }
    await p.keyboard.up("Space");
    assert.equal((await view(p)).listening!.learned, "K-nysa-bread");
    await shot(p, "listening-complete", height);
    await click(p, "dawn", "board");
    await shot(p, "hollow-board", height);
    await click(p, "nav-journal", "journal");
    await shot(p, "journal", height);
    await click(p, "nav-camp", "camp");
    await visit(p, "commons");
    await click(p, "parley-nysa", "parley");
    await shot(p, "parley", height);
    await click(p, "parley-keyboard", "keyboard");
    await shot(p, "letter-board", height);
    await click(p, "letter-I");
    await click(p, "letter-done", "parley");
    await click(p, "parley-text");
    await p.keyboard.type("I know about the bread. Can we stand together?");
    await p.keyboard.press("Escape");
    await click(p, "parley-speak", "parley-result");
    await shot(p, "parley-result", height);
    await click(p, "back", "camp");
    const checkpoints: unknown[] = [];
    while ((await view(p)).day.day <= 14) {
      const v = await view(p),
        day = v.day.day;
      if (v.day.games && v.season.due === "games") {
        await click(p, "prepare-games", "composition");
        await click(p, "preset-2");
        await click(p, "composition-start", "arena");
        await saveLoad(p);
        await p.evaluate(() =>
          (window as unknown as Win).__seasonArena.pause(true),
        );
        const policy = new SeasonPolicy();
        for (let batch = 0; batch < 500; batch++) {
          const bout = linkBout(
            await p.evaluate(() =>
              (window as unknown as Win).__seasonArena.snapshot(),
            ),
          );
          if (bout.phase === "terminal") break;
          if (bout.phase === "intermission") {
            await screen(p, "results");
            if (day === 7 && bout.games!.wave === 0)
              await shot(p, "bout-results", height);
            await click(p, "next-bout", "arena");
            await p.evaluate(() =>
              (window as unknown as Win).__seasonArena.pause(true),
            );
            continue;
          }
          const frames: InputFrame[] = [];
          for (let i = 0; i < 240 && bout.phase === "active"; i++) {
            const input = day === 14 ? idleInput() : policy.frame(bout.games!);
            frames.push(input);
            applyBoutInput(bout, {
              type: "tick",
              tick: bout.games!.state.tick,
              input,
            });
          }
          await p.evaluate(
            async (frames) =>
              (window as unknown as Win).__seasonArena.inputs(frames),
            frames,
          );
        }
        const bout = await p.evaluate(() =>
          (window as unknown as Win).__seasonArena.snapshot(),
        );
        assert.equal(bout.phase, "terminal");
        await screen(p, "results");
        checkpoints.push({
          day,
          result: bout.games!.result,
          tick: bout.games!.state.tick,
        });
        await shot(p, day === 7 ? "games-victor" : "games-missio", height);
        await click(p, "return-camp", "camp");
      } else if (v.slot === "day") await train(p, "yard");
      let n = await view(p);
      if (n.slot === "dusk") {
        if (n.day.eve) {
          await click(p, "trial-summons", "trial");
          await click(p, "start-trial");
          await shot(p, "tent-trial", height);
          while ((await view(p)).season.trial!.phase === "active") {
            const tell = (await view(p)).season.trial!.tell!;
            const stance = Object.entries(bridgeRules.trial.beats).find(
              ([, v]) => v === tell,
            )![0] as TrialStance;
            await click(p, `trial-${stance}`);
          }
          await shot(p, "trial-result", height);
          await click(p, "receive-trial", "camp");
        } else await train(p, "pit");
      }
      n = await view(p);
      if (!n.nightFinished) await click(p, "wait", "camp");
      await click(p, "dawn");
      if ((await snap(p)).screen === "board") await click(p, "nav-camp");
    }
    assert.equal((await view(p)).season.receipts.length, 4);
    await screen(p, "chapter");
    await shot(p, "chapter-results", height);
    await saveLoad(p);
    runs.push({
      height,
      pointerHits,
      performance: {
        fps,
        cpuP95,
        frames: perf.frames.length,
        visibleProjectileSamples: counts,
        frameP95Ms: perf.frames.toSorted((a, b) => a - b)[
          Math.floor(perf.frames.length * 0.95)
        ],
        browserHeap: heap,
        textures: {
          art: textureSnapshot.art,
          uiBytes: textureSnapshot.uiTextureBytes,
          fontBytes: textureSnapshot.fontTextureBytes,
          arenaDerivedBytes: arenaTextureSnapshot.derivedTextureBytes,
          totalRgbaBytes:
            textureSnapshot.art.rgbaBytes +
            textureSnapshot.uiTextureBytes +
            textureSnapshot.fontTextureBytes +
            arenaTextureSnapshot.derivedTextureBytes,
        },
      },
      gamepad:
        "standard browser API emulation; not a physical controller measurement",
      checkpoints,
      receipts: (await view(p)).season.receipts,
      day: (await view(p)).day.day,
    });
    await context.close();
    current = undefined;
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    join(out, "browser.json"),
    JSON.stringify(
      {
        label:
          "Measured headless browser, native pointer/keyboard and ordinary deterministic input policy; human feel unmeasured",
        command:
          "npm run build:game && npx tsx packages/tools/src/u2-browser.ts",
        passed: true,
        runs,
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
      screens: screens.length,
    }),
  );
} catch (error) {
  if (current) {
    await current.screenshot({ path: join(out, "failure.png") });
    console.log(JSON.stringify(await snap(current)));
  }
  writeFileSync(
    join(out, "browser-failure.json"),
    JSON.stringify({ error: String(error), errors, serverLog }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
  server.kill();
}
