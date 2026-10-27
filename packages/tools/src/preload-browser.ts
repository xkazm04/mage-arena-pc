// Arena art preload gate: no raw layer on a visible frame, no stepping while loading.
// Usage: npm run build:game && tsx packages/tools/src/preload-browser.ts [outDir]
import { chromium, type BrowserContext, type Page } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { firstGlInvalid, isGlInvalid } from "./smoke/gl-errors.ts";
import type { CanvasUI } from "../../game/src/ui/ui.ts";
import type { ArenaGame } from "../../game/src/arena-entry.ts";

type Snap = ReturnType<ArenaGame["snapshot"]>;
interface Frame {
  at: number;
  gate: number;
  screen: string;
  mode: string;
  wave?: number;
  tick: number;
  loadingFrames: number;
  ground: string;
  bodies: { entity: string; source: string; page?: string }[];
  sigilsReady: boolean;
  sigilsDrawn: number;
  effectsReady: boolean;
  missingPages: string[];
}
type Win = Window & {
  __ui: { snapshot(): ReturnType<CanvasUI["snapshot"]> };
  __arena: {
    snapshot(): Snap;
    frameLog(): Frame[];
    setReferencePlayer(on: boolean): void;
    runGamesTicks(n: number): void;
  };
};
const port = 4199,
  base = `http://127.0.0.1:${port}`,
  out = resolve(process.argv[2] ?? join(tmpdir(), "mage-preload"));
mkdirSync(out, { recursive: true });
const painted = new Set(
  Object.keys(
    JSON.parse(
      readFileSync(
        "assets/accepted/covenant/a14/packed/characters.json",
        "utf8",
      ),
    ).entities,
  ),
);
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
      MAGE_SAVE_DIRECTORY: mkdtempSync(join(tmpdir(), "mage-preload-")),
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
const results: Record<string, unknown> = {};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** 1.5-3 s, fixed per file, so runs are comparable. */
const delayFor = (url: string) =>
  1500 +
  ([...url].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 1501);
const isArt = (url: URL) =>
  url.pathname.startsWith("/assets/accepted/covenant/") &&
  !url.pathname.endsWith("/covenant/manifest.json");

