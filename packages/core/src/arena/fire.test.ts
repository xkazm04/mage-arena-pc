// Fire rules, strict row reading and the Ember mage AI (lane F). The CR-002 hand checks live in parity/cr-002.test.ts.
// kernel.ts is imported first: fire.ts must load through schools.ts (see the fire.ts header).
import { describe, expect, it } from 'vitest';
import { addMage, createArena, resetWave, stateHash, stepArena, ticks } from './kernel.ts';
import { attachMageAI, mageInput, threats } from './mage-ai.ts';
import { createGames, stepGames } from './games.ts';
import { presets } from './catalog.ts';
import { runtime } from './kernel.ts';
import { newSchoolState, schoolPresets } from './schools.ts';
import { makeTuning } from './tuning.ts';
import { fireBrain } from './mage-ai-fire.ts';
import { fireShape, fireShapes, fireState, heatNearM, heatValue, readFireShape, sunfallLoosedKey } from './fire.ts';
import { fireRows } from './data.generated.ts';
import { idleInput, type Actor, type ArenaState, type InputFrame } from './types.ts';
import type { Vec } from './math.ts';

function arena(seed = 11): ArenaState {
  const state = createArena(seed); state.balance = 'canonical';
  state.tuning = { ...makeTuning(), hitStunS: 0, hitStunPerDamageS: 0, knockbackM: 0, accelerationMps2: 0, decelerationMps2: 0 };
  return state;
}
function ember(state: ArenaState, pos: Vec, team = 0, tier = 4): Actor {
  const a = addMage(state, team, pos, 'Ember');
  a.school = 'fire'; a.schoolState = { ...newSchoolState(schoolPresets.fire[0]!), catalogue: true }; a.tier = tier; a.lastUnlockTick = 1e9;
  a.maxHp = a.hp = 1000; a.maxMana = a.mana = 500;
  return a;
}
function pair(range = 6) {
  const state = arena(), actor = ember(state, { x: 10, y: 10 }), target = addMage(state, 1, { x: 10 + range, y: 10 }, 'Target');
  target.maxHp = target.hp = 1000; target.maxMana = target.mana = 500;
  return { state, actor, target };
}
const slot = (id: string): number => fireShapes.findIndex(s => s.id === id);
const cast = (aim: Vec, s: number): InputFrame => ({ ...idleInput(aim), slot: s, cast: true });
const drew = (state: ArenaState, purpose: string): boolean => state.randomLog.some(d => d.purpose === purpose);

describe('Fire rows read strictly from spells-fire.csv (VR ParseFireSpell)', () => {
  it('reads every row as VR does: kinds, speeds, arcs, radii, ticks, heat modes and note flags', () => {
    expect(fireShapes.map(s => s.kind)).toEqual(['projectile', 'cone', 'dash', 'self', 'line', 'ring', 'zone', 'self', 'meteor', 'beam']);
    expect(fireShape('fire_bolt')).toMatchObject({ speedMps: 18, heatMode: 'hit', heat: 2, bolt: true });
    expect(fireShape('fire_flick')).toMatchObject({ arcDeg: 60, heatMode: 'target', heat: 6 });
    expect(fireShape('fire_cinderstep')).toMatchObject({ dashM: 5, durationS: 2, tickS: 0.5, heatMode: 'tick', heat: 3 });
    expect(fireShape('fire_kindle')).toMatchObject({ heatMode: 'instant', heat: 25, roots: true });
    expect(fireShape('fire_lance')).toMatchObject({ pierceShields: true, heatMode: 'target', heat: 4 });
    expect(fireShape('fire_ring')).toMatchObject({ radiusM: 3, knockbackM: 2, arcDeg: 360, heat: 5 });
    expect(fireShape('fire_pyre')).toMatchObject({ radiusM: 3, sequential: false, roots: false, heat: 8 });
    expect(fireShape('fire_furnace')).toMatchObject({ heatMode: 'lock', heat: 100, lockS: 6, drainMult: 2 });
    expect(fireShape('fire_sunfall')).toMatchObject({ radiusM: 3.5, sequential: true, roots: true, heat: 10 });
    expect(fireShape('fire_wrath')).toMatchObject({ durationS: 2, tickS: 0.25, perfectFirstTickOnly: true, pierceShields: false, heat: 2 });
    expect(heatNearM).toBe(3);
  });
  it('throws on a cell it cannot read exactly instead of guessing', () => {
    const bolt = fireRows[0]!, lance = fireRows[4]!, wrath = fireRows[9]!;
    expect(() => readFireShape({ ...bolt, shape: 'spiral 18 m/s' })).toThrow(/shape not understood/);
    expect(() => readFireShape({ ...bolt, heat_gain: 'a little' })).toThrow(/heat gain not understood/);
    expect(() => readFireShape({ ...lance, shape: 'line 12 m piercing' })).toThrow(/disagrees with range_m/);
    expect(() => readFireShape({ ...wrath, damage: '14 per tick' })).toThrow(/damage cell/);
    expect(() => readFireShape({ ...wrath, damage: '14' })).toThrow(/no tick interval/);
  });
});

