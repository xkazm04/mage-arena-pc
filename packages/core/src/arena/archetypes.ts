// Archetype plans and authored rival builds (spark combat-system-depth WP2; owner 2026-10-23: "Close fighters, Fast light
// spellcasters focused on first waves, Heavy slow long ranged mages which need to survive until later rounds and then control
// battlefield with powerful spells" - builds, not triangles; any school can run any archetype).
// A build (data/rival-builds.json) is stats incl. agility, spell ranks, a bolt + four loadout and an archetype. The plan layer
// here is code: a range band, an opener / setup / payoff sequence, and when to defend with which shape-class answer (Ring of
// Cinders answers close pressure, Air Form answers projectiles; Tide Ward answers beams in mage-ai.ts). Every number it plays
// comes from a row (range, mana, damage, cooldown, dash length) or the school's identity (resource thresholds), never from here.
// A build rival carries its build as its loadout's name (`build:<id>`, catalogue off), so the state alone says which plan runs
// and an actor without one (every Water mage, the CR-002/CR-007 catalogue rivals, preset loadouts) never reaches this file.
// Import order matters: kernel.ts must load before schools.ts reaches fire.ts (see fire.ts header).
import { runtime, ticks } from './kernel.ts';
import { rankRange, schoolIdentity } from './data.generated.ts';
import buildData from './data/rival-builds.json' with { type: 'json' };
import { balancedSpell, identityNumber, schoolSpellById, validateLoadout, type SchoolSpell } from './schools.ts';
import { schoolKit } from './school-kit.ts';
import { maxSpellRank, spellRanksProblems, ultimateFor } from './progression.ts';
import { paced } from './tuning.ts';
import { arenaContains } from './geometry.ts';
import { rotate, sub, unit, type Vec } from './math.ts';
import { slotSchools, type Actor, type ArenaState, type Ranks, type SlotComposition, type SlotSchool, type SpellRanks } from './types.ts';
import type { ShapeClass, Threat } from './mage-ai.ts';

