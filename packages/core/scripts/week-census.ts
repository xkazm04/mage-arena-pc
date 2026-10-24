// Week sweep (D1 4.4, slice step 3: a reading, no tuning). Each campaign week runs at enemyLevel = week (regular enemies only;
// mages and rival builds are not levelled) with a progression profile from arena/data/progression-weeks.pc.json: the reference
// player's average spell rank that week. An opt-in mage-side arm (D1 6.8, a reading only) levels the opponent mage too.
// Pure: no I/O, so report-weeks.ts and the census tests share one runner.
import { combat, createGames, presets, runtime, seconds, stateHash, stepGames, ticks, type Actor, type Composition, type Games, type SpellRanks } from '../src/arena/index.ts';
import { maxEnemyLevel, maxSpellRank } from '../src/arena/progression.ts';
import { applyOpponentMage, buildRows, compositionRows, ranksAtAverage, type OpponentMage } from '../src/arena/mage-build.ts';
import { rivalBuilds } from '../src/arena/archetypes.ts';
import profileData from '../src/arena/data/progression-weeks.pc.json' with { type: 'json' };
import { runBuildFight } from './builds-census.ts';

export type WeekProfiles = Record<string, number[]>;
function profilesProblems(profiles: unknown, at: string): string[] {
  if (!profiles || typeof profiles !== 'object') return [`progression-weeks.pc.json: no ${at} object`];
  const out: string[] = [];
  for (const [name, weeks] of Object.entries(profiles as Record<string, unknown>)) {
    if (!Array.isArray(weeks) || weeks.length !== maxEnemyLevel) { out.push(`progression-weeks.pc.json ${name}: needs ${maxEnemyLevel} weeks`); continue; }
    weeks.forEach((r, i) => {
      if (typeof r !== 'number' || r < 1 || r > maxSpellRank || !Number.isInteger(r * 2)) out.push(`progression-weeks.pc.json ${name} week ${i + 1}: rank ${String(r)} is not 1..${maxSpellRank} in halves`);
      else if (i > 0 && r < (weeks[i - 1] as number)) out.push(`progression-weeks.pc.json ${name} week ${i + 1}: rank falls`);
    });
  }
  return out;
}
/** Problems with a profiles file: one entry per week, each a rank 1..maxSpellRank in halves, never falling. The same rule holds
 * for the optional `rivalProfiles` (the opponent mage's average rank per week, read only by a mage-side arm). */
export function weekProfileProblems(candidate: unknown): string[] {
  const c = candidate as { profiles?: unknown; rivalProfiles?: unknown };
  if (!c || typeof c !== 'object' || !c.profiles || typeof c.profiles !== 'object') return ['progression-weeks.pc.json: no profiles object'];
  const out = Object.keys(c).filter(k => !['version', '_about', 'profiles', 'rivalProfiles'].includes(k)).map(k => `progression-weeks.pc.json: unknown key ${k}`);
  out.push(...profilesProblems(c.profiles, 'profiles'));
  if (c.rivalProfiles !== undefined) out.push(...profilesProblems(c.rivalProfiles, 'rivalProfiles'));
  return out;
}
const loadProblems = weekProfileProblems(profileData);
if (loadProblems.length) throw Error(loadProblems.join(' '));
export const weekProfiles: WeekProfiles = profileData.profiles;
export const rivalProfiles: WeekProfiles = profileData.rivalProfiles;
export const weeks: readonly number[] = Array.from({ length: maxEnemyLevel }, (_, i) => i + 1);

/** The composition's spell ranks for an average rank: every row (mage-build.ts compositionRows: the bolt, then each line's tiers
 * I-IV) at it, or for a .5 alternate rows at the rank above and below. Empty at rank 1, so a week-1 fight is the plain census fight. */
export function profileSpellRanks(composition: Composition, average: number): SpellRanks {
  return ranksAtAverage(compositionRows(composition), average);
}
/** An opponent mage's spell ranks for an average rank: its rows (mage-build.ts buildRows: a Fire/Air build's bolt and four slots,
 * else its Water composition's rows), each never below the rank the build already carries (rival-builds.json spellRanks). */
export function opponentSpellRanks(actor: Actor, average: number): SpellRanks {
  return ranksAtAverage(buildRows(actor), average, { floor: actor.spellRanks ?? {} });
}

