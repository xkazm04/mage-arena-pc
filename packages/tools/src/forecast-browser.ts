import { chromium, type Page } from "playwright";
import assert from "node:assert/strict";
import type { HarnessWindow } from "../../game/src/harness-contract.ts";
import { startPreview } from "./smoke/preview.ts";
import { click, screen, ui } from "./smoke/driver.ts";
/** Lab forecast in the built game at 1080p: worker wall time per forecast and main-thread frame times while it runs. */
const shotPath = process.argv[2];
const preview = await startPreview({ savePrefix: "mage-forecast-" }).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11"] });
const q = (a: number[], f: number) => a.toSorted((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * f))]!;
const status = async (p: Page) => (await ui(p)).texts.find((t) => /baseline in|vs Current in|Simulating|simulating shortly|failed/.test(t.text))?.text ?? "";
/** Waits for the forecast to finish, sampling frame times every second (the UI ring keeps only 360 frames). */
async function measure(p: Page, label: string, expect: RegExp) {
  const started = Date.now(), frames: number[] = [], cpu: number[] = [];
  await p.evaluate(() => (window as unknown as HarnessWindow).__ui.resetPerformance());
  let text: string;
  for (;;) {
    await p.waitForTimeout(1000);
    const perf = await p.evaluate(() => { const w = window as unknown as HarnessWindow, r = w.__ui.performance(); w.__ui.resetPerformance(); return r; });
    frames.push(...perf.frames); cpu.push(...perf.cpu);
    text = await status(p);
    if (expect.test(text) || /failed/.test(text)) break;
    if (Date.now() - started > 120000) throw Error(`${label}: forecast did not finish (${text})`);
  }
  return { label, status: text, wallS: (Date.now() - started) / 1000, frames: frames.length, frameP50Ms: q(frames, 0.5), frameP95Ms: q(frames, 0.95), cpuP95Ms: q(cpu, 0.95) };
}
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await context.newPage(), errors: string[] = [];
  p.on("pageerror", (e) => { errors.push(String(e)); console.error(e); });
  await p.goto(`${preview.base}/?harness=1`);
  await screen(p, "menu");
  await click(p, "combat-feel-lab");
  await click(p, "lab-config-start");
  await p.keyboard.press("KeyT");
  await screen(p, "lab-tuning");
  await click(p, "lab-tuning-live"); // keep the Lab simulating behind the panel while the worker runs
  const runs = [await measure(p, "Current (cold, includes debounce)", /baseline in/)];
  await click(p, "lab-preset-Snappier");
  runs.push(await measure(p, "Snappier vs cached Current (includes debounce)", /vs Current in/));
  if (shotPath) { await p.mouse.move(10, 10); await p.screenshot({ path: shotPath }); }
  const snap = await ui(p), forecast = snap.texts.filter((t) => t.x >= 1300 && t.y >= 600 && t.y < 920).map((t) => t.text);
  console.log(JSON.stringify({ runs, forecast, overflow: snap.overflow, errors }, null, 2));
  assert.deepEqual(errors, []);
  assert.deepEqual(snap.overflow, []);
  assert(forecast.includes("simulated · reference policy · n=50"));
} finally {
  await browser.close();
  preview.close();
}
