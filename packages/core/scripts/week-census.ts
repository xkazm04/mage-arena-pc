// Week sweep (D1 4.4, slice step 3: a reading, no tuning). Each campaign week runs at enemyLevel = week (regular enemies only;
// mages and rival builds are not levelled) with a progression profile from arena/data/progression-weeks.pc.json: the reference
// player's average spell rank that week. Pure: no I/O, so report-weeks.ts and the census tests share one runner.
import { combat, createGames, presets, runtime, seconds, stateHash, stepGames, ticks, type Composition, type SpellRanks } from '../src/arena/index.ts';
import { maxEnemyLevel, maxSpellRank, spellRankKeys } from '../src/arena/progression.ts';
import profileData from '../src/arena/data/progression-weeks.pc.json' with { type: 'json' };
import { runBuildFight } from './builds-census.ts';

export type WeekProfiles = Record<string, number[]>;
/** Problems with a profiles file: one entry per week, each a rank 1..maxSpellRank in halves, never falling. */
export function weekProfileProblems(candidate: unknown): string[] {
  const c = candidate as { profiles?: unknown };
  if (!c || typeof c !== 'object' || !c.profiles || typeof c.profiles !== 'object') return ['progression-weeks.pc.json: no profiles object'];
  const out = Object.keys(c).filter(k => !['version', '_about', 'profiles'].includes(k)).map(k => `progression-weeks.pc.json: unknown key ${k}`);
  for (const [name, weeks] of Object.entries(c.profiles as Record<string, unknown>)) {
    if (!Array.isArray(weeks) || weeks.length !== maxEnemyLevel) { out.push(`progression-weeks.pc.json ${name}: needs ${maxEnemyLevel} weeks`); continue; }
    weeks.forEach((r, i) => {
      if (typeof r !== 'number' || r < 1 || r > maxSpellRank || !Number.isInteger(r * 2)) out.push(`progression-weeks.pc.json ${name} week ${i + 1}: rank ${String(r)} is not 1..${maxSpellRank} in halves`);
      else if (i > 0 && r < (weeks[i - 1] as number)) out.push(`progression-weeks.pc.json ${name} week ${i + 1}: rank falls`);
    });
  }
  return out;
}
const loadProblems = weekProfileProblems(profileData);
if (loadProblems.length) throw Error(loadProblems.join(' '));
export const weekProfiles: WeekProfiles = profileData.profiles;
export const weeks: readonly number[] = Array.from({ length: maxEnemyLevel }, (_, i) => i + 1);

/** The composition's spell ranks for an average rank: every row (the bolt, then each line's tiers I-IV) at it, or for a .5
 * alternate rows at the rank above and below. Empty at rank 1, so a week-1 fight is the plain census fight. */
export function profileSpellRanks(composition: Composition, average: number): SpellRanks {
  if (average === 1) return {};
  const keys = ['bolt:0', ...composition.lines.flatMap(line => [1, 2, 3, 4].map(tier => `${line}:${tier}`))].filter(k => spellRankKeys.includes(k));
  return Object.fromEntries(keys.map((k, i) => [k, Number.isInteger(average) ? average : i % 2 === 0 ? Math.ceil(average) : Math.floor(average)]));
}
const reference = (): Composition => presets.find(p => p.name === runtime.games.referencePreset)!;
const weekOptions = (week: number, profile: string) => {
  const ranks = profileSpellRanks(reference(), weekProfiles[profile]![week - 1]!);
  return { ...(week > 1 ? { enemyLevel: week } : {}), ...(Object.keys(ranks).length ? { spellRanks: ranks } : {}) };
};
/** One default-census fight (report-w4's reference player and wave) in `week` under `profile`. */
export function runWeekFight(seed: number, wave: number, week: number, profile: string, maxSeconds = runtime.games.fightTimeoutS) {
  const g = createGames(seed, reference(), wave, true, undefined, undefined, undefined, weekOptions(week, profile));
  while (g.phase === 'active' && g.state.tick < ticks(maxSeconds)) stepGames(g);
  return { seed, wave: wave + 1, week, profile, outcome: g.phase === 'active' ? 'timeout' : g.phase === 'lost' ? 'loss' : 'win', durationS: seconds(g.state.tick), hash: stateHash(g.state) };
}
/** One builds-census fight (the build's own wave) in `week` under `profile`. */
export const runWeekBuildFight = (seed: number, buildId: string, week: number, profile: string) => runBuildFight(seed, buildId, runtime.games.fightTimeoutS, runtime.games.referencePreset, weekOptions(week, profile));
export const simStepHz = combat.simStepHz;
