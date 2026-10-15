// Who sets renderGroup.structureDidChange per frame (desktop chromium). usage: node churn.mjs [fixture|tiro3|training]
import { createRequire } from "node:module";
const require = createRequire((process.env.REPO ?? process.cwd()) + "/package.json");
const { chromium } = require("playwright");
const mode = process.argv[2] ?? "fixture", query = process.argv[3] ?? "";
const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11"] });
const p = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
p.setDefaultTimeout(120000);
p.on("pageerror", (e) => console.log("pageerror:", e.message, (e.stack ?? "").split(String.fromCharCode(10)).slice(0, 8).join(" | ")));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await p.goto(`http://127.0.0.1:4174/${mode === "tiro3" ? "" : "training"}?harness&${query}`);
await p.waitForFunction(() => ["training", "menu"].includes(window.__ui?.snapshot().screen));
const click = async (id) => { const b = (await p.evaluate(() => window.__ui.snapshot())).buttons.find((b) => b.id === id); await p.mouse.click(b.x + b.w / 2, b.y + b.h / 2); await sleep(500); };
const artReady = () => p.waitForFunction(() => window.__ui.snapshot().art.pending === 0 && !window.__arena?.snapshot().loading);
if (mode === "tiro3") {
  await click("training-arena"); await click("training-tiro"); await click("composition-start"); await artReady();
  await p.evaluate(() => window.__arena.setReferencePlayer(true));
  for (let wave = 0; wave < 2; wave++) {
    for (let i = 0; i < 60; i++) { const ph = await p.evaluate(() => { const a = window.__arena; a.runGamesTicks(600); return a.snapshot().games?.phase; }); if (ph !== "active") break; }
    await p.waitForFunction(() => window.__ui.snapshot().screen === "results"); await click("next-bout");
    await p.waitForFunction((w) => window.__arena.snapshot().games?.wave === w, wave + 1); await artReady();
  }
  await p.evaluate(() => window.__arena.setReferencePlayer(true));
} else { await click("training-magic"); await click("composition-start"); await artReady(); if (mode === "fixture") await p.evaluate(() => window.__arena.artFixture("water")); else await p.evaluate(() => window.__arena.setBot?.("perfect")); }
await sleep(2000);
const out = await p.evaluate(() => new Promise((resolve) => {
  const rg = window.__pixi.stage.renderGroup; const counts = {}; let frames = 0, sets = 0;
  let v = rg.structureDidChange;
  Object.defineProperty(rg, "structureDidChange", { get: () => v, set(x) { if (x) { if (!v) sets++; const st = new Error().stack.split("\n").slice(2, 5).map((l) => l.trim().replace(/\(http.*\/assets\//, "(").replace(/^at /, "")).join(" < "); counts[st] = (counts[st] ?? 0) + 1; } v = x; }, configurable: true });
  const pipes = window.__pixi.renderer.renderPipes; const vr = {};
  const path = (o) => { const a = []; while (o && a.length < 5) { a.push((o.constructor.name) + (o.label ? ":" + o.label : "") + (o.text !== undefined ? "[" + String(o.text).slice(0, 20) + "]" : "")); o = o.parent; } return a.join(" < "); };
  for (const [name, pipe] of Object.entries(pipes)) if (pipe?.validateRenderable) { const o = pipe.validateRenderable.bind(pipe); pipe.validateRenderable = (r) => { const x = o(r); if (x) { const k = name + " " + path(r) + (r.context ? " mode=" + r.context.batchMode + " gpuBatches=" + (r._gpuData[window.__pixi.renderer.uid]?.batches.length) + " idx=" + r.parent?.children.indexOf(r) : ""); vr[k] = (vr[k] ?? 0) + 1; } return x; }; }
  window.__vr = vr;
  const f = () => { if (++frames < 300) requestAnimationFrame(f); else resolve({ frames, sets, top: Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 25).concat(Object.entries(vr).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => ["VALIDATE " + k, v])) }); };
  requestAnimationFrame(f);
}));
console.log("frames", out.frames, "rebuild triggers/frame", (out.sets / out.frames).toFixed(2));
for (const [k, n] of out.top) console.log(String(n).padStart(5), k.slice(0, 400));
await browser.close();
