// Week sweep writer (D1 4.4, slice step 3: a reading only, nothing is tuned from it):
// `npm --prefix packages/core run census:weeks -- [--count n] [--profile name,name] [--arm level|ranked|lag] [--tag t] [--out-dir docs/...]`.
// For every campaign week (enemy level = week) and progression profile (arena/data/progression-weeks.pc.json) it runs the
// default census's four Tiro waves and every authored rival build, and prints the reference player's win rate and median per
// cell. --arm (D1 6.8, a reading only) also levels the opponent mage by week (week-census.ts mageArms); absent, nothing
// changes. With --tag it writes `<tag>.json` (summaries and per-cell digests, no per-fight rows).
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { runtime, tiro } from '../src/arena/index.ts';
import { rivalBuildIds, rivalBuilds } from '../src/arena/archetypes.ts';
import { evidenceDir } from './builds-census.ts';
import { mageArms, rivalProfiles, runWeekBuildFight, runWeekFight, weekProfiles, weeks, type MageArm } from './week-census.ts';

const args = process.argv.slice(2), arg = (name: string): string | undefined => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const count = Number(arg('--count') ?? 200), tag = arg('--tag'), outDir = arg('--out-dir') ?? 'docs/waves/W8-evidence', profiles = arg('--profile')?.split(',') ?? Object.keys(weekProfiles);
const arm = arg('--arm') as MageArm | undefined, armSpec: { level: boolean; ranks?: string } | undefined = arm && mageArms[arm];
if (!Number.isInteger(count) || count < 1 || (tag !== undefined && !/^[a-z0-9-]+$/.test(tag)) || !evidenceDir.test(outDir) || profiles.some(p => !weekProfiles[p]) || (arm !== undefined && !Object.hasOwn(mageArms, arm))) throw Error('Invalid report arguments');
const median = (values: number[]): number | null => values.length ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]! : null;
type Fight = { seed: number; outcome: string; durationS: number; hash: string };
const summary = (fights: Fight[]) => ({ fights: fights.length, winRate: fights.filter(f => f.outcome === 'win').length / fights.length,
  timeouts: fights.filter(f => f.outcome === 'timeout').length, medianS: median(fights.filter(f => f.outcome !== 'timeout').map(f => f.durationS)),
  digest: createHash('sha256').update(fights.map(f => `${f.seed}:${f.hash}`).join('\n')).digest('hex') });
const start = performance.now(), seeds = Array.from({ length: count }, (_, i) => runtime.games.censusSeedStart + i), cells = [];
for (const profile of profiles) for (const week of weeks) {
  const waves = tiro.waves.map((w, wave) => ({ id: `wave ${wave + 1}`, kind: w.kind, targetDurationS: w.targetDurationS, ...summary(seeds.map(seed => runWeekFight(seed, wave, week, profile, runtime.games.fightTimeoutS, arm))) }));
  const builds = rivalBuildIds.map(id => ({ id, kind: `${rivalBuilds[id]!.archetype} (wave ${rivalBuilds[id]!.wave + 1})`, targetDurationS: tiro.waves[rivalBuilds[id]!.wave]!.targetDurationS, ...summary(seeds.map(seed => runWeekBuildFight(seed, id, week, profile, arm))) }));
  const cell = { profile, ...(arm ? { arm } : {}), week, averageSpellRank: weekProfiles[profile]![week - 1]!, enemyLevel: week, waves, builds };
  cells.push(cell);
  const pct = (x: number): string => `${Math.round(x * 100)}%`;
  console.log(`${arm ? `${arm} ` : ''}${profile.padEnd(9)} week ${week} rank ${String(cell.averageSpellRank).padEnd(3)} | ${[...waves, ...builds].map(c => `${c.id} ${pct(c.winRate)} ${c.medianS?.toFixed(1) ?? '-'}s`).join(' | ')}`);
}
console.log(`week sweep: ${count} fights per cell in ${((performance.now() - start) / 1000).toFixed(1)} s.`);
if (tag) {
  const destination = new URL(`../../../${outDir}/`, import.meta.url); mkdirSync(destination, { recursive: true });
  writeFileSync(new URL(`${tag}.json`, destination), JSON.stringify({ label: 'simulated', reading: 'D1 4.4 week sweep; a reading only, nothing tuned from it',
    command: `npm --prefix packages/core run census:weeks -- ${args.join(' ')}`, countPerCell: count, seedRange: [seeds[0], seeds.at(-1)],
    reference: { competence: runtime.games.referenceCompetence, preset: runtime.games.referencePreset, ranks: runtime.training.defaultRanks }, profiles: weekProfiles,
    ...(armSpec ? { mageArm: { arm, ...armSpec, ...(armSpec.ranks ? { rivalProfile: rivalProfiles[armSpec.ranks] } : {}) } } : {}), cells }, null, 2) + '\n');
}
