// W8: the mage AI's three seams for Fire/Air actors (VR CR-002 T07 competence model; AIR.md ChooseAirSpell).
// mage-ai.ts calls these only for an actor with `schoolState`; Water AI is untouched. Lanes own mage-ai-fire.ts / mage-ai-air.ts.
import { bolt } from './kernel.ts';
import { fireBrain } from './mage-ai-fire.ts';
import { airBrain } from './mage-ai-air.ts';
import type { competence, Threat } from './mage-ai.ts';
import type { Actor, ArenaState, SlotSchool } from './types.ts';

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
const brains: Record<SlotSchool, SchoolBrain> = { fire: fireBrain, air: airBrain };
export const schoolBoltSpeedMps = (a: Actor): number => a.schoolState ? brains[a.schoolState.school].boltSpeedMps(a) : bolt.speedMps;
export const chooseSchoolSpell = (state: ArenaState, a: Actor, context: SchoolChoiceContext): { slot: number; cast: boolean } | undefined =>
  a.schoolState ? brains[a.schoolState.school].choose(state, a, context) : undefined;
export function schoolThreats(state: ArenaState, a: Actor): Threat[] {
  return state.actors.flatMap(owner => owner.schoolState && owner.team !== a.team && !owner.tags.includes('DEFEATED') ? brains[owner.schoolState.school].threats(state, owner, a) : []);
}