export const archetypes = ['close', 'light', 'heavy'] as const;
export type Archetype = typeof archetypes[number];
export interface RivalBuild { id: string; school: SlotSchool; archetype: Archetype; wave: number; ranks: Required<Ranks>; spellRanks: SpellRanks; loadout: SlotComposition }
/** The mage waves a build may name (0-based Tiro waves: 2 semifinal, 3 final). */
export const buildWaves: readonly number[] = [2, 3];
/** Loadout-name prefix that marks a build rival (schools.ts keeps `name` free text; no preset starts with it). */
export const buildLoadoutPrefix = 'build:';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const unknownKeys = (v: Record<string, unknown>, known: string[], at: string): string[] => Object.keys(v).filter(k => !k.startsWith('_') && !known.includes(k)).map(k => `${at}: unknown key ${k}`);
const statKeys = ['vigor', 'focus', 'nerve', 'agility'] as const;
/** Problems with a rival-builds data file. Empty means every build spawns, plays its loadout and validates its ranks. */
export function rivalBuildProblems(candidate: unknown): string[] {
  if (!isRecord(candidate) || !isRecord(candidate.builds)) return ['rival-builds.json: no builds object'];
  const out = unknownKeys(candidate, ['builds'], 'rival-builds.json');
  for (const [id, build] of Object.entries(candidate.builds)) {
    const at = `rival-builds.json ${id}`;
    if (!isRecord(build)) { out.push(`${at}: not an object`); continue; }
    out.push(...unknownKeys(build, ['school', 'archetype', 'wave', 'ranks', 'spellRanks', 'loadout'], at));
    const school = build.school;
    if (typeof school !== 'string' || !(slotSchools as readonly string[]).includes(school)) { out.push(`${at}: school ${String(school)} is not fire or air`); continue; }
    if (typeof build.archetype !== 'string' || !(archetypes as readonly string[]).includes(build.archetype)) out.push(`${at}: archetype ${String(build.archetype)} is not close, light or heavy`);
    if (typeof build.wave !== 'number' || !buildWaves.includes(build.wave)) out.push(`${at}: wave ${String(build.wave)} is not a Tiro mage wave (2 or 3)`);
    const ranks = build.ranks;
    if (!isRecord(ranks)) out.push(`${at}: no ranks object`);
    else {
      out.push(...unknownKeys(ranks, [...statKeys], `${at} ranks`));
      for (const key of statKeys) {
        const r = ranks[key];
        if (typeof r !== 'number' || !Number.isInteger(r) || r < rankRange.min || r > rankRange.max) out.push(`${at}: ranks.${key} ${String(r)} is not an integer ${rankRange.min}..${rankRange.max}`);
      }
    }
    const loadout = build.loadout;
    let own: string[] = [];
    if (!isRecord(loadout) || typeof loadout.bolt !== 'string' || !Array.isArray(loadout.slots)) out.push(`${at}: loadout needs a bolt and four slots`);
    else {
      out.push(...unknownKeys(loadout, ['bolt', 'slots'], `${at} loadout`));
      const slots = loadout.slots as unknown[];
      if (slots.length !== 4 || slots.some(s => typeof s !== 'string')) out.push(`${at}: loadout needs four slot ids`);
      else {
        out.push(...validateLoadout({ school: school as SlotSchool, name: id, bolt: loadout.bolt, slots: slots as [string, string, string, string] }).map(p => `${at}: ${p}`));
        own = [loadout.bolt, ...(slots as string[])];
      }
    }
    const spellRanks = build.spellRanks;
    if (!isRecord(spellRanks)) out.push(`${at}: no spellRanks object`);
    else {
      out.push(...spellRanksProblems(spellRanks).map(p => `${at}: ${p}`));
      for (const [key, rank] of Object.entries(spellRanks)) {
        if (own.length && !own.includes(key)) out.push(`${at}: spellRanks ${key} is not in the build's loadout`);
        // Rank 5 is an ultimate form (WP3): a build may play it only on a row that has one (every other row stops at rank 4).
        if (rank === maxSpellRank && !ultimateFor(key, rank)) out.push(`${at}: spellRanks ${key} is rank 5 but ${key} has no ultimate form`);
      }
    }
  }
  return out;
}
const loadProblems = rivalBuildProblems(buildData);
if (loadProblems.length) throw Error(loadProblems.join(' '));
type BuildRow = (typeof buildData.builds)[keyof typeof buildData.builds];
/** The authored builds by id, in file order. */
export const rivalBuilds: Record<string, RivalBuild> = Object.fromEntries(Object.entries(buildData.builds as Record<string, BuildRow>).map(([id, b]) => [id, {
  id, school: b.school as SlotSchool, archetype: b.archetype as Archetype, wave: b.wave, ranks: { ...b.ranks }, spellRanks: { ...(b.spellRanks as SpellRanks) },
  loadout: { school: b.school as SlotSchool, name: `${buildLoadoutPrefix}${id}`, bolt: b.loadout.bolt, slots: [b.loadout.slots[0]!, b.loadout.slots[1]!, b.loadout.slots[2]!, b.loadout.slots[3]!] },
}]));
/** The build this actor plays, read from its loadout's name; undefined for every other actor. */
export function rivalBuildOf(a: Actor): RivalBuild | undefined {
  const s = a.schoolState;
  if (!s || s.catalogue || !s.loadout.name.startsWith(buildLoadoutPrefix)) return undefined;
  return rivalBuilds[s.loadout.name.slice(buildLoadoutPrefix.length)];
}

