import { chromium, type Page } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { CanvasUI } from "../../game/src/ui/ui.ts";
import type { GameAudio } from "../../game/src/audio.ts";
import type { ArenaGame } from "../../game/src/arena-entry.ts";
import type { SeasonView } from "../../game/src/season-api.ts";
import type { Cue } from "../../game/src/audio-policy.ts";
type Win = Window & {
  __ui: { snapshot(): ReturnType<CanvasUI["snapshot"]> };
  __audio: {
    snapshot(): ReturnType<GameAudio["snapshot"]>;
    play(cue: Cue): Promise<void>;
    scene(scene: string): void;
    pause(paused: boolean): void;
  };
  __arena: {
    snapshot(): ReturnType<ArenaGame["snapshot"]>;
    project(p: { x: number; y: number }): { x: number; y: number };
    setBot(name: string): void;
  };
  __nodes: { kind: string; node: AudioNode }[];
  __contexts: AudioContext[];
};
const out = resolve("docs/waves/U6b-evidence/audio-walk");
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
      MAGE_SAVE_DIRECTORY: mkdtempSync(join(tmpdir(), "mage-au4-")),
    },
  },
);
let serverLog = "";
server.stdout.on("data", (b) => (serverLog += String(b)));
server.stderr.on("data", (b) => (serverLog += String(b)));
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=d3d11", "--autoplay-policy=user-gesture-required"],
});
const errors: string[] = [],
  runs: unknown[] = [],
  faults: unknown[] = [];
let current: Page | undefined;
const ui = (p: Page) =>
  p.evaluate(() => (window as unknown as Win).__ui.snapshot());
const audio = (p: Page) =>
  p.evaluate(() => (window as unknown as Win).__audio.snapshot());
const view = (p: Page) =>
  p.evaluate(async () =>
    (await fetch("/api/session")).json(),
  ) as Promise<SeasonView>;
