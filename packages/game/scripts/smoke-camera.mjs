import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import assert from 'node:assert/strict';

const directory = new URL('../../../docs/waves/W4b-evidence/', import.meta.url);
mkdirSync(directory, { recursive: true });
const runtime = JSON.parse(readFileSync(new URL('../../core/src/arena/data/runtime.json', import.meta.url), 'utf8'));
const contract = JSON.parse(readFileSync(new URL('../../../art/scale-contract-v1.json', import.meta.url), 'utf8'));
const server = spawn(process.execPath, ['--import', 'tsx', '../../node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4178', '--strictPort'], { cwd: fileURLToPath(new URL('..', import.meta.url)), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let output = ''; server.stdout.on('data', d => { output += d; }); server.stderr.on('data', d => { output += d; });
let browser, page;
const errors = [], views = [], performanceResults = [], aimChecks = [];
const quantile = (values, q) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * q))];
try {
  const url = 'http://127.0.0.1:4178/training?harness=1&debug=1';
  for (let i = 0; i < 100; i++) { try { if ((await fetch(url)).ok) break; } catch { /* Wait for preview readiness. */ } await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11'] });
  page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  const snapshot = () => page.evaluate(() => window.__arena.snapshot());
  const fixture = kind => page.evaluate(kind => window.__arena.visualFixture(kind), kind);
  const zoom = async value => { await page.locator('#zoom').fill(String(value)); await page.locator('#zoom').dispatchEvent('input'); await page.waitForFunction(z => window.__arena.snapshot().camera.zoom === z, value); };
  const shot = name => page.screenshot({ path: fileURLToPath(new URL(name, directory)) });
  await page.goto(url); await page.waitForFunction(() => window.__arena?.snapshot().state.tick > 1);
  for (const [width, height] of [contract.reference_viewport_px, contract.second_viewport_px]) {
    await page.setViewportSize({ width, height }); await page.waitForFunction(h => window.__arena.snapshot().camera.height === h, height);
    for (const z of [1.2, 0.8]) {
      await zoom(z); await fixture('scale');
      const s = await snapshot();
      assert.equal(s.camera.elevation, 55); assert(Math.abs(s.cameraMetrics.figureHeightPx - height * 0.05 * z) < 1e-8);
      assert.equal(await page.locator('canvas').evaluate(c => c.width), width);
      assert.equal(await page.locator('canvas').evaluate(c => c.height), height);
      const rect = await page.locator('canvas').boundingBox(); assert.equal(rect.height, height); assert.equal(rect.width, width);
      await shot(`${height}p-${z === 1.2 ? 'near' : 'far'}-scale.png`);
      views.push({ viewport: { width, height }, zoom: z, camera: s.camera, metrics: s.cameraMetrics, screenshot: `${height}p-${z === 1.2 ? 'near' : 'far'}-scale.png`, label: 'paused authored visual fixture; zero-damage effects, real projection/renderer' });
    }
    await zoom(1.2); await fixture('scale'); await page.locator('#scale-debug').click();
    await shot(`${height}p-near-clean.png`); await page.locator('#scale-debug').click();
    // W4c drives actual pointer input, then only advances the ordinary fixed-step kernel.
    for (const z of [0.8, 1.2]) {
      await zoom(z);
      for (let octant = 0; octant < 8; octant++) {
        await page.evaluate(angle => window.__arena.visualFixture('aim', angle), octant * Math.PI / 4);
        const target = await page.evaluate(() => { const s = window.__arena.snapshot(); return window.__arena.project(s.state.actors[1].pos); });
        await page.mouse.click(target.x, target.y);
        const aimed = await snapshot(), intended = aimed.state.actors[1].pos;
        assert(Math.hypot(aimed.aim.x - intended.x, aimed.aim.y - intended.y) < 0.05, 'Real mouse maps to projected ground feet');
        await page.evaluate(() => window.__arena.stepInput(120));
        const s = await snapshot(); assert.equal(s.state.actors[1].metrics.hits, 1, `Ground hit: ${height}p / ${z} / octant ${octant}`);
        aimChecks.push({ viewportHeight: height, zoom: z, octant, hits: s.state.actors[1].metrics.hits, damage: s.player.metrics.damageDealt, groundAimErrorM: Math.hypot(aimed.aim.x - intended.x, aimed.aim.y - intended.y) });
      }
    }
    await zoom(1.2); await fixture('depth');
    let s = await snapshot(); assert.deepEqual(s.sortedActorIds, [s.state.actors[1].id, s.player.id, s.state.actors[2].id]);
    await shot(`${height}p-foot-depth-order.png`);
    // A stationary pointer must stay over the same screen pixel when the camera follows.
    const cursor = { x: width * 0.65, y: height * 0.6 }; await page.mouse.move(cursor.x, cursor.y);
    await page.evaluate(() => window.__arena.panPlayer({ x: 20, y: 18 }));
    const remapped = await page.evaluate(() => window.__arena.project(window.__arena.snapshot().aim));
    assert(Math.hypot(remapped.x - cursor.x, remapped.y - cursor.y) < 1e-7);
    // Measure production rendering with 100 moving, on-screen projectiles, no fast-forward.
    await page.evaluate(() => window.__arena.reset('performance'));
    await page.waitForFunction(() => window.__arena.snapshot().projectiles === 100 && window.__arena.snapshot().visibleProjectiles === 100);
    const start = await page.evaluate(() => window.__arena.performance().frameCount);
    await page.waitForFunction(({ start, count }) => window.__arena.performance().frameCount > start + count, { start, count: runtime.presentation.performanceFrames + runtime.presentation.performanceWarmupFrames }, { timeout: 60000 });
    const perf = await page.evaluate(() => window.__arena.performance()); s = await snapshot();
    assert.equal(s.projectiles, 100); assert.equal(s.visibleProjectiles, 100);
    assert(perf.projectileSamples.every(n => n === 100) && perf.visibleProjectileSamples.every(n => n === 100), 'Every sampled frame contains 100 visible projectiles');
    const gpu = await page.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'); const ext = gl?.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unavailable'; });
    const result = { viewport: { width, height }, zoom: s.camera.zoom, projectileCount: s.projectiles, visibleProjectileCount: s.visibleProjectiles, minimumVisibleAcrossSamples: Math.min(...perf.visibleProjectileSamples), minimumProjectilesAcrossSamples: Math.min(...perf.projectileSamples), cpuBudgetMs: runtime.presentation.cpuP95BudgetMs, targetFps: runtime.presentation.targetFps, fpsToleranceFraction: runtime.presentation.fpsToleranceFraction, overlay: true, samples: perf.frames.length, fpsFromMeanFrame: 1000 * perf.frames.length / perf.frames.reduce((a, b) => a + b, 0), frameP50Ms: quantile(perf.frames, 0.5), frameP95Ms: quantile(perf.frames, 0.95), cpuP50Ms: quantile(perf.cpu, 0.5), cpuP95Ms: quantile(perf.cpu, 0.95), gpu };
    performanceResults.push(result); console.log(JSON.stringify(result));
    await shot(`${height}p-100-projectiles.png`);
    // Ordinary live encounter evidence is separate from the authored comparison fixture.
    await page.evaluate(() => window.__arena.startRoster('thornback'));
    await page.waitForFunction(() => window.__arena.snapshot().state.telegraphs.some(t => t.kind === 'charge'));
    await shot(`${height}p-live-charge.png`);
  }
  // Asset boundary integration: padded accepted-size frame, one failed frame, then full fallback.
  await page.route('**/test-manifest.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, frames: { 'mage.player': { url: 'test-mage.svg', width: 100, height: 120, headY: 10, soleY: 110, footX: 50 }, dummy: { url: 'missing-frame.png', width: 100, height: 120, headY: 10, soleY: 110, footX: 50 } } }) }));
  await page.route('**/test-mage.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="120"><path d="M50 10 L75 110 L25 110Z" fill="#246d91"/></svg>' }));
  await page.route('**/missing-frame.png', route => route.fulfill({ status: 404, body: '' }));
  await page.goto(`${url}&sprites=test-manifest.json`);
  await page.waitForFunction(() => window.__arena?.snapshot().sprites.loaded === 1 && window.__arena.snapshot().sprites.diagnostics.length === 1);
  const assets = (await snapshot()).sprites;
  await page.route('**/invalid-manifest.json', route => route.fulfill({ contentType: 'application/json', body: '{"version":9,"frames":{}}' }));
  await page.goto(`${url}&sprites=invalid-manifest.json`);
  await page.waitForFunction(() => window.__arena?.snapshot().sprites.diagnostics.length === 1);
  assert.equal((await snapshot()).sprites.loaded, 0);
  const report = { label: 'measured', command: 'npm --prefix packages/game run smoke:w4b', machine: { platform: os.platform(), release: os.release(), cpu: os.cpus()[0]?.model, node: process.version, browser: browser.version(), browserArgs: ['--use-angle=d3d11'] }, errors, views, performance: performanceResults, aimChecks, assetBoundary: { loadedAndFailedFrameProbe: assets, invalidManifestFallback: (await snapshot()).sprites }, checks: ['native full viewport at both resolutions', 'near and far camera numbers', 'ground-space arc and warning fixtures', 'upright foot-depth order', `${aimChecks.length} real-pointer ground hits`, 'stationary cursor remaps on follow', '100 visible moving projectiles at both resolutions', 'live charge telegraphs', 'sprite loading and procedural fallback'], limitations: ['Comparison and overlap screenshots use explicitly paused authored fixtures.', 'CPU timing includes simulation, rendering submission and HUD; GPU completion is not timed.', 'Headless Chromium requestAnimationFrame is not physical input-to-photon latency.', 'Motion readability, camera feel and aim comfort require owner judgment.', 'Projectile cores have a visual minimum; collision radii remain ground-space data.'] };
  writeFileSync(new URL('browser.json', directory), JSON.stringify(report, null, 2) + '\n');
  assert.deepEqual(errors, []);
  for (const p of performanceResults) { assert(p.cpuP95Ms < runtime.presentation.cpuP95BudgetMs, 'CPU p95 within 8 ms'); assert(p.fpsFromMeanFrame >= runtime.presentation.targetFps * (1 - runtime.presentation.fpsToleranceFraction), '60 fps within 2% scheduling tolerance'); }
  console.log(`W4b passed: ${views.length} scale views, ${aimChecks.length} real pointer hits, both performance resolutions, assets and depth order.`);
} catch (error) { console.error(output, errors); if (page) console.error(await page.evaluate(() => ({ ready: !!window.__arena, text: document.body.innerText.slice(0, 1200) }))); throw error; }
finally { await browser?.close(); server.kill(); }