// The plan layer.
// Every per-school reading below is the row's school kit (school-kit.ts): role, answer class, weight, resource, form-up, dash-builds.
/** What a row does in a plan, read from its shape (never from a number). */
export type Role = 'bolt' | 'dash' | 'build' | 'answer' | 'hit' | 'payoff' | 'signature';
export const roleOf = (spell: SchoolSpell): Role => schoolKit(spell.school).role(spell);
/** The shape class an answer row answers (owner decision: shape-class answers on existing defensive rows). */
export function answersShape(spell: SchoolSpell): ShapeClass | undefined {
  return roleOf(spell) === 'answer' ? schoolKit(spell.school).answers : undefined;
}
/** Damage one press can deliver (Air rows: per projectile x count). */
const weight = (spell: SchoolSpell): number => schoolKit(spell.school).weight(spell);
/** The school's resource (Heat or Momentum) and its top threshold (Blazing 80; Momentum 80), read from the identity. */
const resourceOf = (a: Actor): number => schoolKit(a.schoolState!.school).resource(a);
function resourcePeak(school: SlotSchool, state: ArenaState): number {
  const count = schoolIdentity[school].thresholds.length;
  return Math.max(...Array.from({ length: count }, (_, i) => identityNumber(school, `thresholds.${i}.at`, state)));
}
function resourceFirst(school: SlotSchool, state: ArenaState): number {
  const count = schoolIdentity[school].thresholds.length;
  return Math.min(...Array.from({ length: count }, (_, i) => identityNumber(school, `thresholds.${i}.at`, state)));
}
/** The build's rows as balanced (the overlay applies; the tier gate does not: a band plans for the row it will press). */
const ownRows = (build: RivalBuild, state: ArenaState): SchoolSpell[] =>
  [build.loadout.bolt, ...build.loadout.slots].map(id => balancedSpell(schoolSpellById(id)!, state));
const ranged = (s: SchoolSpell): boolean => s.rangeM > 0 && weight(s) > 0 && roleOf(s) !== 'answer' && roleOf(s) !== 'dash';

/** Fractions of a row's reach that make each archetype's band (plan shape, not balance: the metres come from the rows). */
const bandFraction: Record<Archetype, readonly [number, number]> = { close: [0.5, 0.85], light: [0.7, 1], heavy: [0.75, 0.95] };
/** The distance band this build holds, and whether to sprint at `distanceM`: close inside its shortest damaging row (or its dash), light at its bolt's reach (Air: 10-14 m),
 * heavy at the shortest reach among the payoff rows its collar has unlocked (the bolt's before any). */
export function archetypeBand(state: ArenaState, a: Actor, distanceM = 0): { band: [number, number]; sprint: boolean } | undefined {
  const build = rivalBuildOf(a); if (!build) return undefined;
  const rows = ownRows(build, state), f = bandFraction[build.archetype], bolt = rows[0]!;
  let reach = bolt.rangeM;
  if (build.archetype === 'close') {
    const short = rows.filter(s => roleOf(s) === 'hit' || roleOf(s) === 'answer').map(s => s.rangeM).filter(r => r > 0 && r < bolt.rangeM / 2);
    const dash = rows.find(s => roleOf(s) === 'dash');
    reach = short.length ? Math.max(...short) : dash ? dash.rangeM : bolt.rangeM / 3;
  } else if (build.archetype === 'heavy') {
    const payoffs = rows.filter(s => (roleOf(s) === 'payoff' || roleOf(s) === 'signature') && ranged(s) && s.tier <= a.tier).map(s => s.rangeM);
    if (payoffs.length) reach = Math.min(...payoffs);
  }
  const band: [number, number] = [reach * f[0], reach * f[1]];
  // Close sprints in from twice its band; light and heavy sprint out of a target inside the band (walking, the chaser keeps pace).
  return { band, sprint: build.archetype === 'close' ? distanceM > band[1] * 2 : distanceM < band[0] };
}