interface Run {
  delay: boolean;
  abort?: RegExp;
  hang?: RegExp;
  timeoutS?: number;
}
async function open(path: string, run: Run) {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  await context.route(
    (url) => isArt(url),
    async (route) => {
      const url = route.request().url();
      if (run.abort?.test(url)) return route.abort();
      if (run.hang?.test(url)) return; // never answered; the loader's own fetch timeout ends it
      if (run.delay) await sleep(delayFor(url));
      await route.continue().catch(() => {});
    },
  );
  const page = await context.newPage(),
    warnings: string[] = [],
    errors: string[] = [];
  page.on("console", (m) => {
    if (isGlInvalid(m.text())) glInvalid.push(m.text());
    if (m.type() === "warning") warnings.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  const query = `?harness${run.timeoutS ? `&preloadTimeoutS=${run.timeoutS}` : ""}`;
  await page.goto(`${base}${path}${query}`);
  await page.waitForFunction(
    () => document.body.dataset.ready === "true",
    null,
    {
      timeout: 60_000,
    },
  );
  return { context, page, warnings, errors };
}
// Every console line from a rejected GL call, across the running case.
const glInvalid: string[] = [];
async function clean<T>(run: () => Promise<T>): Promise<T> {
  glInvalid.length = 0;
  const r = await run();
  assert.equal(
    glInvalid.length,
    0,
    `${glInvalid.length} GL_INVALID console line(s); first: ${firstGlInvalid(glInvalid)}`,
  );
  return r;
}
const ui = (p: Page) =>
  p.evaluate(() => (window as unknown as Win).__ui.snapshot());
const arena = (p: Page) =>
  p.evaluate(() => (window as unknown as Win).__arena.snapshot());
const frames = (p: Page) =>
  p.evaluate(() => (window as unknown as Win).__arena.frameLog());
async function click(p: Page, id: string) {
  await p.waitForFunction(
    (id) =>
      (window as unknown as Win).__ui
        .snapshot()
        .buttons.some((b) => b.id === id && !b.disabled),
    id,
    { timeout: 30_000 },
  );
  const b = (await ui(p)).buttons.find((b) => b.id === id && !b.disabled)!;
  await p.mouse.click(b.x + b.w / 2, b.y + b.h / 2);
}
/** Waits for the gate to open, then checks every logged visible frame since it opened. */
async function gateOpened(p: Page, label: string, expectTick?: number) {
  const started = Date.now();
  await p.waitForFunction(
    () => {
      const a = (window as unknown as Win).__arena;
      return !!a && !a.snapshot().loading && a.frameLog().length > 0;
    },
    null,
    { timeout: 30_000, polling: 50 },
  );
  const snap = await arena(p);
  await p.waitForFunction(
    (gate) =>
      (window as unknown as Win).__arena
        .frameLog()
        .filter((f) => f.gate === gate).length >= 10,
    snap.preload.opened,
    { timeout: 10_000 },
  );
  const log = (await frames(p)).filter((f) => f.gate === snap.preload.opened);
  const first = log[0]!;
  const raw = log.flatMap((f) =>
    [
      f.ground !== "A12" ? `ground ${f.ground}` : "",
      ...f.bodies
        .filter((b) => painted.has(b.entity) && b.source !== "A10")
        .map((b) => `${b.entity} ${b.source} ${b.page ?? ""}@${f.tick}`),
      f.sigilsReady && f.effectsReady ? "" : "manifest not ready",
    ].filter(Boolean),
  );
  return {
    label,
    readyMs: Math.round(snap.preload.last?.ms ?? -1),
    waitedMs: Date.now() - started,
    timedOut: snap.preload.last?.timedOut,
    missing: snap.preload.last?.missing,
    loadingFrames: first.loadingFrames,
    framesChecked: log.length,
    rawLayerFrames: raw.length,
    rawLayers: [...new Set(raw)],
    firstFrame: {
      tick: first.tick,
      expectTick,
      screen: first.screen,
      ground: first.ground,
      bodies: first.bodies,
      sigilsDrawn: first.sigilsDrawn,
      effectsReady: first.effectsReady,
    },
    residentMiB: Math.round((await ui(p)).art.rgbaMiB),
  };
}
function strict(r: Awaited<ReturnType<typeof gateOpened>>) {
  assert.equal(
    r.rawLayerFrames,
    0,
    `${r.label}: ${r.rawLayers.join(", ")} ${JSON.stringify({ ...r, firstFrame: undefined })}`,
  );
  assert.equal(r.firstFrame.tick, r.firstFrame.expectTick ?? 0, r.label);
  assert.equal(r.timedOut, false, r.label);
  assert.deepEqual(r.missing, [], r.label);
}

async function training(delay: boolean) {
  let pausedWhileLoading = false;
  const { context, page, warnings, errors } = await open("/", { delay });
  await click(page, "training-arena");
  await click(page, "training-magic");
  await click(page, "composition-start");
  if (delay) {
    await page.waitForFunction(
      () => (window as unknown as Win).__arena?.snapshot().loading,
      null,
      { polling: 50 },
    );
    await sleep(300);
    await page.screenshot({ path: join(out, "loading-card.png") });
    // Pause still answers while the card is up, and the bout does not step behind it.
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => (window as unknown as Win).__ui.snapshot().screen === "pause",
    );
    pausedWhileLoading = (await arena(page)).loading;
    await click(page, "resume");
  }
  const r = await gateOpened(page, `training${delay ? " delayed" : ""}`);
  strict(r);
  if (delay) assert.ok(pausedWhileLoading, "paused during loading");
  await context.close();
  return { ...r, pausedWhileLoading, warnings, errors };
}
async function tiro(delay: boolean, waitForPrefetch: boolean) {
  const { context, page, warnings, errors } = await open("/", { delay });
  await click(page, "training-arena");
  await click(page, "training-tiro");
  await click(page, "composition-start");
  const wave1 = await gateOpened(page, `tiro wave 1${delay ? " delayed" : ""}`);
  strict(wave1);
  await page.evaluate(() =>
    (window as unknown as Win).__arena.setReferencePlayer(true),
  );
  for (let i = 0; i < 40; i++) {
    const phase = await page.evaluate(() => {
      const a = (window as unknown as Win).__arena;
      a.runGamesTicks(600);
      return a.snapshot().games?.phase;
    });
    if (phase !== "active") break;
  }
  const cleared = await arena(page);
  assert.equal(
    cleared.games?.phase,
    "intermission",
    "reference player clears wave 1",
  );
  await page.waitForFunction(
    () => (window as unknown as Win).__ui.snapshot().screen === "results",
  );
  if (waitForPrefetch)
    await page.waitForFunction(
      () =>
        (window as unknown as Win).__arena.snapshot().preload.prefetch?.ms !==
        undefined,
      null,
      { timeout: 30_000 },
    );
  const before = await arena(page);
  await click(page, "next-bout");
  await page.waitForFunction(
    () => (window as unknown as Win).__arena.snapshot().games?.wave === 1,
  );
  const waveStart = (await arena(page)).games!.waveStartTick;
  const wave2 = await gateOpened(
    page,
    `tiro wave 2${delay ? " delayed" : ""}${waitForPrefetch ? " after prefetch" : " continued at once"}`,
    waveStart,
  );
  strict(wave2);
  const after = await arena(page);
  await context.close();
  return {
    wave1,
    wave2,
    prefetch: after.preload.prefetch,
    prefetchDoneBeforeContinue: before.preload.prefetch?.ms !== undefined,
    cardFramesAcrossContinue:
      after.preload.loadingFrames - before.preload.loadingFrames,
    warnings,
    errors,
  };
}
async function lab(delay: boolean) {
  const { context, page, warnings, errors } = await open("/", { delay });
  await click(page, "combat-feel-lab");
  const first = await gateOpened(page, `lab dummy${delay ? " delayed" : ""}`);
  strict(first);
  await click(page, "lab-config-opponent");
  await click(page, "lab-config-start");
  await page.waitForFunction(
    () => (window as unknown as Win).__arena.snapshot().preload.opened >= 2,
    null,
    { timeout: 30_000 },
  );
  const mage = await gateOpened(page, `lab mage${delay ? " delayed" : ""}`);
  strict(mage);
  assert.ok(
    mage.firstFrame.bodies.some(
      (b) => b.entity === "brennic" && b.source === "A10",
    ),
    "lab fire rival is painted",
  );
  await context.close();
  return { first, mage, warnings, errors };
}
async function failure(kind: "abort" | "hang", timeoutS?: number) {
  const target = /a12\/plates\/verdigris\.png/;
  const t0 = Date.now();
  const { context, page, warnings, errors } = await open("/", {
    delay: false,
    ...(kind === "abort" ? { abort: target } : { hang: target }),
    timeoutS,
  });
  await click(page, "training-arena");
  await click(page, "training-magic");
  await click(page, "composition-start");
  const r = await gateOpened(
    page,
    `${kind} plate${timeoutS ? ` (timeout ${timeoutS} s)` : ""}`,
  );
  await sleep(1500);
  const lines = warnings.filter((w) => w.startsWith("Arena art"));
  const snap = await arena(page);
  await context.close();
  assert.equal(lines.length, 1, lines.join("\n"));
  assert.equal(r.firstFrame.tick, 0);
  return {
    ...r,
    totalMs: Date.now() - t0,
    log: lines,
    groundAfter: snap.groundSource,
    errors,
  };
}
async function menu(delay: boolean) {
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  await context.route(
    (url) => isArt(url),
    async (route) => {
      if (delay) await sleep(delayFor(route.request().url()));
      await route.continue().catch(() => {});
    },
  );
  const page = await context.newPage(),
    t0 = Date.now();
  await page.goto(`${base}/?harness`);
  await page.waitForFunction(
    () => (window as unknown as Win).__ui?.snapshot().screen === "menu",
    null,
    { polling: "raf", timeout: 60_000 },
  );
  const s = await ui(page);
  await context.close();
  const needed = [
    "place.door",
    "portrait.cassia.neutral",
    "a13.page.inscription.collar",
  ];
  const missing = needed.filter((k) => !s.art.residentKeys.includes(k));
  assert.deepEqual(missing, [], "menu first paint");
  return {
    label: `menu${delay ? " delayed" : ""}`,
    firstPaintMs: Date.now() - t0,
    missing,
  };
}

try {
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {
      /* starting */
    }
    await sleep(100);
  }
  results.menu = [
    await clean(() => menu(false)),
    await clean(() => menu(true)),
  ];
  results.training = [
    await clean(() => training(false)),
    await clean(() => training(true)),
  ];
  results.lab = [await clean(() => lab(false)), await clean(() => lab(true))];
  results.tiro = [
    await clean(() => tiro(false, true)),
    await clean(() => tiro(true, true)),
    await clean(() => tiro(true, false)),
  ];
  results.failure = [
    await clean(() => failure("abort")),
    await clean(() => failure("hang", 3)),
    await clean(() => failure("hang")),
  ];
  writeFileSync(
    join(out, "preload-results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} catch (e) {
  writeFileSync(
    join(out, "preload-results.json"),
    JSON.stringify(results, null, 2),
  );
  console.error(serverLog.slice(-2000));
  throw e;
} finally {
  await browser.close();
  server.kill();
}
