// Week sweep (D1 4.4, slice step 3: a reading, no tuning). Each campaign week runs at enemyLevel = week (regular enemies only;
// mages and rival builds are not levelled) with a progression profile from arena/data/progression-weeks.pc.json: the reference
// player's average spell rank that week. An opt-in mage-side arm (D1 6.8 to 6.11, a reading only) levels the opponent mage too.
// Pure: no I/O, so report-weeks.ts and the census tests share one runner.
import { combat, presets, runtime, seconds, stateHash, type Actor, type Composition, type Games, type SpellRanks } from '../src/arena/index.ts';
import { maxEnemyLevel, maxSpellRank, validEnemyLevel } from '../src/arena/progression.ts';
import type { ReferenceRange } from '../src/arena/archetypes.ts';
import { applyOpponentMage, buildRows, compositionRows, ranksAtAverage, type OpponentMage } from '../src/arena/mage-build.ts';
import profileData from '../src/arena/data/progression-weeks.pc.json' with { type: 'json' };
import { runBuildFight } from './builds-census.ts';
import { censusGames, outcomeOf, runCensus, type CensusOptions } from './census-kit.ts';

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
function hpLevelsProblems(curves: unknown): string[] {
  if (!curves || typeof curves !== 'object') return ['progression-weeks.pc.json: no rivalHpLevels object'];
  const out: string[] = [];
  for (const [name, levels] of Object.entries(curves as Record<string, unknown>)) {
    if (!Array.isArray(levels) || levels.length !== maxEnemyLevel) { out.push(`progression-weeks.pc.json ${name}: needs ${maxEnemyLevel} weeks`); continue; }
    levels.forEach((l, i) => {
      if (!validEnemyLevel(l)) out.push(`progression-weeks.pc.json ${name} week ${i + 1}: HP level ${String(l)} is not an integer 1..${maxEnemyLevel}`);
      else if (i > 0 && l < (levels[i - 1] as number)) out.push(`progression-weeks.pc.json ${name} week ${i + 1}: HP level falls`);
    });
  }
  return out;
}
/** Problems with a profiles file: one entry per week, each a rank 1..maxSpellRank in halves, never falling. The same rule holds
 * for the optional `rivalProfiles` (the opponent mage's average rank per week, read only by a mage-side arm). The optional
 * `rivalHpLevels` (D1 6.9) holds the opponent mage's HP level per week: an integer enemy level, never falling. */
export function weekProfileProblems(candidate: unknown): string[] {
  const c = candidate as { profiles?: unknown; rivalProfiles?: unknown; rivalHpLevels?: unknown };
  if (!c || typeof c !== 'object' || !c.profiles || typeof c.profiles !== 'object') return ['progression-weeks.pc.json: no profiles object'];
  const out = Object.keys(c).filter(k => !['version', '_about', 'profiles', 'rivalProfiles', 'rivalHpLevels'].includes(k)).map(k => `progression-weeks.pc.json: unknown key ${k}`);
  out.push(...profilesProblems(c.profiles, 'profiles'));
  if (c.rivalProfiles !== undefined) out.push(...profilesProblems(c.rivalProfiles, 'rivalProfiles'));
  if (c.rivalHpLevels !== undefined) out.push(...hpLevelsProblems(c.rivalHpLevels));
  return out;
}
const loadProblems = weekProfileProblems(profileData);
if (loadProblems.length) throw Error(loadProblems.join(' '));
export const weekProfiles: WeekProfiles = profileData.profiles;
export const rivalProfiles: WeekProfiles = profileData.rivalProfiles;
export const rivalHpLevels: WeekProfiles = profileData.rivalHpLevels;
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
 * rank behind it). The `lag-hp` arms (D1 6.9) keep `lag`'s ranks and add a small HP level: `hp` names a rivalHpLevels curve, one
 * enemy level per week, and `hpLevels` carries it into the evidence. Each arm is the createGames `opponentMage` option for its week
 * (armOption; mage-build.ts applies it at spawn), the kernel lever the game can use too.
 * The D1 6.10 arms keep `lag`'s ranks and add one duration lever, each a createGames option (armExtras), two strengths each:
 * - `lag-xw1`/`lag-xw2`: the exchange window's reach grows with the defender's rank, `reachPerRankStepM` 0.5 / 1 m per rank step
 *   (exchange.ts exchangeReach);
 * - `lag-def1`/`lag-def2`: every mage's HP grows with its own rank, `hpPerRankStep` 0.05 / 0.1 per rank step (games.ts
 *   rankDefence; 0.1 mirrors rank power's +0.1 a rank).
 * The D1 6.11 arms (4.1 E, a reading) add the reference player's range: `referenceRange` 'build' has the reference hold the band of
 * the build it faces (archetypes.ts referenceBand) instead of its own 5-8 m, every week, week 1 included (createGames referenceRange):
 * - `lag-ref`: `lag` plus the range;
 * - `lag-def1-ref`: `lag-def1` (rank defence at 0.05) plus the range. */