export interface PlanSlot { slot: number; spell: SchoolSpell; can: boolean }
export interface PlanPick { slot: number; cast: true; aim?: Vec }
/** A dash end along `direction`, kept inside the arena (reversed, then toward the centre, when the wall is in the way). */
function dashAim(a: Actor, direction: Vec, dashM: number): Vec {
  const end = (d: Vec): Vec => ({ x: a.pos.x + d.x * dashM, y: a.pos.y + d.y * dashM });
  const toCentre = unit(sub(runtime.geometry.arenaCentre, a.pos), direction);
  const pick = [direction, rotate(direction, Math.PI / 2), rotate(direction, -Math.PI / 2), toCentre].find(d => arenaContains(end(d), a.radius)) ?? toCentre;
  return end(pick);
}
/** The tick this row's cooldown started (its last press), from the running cooldown; -Infinity when never pressed. */
const lastPress = (a: Actor, spell: SchoolSpell): number => {
  const until = a.schoolState!.cooldowns[spell.id]; return until === undefined ? -Infinity : until - ticks(paced(a, spell.cooldownS));
};
/** The tier a heavy build survives to before it plays (owner: "survive until later rounds", spark: tiers III-IV). */
const heavyPayoffTier = 3;
/** How far ahead an answer is cast (the row's own windup plus a decision cadence would be later than the blow). */
const answerHorizonS = 0.6;

/** The archetype's pick for this decision, or undefined to withhold. `slots` are the build's slots this tick with legality
 * (`can`: tier, cooldown by the ready tick, mana, reach) as the school brain reads it. Draws no random. */
