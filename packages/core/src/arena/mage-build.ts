// One mage-build seam (challenge 2026-10-25): what a mage's build means - its ranked rows, the average-rank rule, its validation and
// applying it to an actor - in one pure module, read by the Lab (lab.ts), the Games opponent-mage option (games.ts) and the
// censuses (scripts/week-census.ts, skill-census.ts), so none of them can drift on it.
import { mageVitals } from './kernel.ts';
import { rankRange } from './data.generated.ts';
import { newSchoolState, validateLoadout } from './schools.ts';
import { enemyHpMult, maxEnemyLevel, maxSpellRank, setSpellRanks, spellRankKeys, spellRanksProblems, validEnemyLevel } from './progression.ts';
import { buildLoadoutPrefix, rivalBuilds } from './archetypes.ts';
import { slotSchools, type Actor, type ArenaState, type Composition, type Ranks, type SlotComposition, type SpellRanks } from './types.ts';

/** A mage's build (spark combat-system-depth WP4): stats incl. agility, spell ranks and, for a Fire or Air mage, the bolt + 4
 * loadout that makes it a real school actor. `plan` names the rival build (rival-builds.json) whose loadout this is; `level`
 * (1..maxEnemyLevel, the campaign week) gives it the regular enemies' HP multiplier for that week. Absent fields change nothing. */
export interface MageBuild { ranks?: Ranks; spellRanks?: SpellRanks; loadout?: SlotComposition; plan?: string; level?: number }
/** The loadout name a build wears when it plays no plan (never the build prefix, so archetypes.ts leaves it alone). */
export const unplannedLoadoutName = "lab pick";

/** A Water composition's ranked rows: the bolt, then each line at tiers I-IV. */
export const compositionRows = (composition: Composition): string[] => ["bolt:0", ...composition.lines.flatMap((line) => [1, 2, 3, 4].map((tier) => `${line}:${tier}`))];
/** An actor's ranked rows: a Fire/Air actor's bolt and four slots, else its Water composition's rows. */
export const buildRows = (actor: Actor): string[] => actor.schoolState ? [actor.schoolState.loadout.bolt, ...actor.schoolState.loadout.slots] : compositionRows(actor.water.composition);
/** A valid average rank: 1..maxSpellRank in halves. */
export const validAverageRank = (average: unknown): average is number =>
  typeof average === "number" && average >= 1 && average <= maxSpellRank && Number.isInteger(average * 2);
/** Spell ranks for rows at an average rank: each row at it, or for a .5 alternate rows at the rank above and below (unknown keys
 * dropped). Empty at rank 1. With a `floor` (a build's authored spellRanks), no row ranks below it: the floor's keys first, then
 * the rows', each at the higher of the two. */
