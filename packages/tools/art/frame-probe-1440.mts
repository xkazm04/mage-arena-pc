/**
 * D2 section 7 frame probe: the art fixture's "stress" scene (100 projectiles, 12 painted figures, every
 * effect clip the a8 atlas has) at a chosen height, read through `__ui.performance()` (frame times, CPU) and
 * the per-phase CPU log of `packages/game/src/frame-probe.ts`. No assets are generated or loaded beyond the repo's.
 *
 * Needs a built game: npm run build:game
 * Run: node --import tsx packages/tools/art/frame-probe-1440.mts [height=1440] [seconds=12] [fixture=stress] [query]
 * `fixture` is an art-fixture kind ("-" sets none, e.g. to see what `?slice=d2s` alone opens) ("bar" is the D2 section 7 scene: eight bodies with the lit cassia, two beams,
 * trails, procedural sigils; "slice" is the D2 section 5 mastery slice, reported under `slice`); `query` is appended
 * to the page URL (e.g. "lighting=unlit", "sliceAt=2.2"). With MAGE_PROBE_SHOT=<png>
 * a screenshot of the last frame is saved there. Prints one JSON object. A run that could not start prints {"evaluated": false, "reason": ...} and exits 1.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

type Win = Window & {
  __ui: {
    snapshot(): {
      screen: string;
      busy: boolean;
      art: { pending: number };
      buttons: {
        id: string;
        disabled?: boolean;
        x: number;
        y: number;
        w: number;
        h: number;
      }[];
    };
    performance(): {
      frames: number[];
      cpu: number[];
      phases: Record<string, number[]>;
    };
    resetPerformance(): void;
  };
  __arena: {
    snapshot(): {
      slice?: Record<string, unknown>;
      visibleProjectiles: number;
      effects: { allocated: number; active: number };
      sigils: { active: number; procedural: Record<string, number> };
      animation: {
        lighting: Record<string, unknown>;
        displayed: {
          entity: string;
          source: string;
          lit?: boolean;
          litChoice?: string;
        }[];
      };
    };
    artFixture(k?: string): void;
  };
};
const height = Number(process.argv[2] ?? 1440),
  seconds = Number(process.argv[3] ?? 12),
  fixture = process.argv[4] ?? "stress",
  query = process.argv[5] ? `&${process.argv[5]}` : "",
  port = 4197;
const stats = (a: number[]) => {
  const s = a.toSorted((x, y) => x - y),
    at = (q: number) => s[Math.min(s.length - 1, Math.floor(s.length * q))]!;
  return {
    n: s.length,
    mean: s.reduce((n, v) => n + v, 0) / (s.length || 1),
    p50: at(0.5),
    p95: at(0.95),
    p99: at(0.99),
    max: s[s.length - 1] ?? 0,
  };
};
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
      MAGE_SAVE_DIRECTORY: mkdtempSync(`${tmpdir()}/mage-probe-`),
    },
  },
);
const fail = (reason: string) => {
  console.log(JSON.stringify({ evaluated: false, reason }));
  server.kill();
  process.exit(1);
};
try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/health`)).status < 500)
        break;
    } catch {
      /* starting */
    }
    if (i > 150) fail("preview server did not start");
    await new Promise((r) => setTimeout(r, 100));
  }
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=d3d11"],
  });
  const context = await browser.newContext({
    viewport: { width: (height * 16) / 9, height },
    deviceScaleFactor: 1,
  });
  const p = await context.newPage();
  const errors: string[] = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`http://127.0.0.1:${port}/training?harness=1${query}`);
  const screen = (id: string) =>
    p.waitForFunction(
      (id) => {
        const s = (window as unknown as Win).__ui?.snapshot();
        return s?.screen === id && !s.busy;
      },
      id,
      { timeout: 30000 },
    );
  const click = async (id: string, next: string) => {
    const b = await p.evaluate(
      (id) =>
        (window as unknown as Win).__ui
          .snapshot()
          .buttons.find((b) => b.id === id && !b.disabled),
      id,
    );
    if (!b) throw Error(`no enabled control ${id}`);
    await p.mouse.click(b.x + b.w / 2, b.y + b.h / 2);
    await screen(next);
  };
  await screen("training");
  await click("training-magic", "composition");
  await click("composition-start", "arena");
  await p.waitForFunction(
    () => (window as unknown as Win).__ui.snapshot().art.pending === 0,
    undefined,
    { timeout: 60000 },
  );
  await p.waitForTimeout(600);
  if (fixture !== "-")
    await p.evaluate(
      (k) => (window as unknown as Win).__arena.artFixture(k),
      fixture,
    );
  await p.waitForTimeout(2000);
  await p.evaluate(() => (window as unknown as Win).__ui.resetPerformance());
  await p.waitForTimeout(seconds * 1000);
  const perf = await p.evaluate(() =>
    (window as unknown as Win).__ui.performance(),
  );
  const scene = await p.evaluate(() =>
    (window as unknown as Win).__arena.snapshot(),
  );
  if (process.env.MAGE_PROBE_SHOT)
    await p.screenshot({ path: process.env.MAGE_PROBE_SHOT });
  const renderer = await p.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    return gl && ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
      : "unknown";
  });
  const frame = stats(perf.frames);
  console.log(
    JSON.stringify(
      {
        evaluated: true,
        height,
        viewport: [(height * 16) / 9, height],
        renderer,
        seconds,
        fixture,
        query,
        scene: {
          visibleProjectiles: scene.visibleProjectiles,
          effects: scene.effects,
          sigilsActive: scene.sigils.active,
          procedural: scene.sigils.procedural,
          lighting: scene.animation.lighting,
          bodies: scene.animation.displayed.map((d) => ({
            entity: d.entity,
            source: d.source,
            lit: d.lit,
            litChoice: d.litChoice,
          })),
          ...(scene.slice ? { slice: scene.slice } : {}),
        },
        frameMs: frame,
        fps: 1000 / frame.mean,
        cpuMs: stats(perf.cpu),
        phasesMs: Object.fromEntries(
          Object.entries(perf.phases).map(([k, v]) => [k, stats(v)]),
        ),
        errors,
      },
      null,
      1,
    ),
  );
  await browser.close();
} catch (e) {
  fail(String(e));
}
server.kill();
process.exit(0);