/** Mage-side arms (D1 4.3 lever, 6.8: a reading only, off unless asked for). Each levels the opponent mage by week: a rival build
 * or a mage wave's Water proxy. `level` gives it the regular enemies' HP multiplier for the week (progression.pc.json
 * enemyLevels); `ranks` names a rivalProfiles entry for its spell ranks (`ranked` follows the steady player's curve, `lag` runs one
 * rank behind it). Each arm is the createGames `opponentMage` option for its week
 * (armOption; mage-build.ts applies it at spawn), the kernel lever the game can use too. */
export const mageArms = { level: { level: true }, ranked: { level: false, ranks: 'ranked' }, lag: { level: false, ranks: 'lag' } } as const satisfies Record<string, { level: boolean; ranks?: string }>;
export type MageArm = keyof typeof mageArms;
for (const arm of Object.values(mageArms)) if ('ranks' in arm && !rivalProfiles[arm.ranks]) throw Error(`progression-weeks.pc.json: no rivalProfiles.${arm.ranks}`);
/** The createGames `opponentMage` option for `week` under `arm`: `level` the week, or `averageRank` the arm's rivalProfiles entry
 * for the week. No arm, no option. */
export function armOption(week: number, arm: MageArm | undefined): OpponentMage | undefined {
  if (!arm) return undefined;
  const spec: { level: boolean; ranks?: string } = mageArms[arm];
  return spec.ranks ? { averageRank: rivalProfiles[spec.ranks]![week - 1]! } : { level: week };
}
/** Level every opponent mage of a fresh Games for `week` under `arm` after spawn (the option's rule, applied by hand; kept for
 * reading an existing Games). No arm, or nothing to change (week 1), leaves the state alone. */
export function levelMages(g: Games, week: number, arm: MageArm | undefined): void {
  const spec = armOption(week, arm);
  if (spec) for (const a of g.state.actors) if (a.team !== g.player.team && a.mageAI) applyOpponentMage(a, spec, g.state);
}

const reference = (): Composition => presets.find(p => p.name === runtime.games.referencePreset)!;
const weekOptions = (week: number, profile: string, arm?: MageArm) => {
  const ranks = profileSpellRanks(reference(), weekProfiles[profile]![week - 1]!), opponentMage = armOption(week, arm);
  return { ...(week > 1 ? { enemyLevel: week } : {}), ...(Object.keys(ranks).length ? { spellRanks: ranks } : {}), ...(opponentMage ? { opponentMage } : {}) };
};
const outcome = (g: Games): string => g.phase === 'active' ? 'timeout' : g.phase === 'lost' ? 'loss' : 'win';
/** One default-census fight (report-w4's reference player and wave) in `week` under `profile`, the mage side levelled by `arm`. */
export function runWeekFight(seed: number, wave: number, week: number, profile: string, maxSeconds = runtime.games.fightTimeoutS, arm?: MageArm) {
  const g = createGames(seed, reference(), wave, true, undefined, undefined, undefined, weekOptions(week, profile, arm));
  while (g.phase === 'active' && g.state.tick < ticks(maxSeconds)) stepGames(g);
  return { seed, wave: wave + 1, week, profile, outcome: outcome(g), durationS: seconds(g.state.tick), hash: stateHash(g.state) };
}
/** One builds-census fight (the build's own wave) in `week` under `profile`. With no arm it is runBuildFight itself; with one, the
 * same Games (createGames with the build) with the arm's opponentMage option, so the rival spawns levelled. */
export function runWeekBuildFight(seed: number, buildId: string, week: number, profile: string, arm?: MageArm) {
  if (!arm) return runBuildFight(seed, buildId, runtime.games.fightTimeoutS, runtime.games.referencePreset, weekOptions(week, profile));
  const build = rivalBuilds[buildId]; if (!build) throw Error(`Unknown build ${buildId}`);
  const g = createGames(seed, reference(), build.wave, true, undefined, undefined, undefined, { ...weekOptions(week, profile, arm), rivalBuild: buildId });
  while (g.phase === 'active' && g.state.tick < ticks(runtime.games.fightTimeoutS)) stepGames(g);
  return { seed, build: buildId, outcome: outcome(g), durationS: seconds(g.state.tick - g.waveStartTick), hash: stateHash(g.state) };
}
export const simStepHz = combat.simStepHz;
