import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const destination = new URL('../../../docs/waves/W4-evidence/', import.meta.url); mkdirSync(destination, { recursive: true });
const fixture = JSON.parse(readFileSync(new URL('competence-ladder.json', destination), 'utf8')).completion;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4177', '--strictPort'], { cwd: fileURLToPath(new URL('..', import.meta.url)), windowsHide: true, stdio: 'ignore' });
let browser;
try {
  const url = `http://127.0.0.1:4177/?harness=1&seed=${fixture.seed}`;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await page.waitForFunction(() => window.__arena?.snapshot().state.tick > 1);
  const snapshot = () => page.evaluate(() => window.__arena.snapshot());
  await page.locator('#start-tiro').click(); await page.locator('[data-preset="2"]').click(); await page.locator('#composition-start').click();
  let initial = await snapshot(); assert.equal(initial.games.wave, 0); assert.equal(initial.state.actors.length, 7);
  assert(await page.locator('#compose').isDisabled(), 'Loadout locked during Games');
  await page.keyboard.down('KeyD'); await page.waitForTimeout(400); await page.keyboard.up('KeyD');
  assert((await snapshot()).player.pos.x > initial.player.pos.x + 1, 'Real keyboard moves in Games');
  const bounds = await page.locator('canvas').boundingBox(); await page.mouse.move(bounds.x + bounds.width * 0.75, bounds.y + bounds.height / 2);
  await page.mouse.down(); await page.waitForTimeout(400); await page.mouse.up(); assert((await snapshot()).player.metrics.casts > 0, 'Real mouse casts in Games');
  await page.screenshot({ path: fileURLToPath(new URL('01-tiro-soldiers.png', destination)) });
  // Reset after real-input checks. This explicitly selected seed uses the unchanged reference policy,
  // with no HP/mana/attack mutation; fast-forward only calls the ordinary fixed-step entry point.
  await page.evaluate(seed => { window.__arena.startGames(seed); window.__arena.setReferencePlayer(true); }, fixture.seed);
  const checkpoints = [];
  for (let wave = 0; wave < 4; wave++) {
    if (wave === 2) { await page.evaluate(() => window.__arena.runGamesTicks(300)); await page.waitForTimeout(50); await page.screenshot({ path: fileURLToPath(new URL('03-mage-semifinal.png', destination)) }); }
    await page.evaluate(() => window.__arena.runGamesTicks(10800)); await page.waitForTimeout(60);
    const s = await snapshot(); checkpoints.push({ wave: wave + 1, phase: s.games.phase, hp: s.player.hp, mana: s.player.mana, tier: s.player.tier });
    assert.equal(s.games.phase, wave === 3 ? 'complete' : 'intermission', `Reference completes bout ${wave + 1}`);
    if (wave === 0) await page.screenshot({ path: fileURLToPath(new URL('02-recovery-intermission.png', destination)) });
    if (wave < 3) {
      const oldHp = s.player.hp; await page.locator('#next-bout').click(); const next = await snapshot();
      assert.equal(next.games.wave, wave + 1); assert.equal(next.player.tier, 1); assert(next.player.hp >= oldHp, 'Recovery does not reduce HP');
    }
  }
  await page.screenshot({ path: fileURLToPath(new URL('04-tiro-champion.png', destination)) });
  const result = (await snapshot()).games.result; assert.deepEqual(result, fixture.result);
  await page.locator('#retry-games').click(); await page.evaluate(() => window.__arena.runGamesTicks(10800)); await page.waitForTimeout(50);
  assert.equal((await snapshot()).games.phase, 'lost', 'Idle player loses by ordinary damage');
  await page.screenshot({ path: fileURLToPath(new URL('05-missio.png', destination)) });
  for (const id of ['conscript','shieldman','slinger','netter','cinder_hound','mire_maw','thornback','hush_moth']) {
    await page.locator('#scenario').selectOption(`enemy:${id}`); const s = await snapshot();
    assert.equal(s.mode, 'roster'); assert(s.state.actors.slice(1).every(a => a.enemy.id === id));
    if (id === 'thornback') { await page.waitForFunction(() => window.__arena.snapshot().state.telegraphs.some(t => t.kind === 'charge')); await page.screenshot({ path: fileURLToPath(new URL('06-thornback-warning.png', destination)) }); }
    if (id === 'hush_moth') { assert.equal(s.state.actors.length, 7); await page.screenshot({ path: fileURLToPath(new URL('07-moth-pack.png', destination)) }); }
  }
  assert.deepEqual(errors, []);
  const report = { label: 'measured', command: 'npm --prefix packages/game run smoke:w4', browser: browser.version(), errors,
    checks: ['real keyboard/mouse in Tiro', 'exact soldier roster', 'loadout lock', 'four reference-policy bouts', 'explicit next-bout recovery', 'tier reset', 'one final payout', 'ordinary damage missio', 'all eight roster entries', 'charge telegraph and moth pack'],
    completionFixture: { seed: fixture.seed, policy: 'same reference input controller as census; fast-forward ticks, no actor buffs', checkpoints, result },
    limitations: ['Completion seed was selected explicitly and is not a win-rate sample.', 'Other schools remain Water proxies.', 'Feel remains owner-only.'] };
  writeFileSync(new URL('browser.json', destination), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
} finally { await browser?.close(); server.kill(); }
