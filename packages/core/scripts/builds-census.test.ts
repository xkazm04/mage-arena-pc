import { describe, expect, it } from 'vitest';
// index.ts first: it loads kernel.ts before fire.ts/air.ts (the schools.ts import-order trap).
import { runtime } from '../src/arena/index.ts';
import { rivalBuildIds, rivalBuilds } from '../src/arena/archetypes.ts';
import { runBuildFight, summariseBuild, type BuildSummary } from './builds-census.ts';

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
