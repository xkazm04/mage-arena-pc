// PC build depth (spark combat-system-depth WP1; docs/concepts/combat-system-depth.md): Agility, spell ranks and enemy
// levels, read from data/progression.pc.json and checked strictly at load. Every accessor is neutral at its default
// (absent agility = rank 1, absent spell rank = rank 1, enemy level 1) and ignores a state that runs balance
// 'canonical' (the VR parity suites), so goldens, the default census and CR-002/CR-007 parity step exactly as before.
// Imports stay leaf-ward (generated data, tuning, types) so schools.ts, fire.ts, air.ts and water.ts can all read it.
import data from './data/progression.pc.json' with { type: 'json' };
import { airRows, fireRows, rankRange, waterRows } from './data.generated.ts';
import { paced } from './tuning.ts';
import type { Spell } from './catalog.ts';
import type { Actor, ArenaState, SpellRanks } from './types.ts';

/** A rank-5 ultimate form; WP3 authors the fields. The registry is keyed by Fire/Air spell id. */
export interface UltimateForm { summary: string }
export interface Progression {
  version: string; _about: string;
  agility: { pointsForRank: number[]; castMultPerRank: number; perfectWindowAddSPerRank: number; recoveryMultPerRank: number; drainMultPerRank: number };
  spellRanks: { maxRank: number; power: number[]; ultimates: Record<string, UltimateForm> };
  enemyLevels: { hpMult: number[] };
}

/** Every spell-rank key: a Fire/Air spell id, or a Water line row `<line>:<tier>` (the bolt is `bolt:0`). */
export const waterRankKey = (spell: Pick<Spell, 'line' | 'tier'>): string => `${spell.line}:${spell.tier}`;
const slotSpellIds: readonly string[] = [...fireRows, ...airRows].map(r => r.id);
export const spellRankKeys: readonly string[] = [...slotSpellIds, ...new Set(waterRows.map(r => `${r.line}:${r.tier}`))];

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const exactKeys = (where: string, value: unknown, keys: string[]): string[] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [`${where} is not an object`];
  const have = Object.keys(value);
  return [...have.filter(k => !keys.includes(k)).map(k => `${where}: unknown key ${k}`), ...keys.filter(k => !have.includes(k)).map(k => `${where}: missing ${k}`)];
};
/** Problems with a progression file (empty = valid). Exported for the planted-bad controls in authored-data.test.ts. */
export function progressionProblems(candidate: unknown): string[] {
  const top = exactKeys('progression.pc.json', candidate, ['version', '_about', 'agility', 'spellRanks', 'enemyLevels']);
  if (top.length) return top;
  const c = candidate as Progression, out: string[] = [];
  const ranks = rankRange.max - rankRange.min + 1, steps = rankRange.max - 1;
  // Agility: the shared points curve, and per-rank effects whose sign is the stat's direction and whose top rank stays positive.
  const ag = c.agility;
  out.push(...exactKeys('agility', ag, ['pointsForRank', 'castMultPerRank', 'perfectWindowAddSPerRank', 'recoveryMultPerRank', 'drainMultPerRank']));
  if (!out.length) {
    if (!Array.isArray(ag.pointsForRank) || ag.pointsForRank.length !== ranks || ag.pointsForRank[0] !== 0 || ag.pointsForRank.some((p, i) => !Number.isInteger(p) || (i > 0 && p <= ag.pointsForRank[i - 1]!)))
      out.push(`agility.pointsForRank must be ${ranks} rising integers from 0`);
    for (const key of ['castMultPerRank', 'recoveryMultPerRank', 'drainMultPerRank'] as const)
      if (!finite(ag[key]) || ag[key] > 0 || 1 + ag[key] * steps <= 0) out.push(`agility.${key} ${ag[key]} must be <= 0 and keep rank ${rankRange.max} above 0`);
    if (!finite(ag.perfectWindowAddSPerRank) || ag.perfectWindowAddSPerRank < 0) out.push(`agility.perfectWindowAddSPerRank ${ag.perfectWindowAddSPerRank} must be >= 0`);
  }
  // Spell ranks: ranks 1..maxRank, power for ranks 1..maxRank-1 starting at 1 and never falling; ultimates on real Fire/Air rows.
  const sr = c.spellRanks, srKeys = exactKeys('spellRanks', sr, ['maxRank', 'power', 'ultimates']);
  out.push(...srKeys);
  if (!srKeys.length) {
    if (sr.maxRank !== 5) out.push(`spellRanks.maxRank ${sr.maxRank} must be 5 (ranks 1-4 power, rank 5 the ultimate form)`);
    if (!Array.isArray(sr.power) || sr.power.length !== sr.maxRank - 1 || sr.power[0] !== 1 || sr.power.some((p, i) => !finite(p) || (i > 0 && p < sr.power[i - 1]!)))
      out.push(`spellRanks.power must be ${sr.maxRank - 1} non-falling multipliers starting at 1`);
    if (!sr.ultimates || typeof sr.ultimates !== 'object' || Array.isArray(sr.ultimates)) out.push('spellRanks.ultimates is not an object');
    else for (const [id, form] of Object.entries(sr.ultimates)) {
      if (!slotSpellIds.includes(id)) out.push(`spellRanks.ultimates: ${id} is not a Fire/Air spell id`);
      else out.push(...exactKeys(`spellRanks.ultimates.${id}`, form, ['summary']));
    }
  }
  // Enemy levels: one multiplier per campaign week, level 1 = authored HP, never falling.
  const el = c.enemyLevels, elKeys = exactKeys('enemyLevels', el, ['hpMult']);
  out.push(...elKeys);
  if (!elKeys.length && (!Array.isArray(el.hpMult) || el.hpMult.length < 1 || el.hpMult[0] !== 1 || el.hpMult.some((m, i) => !finite(m) || (i > 0 && m < el.hpMult[i - 1]!))))
    out.push('enemyLevels.hpMult must start at 1 and never fall');
  return out;
}
const loadProblems = progressionProblems(data);
if (loadProblems.length) throw Error(loadProblems.join(' '));
export const progression: Progression = data as Progression;
export const maxSpellRank = progression.spellRanks.maxRank;
export const maxEnemyLevel = progression.enemyLevels.hpMult.length;

