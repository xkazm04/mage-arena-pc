import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import assert from 'node:assert/strict';
const evidence = process.argv[2] ?? 'W2-evidence';
if (!/^W(?:[234]|4b|7)-evidence(?:\/[a-z-]+)?$/.test(evidence)) throw Error('Invalid evidence directory');
const directory = new URL(`../../../docs/waves/${evidence}/`, import.meta.url);
mkdirSync(directory, { recursive: true });
const runtime = JSON.parse(readFileSync(new URL('../../core/src/arena/data/runtime.json', import.meta.url), 'utf8'));
const port = 4175;
const server = spawn(process.execPath, ['--import', 'tsx', '../../node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: fileURLToPath(new URL('..', import.meta.url)), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let output = ''; server.stdout.on('data', data => { output += data; }); server.stderr.on('data', data => { output += data; });
let browser, page;
const errors = [];
try {
  const url = `http://127.0.0.1:${port}/training?harness=1`;
  for (let i = 0; i < 100; i++) { try { const response = await fetch(url); if (response.ok) break; } catch { /* Wait for preview readiness. */ } await new Promise(resolve => setTimeout(resolve, 100)); }
  browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11'] });
  page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') console.error(e.text()); });
  await page.goto(url); await page.waitForFunction(() => window.__arena?.snapshot().state.tick > 1);
  const snap = () => page.evaluate(() => window.__arena.snapshot());
  const reset = async kind => { await page.evaluate(kind => window.__arena.reset(kind), kind); await page.locator('canvas').focus(); };
  const target = await page.evaluate(() => window.__arena.project(window.__arena.snapshot().state.actors[1].pos)); await page.mouse.move(target.x, target.y);
  await reset('magic'); const initial = await snap();
  await page.keyboard.down('KeyD'); await page.waitForTimeout(350); await page.keyboard.up('KeyD');
  assert((await snap()).player.pos.x > initial.player.pos.x + 1, 'WASD movement');
  await page.keyboard.down('Shift'); await page.keyboard.down('KeyW'); await page.waitForTimeout(250); await page.keyboard.up('KeyW'); await page.keyboard.up('Shift');
  assert((await snap()).player.stamina < initial.player.stamina, 'Sprint drains stamina');
  await page.keyboard.press('Space'); await page.waitForTimeout(100); assert((await snap()).player.metrics.rolls === 1, 'Space rolls');
  await page.waitForTimeout(500);
  await page.mouse.down({ button: 'left' }); await page.waitForTimeout(450); await page.mouse.up({ button: 'left' });
  assert((await snap()).player.metrics.casts > 0, 'Left button casts');
  await page.keyboard.press('Digit3'); assert((await snap()).slot === 2, 'Number chooses slot');
  await page.mouse.wheel(0, 100); await page.waitForTimeout(100); assert((await snap()).slot === 3, 'Wheel chooses slot');
  await page.keyboard.press('Digit1');
  await page.mouse.down({ button: 'right' }); await page.waitForTimeout(120);
  assert((await snap()).player.absorb, 'Right button holds directional ward');
  await page.screenshot({ path: fileURLToPath(new URL('01-controls-and-ward.png', directory)) });
  await page.mouse.up({ button: 'right' });
  await reset('magic'); await page.evaluate(() => window.__arena.setBot('perfect'));
  await page.waitForFunction(() => window.__arena.snapshot().player.metrics.perfects > 0);
  await page.screenshot({ path: fileURLToPath(new URL('02-perfect.png', directory)) });
  await page.waitForFunction(() => window.__arena.snapshot().player.tier === 2);
  assert((await snap()).player.unlockTicks[1] < 15 * 60, 'Perfects shorten collar clock');
  await page.evaluate(() => window.__arena.setBot()); await reset('charge');
  await page.waitForFunction(() => window.__arena.snapshot().state.telegraphs.length > 0);
  await page.screenshot({ path: fileURLToPath(new URL('03-unblockable-lane.png', directory)) });
  await page.locator('#pause').click(); const pausedTick = (await snap()).state.tick;
  await page.waitForTimeout(150); assert((await snap()).state.tick === pausedTick, 'Pause stops kernel');
  await reset('performance');
  await page.waitForFunction(() => window.__arena.snapshot().projectiles >= 100);
  const startedAt = await page.evaluate(() => window.__arena.performance().frameCount);
  await page.waitForFunction(({ start, count }) => window.__arena.performance().frameCount > start + count, { start: startedAt, count: runtime.presentation.performanceFrames + runtime.presentation.performanceWarmupFrames }, { timeout: 60000 });
  const perf = await page.evaluate(() => window.__arena.performance());
  await page.screenshot({ path: fileURLToPath(new URL('04-projectile-field.png', directory)) });
  const percentile = (xs, q) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * q))];
  const cpuP95Ms = percentile(perf.cpu, 0.95), frameP95Ms = percentile(perf.frames, 0.95);
  const gpu = await page.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'); const ext = gl?.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unavailable'; });
  const report = { label: 'measured', command: `npm --prefix packages/game run smoke${process.argv[2] ? ` -- ${evidence}` : ''}`, machine: { platform: os.platform(), release: os.release(), cpu: os.cpus()[0]?.model, node: process.version, browser: browser.version(), gpu, browserArgs: ['--use-angle=d3d11'] },
    checks: ['WASD movement', 'sprint stamina', 'Space roll', 'mouse aim and cast', 'number/wheel selection', 'right-button ward', 'perfect feedback and collar advance', 'unblockable telegraph', 'pause'], errors,
    performance: { projectileCount: (await snap()).projectiles, samples: perf.frames.length, fpsFromMeanFrame: 1000 / (perf.frames.reduce((a, b) => a + b, 0) / perf.frames.length), frameP50Ms: percentile(perf.frames, 0.5), frameP95Ms, cpuP50Ms: percentile(perf.cpu, 0.5), cpuP95Ms, cpuBudgetMs: runtime.presentation.cpuP95BudgetMs,
      scope: 'Chromium headless requestAnimationFrame on this PC; CPU includes fixed steps, shape building, HUD updates and renderer submission. GPU completion and physical input-to-photon latency not measured.' } };
  writeFileSync(new URL('browser.json', directory), JSON.stringify(report, null, 2) + '\n');
  assert.deepEqual(errors, [], 'No browser exceptions'); assert(cpuP95Ms < runtime.presentation.cpuP95BudgetMs, 'CPU p95 within budget');
  assert(report.performance.fpsFromMeanFrame >= runtime.presentation.targetFps * (1 - runtime.presentation.fpsToleranceFraction), 'Sustained frame rate within target tolerance');
  console.log(JSON.stringify(report, null, 2));
} catch (error) { console.error(output, errors); if (page) console.error(await page.evaluate(() => ({ ready: !!window.__arena, snapshot: window.__arena?.snapshot(), hidden: document.hidden, text: document.body.innerText.slice(0, 500) }))); throw error; }
finally { await browser?.close(); server.kill(); }
