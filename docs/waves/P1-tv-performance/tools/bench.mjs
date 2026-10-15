// usage: node bench.mjs <label> <scenario: training|tiro3|stress|menu> [frames] [query]
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
const require = createRequire((process.env.REPO ?? process.cwd()) + "/package.json");
const { chromium } = require("playwright");
const [label = "run", scenario = "training", framesArg = "600", query = ""] = process.argv.slice(2);
const N = Number(framesArg), base = process.env.BASE ?? "http://127.0.0.1:4174";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const p = b.contexts()[0].pages()[0];
p.setDefaultTimeout(120000);
p.on("pageerror", (e) => console.log("PAGEERROR", e.message, (e.stack ?? "").split(String.fromCharCode(10)).slice(0, 14).join(" | ")));
const ui = () => p.evaluate(() => window.__ui.snapshot());
async function screen(id) { await p.waitForFunction((id) => { const s = window.__ui?.snapshot(); return s?.screen === id && !s.busy; }, id, { polling: 200 }); }
async function click(id, next) {
  const bt = (await ui()).buttons.find((b) => b.id === id && !b.disabled);
  if (!bt) throw Error(`missing ${id}: ${(await ui()).buttons.map((b) => b.id)}`);
  await p.mouse.click(bt.x + bt.w / 2, bt.y + bt.h / 2);
  if (next) await screen(next); else await sleep(300);
}
const t0 = Date.now();
await p.goto(`${base}/${scenario === "tiro3" ? "" : "training"}?harness${query ? "&" + query : ""}`);
await p.waitForFunction(() => document.body.dataset.ready === "true" || window.__ui?.snapshot().screen === "training", null, { polling: 250 });
const loadS = (Date.now() - t0) / 1000;
await p.waitForFunction(() => ["training", "menu"].includes(window.__ui?.snapshot().screen) && !window.__ui.snapshot().busy, null, { polling: 200 });
const artReady = () => p.waitForFunction(() => window.__ui.snapshot().art.pending === 0 && !window.__arena?.snapshot().loading, null, { polling: 250 });
let stopInput = false, inputLoop;
if (scenario === "menu") {
  // measure the training menu itself
} else if (scenario === "tiro3") {
  await click("training-arena"); await click("training-tiro"); await click("composition-start", "arena"); await artReady();
  await p.evaluate(() => window.__arena.setReferencePlayer(true));
  for (let wave = 0; wave < 2; wave++) {
    for (let i = 0; i < 60; i++) {
      const phase = await p.evaluate(() => { const a = window.__arena; a.runGamesTicks(600); return a.snapshot().games?.phase; });
      if (phase !== "active") break;
    }
    await screen("results"); await click("next-bout");
    await p.waitForFunction((w) => window.__arena.snapshot().games?.wave === w, wave + 1, { polling: 250 });
    await artReady();
  }
  await p.evaluate(() => window.__arena.setReferencePlayer(true));
} else {
  await click("training-magic"); await click("composition-start", "arena"); await artReady();
  if (scenario === "stress") { await p.evaluate(() => window.__arena.artFixture("stress")); await sleep(2500); }
  else if (scenario === "training") {
    const keys = ["KeyW", "KeyD", "KeyS", "KeyA"]; let k = 0;
    inputLoop = (async () => {
      while (!stopInput) {
        const key = keys[k++ % 4]; await p.keyboard.down(key);
        for (let i = 0; i < 3 && !stopInput; i++) { await p.mouse.move(480 + 200 * Math.cos(k + i), 270 + 120 * Math.sin(k + i)); await p.mouse.down(); await sleep(120); await p.mouse.up(); await sleep(150); }
        await p.keyboard.up(key);
      }
    })();
  }
}
if (process.env.PRE) await p.evaluate(process.env.PRE);
if (process.env.FIX) await p.evaluate((f) => window.__arena.artFixture(f), process.env.FIX);
await sleep(2000);
await p.evaluate(() => { window.__ui.resetPerformance(); window.__ui.resetPhases?.(); });
const res = await p.evaluate((n) => new Promise((resolve) => {
  const iv = [], lt = []; let last = 0;
  let po; try { po = new PerformanceObserver((l) => { for (const e of l.getEntries()) lt.push(Math.round(e.duration)); }); po.observe({ type: "longtask" }); } catch {}
  const f = (t) => { iv.push(t - last); last = t; if (iv.length < n) requestAnimationFrame(f); else { po?.disconnect(); resolve({ iv, lt }); } };
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(f); });
}), N);
stopInput = true; await inputLoop;
if (process.env.POST) console.log("POST", JSON.stringify(await p.evaluate(process.env.POST))); await p.keyboard.up("KeyW").catch(() => {});
const extra = await p.evaluate(() => {
  const perf = window.__ui.performance(), a = window.__arena?.snapshot?.(), u = window.__ui.snapshot();
  const c = document.querySelector("canvas");
  return { cpu: perf.cpu, phases: perf.phases, canvas: [c.width, c.height], screen: u.screen,
    projectiles: a?.visibleProjectiles, figures: a?.animation?.displayed?.length, effects: a?.effects && { allocated: a.effects.allocated, cpuMs: a.effects.cpuMs },
    textureMiB: (u.art.rgbaBytes + u.uiTextureBytes + u.fontTextureBytes + (a?.derivedTextureBytes ?? 0)) / 1048576,
    heapMiB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null, wave: a?.games?.wave, phase: a?.games?.phase };
});
const pct = (a, q) => { const s = a.toSorted((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * q))].toFixed(1); };
const st = (a) => a && a.length ? { p50: pct(a, 0.5), p95: pct(a, 0.95), p99: pct(a, 0.99), mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) } : null;
const iv = res.iv;
const out = {
  label, scenario, query, frames: iv.length, loadS,
  fps: +(1000 / (iv.reduce((x, y) => x + y, 0) / iv.length)).toFixed(1),
  frame: st(iv), over16_7: +(iv.filter((x) => x > 17.5).length / iv.length * 100).toFixed(1), over33: +(iv.filter((x) => x > 34.5).length / iv.length * 100).toFixed(1),
  hist: { "<=17.5": iv.filter((x) => x <= 17.5).length, "17.5-34.5": iv.filter((x) => x > 17.5 && x <= 34.5).length, "34.5-51": iv.filter((x) => x > 34.5 && x <= 51).length, ">51": iv.filter((x) => x > 51).length },
  longTasks: { count: res.lt.length, max: Math.max(0, ...res.lt) },
  ...extra, cpu: st(extra.cpu), cpuRaw: extra.cpu, phasesRaw: extra.phases,
  phases: extra.phases ? Object.fromEntries(Object.entries(extra.phases).map(([k, v]) => [k, st(v)?.mean + "/" + st(v)?.p95])) : undefined,
};
delete out.cpuRaw;
const show = { ...out }; delete show.phasesRaw; delete show.cpuRaw;
console.log(JSON.stringify(show));
mkdirSync("results", { recursive: true });
writeFileSync(`results/${label}-${scenario}.json`, JSON.stringify({ ...out, iv }, null, 1));
if (process.env.SHOT) await p.screenshot({ path: `results/${label}-${scenario}.png` });
await b.close();