describe('Fire rules', () => {
  it('casts through the collar tier gate: a tier-I mage cannot press Brand Lance', () => {
    const { state, actor, target } = pair();
    actor.tier = 1;
    stepArena(state, { [actor.id]: cast(target.pos, slot('fire_lance')) });
    expect(actor.pending).toBeUndefined(); expect(actor.mana).toBeGreaterThan(499);
  });
  it('refuses a cast while its own beam runs (VR FireChannelBusy) and accepts one after it ends', () => {
    const { state, actor, target } = pair();
    stepArena(state, { [actor.id]: cast(target.pos, slot('fire_wrath')) });
    for (let i = 0; i < 20; i++) stepArena(state, { [actor.id]: { ...idleInput(target.pos) } });
    expect(state.schoolEffects?.some(e => e.kind === 'beam')).toBe(true);
    stepArena(state, { [actor.id]: cast(target.pos, slot('fire_bolt')) });
    expect(state.projectiles).toHaveLength(0);
    while (state.schoolEffects?.length) stepArena(state, { [actor.id]: { ...idleInput(target.pos) } });
    stepArena(state, { [actor.id]: cast(target.pos, slot('fire_bolt')) });
    expect(state.projectiles).toHaveLength(1);
  });
  it('roots Kindle and Sunfall casts but not Pyre (the caster walks during the fill)', () => {
    for (const [id, rooted] of [['fire_kindle', true], ['fire_pyre', false]] as const) {
      const { state, actor, target } = pair();
      stepArena(state, { [actor.id]: cast(target.pos, slot(id)) });
      const x = actor.pos.x;
      stepArena(state, { [actor.id]: { ...idleInput(target.pos), move: { x: 0, y: 1 } } });
      expect(actor.pos.y !== 10, id).toBe(!rooted);
      expect(actor.pos.x).toBe(x);
    }
  });
  it('a beam stops when its owner rolls (VR Interrupt cancels the channel)', () => {
    const { state, actor, target } = pair();
    stepArena(state, { [actor.id]: cast(target.pos, slot('fire_wrath')) });
    while (state.tick < 28) stepArena(state, { [actor.id]: idleInput(target.pos) });
    expect(target.hp).toBe(1000 - 14);
    stepArena(state, { [actor.id]: { ...idleInput(target.pos), roll: true, move: { x: 0, y: 1 } } });
    expect(state.schoolEffects).toEqual([]);
    for (let i = 0; i < 60; i++) stepArena(state);
    expect(target.hp).toBe(1000 - 14);
  });
  it('Fire against Fire pays each side once: the caster its bolt heat, the target its unabsorbed 12', () => {
    const state = arena(), a = ember(state, { x: 10, y: 10 }), b = ember(state, { x: 16, y: 10 }, 1);
    stepArena(state, { [a.id]: cast(b.pos, slot('fire_bolt')) });
    for (let i = 0; i < 30 && !state.events.some(e => e.kind === 'hit'); i++) stepArena(state);
    expect(heatValue(a)).toBe(2);
    expect(heatValue(b)).toBe(12);
  });
  it('a new wave resets Heat, the lock, cooldowns and every effect', () => {
    const { state, actor, target } = pair();
    stepArena(state, { [actor.id]: cast(target.pos, slot('fire_cinderstep')) });
    fireState(actor)!.value = 70;
    resetWave(state, actor);
    expect(fireState(actor)).toMatchObject({ value: 0, lockedUntil: 0, gained: false, cooldowns: {} });
    expect(state.schoolEffects).toEqual([]);
  });
  it('leaves a Water-only arena without school keys (hash neutrality)', () => {
    const state = createArena(3), a = addMage(state, 0, { x: 10, y: 10 }), b = addMage(state, 1, { x: 12, y: 10 });
    for (let i = 0; i < 120; i++) stepArena(state, { [a.id]: cast(b.pos, 1) });
    expect('schoolEffects' in state).toBe(false);
    expect(state.actors.some(x => 'schoolState' in x)).toBe(false);
  });
});

