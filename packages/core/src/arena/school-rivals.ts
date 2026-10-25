// Fire/Air mage opponents in the Tiro Games, behind createGames options (default off: the Water proxies, identical runs).
// 'fire' / 'air' make every mage duelist that school (VR CR-002 / CR-007 parity runs); 'named' is the PC bracket:
// semifinal Brennic (Fire), final Lio (Air). The water composition stays attached, as CR-002 requires.
import { newSchoolState, schoolPresets } from './schools.ts';
import { setSpellRanks } from './progression.ts';
import { schoolKit } from './school-kit.ts';
import type { RivalBuild } from './archetypes.ts';
import type { Actor, SlotSchool } from './types.ts';

export type SchoolRivals = 'fire' | 'air' | 'named';
/** Waves are 0-based Tiro waves; 2 is the semifinal, 3 the final. */
export function rivalSchool(mode: SchoolRivals, wave: number): SlotSchool {
  return mode === 'named' ? (wave === 2 ? 'fire' : 'air') : mode;
}
/** Turn a spawned Tiro mage into a school rival that chooses from its whole catalogue (slot n = row n, CR-002). */
export function makeSchoolRival(actor: Actor, mode: SchoolRivals, wave: number): string {
  const school = rivalSchool(mode, wave);
  actor.school = school;
  actor.schoolState = { ...newSchoolState(schoolPresets[school][0]!), catalogue: true };
  actor.label = mode === 'named' ? schoolKit(school).named : schoolKit(school).label;
  return actor.label;
}
/** The label a build rival wears: its named rival's name when it is that rival's own build in the named bracket, else the school label and the archetype. */
export const buildRivalLabel = (build: RivalBuild, isNamed?: boolean): string => isNamed ? schoolKit(build.school).named : `${schoolKit(build.school).label} · ${build.archetype}`;
/** Turn a spawned Tiro mage (already carrying the build's ranks) into a build rival: its loadout (named `build:<id>`, which is how
 * archetypes.ts finds the plan) and its spell ranks. */
export function makeBuildRival(actor: Actor, build: RivalBuild, label: string): string {
  actor.school = build.school;
  actor.schoolState = newSchoolState(build.loadout);
  setSpellRanks(actor, build.spellRanks);
  actor.label = label;
  return label;
}
