// W8: the mage AI's three seams for Fire/Air actors (VR CR-002 T07 competence model; AIR.md ChooseAirSpell).
// mage-ai.ts calls these only for an actor with `schoolState`; Water AI is untouched. Lanes own mage-ai-fire.ts / mage-ai-air.ts;
// each school's brain is its kit's (school-kit.ts). A build rival's archetype plan is played here, once for every school.
import { bolt } from './kernel.ts';
import { schoolKit, schoolSlots } from './school-kit.ts';
import { archetypeChoose, rivalBuildOf } from './archetypes.ts';
import type { competence, Threat } from './mage-ai.ts';
import type { Actor, ArenaState } from './types.ts';

export interface SchoolChoiceContext {
  target: Actor; distanceM: number; seen: Threat[]; profile: ReturnType<typeof competence>;
  /** The earliest tick a chosen spell may come off cooldown (curve rows plan around a pending ward). */
  readyTick: number;
}
export interface SchoolBrain {
  /** Projectile speed the aim lead uses (CR-002: Ember Dart 18 m/s for a fire mage). */
  boltSpeedMps(a: Actor): number;
  /** Slot to press and whether to cast this decision, or undefined to withhold (Sunfall bank, nothing legal). */
  choose(state: ArenaState, a: Actor, context: SchoolChoiceContext): { slot: number; cast: boolean } | undefined;
  /** Threats this school's actor presents to `a`: its pending cast, live lines, beams and detonations. */
  threats(state: ArenaState, owner: Actor, a: Actor): Threat[];
}
export const schoolBoltSpeedMps = (a: Actor): number => a.schoolState ? schoolKit(a.schoolState.school).brain.boltSpeedMps(a) : bolt.speedMps;
export function chooseSchoolSpell(state: ArenaState, a: Actor, context: SchoolChoiceContext): { slot: number; cast: boolean } | undefined {
  if (!a.schoolState) return undefined;
  const kit = schoolKit(a.schoolState.school);
  // A build rival plays its archetype plan (archetypes.ts) in place of the school's priorities and competence pick; reactions,
  // aim and wards stay the competence's. The plan's dash or ring aim rides the brain's input, which mage-ai.ts copies out.
  if (rivalBuildOf(a)) {
    const { target, distanceM, seen, readyTick } = context;
    const pick = archetypeChoose(state, a, target, distanceM, seen, schoolSlots(state, a).map(c => ({ ...c, can: kit.offerable(state, a, c.spell, distanceM, readyTick) })));
    if (pick?.aim && a.mageAI) a.mageAI.input.aim = pick.aim;
    return pick && { slot: pick.slot, cast: true };
  }
  return kit.brain.choose(state, a, context);
}
export function schoolThreats(state: ArenaState, a: Actor): Threat[] {
  return state.actors.flatMap(owner => owner.schoolState && owner.team !== a.team && !owner.tags.includes('DEFEATED') ? schoolKit(owner.schoolState.school).brain.threats(state, owner, a) : []);
}