describe('Ember mage AI (VR ChooseFireSpell, SunfallBeat)', () => {
  const decide = (mana: number, level = 1, setup?: (s: ArenaState, a: Actor, t: Actor) => void) => {
    const { state, actor, target } = pair();
    actor.mana = mana; actor.maxMana = 95;
    setup?.(state, actor, target);
    attachMageAI(actor, level, state.tick);
    return { state, actor, target, input: mageInput(state, actor) };
  };
  it('tier IV opens on Sunfall without drawing the spell random, and the decision casts it', () => {
    const { state, actor, input } = decide(95);
    expect(input).toMatchObject({ cast: true, slot: slot('fire_sunfall') });
    expect(drew(state, `mage ${actor.id} spell`)).toBe(false);
    stepArena(state, { [actor.id]: input });
    expect(actor.pending?.spellId).toBe('fire_sunfall');
  });
  it('short of 70 mana, offense waits (no draw); 74 mana still opens on Sunfall', () => {
    const short = decide(69);
    expect(short.input.cast).toBe(false);
    expect(drew(short.state, `mage ${short.actor.id} spell`)).toBe(false);
    const rich = decide(74);
    expect(rich.input).toMatchObject({ cast: true, slot: slot('fire_sunfall') });
  });
  it('a Sunfall barred by range falls through to the normal pick', () => {
    const { input, state, actor } = decide(95, 1, (_s, _a, t) => { t.pos = { x: 23, y: 10 }; });
    expect(input.cast).toBe(true); expect(input.slot).not.toBe(slot('fire_sunfall'));
    expect(drew(state, `mage ${actor.id} spell`)).toBe(true);
  });
  it('once Sunfall is loosed, level 2 sorts by damage: Pyre at 6 m', () => {
    const { input } = decide(95, 2, (s, a) => { fireState(a)!.cooldowns[sunfallLoosedKey] = 0; fireState(a)!.cooldowns.fire_sunfall = 1e6; });
    expect(input).toMatchObject({ cast: true, slot: slot('fire_pyre') });
  });
  it('withholds when nothing is legal, and aims its lead with Ember Dart 18 m/s', () => {
    const { input } = decide(3, 1, (_s, a) => { a.tier = 1; });
    expect(input.cast).toBe(false);
    expect(fireBrain.boltSpeedMps(pair().actor)).toBe(18);
  });
  it('presents its pending cast, live beam and committed shadow as threats; a dash and a self row are not', () => {
    const { state, actor, target } = pair();
    stepArena(state, { [actor.id]: cast(target.pos, slot('fire_pyre')) });
    const pyre = threats(state, target).find(t => t.id === actor.pending!.activationId)!;
    expect(pyre).toMatchObject({ aimedAtUs: true, impactTick: actor.pending!.releaseTick, family: 'magic' });
    const kindle = pair(); stepArena(kindle.state, { [kindle.actor.id]: cast(kindle.target.pos, slot('fire_kindle')) });
    expect(threats(kindle.state, kindle.target)).toEqual([]);
    const sun = pair(); stepArena(sun.state, { [sun.actor.id]: cast(sun.target.pos, slot('fire_sunfall')) });
    for (let i = 0; i < 48; i++) stepArena(sun.state);
    const shadow = threats(sun.state, sun.target).find(t => t.family === 'unblockable')!;
    expect(shadow).toMatchObject({ aimedAtUs: true, impactTick: sun.state.tick + 72, damage: 95 });
    const beam = pair(); stepArena(beam.state, { [beam.actor.id]: cast(beam.target.pos, slot('fire_wrath')) });
    for (let i = 0; i < 13; i++) stepArena(beam.state, { [beam.actor.id]: idleInput(beam.target.pos) });
    expect(threats(beam.state, beam.target).find(t => t.id === -beam.actor.id)).toMatchObject({ aimedAtUs: true, damage: 14 });
  });
  it('an Ember mage duel in the Tiro Games casts Fire rows and replays to the same hash', () => {
    const run = () => {
      const g = createGames(40000, presets.find(p => p.name === runtime.games.referencePreset)!, 2, true, undefined, undefined, undefined, { schoolRivals: 'fire' });
      while (g.phase === 'active' && g.state.tick < ticks(60)) stepGames(g);
      return g;
    };
    const first = run(), second = run(), rival = first.state.actors.find(a => a.schoolState)!;
    expect(first.state.events.filter(e => e.kind === 'release' && e.actorId === rival.id && e.spellId?.startsWith('fire_')).length).toBeGreaterThan(5);
    expect(stateHash(first.state)).toBe(stateHash(second.state));
  });
});
