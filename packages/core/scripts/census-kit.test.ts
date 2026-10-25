import { describe, expect, it } from 'vitest';
// index.ts first: it loads kernel.ts before fire.ts/air.ts (the schools.ts import-order trap).
import { runtime } from '../src/arena/index.ts';
import { rivalBuildIds } from '../src/arena/archetypes.ts';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import exchangeAfter from '../../../docs/change-requests/evidence/d1-exchange-after.json' with { type: 'json' };
import fixture from './census-kit.fixture.json' with { type: 'json' };
import { evidenceEnvelope, fightDigest, median, parseCensusArgs, quantile } from './census-kit.ts';
import { runBuildFight, summariseBuild } from './builds-census.ts';
import { coverageBuildFight, coverageDefaultFight } from './counter-coverage.ts';
import { runNamedFight } from './named-census.ts';
import { runWeekBuildFight, runWeekFight } from './week-census.ts';

// The census kit (challenge 2026-10-25) moves every census runner onto one loop with read-only observers. The proof that nothing
// moved: census-kit.fixture.json holds the runners' outputs captured before the kit (HEAD d3dd8c7), field for field.
const s0 = runtime.games.censusSeedStart, seeds = (n: number) => Array.from({ length: n }, (_, i) => s0 + i);
const plain = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const ported = ['builds-census.ts', 'counter-coverage.ts', 'named-census.ts', 'week-census.ts', 'report-builds.ts', 'report-counters.ts', 'report-named.ts', 'report-weeks.ts', 'report-skills.ts'];
const source = (file: string): string => readFileSync(new URL(file, import.meta.url), 'utf8');

