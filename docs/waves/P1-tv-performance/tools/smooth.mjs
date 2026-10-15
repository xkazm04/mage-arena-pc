// Movement smoothness on the TV: per-frame on-screen motion of the player and the world while walking.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire((process.env.REPO ?? process.cwd()) + "/package.json");
const { chromium } = require("playwright");
const [label = "smooth", query = ""] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const p = b.contexts()[0].pages()[0]; p.setDefaultTimeout(120000);
const ui = () => p.evaluate(() => window.__ui.snapshot());
async function screen(id) { await p.waitForFunction((id) => { const s = window.__ui?.snapshot(); return s?.screen === id && !s.busy; }, id, { polling: 200 }); }
async function click(id, next) { const bt = (await ui()).buttons.find((b) => b.id === id && !b.disabled); await p.mouse.click(bt.x + bt.w / 2, bt.y + bt.h / 2); if (next) await screen(next); else await sleep(300); }
await p.goto(`http://127.0.0.1:4174/training?harness${query ? "&" + query : ""}`);
await screen("training"); await click("training-magic"); await click("composition-start", "arena");
await p.waitForFunction(() => window.__ui.snapshot().art.pending === 0 && !window.__arena?.snapshot().loading, null, { polling: 250 });
await sleep(1500);
await p.evaluate(() => {
  const w = window.__pixi.stage.children[0], floor = w.children[0], figs = w.children[5];
  window.__trace = []; window.__tracing = true;
  const f = (t) => { const a = figs.children.find((c) => c.label === "actor:1"); window.__trace.push([t, floor.x, floor.y, a ? a.x : NaN, a ? a.y : NaN]); if (window.__tracing) requestAnimationFrame(f); };
  requestAnimationFrame(f);
});
await p.keyboard.down("ShiftLeft");
for (const key of (process.env.KEYS ?? "KeyD,KeyA").split(",")) { await p.keyboard.down(key); await sleep(Number(process.env.HOLD ?? 4000)); await p.keyboard.up(key); await sleep(300); }
await p.keyboard.up("ShiftLeft");
const tr = await p.evaluate(() => { window.__tracing = false; return window.__trace; });
// player position in world-pixels = actor screen pos - floor offset (floor carries the camera); per-frame velocity in px/ms
const rows = [];
for (let i = 1; i < tr.length; i++) {
  const dt = tr[i][0] - tr[i - 1][0];
  const wx = (tr[i][3] - tr[i][1]) - (tr[i - 1][3] - tr[i - 1][1]), wy = (tr[i][4] - tr[i][2]) - (tr[i - 1][4] - tr[i - 1][2]);
  const sx = tr[i][3] - tr[i - 1][3], cx = tr[i][1] - tr[i - 1][1], cy = tr[i][2] - tr[i - 1][2];
  rows.push({ dt, v: Math.hypot(wx, wy) / dt, sx, cam: Math.hypot(cx, cy) / dt });
}
const moving = rows.filter((r) => r.v > 0.02);
const stats = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); return { mean: +m.toFixed(4), cv: +(sd / m).toFixed(3) }; };
const dts = moving.map((r) => r.dt);
const camMoving = rows.filter((r) => r.cam > 0.01);
// "step" = world displacement per displayed frame; judder shows as uneven steps at even frame intervals
// steady state: ratio of displacement to frame time, frames where speed within 10% of the median moving speed
const med = moving.map((r) => r.v).toSorted((a, b) => a - b)[Math.floor(moving.length / 2)];
const steady = moving.filter((r) => Math.abs(r.v - med) < 0.5 * med);
const camSteady = camMoving.length ? camMoving.map((r) => r.cam) : [];
const camMed = camSteady.toSorted((a, b) => a - b)[Math.floor(camSteady.length / 2)];
console.log("steady", JSON.stringify({ steadyFrames: steady.length, playerPxPerMs: stats(steady.map((r) => r.v)), camFrames: camSteady.length, camPxPerMs: camSteady.length ? stats(camSteady.filter((v) => Math.abs(v - camMed) < 0.5 * camMed)) : null }));
console.log(JSON.stringify({ label, frames: rows.length, movingFrames: moving.length, frameMs: stats(dts), playerSpeed: stats(moving.map((r) => r.v)), cameraSpeed: camMoving.length ? stats(camMoving.map((r) => r.cam)) : null, over17: +(dts.filter((x) => x > 17.5).length / dts.length * 100).toFixed(1) }));
writeFileSync(`results/smooth-${label}.json`, JSON.stringify(tr));
await b.close();
