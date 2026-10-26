// Week profiles (D1 4.4, 6.8 to 6.12): the per-week spell-rank curves of arena/data/progression-weeks.pc.json, checked strictly at
// load. The census script (scripts/week-census.ts) reads the player's `profiles` and the opponent mage's `rivalProfiles`; the
// season reads `seasonRival` (6.12), the lag plus rank-defence levers a flag-on bout plays. One reading, so both agree.
import { maxEnemyLevel, maxSpellRank, validEnemyLevel } from './progression.ts';
import { rankDefenceProblems, type RankDefence } from './games.ts';
import profileData from './data/progression-weeks.pc.json' with { type: 'json' };

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
/** Problems with the `seasonRival` entry (D1 6.12): the `profile` a flag-on season's opponent mage follows (a rivalProfiles name)
 * and the `hpPerRankStep` of its rank defence (games.ts rankDefenceProblems). */
function seasonRivalProblems(candidate: unknown, rival: unknown): string[] {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return ['progression-weeks.pc.json: seasonRival is not an object'];
  const c = candidate as Record<string, unknown>;
  return [...Object.keys(c).filter(k => !['profile', 'hpPerRankStep'].includes(k)).map(k => `progression-weeks.pc.json seasonRival: unknown key ${k}`),
    ...(typeof c.profile === 'string' && rival && typeof rival === 'object' && c.profile in rival ? [] : [`progression-weeks.pc.json seasonRival: profile ${String(c.profile)} is not a rivalProfiles entry`]),
    ...rankDefenceProblems({ hpPerRankStep: c.hpPerRankStep }).map(p => `progression-weeks.pc.json seasonRival: ${p}`)];
}
/** Problems with a profiles file: one entry per week, each a rank 1..maxSpellRank in halves, never falling. The same rule holds
 * for the optional `rivalProfiles` (the opponent mage's average rank per week, read only by a mage-side arm). The optional
 * `rivalHpLevels` (D1 6.9) holds the opponent mage's HP level per week: an integer enemy level, never falling. */
export function weekProfileProblems(candidate: unknown): string[] {
  const c = candidate as { profiles?: unknown; rivalProfiles?: unknown; rivalHpLevels?: unknown; seasonRival?: unknown };
  if (!c || typeof c !== 'object' || !c.profiles || typeof c.profiles !== 'object') return ['progression-weeks.pc.json: no profiles object'];
  const out = Object.keys(c).filter(k => !['version', '_about', 'profiles', 'rivalProfiles', 'rivalHpLevels', 'seasonRival'].includes(k)).map(k => `progression-weeks.pc.json: unknown key ${k}`);
  out.push(...profilesProblems(c.profiles, 'profiles'));
  if (c.rivalProfiles !== undefined) out.push(...profilesProblems(c.rivalProfiles, 'rivalProfiles'));
  if (c.rivalHpLevels !== undefined) out.push(...hpLevelsProblems(c.rivalHpLevels));
  if (c.seasonRival !== undefined) out.push(...seasonRivalProblems(c.seasonRival, c.rivalProfiles));
  return out;
}
const loadProblems = weekProfileProblems(profileData);
if (loadProblems.length) throw Error(loadProblems.join(' '));
export const weekProfiles: WeekProfiles = profileData.profiles;
export const rivalProfiles: WeekProfiles = profileData.rivalProfiles;
export const rivalHpLevels: WeekProfiles = profileData.rivalHpLevels;
/** The levers a flag-on season's bouts carry (D1 6.12): the opponent mage's rank curve (the 6.10 lag-def1 arm) and its rank defence. */
export const seasonRival: { profile: string; rankDefence: RankDefence } = { profile: profileData.seasonRival.profile, rankDefence: { hpPerRankStep: profileData.seasonRival.hpPerRankStep } };