/** PC progression applies unless the state runs VR's canonical numbers (the parity suites). */
const live = (state?: ArenaState): boolean => state?.balance !== 'canonical';

// Agility.
/** The actor's agility rank as this state plays it: absent = 1, and 1 under canonical balance. */
export const agilityRank = (a: Actor, state?: ArenaState): number => live(state) ? a.ranks.agility ?? 1 : 1;
const agilityMult = (perRank: number, a: Actor, state?: ArenaState): number => {
  const steps = agilityRank(a, state) - 1;
  return steps > 0 ? 1 + perRank * steps : 1;
};
export const agilityCastMult = (a: Actor, state?: ArenaState): number => agilityMult(progression.agility.castMultPerRank, a, state);
export const agilityRecoveryMult = (a: Actor, state?: ArenaState): number => agilityMult(progression.agility.recoveryMultPerRank, a, state);
export const agilityDrainMult = (a: Actor, state?: ArenaState): number => agilityMult(progression.agility.drainMultPerRank, a, state);
/** Seconds added to the perfect-absorb window (0 at rank 1). */
export const agilityPerfectWindowAddS = (a: Actor, state?: ArenaState): number => {
  const steps = agilityRank(a, state) - 1;
  return steps > 0 ? progression.agility.perfectWindowAddSPerRank * steps : 0;
};
/** The caster's own cast time (already paced) shortened by agility; identity at rank 1. */
export const agileCastS = (a: Actor, seconds: number, state?: ArenaState): number => seconds * agilityCastMult(a, state);
/** A defender-facing warning (already paced, already floored) shortened by agility, never below its reaction-band floor
 * and, like pacedWarning, not shortened at all when authored under the floor; identity at rank 1. */
