import { describe, expect, it } from 'vitest';
// index.ts first: it loads kernel.ts before fire.ts/air.ts (the schools.ts import-order trap).
import { runtime } from '../src/arena/index.ts';
import { rivalBuildIds, rivalBuilds } from '../src/arena/archetypes.ts';
import { createHash } from 'node:crypto';
import { runBuildFight, summariseBuild, whyLine, type BuildSummary } from './builds-census.ts';

// The claim the 200-seed builds census makes (report in the WP2 hand-off), pinned on the first 60 census seeds per build:
// every plan reads as its archetype in its cast roles and its distance, and the answers fire on their own shape class.
// Win-rate bands are wide here (60 seeds); the census itself carries the 35-60 % reading.
const seeds = 60;
const summaries: Record<string, BuildSummary> = Object.fromEntries(rivalBuildIds.map(id =>
  [id, summariseBuild(Array.from({ length: seeds }, (_, i) => runBuildFight(runtime.games.censusSeedStart + i, id)))]));
const role = (id: string, r: string): number => summaries[id]!.roles[r] ?? 0;

describe('builds census (WP2): six authored builds against the reference player', () => {
  it('every build fights to a result inside the timeout and replays to the same hash', () => {
    for (const id of rivalBuildIds) {
      expect(summaries[id]!.timeouts, id).toBe(0);
      const a = runBuildFight(runtime.games.censusSeedStart, id), b = runBuildFight(runtime.games.censusSeedStart, id);
      expect(a.hash, id).toBe(b.hash);
    }
  });

  it('win share stays playable on the pinned seeds (the 200-seed census lands each build at 40-57 %)', () => {
    for (const id of rivalBuildIds) {
      expect(summaries[id]!.rivalWinShare, id).toBeGreaterThanOrEqual(0.2);
      expect(summaries[id]!.rivalWinShare, id).toBeLessThanOrEqual(0.8);
    }
  });

  it('each plan reads as its archetype: close holds closest and casts its short rows, light streams darts, heavy casts payoffs', () => {
    for (const school of ['fire', 'air'] as const) {
      const id = (archetype: string) => `${school}_${archetype}`;
      // Distance: the close fighter holds well inside the light and heavy builds.
      expect(summaries[id('close')]!.meanDistanceM).toBeLessThan(summaries[id('light')]!.meanDistanceM - 2);
      expect(summaries[id('close')]!.meanDistanceM).toBeLessThan(summaries[id('heavy')]!.meanDistanceM - 2);
      // Cast roles: close presses its short hitters and its dash far more than the others; light is the dart stream; heavy plays payoffs.
      expect(role(id('close'), 'hit') + role(id('close'), 'dash')).toBeGreaterThan(2 * (role(id('light'), 'hit') + role(id('light'), 'dash')));
      expect(role(id('light'), 'bolt')).toBeGreaterThan(role(id('close'), 'bolt'));
      expect(role(id('heavy'), 'payoff') + role(id('heavy'), 'signature')).toBeGreaterThan(role(id('light'), 'payoff') + role(id('light'), 'signature'));
      expect(role(id('heavy'), 'payoff') + role(id('heavy'), 'signature')).toBeGreaterThan(role(id('close'), 'payoff') + role(id('close'), 'signature'));
    }
  });

  it('the curve: the fire light build wins the short fights it gets; the heavy builds keep winning at tier IV', () => {
    const light = summaries.fire_light!.curve;
    expect(light.shortFights).toBeGreaterThan(0);
    expect(light.rivalShareShort).toBeGreaterThan(0.5);
    for (const id of ['fire_heavy', 'air_heavy']) {
      expect(summaries[id]!.curve.tier4Fights, id).toBeGreaterThan(seeds / 3);
      expect(summaries[id]!.curve.rivalShareTier4, id).toBeGreaterThan(0.35);
    }
  });

  it('shape-class answers: Air Form meets projectiles, never another class', () => {
    for (const id of rivalBuildIds.filter(i => [rivalBuilds[i]!.loadout.slots].flat().includes('air_form'))) {
      const form = summaries[id]!.answers.air_form!;
      expect(form.answered, id).toBeGreaterThan(0);
      expect(form.other, id).toBe(0);
      expect(form.answered, id).toBeGreaterThan(5 * form.none);
    }
  });
}, 120000);

// Plan-branch ledger (challenge 2026-10-25): the trace rides outside the hashed state, so the fights, the per-build digest and every
// pre-existing summary field match a run with the trace off; digests pinned from HEAD 01ada3c (3 census seeds per build).
const preTraceDigests: Record<string, string> = {
  fire_close: '73e5e24ab4a96bb5053d454543aeb3a1b76322b07cd57c270faa9c0aa5164fa1', fire_light: 'a92a881fd7f1e60af8998ed77ad5323c9eda87b5561eedf052eac4bb271aab1e',
  fire_heavy: 'e7c83f44b1a483eea15762c1cad15c1ea4b1c34221a54ec5ae61b4675adcfcdc', air_light: '8712bd6248677602fc0da71bca70427b24343c1f1c5bca72fc763bd934f92763',
  air_close: '023356f4cd2081678a84c282e219c4fb7b47ea69a3729cc1280f2f3d1eeeff41', air_heavy: 'a4293e1f2d4c0f7d1de907806de42002c1f837319cfb93b0b003df129f6bb591' };
const digest = (fights: { seed: number; hash: string }[]): string => createHash('sha256').update(fights.map(f => `${f.seed}:${f.hash}`).join('\n')).digest('hex');

describe('builds census: the plan-branch ledger', () => {
  it('trace on and off: same hashes, same digest as before the ledger, same summary fields; branches sum to 1', () => {
    for (const id of rivalBuildIds) {
      const run = (trace: boolean) => [0, 1, 2].map(i => runBuildFight(runtime.games.censusSeedStart + i, id, undefined, undefined, undefined, trace));
      const on = run(true), off = run(false);
      expect(on.map(f => f.hash), id).toEqual(off.map(f => f.hash));
      expect(digest(on), id).toBe(preTraceDigests[id]);
      const { branches, withheldShare, ...rest } = summariseBuild(on), { branches: offBranches, withheldShare: offWithheld, ...offRest } = summariseBuild(off);
      expect(rest, id).toEqual(offRest);
      expect(offBranches, id).toEqual({}); expect(offWithheld, id).toBeNull();
      expect(Object.values(branches).reduce((a, b) => a + b, 0), id).toBeCloseTo(1, 9);
      expect(withheldShare, id).toBeGreaterThanOrEqual(0); expect(withheldShare!, id).toBeLessThan(1);
    }
  });

  it('the heavy builds name their withholds; whyLine prints the top three branches', () => {
    expect(Object.keys(summaries.fire_heavy!.branches).some(b => b.startsWith('heavy:'))).toBe(true);
    expect(summaries.fire_heavy!.withheldShare).toBeGreaterThan(0);
    expect(whyLine({ 'light:bolt': 0.5, 'light:dash-out': 0.3, 'answer:incoming': 0.2 })).toBe('why light:bolt 50 light:dash-out 30 answer:incoming 20');
    expect(whyLine({ a: 0.1, b: 0.4, c: 0.3, d: 0.2 })).toBe('why b 40 c 30 d 20');
  });
}, 120000);
