// One SchoolKit per slot school (challenge 2026-10-25): every per-school fact the kernel seam, the mage AI and the archetype
// plan read - the CSV sheet, the rules and the brain, the kind -> role / shape-class reading, damage weight, the resource, the
// answer class, labels - in one place, so schools.ts, mage-ai-schools.ts, archetypes.ts and school-rivals.ts carry no school
// literal. Also the brain skeleton the Fire and Air brains share: slot enumeration and the competence pick.
// Load order: schools.ts imports this file, and this file imports fire.ts, air.ts and both brains, so nothing here may read
// those modules at load (see the fire.ts header). The registry is built on its first call, at call time; only `schoolSheet`
// is read at load (by schools.ts for canonicalSpells), and it is a hoisted function over data.generated.ts alone.
import { airRows, fireRows } from './data.generated.ts';
import { fireRules, fireShape, heatValue } from './fire.ts';
import { airRow, airRules, momentumOf } from './air.ts';
import { canonicalSpells, slotSpell, type SchoolRules, type SchoolSpell } from './schools.ts';
import { fireBrain, fireOfferable, fireShapeClass } from './mage-ai-fire.ts';
import { airBrain, airOfferable, airShapeClass } from './mage-ai-air.ts';
import { random } from './kernel.ts';
import { slotSchools, type Actor, type ArenaState, type SlotSchool } from './types.ts';
import type { Role } from './archetypes.ts';
import type { SchoolBrain } from './mage-ai-schools.ts';
import type { competence, ShapeClass } from './mage-ai.ts';

/** A school's CSV rows (data.generated.ts). Hoisted and free of module state: schools.ts reads it at its own load. */
export function schoolSheet(school: SlotSchool): readonly Readonly<Record<string, string>>[] {
  return ({ fire: fireRows, air: airRows } as Record<SlotSchool, readonly Readonly<Record<string, string>>[]>)[school];
}

export interface SchoolKit {
  school: SlotSchool;
  /** The catalogue rival's label (CR-002 parity modes) and the named rival who plays this school in the PC bracket. */
  label: string; named: string;
  /** The shape class this school's answer row answers (Ring of Cinders: close pressure; Air Form: projectiles). */
  answers: ShapeClass;
  /** True when the school's dash builds its resource (Air Momentum is built by moving), so a plan may dash to build. */
  movesForResource: boolean;
  readonly rules: SchoolRules;
  readonly brain: SchoolBrain;
  /** The canonical rows in CSV order (slot n = row n for a catalogue rival). */
  rows(): SchoolSpell[];
  /** The row's shape kind as the school module reads its prose. */
  kindOf(id: string): string | undefined;
  /** The shape class a row's blow presents to its defender (mage-ai.ts ShapeClass). */
  shapeClass(id: string): ShapeClass;
  /** What a row does in a plan, read from its shape (never from a number). */
  role(spell: SchoolSpell): Role;
  /** Damage one press can deliver (Air rows: per projectile x count). */
  weight(spell: SchoolSpell): number;
  /** The school's resource value (Heat, Momentum). */
  resource(a: Actor): number;
  /** True while the answer is already up (Air Form running), so the plan does not recast it. */
  answerUp(state: ArenaState, a: Actor): boolean;
  /** VR FireOfferable / AirOfferable: tier (slotSpell), cooldown by `readyTick`, mana and reach as the brain reads them. */
  offerable(state: ArenaState, a: Actor, spell: SchoolSpell, distanceM: number, readyTick: number): boolean;
}
/** A row's plan role: tier 0 is the bolt, every other row reads its school's shape kind. */
const withBolt = (kindRole: (spell: SchoolSpell) => Role) => (spell: SchoolSpell): Role => spell.tier === 0 ? 'bolt' : kindRole(spell);
const fireKit = (): SchoolKit => ({
  school: 'fire', label: 'Ember mage', named: 'Brennic', answers: 'close', movesForResource: false,
  get rules() { return fireRules; }, get brain() { return fireBrain; },
  rows: () => canonicalSpells.fire,
  kindOf: id => fireShape(id)?.kind,
  shapeClass: id => fireShapeClass(fireShape(id)?.kind),
  role: withBolt(spell => {
    const kind = fireShape(spell.id)!.kind;
    return kind === 'dash' ? 'dash' : kind === 'self' ? 'build' : kind === 'ring' ? 'answer' : kind === 'cone' ? 'hit' : kind === 'meteor' ? 'signature' : 'payoff';
  }),
  weight: spell => spell.damage,
  resource: heatValue,
  answerUp: () => false,
  offerable: (_state, a, spell, distanceM, readyTick) => fireOfferable(a, spell, distanceM, readyTick),
});
const airKit = (): SchoolKit => ({
  school: 'air', label: 'Gale mage', named: 'Lio', answers: 'projectile', movesForResource: true,
  get rules() { return airRules; }, get brain() { return airBrain; },
  rows: () => canonicalSpells.air,
  kindOf: id => airRow(id)?.kind,
  shapeClass: id => airShapeClass(airRow(id)!.kind),
  role: withBolt(spell => {
    const kind = airRow(spell.id)!.kind;
    return kind === 'dash' ? 'dash' : kind === 'self' ? 'build' : kind === 'form' ? 'answer' : kind === 'twin' ? 'hit' : kind === 'line' && spell.family === 'unblockable' ? 'signature' : 'payoff';
  }),
  weight: spell => spell.damage * airRow(spell.id)!.count,
  resource: momentumOf,
  answerUp: (state, a) => state.tick < (a.schoolState!.formUntil ?? 0),
  offerable: (state, a, spell, distanceM, readyTick) => airOfferable(state, a, spell, airRow(spell.id)!, distanceM, readyTick),
});
const builders: Record<SlotSchool, () => SchoolKit> = { fire: fireKit, air: airKit };
let kits: Record<SlotSchool, SchoolKit> | undefined;
/** The registry, one kit per slot school in slotSchools order. Built on first call (call time, never at import). */
export function schoolKits(): Record<SlotSchool, SchoolKit> {
  kits ??= Object.fromEntries(slotSchools.map(school => [school, builders[school]()])) as Record<SlotSchool, SchoolKit>;
  return kits;
}
export const schoolKit = (school: SlotSchool): SchoolKit => schoolKits()[school];

// The brain skeleton.
/** Slots this actor can press, with the row each holds this tick: a catalogue rival walks every row (slot n = row n, CR-002);
 * a loadout walks the bolt and four. Dark slots (tier the collar has not unlocked) are left out. */
export function schoolSlots(state: ArenaState, a: Actor): { slot: number; spell: SchoolSpell }[] {
  const s = a.schoolState; if (!s) return [];
  const count = s.catalogue ? schoolKit(s.school).rows().length : 5, out: { slot: number; spell: SchoolSpell }[] = [];
  for (let slot = 0; slot < count; slot++) {
    const spell = slotSpell(a, slot, state);
    if (spell) out.push({ slot, spell });
  }
  return out;
}
/** The VR T07 competence pick over a school's choices: under level 2 one `mage <id> spell` draw picks uniformly; from level 2
 * no draw, the school's `order` decides (ties broken by the order itself). */
export function competencePick<T extends { slot: number }>(state: ArenaState, a: Actor, choices: readonly T[], profile: ReturnType<typeof competence>, order: (x: T, y: T) => number): { slot: number; cast: true } {
  if (profile.level < 2) return { slot: choices[Math.floor(random(state, `mage ${a.id} spell`) * choices.length)]!.slot, cast: true };
  return { slot: [...choices].sort(order)[0]!.slot, cast: true };
}
