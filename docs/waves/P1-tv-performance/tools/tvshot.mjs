// TV screenshot of a fixed arena moment. usage: node tvshot.mjs <label> <port> [query] [fixture]
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const require = createRequire((process.env.REPO ?? process.cwd()) + "/package.json");
const { chromium } = require("playwright");
const [label, port = "4174", query = "", fixture = "water"] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
const p = b.contexts()[0].pages()[0]; p.setDefaultTimeout(120000);
const ui = () => p.evaluate(() => window.__ui.snapshot());
async function screen(id) { await p.waitForFunction((id) => { const s = window.__ui?.snapshot(); return s?.screen === id && !s.busy; }, id, { polling: 200 }); }
async function click(id, next) { const bt = (await ui()).buttons.find((b) => b.id === id && !b.disabled); await p.mouse.click(bt.x + bt.w / 2, bt.y + bt.h / 2); if (next) await screen(next); else await sleep(300); }
await p.goto(`http://127.0.0.1:${port}/training?harness${query ? "&" + query : ""}`);
await screen("training"); await click("training-magic"); await click("composition-start", "arena");
await p.waitForFunction(() => window.__ui.snapshot().art.pending === 0 && !window.__arena?.snapshot().loading, null, { polling: 250 });
await sleep(1000);
if (fixture === "ring") await p.evaluate(() => window.__arena.sigilFixture("ring"));
else await p.evaluate((f) => window.__arena.artFixture(f), fixture);
await p.mouse.move(950, 530);
await sleep(2500);
const png = execFileSync("C:/Users/kazda/scoop/apps/android-clt/current/platform-tools/adb.exe", ["-s", "10.0.0.139:5555", "exec-out", "screencap", "-p"], { maxBuffer: 1 << 28 });
writeFileSync(`results/tv-${label}.png`, png);
console.log(label, png.length);
await b.close();
