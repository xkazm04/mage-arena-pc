// PC spell-rank progression (D1 4.3; owner ruling 2026-10-24): camp activities earn skill points, skill points buy the next
// rank of any spell the player knows at a cost that rises by rank and by tier, and a school's elder teaches its signature
// spell when the elder's camp trust in the player is high enough. Numbers in arena/data/skill-book.pc.json, checked at load.
// The book is in-memory only: the season save carries no skill points yet (a schema change waits on an owner ask), so the
// host keeps the book beside the session. Behind the file's `enabled` flag, off by default: while off nothing earns, nothing
// is taught and boutSpellRanks gives nothing, so every bout plays exactly as before.
import data from './arena/data/skill-book.pc.json' with { type: 'json' };
import season from '../../../docs/design/reconciled/data/season.json' with { type: 'json' };
import schoolsData from '../../../docs/design/reconciled/data/schools.json' with { type: 'json' };
import { airRows, fireRows } from './arena/data.generated.ts';
import { maxSpellRank, spellRankKeys } from './arena/progression.ts';
import type { SpellRanks } from './arena/types.ts';
import { present, type CampSession } from './camp-session.ts';
import type { Tables } from './types.ts';

export interface SkillBookRules {
  version: string; _about: string; enabled: boolean;
  award: Record<string, number>;
  weekScale: number[];
  rankCost: number[][];
  teaching: { trustAtLeast: number; signatures: Record<string, string> };
}
/** Unspent points, points earned so far, ranks bought (absent = rank 1) and signatures taught. */
export interface SkillBook { points: number; earned: number; ranks: SpellRanks; taught: string[] }

const tiers = 5;
const activities: readonly string[] = Object.keys(season.activityHours);
const schoolIds: readonly string[] = schoolsData.map(s => s.id);
/** The spell-rank keys of one school: Water's `line:tier` rows (the bolt is `bolt:0`), Fire's and Air's spell ids. */
export function schoolRankKeys(school: string): string[] {
  if (school === 'fire') return fireRows.map(r => r.id);
  if (school === 'air') return airRows.map(r => r.id);
  return school === 'water' ? spellRankKeys.filter(k => k.includes(':')) : [];
}
/** A key's collar tier: the `line:tier` suffix for Water, the canonical row tier for Fire and Air. */
export function rankTier(key: string): number {
  const row = [...fireRows, ...airRows].find(r => r.id === key);
  const tier = Number(row ? row.tier : key.split(':')[1]);
  if (!spellRankKeys.includes(key) || !Number.isInteger(tier)) throw Error(`Unknown spell-rank key ${key}.`);
  return tier;
}

const exactKeys = (where: string, value: unknown, keys: readonly string[]): string[] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [`${where} is not an object`];
  const have = Object.keys(value);
  return [...have.filter(k => !keys.includes(k)).map(k => `${where}: unknown key ${k}`), ...keys.filter(k => !have.includes(k)).map(k => `${where}: missing ${k}`)];
};
const count = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0;
/** Problems with a skill-book file (empty = valid). Exported for the planted-bad controls in skill-book.test.ts. */
export function skillBookProblems(candidate: unknown): string[] {
  const top = exactKeys('skill-book.pc.json', candidate, ['version', '_about', 'enabled', 'award', 'weekScale', 'rankCost', 'teaching']);
  if (top.length) return top;
  const c = candidate as SkillBookRules, out: string[] = [];
  if (typeof c.enabled !== 'boolean') out.push('enabled must be true or false');
  const award = exactKeys('award', c.award, activities);
  out.push(...award);
  if (!award.length) for (const [k, v] of Object.entries(c.award)) if (!count(v)) out.push(`award.${k} ${String(v)} must be a whole number >= 0`);
  const scale = c.weekScale;
  if (!Array.isArray(scale) || scale.length !== season.weeks || scale.some((n, i) => !count(n) || n < 1 || (i > 0 && n < scale[i - 1]!)))
    out.push(`weekScale must be ${season.weeks} whole multipliers >= 1, never falling`);
  // One row per tier, one step per rank; every step a positive integer, rising along the rank and along the tier.
  const steps = maxSpellRank - 1, cost = c.rankCost;
  if (!Array.isArray(cost) || cost.length !== tiers || cost.some(row => !Array.isArray(row) || row.length !== steps || row.some(n => !count(n) || n < 1)))
    out.push(`rankCost must be ${tiers} tiers x ${steps} rank steps of whole numbers >= 1`);
  else cost.forEach((row, tier) => row.forEach((n, i) => {
    if (i > 0 && n <= row[i - 1]!) out.push(`rankCost[${tier}][${i}] ${n} must rise with the rank`);
    if (tier > 0 && n <= cost[tier - 1]![i]!) out.push(`rankCost[${tier}][${i}] ${n} must rise with the tier`);
  }));
  const teaching = exactKeys('teaching', c.teaching, ['trustAtLeast', 'signatures']);
  out.push(...teaching);
  if (!teaching.length) {
    if (!Number.isInteger(c.teaching.trustAtLeast)) out.push('teaching.trustAtLeast must be a whole number');
    const sig = c.teaching.signatures;
    if (!sig || typeof sig !== 'object' || Array.isArray(sig)) out.push('teaching.signatures is not an object');
    else for (const [school, key] of Object.entries(sig)) {
      if (!schoolIds.includes(school)) out.push(`teaching.signatures: ${school} is not a school`);
      else if (!schoolRankKeys(school).includes(key)) out.push(`teaching.signatures.${school}: ${key} is not a ${school} spell`);
    }
  }
  return out;
}
const loadProblems = skillBookProblems(data);
if (loadProblems.length) throw Error(loadProblems.join(' '));
export const skillBookRules: SkillBookRules = data;
/** The PC flag. Every entry point below takes `on` so tests and the census can run the slice with the file's flag off. */
export const skillBookOn: boolean = skillBookRules.enabled;

