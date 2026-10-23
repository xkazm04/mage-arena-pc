// Fire/Air mage opponents in the Tiro Games, behind createGames options (default off: the Water proxies, identical runs).
// 'fire' / 'air' make every mage duelist that school (VR CR-002 / CR-007 parity runs); 'named' is the PC bracket:
// semifinal Brennic (Fire), final Lio (Air). The water composition stays attached, as CR-002 requires.
import { newSchoolState, schoolPresets } from './schools.ts';
import type { Actor, SlotSchool } from './types.ts';

export type SchoolRivals = 'fire' | 'air' | 'named';
export const schoolRivalLabels: Record<SlotSchool, string> = { fire: 'Ember mage', air: 'Gale mage' };
const named: Record<SlotSchool, string> = { fire: 'Brennic', air: 'Lio' };
/** Waves are 0-based Tiro waves; 2 is the semifinal, 3 the final. */
export function rivalSchool(mode: SchoolRivals, wave: number): SlotSchool {
  return mode === 'named' ? (wave === 2 ? 'fire' : 'air') : mode;
}
/** Turn a spawned Tiro mage into a school rival that chooses from its whole catalogue (slot n = row n, CR-002). */
export function makeSchoolRival(actor: Actor, mode: SchoolRivals, wave: number): string {
  const school = rivalSchool(mode, wave);
  actor.school = school;
  actor.schoolState = { ...newSchoolState(schoolPresets[school][0]!), catalogue: true };
  actor.label = mode === 'named' ? named[school] : schoolRivalLabels[school];
  return actor.label;
}
