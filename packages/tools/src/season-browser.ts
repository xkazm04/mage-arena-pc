import { chromium, type Page } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { applyBoutInput, bridgeRules, linkBout, type SeasonBout, type TrialStance } from '@mage/core';
import { idleInput, type InputFrame } from '@mage/core/arena';
import type { SeasonView } from '../../game/src/season-api.ts';
import { SeasonPolicy } from './season-policy.ts';
const out = 'docs/waves/W7-evidence'; mkdirSync(`${out}/screens`, { recursive: true });
const base = process.env.CAMP_URL ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11'] });
const errors: string[] = [], runs: unknown[] = [];
const view = (page: Page) => page.evaluate(async () => (await fetch('/api/session')).json()) as Promise<SeasonView>;
const shot = (page: Page, name: string) => page.screenshot({ path: `${out}/screens/${name}.png` });
async function click(page: Page, selector: string) {
  const before = await view(page); await page.locator(selector).click();
  await page.waitForFunction(async revision => (await (await fetch('/api/session')).json()).revision !== revision, before.revision);
  await page.waitForTimeout(120);
}
async function visit(page: Page, place: string) {
  await page.locator('[data-scene="map"]').click(); await page.locator(`[data-place="${place}"]`).click();
  if ((await view(page)).location !== place) await click(page, '[data-visit]'); else await page.locator('[data-visit]').click();
}
async function training(page: Page, place: string) {
  await visit(page, place); const v = await view(page), i = v.actions.findIndex(a => a.intent === 'TRAIN');
  await click(page, i >= 0 ? `[data-action="${i}"]` : '[data-command="wait"]');
}
type ArenaWindow = Window & { __seasonArena: { snapshot(): SeasonBout; inputs(frames: InputFrame[]): Promise<void>; pause(value: boolean): void } };
try {
  for (const height of [1080, 1440]) {
    const context = await browser.newContext({ viewport: { width: height === 1080 ? 1920 : 2560, height } });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/?harness=1`); await page.locator('#pick-character').click();
    await page.locator('#choose-water').waitFor(); assert.equal(await page.locator('.character button:disabled').count(), 3);
    await shot(page, `${height}-character-pick`); await page.locator('#choose-water').click(); await page.waitForSelector('body[data-ready=true]');
    await shot(page, `${height}-camp-map`);
    await page.keyboard.press('Escape'); await page.locator('#settings-dialog[open]').waitFor(); await shot(page, `${height}-controls`); await page.locator('#resume-season').click();
    const checkpoints: unknown[] = [];
    while ((await view(page)).day.day <= 14) {
      const v = await view(page), day = v.day.day;
      if (v.day.games) {
        await page.locator('#prepare-games').click(); await page.locator('[data-preset="2"]').click(); await page.locator('#composition-start').click();
        await page.waitForFunction(() => !!(window as unknown as ArenaWindow).__seasonArena);
        // Real native input once, followed by an external observation-only policy through the same replay endpoint.
        await page.locator('canvas').focus(); await page.keyboard.down('KeyD'); await page.waitForTimeout(150); await page.keyboard.up('KeyD');
        await page.mouse.move(height, height / 2); await page.mouse.down(); await page.waitForTimeout(150); await page.mouse.up();
        await page.mouse.down({ button: 'right' }); await page.waitForTimeout(150); await page.mouse.up({ button: 'right' });
        await page.evaluate(() => (window as unknown as ArenaWindow).__seasonArena.pause(true));
        await page.waitForTimeout(200); await shot(page, `${height}-day-${day}-games`);
        const policy = new SeasonPolicy();
        for (let batch = 0; batch < 400; batch++) {
          const b = linkBout(await page.evaluate(() => (window as unknown as ArenaWindow).__seasonArena.snapshot()));
          if (b.phase === 'terminal') break;
          if (b.phase === 'intermission') { await page.locator('#next-bout').click(); await page.waitForTimeout(100); continue; }
          const frames: InputFrame[] = [];
          for (let i = 0; i < 240 && b.phase === 'active'; i++) {
            const input = day === 14 ? idleInput() : policy.frame(b.games!); frames.push(input);
            applyBoutInput(b, { type: 'tick', tick: b.games!.state.tick, input });
          }
          await page.evaluate(async inputs => (window as unknown as ArenaWindow).__seasonArena.inputs(inputs), frames);
        }
        const ended = await page.evaluate(() => (window as unknown as ArenaWindow).__seasonArena.snapshot()); assert.equal(ended.phase, 'terminal');
        checkpoints.push({ day, result: ended.games!.result, tick: ended.games!.state.tick, spectator: ended.spectator });
        await shot(page, `${height}-day-${day}-result`); await page.locator('#return-camp').click(); await page.waitForSelector('body[data-ready=true]');
        assert.equal(await page.locator('canvas').count(), 1);
      } else if (day === 2) {
        await visit(page, 'commons'); await page.locator('[data-parley-target="nysa"]').click();
        await shot(page, `${height}-knowing-parley`); await page.locator('[data-parley-card]').first().click();
        await page.locator('.parley-result .reply').waitFor(); await page.locator('[data-parley-close]').click();
      } else await training(page, 'yard');
      let current = await view(page);
      if (current.slot === 'dusk') {
        if (current.day.eve) {
          await visit(page, 'pit'); await click(page, '#start-trial');
          while ((await view(page)).season.trial!.phase === 'active') {
            const tell = (await view(page)).season.trial!.tell!;
            const stance = Object.entries(bridgeRules.trial.beats).find(([, value]) => value === tell)![0] as TrialStance;
            await click(page, `#trial-${stance}`);
          }
          await shot(page, `${height}-day-${day}-trial`); await click(page, '#receive-trial');
        } else await training(page, 'pit');
      }
      current = await view(page);
      if (day === 1) {
        await visit(page, 'tent'); await click(page, '[data-command="listen"]');
        const deadline = Date.now() + 65000;
        while (!(await view(page)).nightFinished && Date.now() < deadline) {
          const n = (await view(page)).listening!;
          await page.keyboard.press(`Digit${n.beacon + 1}`);
          if (n.beacon !== n.patrol || n.warning) await page.keyboard.down('Space'); else await page.keyboard.up('Space');
          await page.waitForTimeout(180);
        }
        await page.keyboard.up('Space'); assert.equal((await view(page)).listening!.learned, 'K-nysa-bread'); await shot(page, `${height}-night-knowing`);
      } else if (!current.nightFinished) await click(page, '[data-command="wait"]');
      await click(page, '[data-command="dawn"]');
      if ([7, 14].includes(day)) await shot(page, `${height}-day-${day + 1}-board`);
    }
    const final = await view(page); assert(final.season.complete); assert.equal(final.season.receipts.length, 4); assert(final.board.length > 0);
    await shot(page, `${height}-two-weeks`); runs.push({ height, checkpoints, receipts: final.season.receipts, day: final.day.day });
    await context.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/season-browser.json`, JSON.stringify({ label: 'measured browser route, simulated scripted policy; owner feel unmeasured', command: 'npx tsx packages/tools/src/season-browser.ts', runs, errors }, null, 2) + '\n');
  console.log(JSON.stringify({ runs: runs.length, errors }));
} finally { await browser.close(); }