export const createSkillBook = (): SkillBook => ({ points: 0, earned: 0, ranks: {}, taught: [] });
/** Points one finished camp activity (an activity id from season.json activityHours) earns in campaign week `week`. */
export function activityPoints(activity: string, week: number, rules: SkillBookRules = skillBookRules): number {
  if (!activities.includes(activity)) throw Error(`Unknown camp activity ${activity}.`);
  if (!Number.isInteger(week) || week < 1 || week > season.weeks) throw Error(`Week ${week} is not a campaign week.`);
  return rules.award[activity]! * rules.weekScale[week - 1]!;
}
/** The book after one finished camp activity in campaign week `week` (calendar(t, day).week). Unchanged while off.
 * `rules` swaps the numbers for a census arm (report-skills.ts --flat); omitted, the file's. */
export function earnSkillPoints(book: SkillBook, activity: string, week: number, on = skillBookOn, rules: SkillBookRules = skillBookRules): SkillBook {
  const gain = on ? activityPoints(activity, week, rules) : 0;
  return gain ? { ...structuredClone(book), points: book.points + gain, earned: book.earned + gain } : book;
}
/** Spells the player can rank: every row of their own school, then the signatures taught to them. */
export const knownSpells = (book: SkillBook, school: string): string[] => [...schoolRankKeys(school), ...book.taught.filter(k => !schoolRankKeys(school).includes(k))];
export const rankOf = (book: SkillBook, key: string): number => book.ranks[key] ?? 1;
/** Points for the next rank of `key`, or null at the top rank. */
export function nextRankCost(book: SkillBook, key: string): number | null {
  const rank = rankOf(book, key);
  return rank >= maxSpellRank ? null : skillBookRules.rankCost[rankTier(key)]![rank - 1]!;
}
export function buyRankProblem(book: SkillBook, key: string, school: string): string | null {
  if (!knownSpells(book, school).includes(key)) return 'You do not know that spell.';
  const cost = nextRankCost(book, key);
  if (cost === null) return 'That spell is at its top rank.';
  return book.points < cost ? 'Not enough skill points.' : null;
}
export function buyRank(book: SkillBook, key: string, school: string): SkillBook {
  const problem = buyRankProblem(book, key, school);
  if (problem) throw Error(problem);
  const next = structuredClone(book);
  next.points -= nextRankCost(book, key)!; next.ranks[key] = rankOf(book, key) + 1;
  return next;
}

/** The elder who teaches a school, and the signature they teach (none for a school without one in the file). */
export function teacherOf(t: Tables, school: string): { teacher: string; signature: string } | undefined {
  const signature = skillBookRules.teaching.signatures[school];
  const elder = t.characters.characters.find(c => c.role === 'elder' && c.school === school);
  return signature && elder ? { teacher: elder.id, signature } : undefined;
}
/** Why `teacher` will not teach the player now, or null. The alignment check reads the camp's own trust ('teacher>player'),
 * the relationship state befriending, confiding and parley already move. */
export function lessonProblem(t: Tables, s: CampSession, book: SkillBook, teacher: string, on = skillBookOn): string | null {
  if (!on) return 'No one teaches spells yet.';
  const c = s.camp.characters[teacher], player = s.camp.characters[s.camp.player]!;
  const offer = c && c.role === 'elder' ? teacherOf(t, c.school) : undefined;
  if (!c || !offer || offer.teacher !== teacher) return 'They have no signature to teach.';
  if (c.life !== 'Alive' || player.life !== 'Alive' || !present(s).includes(teacher)) return 'They are not here.';
  if (knownSpells(book, player.school).includes(offer.signature)) return 'You already know their signature.';
  return (s.camp.trust[`${teacher}>${player.id}`] ?? 0) < skillBookRules.teaching.trustAtLeast ? 'They do not trust you enough to teach you.' : null;
}
export function learnSignature(t: Tables, s: CampSession, book: SkillBook, teacher: string, on = skillBookOn): SkillBook {
  const problem = lessonProblem(t, s, book, teacher, on);
  if (problem) throw Error(problem);
  return { ...structuredClone(book), taught: [...book.taught, teacherOf(t, s.camp.characters[teacher]!.school)!.signature] };
}
/** The ranks a bout should carry (createGames' `spellRanks`): undefined while off or while nothing is bought. */
export function boutSpellRanks(book: SkillBook, on = skillBookOn): SpellRanks | undefined {
  return on && Object.keys(book.ranks).length ? { ...book.ranks } : undefined;
}