describe('census kit: the runners on one loop, nothing moved', () => {
  it('case 1: every build x 8 seeds, and the coverage, named and week runners, deep-equal the pre-kit fixture', () => {
    for (const id of rivalBuildIds) expect(plain(seeds(8).map(s => runBuildFight(s, id))), id).toEqual(fixture.builds[id as keyof typeof fixture.builds]);
    for (const id of rivalBuildIds) expect(plain(seeds(3).map(s => coverageBuildFight(s, id))), id).toEqual(fixture.coverage.builds[id as keyof typeof fixture.coverage.builds]);
    expect(plain(seeds(3).map(s => coverageBuildFight(s, 'air_heavy', 'Mirror tide')))).toEqual(fixture.coverage.mirror);
    expect(plain([0, 1, 2, 3].map(w => seeds(2).map(s => coverageDefaultFight(s, w))))).toEqual(fixture.coverage.defaults);
    for (const w of [2, 3] as const) expect(plain(seeds(8).map(s => runNamedFight(s, w))), `wave ${w}`).toEqual(fixture.named[w]);
    expect(plain([0, 1, 2, 3].map(w => seeds(2).map(s => runWeekFight(s, w, 4, 'steady'))))).toEqual(fixture.weeks.steady4);
    expect(plain(seeds(2).map(s => runWeekFight(s, 3, 4, 'steady', runtime.games.fightTimeoutS, 'lag')))).toEqual(fixture.weeks.steady4lag);
    expect(plain(seeds(2).map(s => runWeekBuildFight(s, 'fire_close', 4, 'steady')))).toEqual(fixture.weeks.buildSteady4);
  }, 240000);

  it('case 2: 200 kit-run fire_close fights digest to the d1-exchange-after.json fire_close digest', () => {
    const pinned = exchangeAfter.summaries.find(s => s.build === 'fire_close')!.digest;
    expect(pinned.startsWith('dd746f4e')).toBe(true);
    expect(fightDigest(seeds(200).map(s => runBuildFight(s, 'fire_close')))).toBe(pinned);
  }, 240000);

  it('case 3: an armed week build fight keeps its hash and now carries the builds instrumentation', () => {
    const fights = seeds(8).map(s => runWeekBuildFight(s, 'fire_heavy', 3, 'steady', 'lag'));
    expect(fights.map(({ seed, build, outcome, durationS, hash }) => ({ seed, build, outcome, durationS, hash }))).toEqual(fixture.weeks.armedFireHeavy3lag);
    for (const f of fights) {
      expect(Object.values(f.casts).reduce((a, b) => a + b, 0), String(f.seed)).toBeGreaterThan(0);
      expect(f.exchanges).toBeGreaterThan(0); expect(f.cleanHits).toBeLessThanOrEqual(f.exchanges * 50);
      expect(f.meanDistanceM).toBeGreaterThan(0); expect(Object.keys(f.branches).length).toBeGreaterThan(0);
    }
    const s = summariseBuild(fights);
    expect(s.fights).toBe(8); expect(Number.isFinite(s.hitsPerExchange)).toBe(true); expect(s.hitsPerExchange).toBeGreaterThan(0);
  }, 120000);

  it('case 4: coverage build fights are set up by the same kit call as runBuildFight; no ported runner owns a loop or a createGames', () => {
    expect(coverageBuildFight(s0, 'air_heavy', 'Mirror tide').hash).toBe(runBuildFight(s0, 'air_heavy', undefined, 'Mirror tide').hash);
    for (const file of ported.slice(0, 4)) {
      const text = source(file);
      expect(text, file).not.toMatch(/\bcreateGames\(/);
      expect(text, file).not.toMatch(/\bstepGames\(/);
      expect(text, file).not.toContain("g.phase === 'lost' ? 'loss'");
    }
    expect(source('census-kit.ts').match(/\bcreateGames\(/g)).toHaveLength(1);
  });

  it('case 5: parseCensusArgs refuses a bad count, tag or out-dir and reads the shared flags', () => {
    expect(() => parseCensusArgs(['--count', '0'])).toThrow('Invalid report arguments');
    expect(() => parseCensusArgs(['--tag', 'A B'])).toThrow('Invalid report arguments');
    expect(() => parseCensusArgs(['--out-dir', '../etc'])).toThrow('Invalid report arguments');
    expect(() => parseCensusArgs(['--count', '1.5'])).toThrow('Invalid report arguments');
    expect(parseCensusArgs(['--count', '50', '--tag', 'x'])).toMatchObject({ count: 50, tag: 'x', outDir: 'docs/waves/W8-evidence' });
    expect(parseCensusArgs([], { count: 7, outDir: 'docs/change-requests/evidence' })).toMatchObject({ count: 7, tag: undefined, outDir: 'docs/change-requests/evidence' });
    expect(parseCensusArgs(['--only', 'fire_close']).arg('--only')).toBe('fire_close');
  });

  it('case 6: one digest and one median policy', () => {
    expect(fightDigest([{ seed: 1, hash: 'a' }, { seed: 2, hash: 'b' }])).toBe(createHash('sha256').update('1:a\n2:b').digest('hex'));
    expect(median([])).toBeNull(); expect(median([3, 1, 2])).toBe(2); expect(median([4, 1, 3, 2])).toBe(3);
    expect(quantile([5, 1, 4, 2, 3], 0.1)).toBe(1); expect(quantile([5, 1, 4, 2, 3], 0.9)).toBe(5); expect(quantile([], 0.9)).toBeNull();
    for (const file of ['builds-census.ts', 'named-census.ts', 'report-counters.ts', 'report-weeks.ts']) expect(source(file), file).not.toMatch(/const (median|quantile) = /);
  });

  it('case 7: one evidence envelope; the seed:hash digest is written only in the kit', () => {
    expect(evidenceEnvelope({ command: 'npm --prefix packages/core run census:builds -- --count 5', count: 5 })).toEqual({ label: 'simulated',
      command: 'npm --prefix packages/core run census:builds -- --count 5', seedRange: [s0, s0 + 4],
      reference: { competence: runtime.games.referenceCompetence, preset: runtime.games.referencePreset } });
    expect(evidenceEnvelope({ command: 'c', count: 1, reference: { supplement: 'Mirror tide' } }).reference).toEqual({ competence: runtime.games.referenceCompetence, preset: runtime.games.referencePreset, supplement: 'Mirror tide' });
    const seedHash = '${f.seed}:${f.hash}';
    for (const file of ported) expect(source(file), file).not.toContain(seedHash);
    expect(source('census-kit.ts')).toContain(seedHash);
  });
});
