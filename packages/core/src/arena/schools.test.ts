import { describe, expect, it } from 'vitest';
import { addMage, createArena, stateHash, stepArena } from './kernel.ts';
import { balancedSpell, canonicalSpells, identityNumber, newSchoolState, overlayProblems, schoolPresets, slotSpell, validateLoadout } from './schools.ts';
import { idleInput } from './types.ts';

describe('W8 school seam (WP0)', () => {
  it('reads both school catalogues as VR pinned them, with CR-002 family and damage rules', () => {
    expect(canonicalSpells.fire.map(s => s.id)).toEqual(['fire_bolt', 'fire_flick', 'fire_cinderstep', 'fire_kindle', 'fire_lance', 'fire_ring', 'fire_pyre', 'fire_furnace', 'fire_sunfall', 'fire_wrath']);
    expect(canonicalSpells.air).toHaveLength(10);
    const fire = (id: string) => canonicalSpells.fire.find(s => s.id === id)!;
    expect(fire('fire_sunfall')).toMatchObject({ tier: 4, family: 'unblockable', damage: 95, mana: 70, telegraphS: 1.2 });
    expect(fire('fire_wrath').damage).toBe(14);
    expect(fire('fire_kindle').family).toBe('self');
    expect(canonicalSpells.air.find(s => s.id === 'air_shear')).toMatchObject({ damage: 9, family: 'magic' });
    expect(identityNumber('fire', 'decay.perSecond')).toBe(6);
    expect(identityNumber('air', 'gain.perSecondMovingAbove4Mps')).toBe(20);
  });
  it('validates loadouts: own bolt, four distinct slot spells of the same school', () => {
    for (const school of ['fire', 'air'] as const) for (const p of schoolPresets[school]) expect(validateLoadout(p)).toEqual([]);
    const brand = schoolPresets.fire[1]!;
    expect(validateLoadout({ ...brand, bolt: 'air_bolt' })).not.toEqual([]);
    expect(validateLoadout({ ...brand, slots: ['fire_flick', 'fire_flick', 'fire_lance', 'fire_pyre'] })).not.toEqual([]);
    expect(validateLoadout({ ...brand, slots: ['fire_flick', 'air_veer', 'fire_lance', 'fire_pyre'] })).not.toEqual([]);
  });
  it('refuses overlay keys that name nothing, and applies none while the overlay is empty', () => {
    expect(overlayProblems({ 'fire_lance.damage': 30, 'air.identity.decay.perSecondStill': 20 })).toEqual([]);
    expect(overlayProblems({ 'fire_lance.dmg': 30 })).toHaveLength(1);
    expect(overlayProblems({ 'fire_nope.damage': 30 })).toHaveLength(1);
    expect(overlayProblems({ 'fire.identity.resource': 1 })).toHaveLength(1);
    const lance = canonicalSpells.fire.find(s => s.id === 'fire_lance')!;
    expect(balancedSpell(lance)).toEqual(lance);
  });
  it('keeps Water actors free of school state and gates Fire slots by the collar tier', () => {
    const state = createArena(7), water = addMage(state, 0, { x: 5, y: 5 }), fire = addMage(state, 1, { x: 12, y: 5 }, 'Ember mage');
    expect('schoolState' in water).toBe(false);
    expect('schoolEffects' in state).toBe(false);
    fire.school = 'fire'; fire.schoolState = newSchoolState(schoolPresets.fire[2]!);
    expect(slotSpell(fire, 0, state)?.id).toBe('fire_bolt');
    expect(slotSpell(fire, 1, state)?.id).toBe('fire_flick');
    expect(slotSpell(fire, 4, state)).toBeUndefined();
    fire.tier = 4;
    expect(slotSpell(fire, 4, state)?.id).toBe('fire_sunfall');
    // WP0 stubs cast nothing: a Fire actor pressing every slot steps without a cast or an effect.
    for (let t = 0; t < 120; t++) stepArena(state, { [fire.id]: { ...idleInput({ x: 5, y: 5 }), cast: true, slot: t % 5 } });
    expect(fire.metrics.casts).toBe(0);
    expect('schoolEffects' in state).toBe(false);
    expect(stateHash(state)).toMatch(/^[0-9a-f]{8}$/);
  });
});