const lagHp = (hp: string) => ({ level: false, ranks: 'lag', hp, hpLevels: rivalHpLevels[hp] ?? [] }) as const;
const lagXw = (reachPerRankStepM: number) => ({ level: false, ranks: 'lag', reachPerRankStepM }) as const;
const lagDef = (hpPerRankStep: number) => ({ level: false, ranks: 'lag', hpPerRankStep }) as const;
const referenceRange = 'build' as const;
export const mageArms = { level: { level: true }, ranked: { level: false, ranks: 'ranked' }, lag: { level: false, ranks: 'lag' }, 'lag-hp1': lagHp('hp1'), 'lag-hp2': lagHp('hp2'),
  'lag-xw1': lagXw(0.5), 'lag-xw2': lagXw(1), 'lag-def1': lagDef(0.05), 'lag-def2': lagDef(0.1),
  'lag-ref': { level: false, ranks: 'lag', referenceRange }, 'lag-def1-ref': { ...lagDef(0.05), referenceRange } } as const satisfies Record<string, MageArmSpec>;
type MageArmSpec = { level: boolean; ranks?: string; hp?: string; hpLevels?: readonly number[]; reachPerRankStepM?: number; hpPerRankStep?: number; referenceRange?: ReferenceRange };
export type MageArm = keyof typeof mageArms;
for (const arm of Object.values(mageArms)) {
  if ('ranks' in arm && !rivalProfiles[arm.ranks]) throw Error(`progression-weeks.pc.json: no rivalProfiles.${arm.ranks}`);
  if ('hp' in arm && !rivalHpLevels[arm.hp]) throw Error(`progression-weeks.pc.json: no rivalHpLevels.${arm.hp}`);
}
/** The createGames `opponentMage` option for `week` under `arm`: `level` the week, or `averageRank` the arm's rivalProfiles entry
 * for the week, with a `lag-hp` arm's rivalHpLevels entry as `level` when it is above 1. No arm, no option. */
export function armOption(week: number, arm: MageArm | undefined): OpponentMage | undefined {
  if (!arm) return undefined;
  const spec: MageArmSpec = mageArms[arm], hpLevel = spec.hp ? rivalHpLevels[spec.hp]![week - 1]! : 1;
  return spec.ranks ? { averageRank: rivalProfiles[spec.ranks]![week - 1]!, ...(hpLevel > 1 ? { level: hpLevel } : {}) } : { level: week };
}
/** The createGames options a D1 6.10 or 6.11 arm adds beside its opponentMage, the same every week: `exchangeReach` or
 * `rankDefence` (both read the rank steps a mage gained above its authored build, games.ts, none in week 1), and `referenceRange`
 * (the reference holds the faced build's band, week 1 included). No arm, or an arm without one, adds nothing. */
export function armExtras(arm: MageArm | undefined): Pick<CensusOptions, 'exchangeReach' | 'rankDefence' | 'referenceRange'> {
  const spec: MageArmSpec | undefined = arm && mageArms[arm];
  return { ...(spec?.reachPerRankStepM !== undefined ? { exchangeReach: { perRankStepM: spec.reachPerRankStepM } } : {}),
    ...(spec?.hpPerRankStep !== undefined ? { rankDefence: { hpPerRankStep: spec.hpPerRankStep } } : {}),
    ...(spec?.referenceRange !== undefined ? { referenceRange: spec.referenceRange } : {}) };
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
  return { ...(week > 1 ? { enemyLevel: week } : {}), ...(Object.keys(ranks).length ? { spellRanks: ranks } : {}), ...(opponentMage ? { opponentMage } : {}), ...armExtras(arm) };
};
/** One default-census fight (report-w4's reference player and wave) in `week` under `profile`, the mage side levelled by `arm`. */
export function runWeekFight(seed: number, wave: number, week: number, profile: string, maxSeconds = runtime.games.fightTimeoutS, arm?: MageArm) {
  const g = runCensus(censusGames(seed, wave, weekOptions(week, profile, arm)), maxSeconds);
  return { seed, wave: wave + 1, week, profile, outcome: outcomeOf(g), durationS: seconds(g.state.tick), hash: stateHash(g.state) };
}
/** One builds-census fight (the build's own wave) in `week` under `profile`: runBuildFight itself with the week's options, the arm's
 * opponentMage among them (the rival spawns levelled), so an armed fight carries the whole builds reading too. */
export function runWeekBuildFight(seed: number, buildId: string, week: number, profile: string, arm?: MageArm) {
  return runBuildFight(seed, buildId, runtime.games.fightTimeoutS, runtime.games.referencePreset, weekOptions(week, profile, arm));
}
export const simStepHz = combat.simStepHz;
