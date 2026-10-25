// Week sweep writer (D1 4.4, slice step 3: a reading only, nothing is tuned from it):
// `npm --prefix packages/core run census:weeks -- [--count n] [--profile name,name] [--arm <arm>] [--tag t] [--out-dir docs/...]`.
// For every campaign week (enemy level = week) and progression profile (arena/data/progression-weeks.pc.json) it runs the
// default census's four Tiro waves and every authored rival build, and prints the reference player's win rate and median per
// cell. --arm (D1 6.8 to 6.10, a reading only: level, ranked, lag, lag-hp1/2, lag-xw1/2, lag-def1/2) also levels the opponent
// mage by week (week-census.ts mageArms); absent, nothing changes. It closes with the D1 targets read off the cells: the builds
// mean per week and the rival duels whose median is under their band's floor in weeks 2-6. With --tag it writes `<tag>.json`
// (summaries and per-cell digests, no per-fight rows).
import { performance } from 'node:perf_hooks';
import { runtime, tiro } from '../src/arena/index.ts';
import { rivalBuildIds, rivalBuilds } from '../src/arena/archetypes.ts';
import { censusCommand, evidenceEnvelope, fightDigest, median, parseCensusArgs, refuseArgs, writeEvidence } from './census-kit.ts';
import { mageArms, rivalProfiles, runWeekBuildFight, runWeekFight, weekProfiles, weeks, type MageArm } from './week-census.ts';

const args = process.argv.slice(2), { count, tag, outDir, arg } = parseCensusArgs(args), profiles = arg('--profile')?.split(',') ?? Object.keys(weekProfiles);
const arm = arg('--arm') as MageArm | undefined, armSpec: { level: boolean; ranks?: string } | undefined = arm && Object.hasOwn(mageArms, arm) ? mageArms[arm] : undefined;
if (profiles.some(p => !weekProfiles[p]) || (arm !== undefined && !Object.hasOwn(mageArms, arm))) refuseArgs();
type Fight = { seed: number; outcome: string; durationS: number; hash: string };
const summary = (fights: Fight[]) => ({ fights: fights.length, winRate: fights.filter(f => f.outcome === 'win').length / fights.length,
  timeouts: fights.filter(f => f.outcome === 'timeout').length, medianS: median(fights.filter(f => f.outcome !== 'timeout').map(f => f.durationS)),
  digest: fightDigest(fights) });
const start = performance.now(), seeds = Array.from({ length: count }, (_, i) => runtime.games.censusSeedStart + i), cells = [];
for (const profile of profiles) for (const week of weeks) {
  const waves = tiro.waves.map((w, wave) => ({ id: `wave ${wave + 1}`, kind: w.kind, targetDurationS: w.targetDurationS, ...summary(seeds.map(seed => runWeekFight(seed, wave, week, profile, runtime.games.fightTimeoutS, arm))) }));
  const builds = rivalBuildIds.map(id => ({ id, kind: `${rivalBuilds[id]!.archetype} (wave ${rivalBuilds[id]!.wave + 1})`, targetDurationS: tiro.waves[rivalBuilds[id]!.wave]!.targetDurationS, ...summary(seeds.map(seed => runWeekBuildFight(seed, id, week, profile, arm))) }));
  const cell = { profile, ...(arm ? { arm } : {}), week, averageSpellRank: weekProfiles[profile]![week - 1]!, enemyLevel: week, waves, builds };
  cells.push(cell);
  const pct = (x: number): string => `${Math.round(x * 100)}%`;
  console.log(`${arm ? `${arm} ` : ''}${profile.padEnd(9)} week ${week} rank ${String(cell.averageSpellRank).padEnd(3)} | ${[...waves, ...builds].map(c => `${c.id} ${pct(c.winRate)} ${c.medianS?.toFixed(1) ?? '-'}s`).join(' | ')}`);
}
// The D1 targets (6.9, 6.10), read off the cells, never by hand: the builds mean (the six rival duels) per week, and each rival duel
// whose median is under its band's floor (45 s) in weeks 2-6.
for (const profile of profiles) {
  const own = cells.filter(c => c.profile === profile), mean = (c: typeof own[number]) => c.builds.reduce((n, b) => n + b.winRate, 0) / c.builds.length;
  const short = own.filter(c => c.week >= 2).flatMap(c => c.builds.filter(b => b.medianS !== null && b.medianS < b.targetDurationS[0]!).map(b => `w${c.week} ${b.id} ${b.medianS!.toFixed(1)}`));
  console.log(`${arm ? `${arm} ` : ''}${profile.padEnd(9)} builds mean ${own.map(c => `w${c.week} ${(mean(c) * 100).toFixed(1)}%`).join(' ')} | duels under the floor, weeks 2-6: ${short.length}${short.length ? ` (${short.join(', ')})` : ''}`);
}
console.log(`week sweep: ${count} fights per cell in ${((performance.now() - start) / 1000).toFixed(1)} s.`);
if (tag) writeEvidence(outDir, `${tag}.json`, { ...evidenceEnvelope({ command: censusCommand('census:weeks', args), count, reference: { ranks: runtime.training.defaultRanks } }),
  reading: 'D1 4.4 week sweep; a reading only, nothing tuned from it', countPerCell: count, profiles: weekProfiles,
  ...(armSpec ? { mageArm: { arm, ...armSpec, ...(armSpec.ranks ? { rivalProfile: rivalProfiles[armSpec.ranks] } : {}) } } : {}), cells });
