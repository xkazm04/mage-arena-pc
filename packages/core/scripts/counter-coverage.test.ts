import { describe, expect, it } from 'vitest';
// index.ts first: it loads kernel.ts before fire.ts/air.ts (the schools.ts import-order trap).
import { runFight, runtime } from '../src/arena/index.ts';
import { runBuildFight } from './builds-census.ts';
import { addTally, coverageBuildFight, coverageDefaultFight, defensiveRows, emptyTally } from './counter-coverage.ts';

// The D1 6.4 reading (census:counters, 200 seeds per cell) pinned on its first census seeds: the reader only watches, and the
// rows read the way the first measurement found them.
const seed = runtime.games.censusSeedStart, seeds = Array.from({ length: 8 }, (_, i) => seed + i);
const total = (id: string, row: string, preset?: string) => seeds.reduce((t, s) => addTally(t, coverageBuildFight(s, id, preset).tallies[row] ?? emptyTally()), emptyTally());

describe('counter coverage (D1 6.4)', () => {
  it('reads one answer row per school', () => {
    expect(defensiveRows.map(r => r.name)).toEqual(['Ring of Cinders', 'Air Form', 'Tide Ward']);
  });

  it('only watches: each fight hashes as its census fight', () => {
    expect(coverageBuildFight(seed, 'air_heavy', 'Mirror tide').hash).toBe(runBuildFight(seed, 'air_heavy', undefined, 'Mirror tide').hash);
    expect(coverageBuildFight(seed, 'fire_close').hash).toBe(runBuildFight(seed, 'fire_close').hash);
    expect(coverageDefaultFight(seed, 3).hash).toBe(runFight(seed, 3).hash);
  });

  it('Air Form answers most of the projectiles it could, and never counts a blow it could not reach', () => {
    const t = total('air_heavy', 'air_form');
    expect(t.reachable).toBeGreaterThan(0);
    expect(t.reachable).toBeLessThanOrEqual(t.slotted);
    expect(t.answered / t.reachable).toBeGreaterThan(0.5);
  });

  it('Tide Ward meets beams it cannot reach: the mend line plays Tide Ward at tier II, the beams come at tier IV', () => {
    const t = total('air_heavy', defensiveRows[2]!.id, 'Mirror tide');
    expect(t.slotted).toBeGreaterThan(0);
    expect(t.reachable).toBe(0);
  });
});
