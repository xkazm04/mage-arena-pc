// usage: node ablate.mjs <label> <training|stress> <query>
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
const require = createRequire((process.env.REPO ?? process.cwd()) + "/package.json");
const { chromium } = require("playwright");
const [label = "abl", scenario = "stress", query = "", framesArg = "300"] = process.argv.slice(2);
const N = Number(framesArg), base = "http://127.0.0.1:4174";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const p = b.contexts()[0].pages()[0];
p.setDefaultTimeout(120000);
const ui = () => p.evaluate(() => window.__ui.snapshot());
async function screen(id) { await p.waitForFunction((id) => { const s = window.__ui?.snapshot(); return s?.screen === id && !s.busy; }, id, { polling: 200 }); }
async function click(id, next) { const bt = (await ui()).buttons.find((b) => b.id === id && !b.disabled); await p.mouse.click(bt.x + bt.w / 2, bt.y + bt.h / 2); if (next) await screen(next); else await sleep(300); }
await p.goto(`${base}/training?harness${query ? "&" + query : ""}`);
await screen("training");
await click("training-magic"); await click("composition-start", "arena");
await p.waitForFunction(() => window.__ui.snapshot().art.pending === 0 && !window.__arena?.snapshot().loading, null, { polling: 250 });
if (scenario === "stress") await p.evaluate(() => window.__arena.artFixture("stress"));
else await p.evaluate(() => window.__arena.artFixture("water"));
await sleep(2500);
await p.evaluate(() => {
  const P = WebGL2RenderingContext.prototype; const c = (window.__gl = { draws: 0, tris: 0, fbo: 0, tex: 0, frames: 0 });
  for (const n of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) { const o = P[n]; P[n] = function (...a) { c.draws++; c.tris += (n.startsWith("drawElements") ? a[1] : a[2]) / 3; return o.apply(this, a); }; }
  const bf = P.bindFramebuffer; P.bindFramebuffer = function (...a) { c.fbo++; return bf.apply(this, a); };
  for (const n of ["texImage2D", "texSubImage2D"]) { const o = P[n]; P[n] = function (...a) { c.tex++; return o.apply(this, a); }; }
  const app = window.__pixi, world = app.stage.children[0], root = app.stage.children[1];
  window.__layers = { world, root, names: world.children.map((c, i) => `${i}:${c.constructor.name}:${c.children?.length ?? 0}`) };
  window.__tree = (n = world, d = 0, path = "") => (n.children ?? []).map((c, i) => `${"  ".repeat(d)}${path}${i} ${c.constructor.name} ${c.label ?? ""} vis=${c.visible} ${c.texture?.source ? (c.texture.source?.width + "x" + c.texture.source?.height) : ""} ${Math.round(c.width ?? 0)}x${Math.round(c.height ?? 0)} kids=${c.children?.length}` + (d < 2 && c.children?.length ? String.fromCharCode(10) + window.__tree(c, d + 1, path + i + ".") : "")).join(String.fromCharCode(10));
});
const names = await p.evaluate(() => window.__layers.names);
console.log(names.join(" | "));
if (process.env.TREE) console.log(await p.evaluate(() => window.__tree()));
const measure = (n) => p.evaluate((n) => new Promise((resolve) => {
  const iv = []; let last = 0; const g = window.__gl; const g0 = { ...g };
  const f = (t) => { iv.push(t - last); last = t; if (iv.length < n) requestAnimationFrame(f); else resolve({ iv, draws: (g.draws - g0.draws) / n, tris: (g.tris - g0.tris) / n, fbo: (g.fbo - g0.fbo) / n, tex: (g.tex - g0.tex) / n, cpu: window.__ui.performance().cpu.slice(-n) }); };
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(f); });
}), n);
const st = (iv) => { const s = iv.toSorted((a, b) => a - b); const q = (x) => +s[Math.floor(s.length * x)].toFixed(1); return { fps: +(1000 / (iv.reduce((a, b) => a + b, 0) / iv.length)).toFixed(1), p50: q(0.5), p95: q(0.95), over: +(iv.filter((x) => x > 17.5).length / iv.length * 100).toFixed(0) }; };
const results = [];
const run = async (name, hide) => {
  await p.evaluate((hide) => { const L = window.__layers; const all = (n) => { n.visible = true; n.children?.forEach(all); }; L.world.children.forEach(all); L.root.visible = true;
    for (const h of hide) { if (h === "hud") { L.root.visible = false; continue; } let n = L.world; for (const i of String(h).split(".")) n = n.children[Number(i)]; if (n) n.visible = false; } }, hide);
  await sleep(800);
  const r = await measure(N);
  const row = { name, ...st(r.iv), cpu: +(r.cpu.reduce((a, b) => a + b, 0) / r.cpu.length).toFixed(1), draws: +r.draws.toFixed(1), tris: Math.round(r.tris), fbo: +r.fbo.toFixed(2), tex: +r.tex.toFixed(2) };
  results.push(row); console.log(JSON.stringify(row));
};
const layers = process.env.LAYERS ? JSON.parse(process.env.LAYERS) : null;
await run("all", []);
if (layers) for (const [name, hide] of layers) await run(name, hide);
else for (let i = 0; i < names.length; i++) await run(`-${names[i]}`, [i]);
if (!layers) { await run("-hud", ["hud"]); await run("nothing", [...names.keys(), "hud"]); }
await p.evaluate(() => { const L = window.__layers; L.world.children.forEach((c) => (c.visible = true)); L.root.visible = true; });
mkdirSync("results", { recursive: true });
writeFileSync(`results/ablate-${label}-${scenario}.json`, JSON.stringify(results, null, 1));
await b.close();