export function ranksAtAverage(rows: readonly string[], average: number, options: { floor?: SpellRanks } = {}): SpellRanks {
  const ranked: SpellRanks = average === 1 ? {} : Object.fromEntries(rows.filter((k) => spellRankKeys.includes(k))
    .map((k, i) => [k, Number.isInteger(average) ? average : i % 2 === 0 ? Math.ceil(average) : Math.floor(average)]));
  if (!options.floor) return ranked;
  const own = options.floor;
  return Object.fromEntries([...new Set([...Object.keys(own), ...Object.keys(ranked)])].map((k) => [k, Math.max(own[k] ?? 1, ranked[k] ?? 1)]));
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const statKeys = ["vigor", "focus", "nerve", "agility"] as const;
/** Problems with one mage's build (empty = valid; absent = valid). The loadout must be the mage's own Fire/Air school and pass
 * `validateLoadout`; a plan must name a rival build of that school whose bolt + 4 the loadout is, slot for slot. `level` is a
 * known key only with `{ level: true }` (the Lab's builds carry none). */
export function mageBuildProblems(build: unknown, school: string, at = "Build", options: { level?: boolean } = {}): string[] {
  if (build === undefined) return [];
  if (!isRecord(build)) return [`${at} is not an object.`];
  const keys = ["ranks", "spellRanks", "loadout", "plan", ...(options.level ? ["level"] : [])];
  const out = Object.keys(build).filter((k) => !keys.includes(k)).map((k) => `${at}: unknown key ${k}.`);
  const { ranks, spellRanks, loadout, plan, level } = build;
  if (ranks !== undefined) {
    if (!isRecord(ranks)) out.push(`${at}: ranks is not an object.`);
    else {
      out.push(...Object.keys(ranks).filter((k) => !(statKeys as readonly string[]).includes(k)).map((k) => `${at}: unknown stat ${k}.`));
      for (const key of statKeys) {
        const r = ranks[key];
        if (key === "agility" && r === undefined) continue;
        if (!Number.isInteger(r) || (r as number) < rankRange.min || (r as number) > rankRange.max) out.push(`${at}: ${key} ${String(r)} is not an integer ${rankRange.min}..${rankRange.max}.`);
      }
    }
  }
  if (spellRanks !== undefined) out.push(...spellRanksProblems(spellRanks).map((p) => `${at}: ${p}`));
  let own: SlotComposition | undefined;
  if (loadout !== undefined) {
    if (!isRecord(loadout) || typeof loadout.school !== "string" || typeof loadout.name !== "string" || typeof loadout.bolt !== "string" || !Array.isArray(loadout.slots) || loadout.slots.length !== 4 || loadout.slots.some((s) => typeof s !== "string"))
      out.push(`${at}: a loadout needs a school, a name, a bolt and four slot ids.`);
    else if (!(slotSchools as readonly string[]).includes(loadout.school) || loadout.school !== school)
      out.push(`${at}: a ${loadout.school} loadout cannot play on a ${school} side.`);
    else {
      own = loadout as unknown as SlotComposition;
      out.push(...validateLoadout(own).map((p) => `${at}: ${p}`));
    }
  }
  if (plan !== undefined) {
    const rival = typeof plan === "string" ? rivalBuilds[plan] : undefined;
    if (!rival) out.push(`${at}: plan ${String(plan)} is not a rival build.`);
    else if (!own || own.school !== rival.school || own.bolt !== rival.loadout.bolt || own.slots.some((id, i) => id !== rival.loadout.slots[i]))
      out.push(`${at}: plan ${plan} needs its own bolt + 4 loadout.`);
  }
  if (options.level && level !== undefined && !validEnemyLevel(level)) out.push(`${at}: level ${String(level)} is not an integer 1..${maxEnemyLevel}.`);
  return out;
}

/** Apply a validated build to an actor: the ranks size HP, mana and stamina exactly as `addMage` does (mageVitals); a loadout
 * makes it a real Fire/Air actor (named for its plan, else `unplannedLoadoutName`); spell ranks ride on the actor; a level then
 * scales its HP by the week (enemyHpMult; 1 under canonical balance). No build, no change. */
export function applyMageBuild(a: Actor, build: MageBuild | undefined, state?: ArenaState): void {
  if (!build) return;
  if (build.ranks) {
    const { maxHp, maxMana, maxStamina } = mageVitals(build.ranks);
    a.ranks = { ...build.ranks };
    a.hp = a.maxHp = maxHp;
    a.mana = a.maxMana = maxMana;
    a.stamina = a.maxStamina = maxStamina;
  }
  if (build.loadout) {
    a.school = build.loadout.school;
    a.schoolState = newSchoolState({ ...build.loadout, name: build.plan ? `${buildLoadoutPrefix}${build.plan}` : unplannedLoadoutName });
  }
  setSpellRanks(a, build.spellRanks);
  if (build.level !== undefined) levelHp(a, build.level, state);
}

/** The Games opponent-mage lever (D1 4.3, 6.8): `level` gives every opponent mage the regular enemies' HP multiplier for that
 * week; `averageRank` ranks its rows (buildRows) at that average, never below the ranks it already carries. */
export interface OpponentMage { level?: number; averageRank?: number }
export function opponentMageProblems(o: unknown): string[] {
  if (!isRecord(o)) return ["Opponent mage is not an object."];
  return [
    ...Object.keys(o).filter((k) => k !== "level" && k !== "averageRank").map((k) => `Opponent mage: unknown key ${k}.`),
    ...(o.level === undefined || validEnemyLevel(o.level) ? [] : [`Opponent mage: level ${String(o.level)} is not an integer 1..${maxEnemyLevel}.`]),
    ...(o.averageRank === undefined || validAverageRank(o.averageRank) ? [] : [`Opponent mage: average rank ${String(o.averageRank)} is not 1..${maxSpellRank} in halves.`]),
  ];
}
function levelHp(a: Actor, level: number, state?: ArenaState) {
  const hpMult = enemyHpMult(level, state);
  if (hpMult !== 1) a.hp = a.maxHp = a.maxHp * hpMult;
}
/** Level one spawned opponent mage: HP first, then ranks. Ranks are rewritten only when they change, so a level-1, rank-1
 * spec leaves the actor exactly as spawned. */
export function applyOpponentMage(a: Actor, spec: OpponentMage, state?: ArenaState): void {
  if (spec.level !== undefined) levelHp(a, spec.level, state);
  if (spec.averageRank === undefined) return;
  const ranks = ranksAtAverage(buildRows(a), spec.averageRank, { floor: a.spellRanks ?? {} });
  if (JSON.stringify(ranks) !== JSON.stringify(a.spellRanks ?? {})) setSpellRanks(a, ranks);
}
