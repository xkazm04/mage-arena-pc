import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const evidence = process.argv[2] ?? 'W3-evidence';
if (!/^W(?:3|4b|7)-evidence(?:\/[a-z-]+)?$/.test(evidence)) throw Error('Invalid evidence directory');
const destination = new URL(`../../../docs/waves/${evidence}/`, import.meta.url); mkdirSync(destination, { recursive: true });
const server = spawn(process.execPath, ['--import', 'tsx', '../../node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4176', '--strictPort'], { cwd: fileURLToPath(new URL('..', import.meta.url)), windowsHide: true, stdio: 'ignore' });
let browser;
try {
  const url = 'http://127.0.0.1:4176/training?harness=1';
  for (let i = 0; i < 100; i++) { try { if ((await fetch(url)).ok) break; } catch { /* Wait for preview readiness. */ } await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await page.waitForFunction(() => window.__arena?.snapshot().state.tick > 1);
  const snapshot = () => page.evaluate(() => window.__arena.snapshot());
  await page.locator('#compose').click(); assert((await snapshot()).paused, 'Composition pauses combat');
  await page.locator('[data-preset="1"]').click();
  await page.screenshot({ path: fileURLToPath(new URL('01-composition-mirror-tide.png', destination)) });
  assert((await page.locator('.curve').innerText()).includes('Rain of Orbs'), 'Chosen IV-B is visible');
  await page.locator('[data-line="1"]').selectOption('mirror'); assert(await page.locator('#composition-start').isDisabled(), 'Duplicate slots rejected');
  await page.locator('[data-preset="1"]').click(); await page.locator('#composition-start').click();
  assert.deepEqual((await snapshot()).player.water.composition.lines, ['mirror','mend','tide_orb']);
  const target = await page.evaluate(() => window.__arena.project(window.__arena.snapshot().state.actors[1].pos));
  await page.mouse.move(target.x, target.y);
  await page.keyboard.press('Digit4'); await page.mouse.click(target.x, target.y);
  await page.waitForFunction(() => window.__arena.snapshot().player.metrics.damageDealt > 0);
  assert((await snapshot()).player.water.cooldowns.tide_orb > 0, 'Selected line spends cooldown');
  await page.screenshot({ path: fileURLToPath(new URL('02-water-practice.png', destination)) });
  await page.locator('#compose').click(); await page.locator('[data-preset="0"]').click(); await page.locator('[data-branch="lash"]').selectOption('B');
  await page.screenshot({ path: fileURLToPath(new URL('03-custom-branches.png', destination)) });
  await page.locator('#composition-start').click(); await page.evaluate(() => window.__arena.setBot('perfect'));
  await page.waitForFunction(() => window.__arena.snapshot().player.tier === 2);
  assert((await page.locator('[data-slot="1"] .slot-name').innerText()) === 'Riptide', 'The same slot climbs to chosen tier II');
  await page.screenshot({ path: fileURLToPath(new URL('04-tier-two-in-place.png', destination)) });
  assert.deepEqual(errors, []);
  const report = { label: 'measured', command: `npm --prefix packages/game run smoke:w3 -- ${evidence}`, browser: browser.version(), errors,
    checks: ['production boot', 'composition pauses simulation', 'preset preview', 'duplicate slots blocked', 'chosen branches applied', 'mouse/number-key line cast hits target', 'line cooldown', 'in-place tier upgrade'],
    finalTier: (await snapshot()).player.tier, finalSlot: await page.locator('[data-slot="1"] .slot-name').innerText(), ownerFeel: 'not measured' };
  writeFileSync(new URL('browser.json', destination), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
} finally { await browser?.close(); server.kill(); }