async function screen(p: Page, name: string) {
  await p.waitForFunction((name) => {
    const s = (window as unknown as Win).__ui?.snapshot();
    return s?.screen === name && !s.busy;
  }, name);
}
async function click(p: Page, id: string, next?: string) {
  await p.waitForFunction((id) => {
    const s = (window as unknown as Win).__ui.snapshot();
    return !s.busy && s.buttons.some((b) => b.id === id && !b.disabled);
  }, id);
  const b = (await ui(p)).buttons.find((b) => b.id === id)!;
  await p.mouse.click(b.x + b.w / 2, b.y + b.h / 2);
  await p.waitForFunction(
    () => !(window as unknown as Win).__ui.snapshot().busy,
  );
  if (next) await screen(p, next);
}
async function played(p: Page, cue: string, event = "play", timeout = 10000) {
  await p.waitForFunction(
    ({ cue, event }) =>
      (window as unknown as Win).__audio
        .snapshot()
        .logs.some((e) => e.cue === cue && e.event === event),
    { cue, event },
    { timeout },
  );
}
async function shot(p: Page, name: string, height: number) {
  await p.mouse.move(10, 10);
  await p.waitForTimeout(220);
  assert.deepEqual((await ui(p)).overflow, []);
  await p.screenshot({ path: join(out, "screens", `${height}-${name}.png`) });
}
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:4195")).ok) break;
    } catch {
      /* startup */
    }
    if (server.exitCode !== null) throw Error(serverLog);
    await new Promise((r) => setTimeout(r, 100));
  }
  for (const height of [1080, 1440]) {
    const context = await browser.newContext({
        viewport: { width: (height * 16) / 9, height },
      }),
      p = await context.newPage();
    current = p;
    p.on("pageerror", (e) => errors.push(e.message));
    await p.addInitScript(`window.__nodes=[];window.__contexts=[];const Native=window.AudioContext;window.AudioContext=class extends Native {
      constructor(...args){super(...args);window.__contexts.push(this)}
      createBiquadFilter(){const node=super.createBiquadFilter();window.__nodes.push({kind:'filter',node});return node}
      createDynamicsCompressor(){const node=super.createDynamicsCompressor();window.__nodes.push({kind:'compressor',node});return node}
      createWaveShaper(){const node=super.createWaveShaper();window.__nodes.push({kind:'ceiling',node});return node}
    };`);
    await p.goto("http://127.0.0.1:4195/?harness=1");
    await screen(p, "menu");
    assert.equal((await audio(p)).state, "locked");
    assert.equal(
      await p.evaluate(() => (window as unknown as Win).__contexts.length),
      0,
    );
    if (height === 1440) {
      await p.keyboard.press("Enter");
      await screen(p, "character");
      await played(p, "ui.click");
    } else await click(p, "pick-character", "character");
    await click(p, "choose-water", "camp");
    await played(p, "camp-day", "music-play");
    assert.equal((await audio(p)).state, "running");
    const graph = await p.evaluate(() =>
      (window as unknown as Win).__nodes.map(({ kind, node }) => ({
        kind,
        ...(kind === "filter"
          ? {
              type: (node as BiquadFilterNode).type,
              frequency: (node as BiquadFilterNode).frequency.value,
            }
          : kind === "compressor"
            ? {
                threshold: (node as DynamicsCompressorNode).threshold.value,
                ratio: (node as DynamicsCompressorNode).ratio.value,
              }
            : {
                ceiling: Math.max(...(node as WaveShaperNode).curve!),
                oversample: (node as WaveShaperNode).oversample,
              }),
      })),
    );
    assert(
      graph.some(
        (n) => "frequency" in n && n.frequency === 6500 && n.type === "lowpass",
      ),
    );
    assert.deepEqual(
      graph.filter((n) => "threshold" in n).map((n) => [n.threshold, n.ratio]),
      [
        [-1, 20],
        [-20, 4],
        [-3, 20],
      ],
    );
    assert(
      graph
        .filter((n) => "ceiling" in n)
        .every((n) => n.ceiling < 0.9 && n.oversample === "4x"),
    );
    assert.equal(
      await p.evaluate(() => (window as unknown as Win).__contexts.length),
      1,
    );
    // Keep simulation untouched: the sound harness drives only the presentation transport.
    for (const scene of ["arena:2", "arena:3"]) {
      await p.evaluate(
        (scene) => (window as unknown as Win).__audio.scene(scene),
        scene,
      );
      const id = scene === "arena:2" ? "arena-c" : "arena-d";
      await p.waitForFunction(
        (id) => (window as unknown as Win).__audio.snapshot().music?.id === id,
        id,
      );
      const a = await audio(p);
      assert.equal(a.music!.duration, 150);
      assert.equal(a.music!.offset, 0);
      assert.equal(a.decodedBuffers[id]!.duration, 150);
      assert.equal(a.decodedBuffers[id]!.channels, 2);
    }
    await p.waitForTimeout(350);
    await p.evaluate(() => (window as unknown as Win).__audio.pause(true));
    await p.waitForTimeout(200);
    assert.equal((await audio(p)).music, null);
    await p.evaluate(() => (window as unknown as Win).__audio.pause(false));
    await p.waitForFunction(
      () =>
        (window as unknown as Win).__audio.snapshot().music?.id === "arena-d",
    );
    const resumed = await audio(p);
    assert(resumed.music!.offset >= 0.3 && resumed.music!.offset < 5);
    await p.evaluate(() => {
      const a = (window as unknown as Win).__audio;
      for (const scene of [
        "arena:2",
        "arena:3",
        "arena:4",
        "arena:3",
        "arena:2",
      ])
        a.scene(scene);
    });
    await p.waitForFunction(
      () =>
        (window as unknown as Win).__audio.snapshot().music?.id === "arena-c",
    );
    assert((await audio(p)).musicVoices <= 2);
    if (height === 1080) {
      // A real 148-second transport run proves full-track progression, without a fake clock or a short-loop substitute.
      await p.waitForFunction(
        () =>
          (window as unknown as Win).__audio.snapshot().music?.id === "arena-d",
        undefined,
        { timeout: 160000 },
      );
      const a = await audio(p);
      assert.equal(a.scene, "arena:2");
      assert.equal(a.music!.offset, 0);
      assert.equal(a.music!.duration, 150);
      runs.push({ kind: "natural-full-track-playlist", audio: a });
    }
    runs.push({
      height,
      kind: "full-track-transport",
      resumed,
      audio: await audio(p),
    });
    await p.evaluate(() =>
      (window as unknown as Win).__audio.scene("camp:day"),
    );
    await p.evaluate(() =>
      (window as unknown as Win).__audio.play("voice.collar"),
    );
    await played(p, "voice.collar");
    await p.waitForTimeout(220);
    const ducked = (await audio(p)).duckGains;
    assert(ducked.music! < 0.6 && ducked.effects! < 0.6);
    await click(p, "wait", "camp");
    await played(p, "camp-dusk", "music-play");
    assert((await audio(p)).musicVoices <= 2);
    await click(p, "wait", "camp");
    await played(p, "camp-night", "music-play");
    await shot(p, "camp-night-music", height);
    await p.keyboard.press("Escape");
    await screen(p, "pause");
    const pause = await audio(p);
    assert.equal(pause.worldPaused, true);
    await click(p, "open-settings", "settings");
    await click(p, "sound", "audio-settings");
    const before = (await audio(p)).settings;
    for (const bus of ["master", "music", "effects", "voice", "ui"])
      await click(p, `volume-${bus}-down`);
    const adjusted = (await audio(p)).settings;
    assert.equal(adjusted.master, Math.round((before.master - 0.1) * 10) / 10);
    await click(p, "audio-mute");
    assert.equal((await audio(p)).settings.muted, true);
    await click(p, "audio-preview");
    assert((await audio(p)).logs.some((e) => e.event === "muted"));
    await click(p, "audio-mute");
    for (let i = 0; i < 8; i++) {
      await click(p, "audio-preview");
      await p.waitForTimeout(220);
    }
    await click(p, "voice-preview");
    await played(p, "voice.preview");
    await shot(p, "audio-settings", height);
    assert.deepEqual(
      JSON.parse(await p.evaluate(() => localStorage.getItem("mage-audio")!)),
      (await audio(p)).settings,
    );
    await click(p, "back", "settings");
    await click(p, "back", "pause");
    await click(p, "resume", "camp");
    await p.waitForFunction(
      () => (window as unknown as Win).__audio.snapshot().music !== null,
    );
    assert(
      (await audio(p)).logs.some(
        (e) =>
          e.event === "music-play" &&
          ((e.detail as { offset?: number })?.offset ?? 0) > 0,
      ),
    );
    await p.keyboard.press("Escape");
    await screen(p, "pause");
    await click(p, "main-menu", "menu");
    await click(p, "training-arena", "training");
    await click(p, "training-magic", "composition");
    await click(p, "composition-start", "arena");
    await played(p, "arena-a", "music-play");
    const aim = await p.evaluate(() => {
      const a = (window as unknown as Win).__arena;
      return a.project(a.snapshot().state.actors[1]!.pos);
    });
    await p.mouse.move(aim.x, aim.y);
    await p.mouse.down();
    await p.waitForTimeout(650);
    await p.mouse.up();
    await played(p, "cast.water");
    await p.keyboard.down("KeyD");
    await p.keyboard.press("Space");
    await p.waitForTimeout(350);
    await p.keyboard.up("KeyD");
    await played(p, "roll");
    await p.evaluate(() =>
      (window as unknown as Win).__arena.setBot("perfect"),
    );
    await played(p, "perfect", "play", 25000);
    await played(p, "arena-c", "music-play", 30000);
    await played(p, "arena-d", "music-play", 30000);
    await p.waitForFunction(
      () => (window as unknown as Win).__audio.snapshot().scene === "arena:4",
      undefined,
      { timeout: 30000 },
    );
    await played(p, "collar");
    await shot(p, "arena-audio-tier-four", height);
    const state = await p.evaluate(() =>
      (window as unknown as Win).__arena.snapshot(),
    );
    assert(state.player.metrics.perfects > 0);
    assert.equal(state.player.tier, 4);
    // Explicit load stress exercises the real policy and logging without mutating the core.
    await p.evaluate(async () => {
      const a = (window as unknown as Win).__audio;
      await Promise.all(Array.from({ length: 24 }, () => a.play("impact")));
      await a.play("perfect");
    });
    const stress = await audio(p);
    assert(stress.logs.some((e) => e.event === "cooldown"));
    assert(stress.active.length <= 12);
    assert(stress.musicVoices <= 2);
    const settings = stress.settings;
    await p.reload();
    await screen(p, "training");
    assert.deepEqual((await audio(p)).settings, settings);
    assert.equal((await audio(p)).state, "locked");
    runs.push({
      height,
      graph,
      ducked,
      pause,
      settings,
      unlockTicks: state.player.unlockTicks,
      perfects: state.player.metrics.perfects,
      audio: stress,
    });
    await context.close();
    current = undefined;
  }
  for (const mode of ["missing-all", "corrupt-ui"]) {
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
      }),
      p = await context.newPage();
    current = p;
    p.on("pageerror", (e) => errors.push(e.message));
    if (mode === "missing-all")
      await p.route("**/audio/**", (route) => route.abort());
    else {
      const manifest = JSON.parse(
        readFileSync("packages/game/public/audio/manifest.json", "utf8"),
      );
      const bytes = Buffer.from("invalid audio, checksum deliberately valid");
      manifest.assets["ui-click"].sha256 = createHash("sha256")
        .update(bytes)
        .digest("hex");
      await p.route("**/audio/manifest.json", (route) =>
        route.fulfill({ json: manifest }),
      );
      await p.route("**/audio/ui-click.mp3", (route) =>
        route.fulfill({ body: bytes, contentType: "audio/mpeg" }),
      );
    }
    await p.goto("http://127.0.0.1:4195/?harness=1");
    await screen(p, "menu");
    await click(p, "pick-character", "character");
    await click(p, "choose-water", "camp");
    await click(p, "wait", "camp");
    assert.equal((await view(p)).hour, 18);
    await p.waitForFunction(() =>
      (window as unknown as Win).__audio
        .snapshot()
        .logs.some(
          (e) => e.event === "manifest-silent" || e.event === "asset-silent",
        ),
    );
    await shot(p, mode, 1080);
    faults.push({ mode, audio: await audio(p) });
    await context.close();
    current = undefined;
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    join(out, "browser.json"),
    JSON.stringify(
      {
        label:
          "measured headless WebAudio graph/events; audio cannot be listened to headlessly",
        command: "npx tsx packages/tools/src/u6b-audio.ts",
        passed: true,
        runs,
        faults,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({ passed: true, runs: runs.length, faults: faults.length }),
  );
} catch (error) {
  if (current) {
    await current.screenshot({ path: join(out, "failure.png") });
    writeFileSync(
      join(out, "failure.json"),
      JSON.stringify(
        {
          error: String(error),
          ui: await ui(current),
          audio: await audio(current),
          errors,
          serverLog,
        },
        null,
        2,
      ),
    );
  }
  throw error;
} finally {
  await browser.close();
  server.kill();
}