export const agileWarningS = (a: Actor, warningS: number, floorS: number, state?: ArenaState): number => {
  const m = agilityCastMult(a, state);
  return m === 1 ? warningS : Math.max(Math.min(warningS, floorS), warningS * m);
};
/** One of the actor's recoveries (cast, ward re-raise, staff strike, roll) at its pace, shortened by agility. */
export const agileRecoveryS = (a: Actor, seconds: number, state?: ArenaState): number => paced(a, seconds) * agilityRecoveryMult(a, state);

// Spell ranks.
/** Problems with a spell-rank map: known keys, integer ranks 1..maxRank. */
export function spellRanksProblems(ranks: unknown): string[] {
  if (!ranks || typeof ranks !== 'object' || Array.isArray(ranks)) return ['Spell ranks must be an object.'];
  return Object.entries(ranks).flatMap(([key, rank]) => [
    ...(spellRankKeys.includes(key) ? [] : [`Unknown spell-rank key ${key}.`]),
    ...(Number.isInteger(rank) && (rank as number) >= 1 && (rank as number) <= maxSpellRank ? [] : [`Spell rank ${key}=${String(rank)} is not an integer 1..${maxSpellRank}.`]),
  ]);
}
/** Carry spell ranks on an actor (validated; an empty map leaves the key absent). */
export function setSpellRanks(a: Actor, ranks: SpellRanks | undefined): void {
  if (ranks === undefined) return;
  const problems = spellRanksProblems(ranks);
  if (problems.length) throw Error(problems.join(' '));
  if (Object.keys(ranks).length) a.spellRanks = { ...ranks }; else delete a.spellRanks;
}
/** The rank this state plays for one key: absent = 1, and 1 under canonical balance. */
export const spellRank = (a: Actor, key: string, state?: ArenaState): number => live(state) ? a.spellRanks?.[key] ?? 1 : 1;
/** Power of a rank: ranks 1-4 from the table, rank 5 keeps rank 4 power (its extra is the ultimate form). */
export function rankPower(rank: number): number {
  const power = progression.spellRanks.power;
  return power[Math.min(Math.max(1, rank), power.length) - 1]!;
}
/** The rank-5 ultimate form of a Fire/Air row, when one is registered (WP3 fills the registry; empty in WP1). */
export function ultimateFor(spellId: string, rank: number): UltimateForm | undefined {
  return rank >= maxSpellRank ? progression.spellRanks.ultimates[spellId] : undefined;
}
/** Water's ranked row: damage and effect size (heals, the Font's mana, Return Tide's stored cap) times the rank's power.
 * Ratios (slow, ward, sheen), displacement and durations keep the row's numbers. Identity at rank 1. */
const scaledWaterEffects = new Set(['heal', 'hot', 'font', 'return']);
export function rankedWaterSpell(spell: Spell, a: Actor, state?: ArenaState): Spell {
  const power = rankPower(spellRank(a, waterRankKey(spell), state));
  if (power === 1) return spell;
  return { ...spell, damage: spell.damage * power, ...(scaledWaterEffects.has(spell.effect) ? { amount: spell.amount * power } : {}) };
}

// Enemy levels.
export function validEnemyLevel(level: unknown): level is number {
  return Number.isInteger(level) && (level as number) >= 1 && (level as number) <= maxEnemyLevel;
}
/** HP multiplier for a regular enemy at this level (1 at level 1 and under canonical balance). */
export function enemyHpMult(level: number, state?: ArenaState): number {
  if (!validEnemyLevel(level)) throw Error(`Enemy level ${level} is not an integer 1..${maxEnemyLevel}.`);
  return live(state) ? progression.enemyLevels.hpMult[level - 1]! : 1;
}
