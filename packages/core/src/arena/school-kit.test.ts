// One SchoolKit per school (challenge 2026-10-25, arena-schools-ai A): the registry, the kind -> role reading, the shared
// competence pick, the single build-rival branch, and the plan/seam files free of per-school literals. Picks pinned before
// the refactor: the kit moves code, never an outcome.
// index.ts first: it loads kernel.ts before fire.ts/air.ts (the schools.ts import-order trap, see the fire.ts header).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { presets, createGames, createArena, addMage, runtime, competence, threats, rivalBuilds, rivalBuildIds, distance, roleOf } from './index.ts';
import { chooseSchoolSpell } from './mage-ai-schools.ts';
import { canonicalSpells, schoolSpellById } from './schools.ts';
import { competencePick, schoolKit, schoolKits } from './school-kit.ts';
import { fireRules } from './fire.ts';
import { airRules } from './air.ts';
import { fireBrain } from './mage-ai-fire.ts';
import { airBrain } from './mage-ai-air.ts';
import { slotSchools } from './types.ts';

const reference = presets.find(p => p.name === runtime.games.referencePreset)!;
const source = (file: string): string => readFileSync(join(import.meta.dirname, file), 'utf8');

describe('the kit registry', () => {
  it('one kit per slot school: its rows are the canonical rows, its rules and brain the ones dispatched', () => {
    expect(Object.keys(schoolKits())).toEqual([...slotSchools]);
    for (const school of slotSchools) expect(schoolKit(school).rows().map(s => s.id), school).toEqual(canonicalSpells[school].map(s => s.id));
    expect([schoolKit('fire').rules, schoolKit('air').rules]).toEqual([fireRules, airRules]);
    expect(schoolKit('fire').rules).toBe(fireRules); expect(schoolKit('air').rules).toBe(airRules);
    expect(schoolKit('fire').brain).toBe(fireBrain); expect(schoolKit('air').brain).toBe(airBrain);
    expect([schoolKit('fire').label, schoolKit('fire').named, schoolKit('air').label, schoolKit('air').named]).toEqual(['Ember mage', 'Brennic', 'Gale mage', 'Lio']);
  });

  it('kit.role reads the row shapes as the plan always did; each kit answers its own shape class', () => {
    const role = (id: string) => schoolKit(schoolSpellById(id)!.school).role(schoolSpellById(id)!);
    const fire = ['fire_bolt', 'fire_cinderstep', 'fire_kindle', 'fire_ring', 'fire_flick', 'fire_lance', 'fire_pyre', 'fire_sunfall', 'fire_wrath'];
    const air = ['air_bolt', 'air_slipstream', 'air_eye', 'air_form', 'air_shear', 'air_veer', 'air_squall', 'air_tempest', 'air_cyclone'];
    const table = ['bolt', 'dash', 'build', 'answer', 'hit', 'payoff', 'payoff', 'signature', 'payoff'];
    expect(fire.map(role)).toEqual(table); expect(air.map(role)).toEqual(table);
    expect([...fire, ...air].map(id => roleOf(schoolSpellById(id)!))).toEqual([...table, ...table]);
    expect([schoolKit('fire').answers, schoolKit('air').answers]).toEqual(['close', 'projectile']);
    expect([schoolKit('fire').movesForResource, schoolKit('air').movesForResource]).toEqual([false, true]);
    expect(['fire_bolt', 'fire_wrath', 'fire_sunfall', 'fire_flick'].map(schoolKit('fire').shapeClass)).toEqual(['projectile', 'beam', 'area', 'close']);
    expect(['air_bolt', 'air_cyclone', 'air_tempest', 'air_eye'].map(schoolKit('air').shapeClass)).toEqual(['projectile', 'beam', 'line', 'close']);
  });

  it('the plan and seam files carry no per-school literal: no school === fire|air, no { fire: ..., air: ... } registry', () => {
    const literal = /school\s*===\s*'(fire|air)'|\{\s*fire\s*:|\bair\s*:\s*air(Rules|Brain)\b/g;
    for (const file of ['archetypes.ts', 'schools.ts', 'mage-ai-schools.ts', 'school-rivals.ts']) expect(source(file).match(literal) ?? [], file).toEqual([]);
  });
});

describe('the shared brain skeleton', () => {
  it('competencePick: under level 2 one `mage <id> spell` draw picks choices[floor(r * n)]; from level 2 no draw, the order decides', () => {
    const s = createArena(7), a = addMage(s, 1, { x: 10, y: 10 });
    const choices = [{ slot: 3, w: 1 }, { slot: 5, w: 9 }, { slot: 7, w: 4 }], order = (x: { w: number }, y: { w: number }) => y.w - x.w;
    const before = s.randomLog.length, pick = competencePick(s, a, choices, competence(1), order);
    const draws = s.randomLog.slice(before);
    expect(draws.map(d => d.purpose)).toEqual([`mage ${a.id} spell`]);
    expect(pick).toEqual({ slot: choices[Math.floor(draws[0]!.value * choices.length)]!.slot, cast: true });
    const after = s.randomLog.length;
    expect(competencePick(s, a, choices, competence(2), order)).toEqual({ slot: 5, cast: true });
    expect(s.randomLog.length).toBe(after);
    for (const file of ['mage-ai-fire.ts', 'mage-ai-air.ts']) {
      expect(source(file), file).not.toContain('profile.level < 2');
      expect(source(file), file).toContain('competencePick(');
    }
  });

  // Pinned from chooseSchoolSpell at d633490, before the kit (distance m, collar tier, resource value): slot, cast, the aim the
  // plan wrote into the brain's input (-1,-1 when it wrote none) and the random draws taken.
  const buildPins: Record<string, { slot?: number; cast?: boolean; aim: { x: number; y: number }; draws: number }[]> = {
    fire_close: [{ slot: 2, cast: true, aim: { x: -1, y: -1 }, draws: 0 }, { slot: 1, cast: true, aim: { x: 12, y: 10 }, draws: 0 }, { slot: 1, cast: true, aim: { x: 18, y: 10 }, draws: 0 }],
    fire_light: [{ slot: 2, cast: true, aim: { x: 17.5, y: 10 }, draws: 0 }, { slot: 4, cast: true, aim: { x: -1, y: -1 }, draws: 0 }, { slot: 4, cast: true, aim: { x: -1, y: -1 }, draws: 0 }],
    fire_heavy: [{ slot: 0, cast: true, aim: { x: -1, y: -1 }, draws: 0 }, { slot: 0, cast: true, aim: { x: -1, y: -1 }, draws: 0 }, { aim: { x: -1, y: -1 }, draws: 0 }],
    air_light: [{ slot: 2, cast: true, aim: { x: 18.5, y: 10 }, draws: 0 }, { slot: 2, cast: true, aim: { x: 23, y: 10 }, draws: 0 }, { slot: 4, cast: true, aim: { x: -1, y: -1 }, draws: 0 }],
    air_close: [{ slot: 2, cast: true, aim: { x: -1, y: -1 }, draws: 0 }, { slot: 2, cast: true, aim: { x: -1, y: -1 }, draws: 0 }, { slot: 1, cast: true, aim: { x: 17, y: 10 }, draws: 0 }],
    air_heavy: [{ slot: 0, cast: true, aim: { x: -1, y: -1 }, draws: 0 }, { slot: 0, cast: true, aim: { x: -1, y: -1 }, draws: 0 }, { slot: 3, cast: true, aim: { x: -1, y: -1 }, draws: 0 }],
  };
  it('the build-rival branch exists once: six builds x three positions pick as before, and the brains no longer reach the plan', () => {
    expect(Object.keys(buildPins).sort()).toEqual([...rivalBuildIds].sort());
    for (const id of rivalBuildIds) {
      const got = ([[2.5, 1, 0], [7, 2, 50], [13, 4, 90]] as const).map(([d, tier, value]) => {
        const g = createGames(41000, reference, rivalBuilds[id]!.wave, true, undefined, undefined, undefined, { rivalBuild: id });
        const rival = g.state.actors.find(a => a.team !== g.player.team)!, s = g.state;
        g.player.pos = { x: 10, y: 10 }; g.player.previousPos = { x: 10, y: 10 };
        rival.pos = { x: 10 + d, y: 10 }; rival.previousPos = { ...rival.pos };
        rival.tier = tier; rival.schoolState!.value = value; rival.mana = 100; rival.mageAI!.input.aim = { x: -1, y: -1 };
        const draws = s.randomLog.length;
        const pick = chooseSchoolSpell(s, rival, { target: g.player, distanceM: distance(rival.pos, g.player.pos), seen: threats(s, rival), profile: competence(1.5), readyTick: s.tick + 1 });
        const aim = rival.mageAI!.input.aim;
        return { ...pick, aim: { x: +aim.x.toFixed(4), y: +aim.y.toFixed(4) }, draws: s.randomLog.length - draws };
      });
      expect(got, id).toEqual(buildPins[id]);
    }
    for (const file of ['mage-ai-fire.ts', 'mage-ai-air.ts']) expect(source(file), file).not.toMatch(/archetypeChoose|rivalBuildOf/);
  });

  // Guard (green before by design): the catalogue rivals' competence picks and their draws, pinned at d633490.
  const cataloguePins = {
    fire: [{ slot: 1, cast: true, draws: ['mage 2 spell'] }, { slot: 2, cast: true, draws: ['mage 2 spell'] }, { slot: 4, cast: true, draws: [] }, { slot: 8, cast: true, draws: [] }],
    air: [{ slot: 2, cast: true, draws: [] }, { slot: 2, cast: true, draws: [] }, { slot: 2, cast: true, draws: [] }, { slot: 8, cast: true, draws: [] }],
  };
  it('guard: the catalogue rivals pick and draw as before', () => {
    for (const mode of slotSchools) {
      const got = ([[3, 1, 1], [7, 2, 1], [7, 2, 2.5], [11, 4, 3]] as const).map(([d, tier, level]) => {
        const g = createGames(41000, reference, 2, true, undefined, undefined, undefined, { schoolRivals: mode });
        const rival = g.state.actors.find(a => a.team !== g.player.team)!, s = g.state;
        g.player.pos = { x: 10, y: 10 }; g.player.previousPos = { x: 10, y: 10 };
        rival.pos = { x: 10 + d, y: 10 }; rival.previousPos = { ...rival.pos };
        rival.tier = tier; rival.mana = 100;
        const draws = s.randomLog.length;
        const pick = chooseSchoolSpell(s, rival, { target: g.player, distanceM: distance(rival.pos, g.player.pos), seen: threats(s, rival), profile: competence(level), readyTick: s.tick + 1 });
        return { ...pick, draws: s.randomLog.slice(draws).map(r => r.purpose) };
      });
      expect(got, mode).toEqual(cataloguePins[mode]);
    }
  });
});