export function archetypeChoose(state: ArenaState, a: Actor, target: Actor, distanceM: number, seen: Threat[], slots: PlanSlot[]): PlanPick | undefined {
  const build = rivalBuildOf(a); if (!build) return undefined;
  const ready = slots.filter(c => c.can), of = (role: Role): PlanSlot[] => ready.filter(c => roleOf(c.spell) === role);
  const best = (list: PlanSlot[]): PlanSlot | undefined => [...list].sort((x, y) => weight(y.spell) - weight(x.spell) || x.slot - y.slot)[0];
  const toward = unit(sub(target.pos, a.pos), a.facing), away = { x: -toward.x, y: -toward.y };
  const resource = resourceOf(a), peak = resourcePeak(build.school, state), first = resourceFirst(build.school, state);
  const band = archetypeBand(state, a)!.band;
  // 1. The shape-class answer: an aimed, blockable threat of the answer's class landing soon, or (Ring) a body inside its reach.
  for (const c of of('answer')) {
    const shape = answersShape(c.spell)!, soon = state.tick + ticks(answerHorizonS);
    const incoming = seen.some(t => t.aimedAtUs && t.family !== 'unblockable' && t.shape === shape && t.impactTick <= soon);
    const pressed = shape === 'close' && distanceM <= c.spell.rangeM + target.radius;
    if ((incoming || pressed) && !schoolKit(c.spell.school).answerUp(state, a)) return { slot: c.slot, cast: true, ...(shape === 'close' ? { aim: { ...target.pos } } : {}) };
  }
  // 2. The signature (unblockable, tier IV) whenever legal and the target is not mid-roll.
  const signature = of('signature').find(() => state.tick >= target.rollUntil);
  if (signature && build.archetype !== 'light') return { slot: signature.slot, cast: true };
  const dash = of('dash')[0];
  if (build.archetype === 'close') {
    // Brawler cycle: dash in, build the resource to its peak with the short rows, cash it with the strongest payoff.
    if (dash && distanceM > band[1] + dash.spell.rangeM / 2) return { slot: dash.slot, cast: true, aim: dashAim(a, toward, dash.spell.rangeM) };
    const payoff = best(of('payoff'));
    if (payoff && resource >= peak) return { slot: payoff.slot, cast: true };
    const hit = best(of('hit'));
    if (hit) return { slot: hit.slot, cast: true };
    // A school that builds its resource by moving (Air Momentum): a dash toward the target is both the gap closer and the builder.
    if (dash && schoolKit(build.school).movesForResource && resource < first) return { slot: dash.slot, cast: true, aim: dashAim(a, toward, dash.spell.rangeM) };
    const builder = of('build')[0];
    if (builder && resource < peak) return { slot: builder.slot, cast: true };
    if (payoff) return { slot: payoff.slot, cast: true };
  } else if (build.archetype === 'light') {
    // Skirmisher kite: hold the bolt's reach, dash out when pressed (Air: also to keep Momentum high), alternate the damaging rows
    // so a slow one (Veering Bolt) and a fast one (Shear) arrive together, spend freely (the light build peaks early).
    if (dash && distanceM < band[0] * 0.75) return { slot: dash.slot, cast: true, aim: dashAim(a, away, dash.spell.rangeM) };
    if (dash && schoolKit(build.school).movesForResource && resource < peak) return { slot: dash.slot, cast: true, aim: dashAim(a, rotate(toward, Math.PI / 2), dash.spell.rangeM) };
    const builder = of('build')[0];
    if (builder && resource < first) return { slot: builder.slot, cast: true };
    const damaging = [...of('hit'), ...of('payoff'), ...of('signature')];
    const newest = Math.max(-Infinity, ...damaging.map(c => lastPress(a, c.spell)));
    const pick = [...damaging].sort((x, y) => Number(lastPress(a, x.spell) === newest) - Number(lastPress(a, y.spell) === newest) || weight(y.spell) - weight(x.spell) || x.slot - y.slot)[0];
    if (pick) return { slot: pick.slot, cast: true };
  } else {
    // Long-range controller: hold far; until its collar reaches tier III it survives (hands free for the ward while anything is seen
    // coming), then it plays its payoff sequence (D1 4.2): the newest tier's payoff first (Brand Wrath, Cyclone at tier IV), the
    // strongest of a tier before the rest, and keeps the mana its next payoff needs.
    if (dash && distanceM < band[0] / 2) return { slot: dash.slot, cast: true, aim: dashAim(a, away, dash.spell.rangeM) };
    const waiting = a.tier < heavyPayoffTier && seen.length > 0;
    const payoff = [...of('payoff')].sort((x, y) => y.spell.tier - x.spell.tier || weight(y.spell) - weight(x.spell) || x.slot - y.slot)[0];
    if (payoff && !waiting) return { slot: payoff.slot, cast: true };
    const builder = of('build')[0];
    if (builder && resource < first) return { slot: builder.slot, cast: true };
    const reserve = Math.max(0, ...ownRows(build, state).filter(s => (roleOf(s) === 'payoff' || roleOf(s) === 'signature') && s.tier <= a.tier + 1).map(s => s.mana));
    const bolt = of('bolt')[0];
    if (bolt && !waiting && a.mana - bolt.spell.mana >= reserve) return { slot: bolt.slot, cast: true };
    return undefined;
  }
  const bolt = of('bolt')[0];
  return bolt ? { slot: bolt.slot, cast: true } : undefined;
}
/** Tempo: a light build holds its bolt down between decisions (a stream at the bolt's cooldown); close and heavy builds press it once
 * per decision (the brawler's damage is its cycle, the controller's its payoffs). Every other press and every other actor holds. */
export function holdsPress(a: Actor, slot: number): boolean {
  const build = rivalBuildOf(a);
  return !build || build.archetype === 'light' || slot !== 0;
}
/** True when any living opponent of `a` plays a build (the shape-class answer rule for a Water defender, mage-ai.ts). */
export const facesBuild = (state: ArenaState, a: Actor): boolean => state.actors.some(o => o.team !== a.team && !o.tags.includes('DEFEATED') && rivalBuildOf(o) !== undefined);
/** Every build id, for runners and pickers. */
export const rivalBuildIds: readonly string[] = Object.keys(rivalBuilds);
