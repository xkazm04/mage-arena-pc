// Air (W8 lane A) behaviour beyond the CR-007 hand checks (parity/cr-007.test.ts): the strict load, the PC readings of the
// interrupt, stagger and encase, deflect replacing the Water mirror, the evade's Momentum rule, the AI's threats and dash end.
// kernel.ts is imported first: air.ts sits in the kernel -> schools -> air import cycle.
import { describe, expect, it } from 'vitest';
import { addMage, createArena, DT, resolveHit, spawnProjectile, stateHash, stepArena } from './kernel.ts';
import { airChannelBusy, airSheet, parseAirRows, type AirHit, type AirSchoolState } from './air.ts';
import { airBrain, slipstreamAim } from './mage-ai-air.ts';
import { threats } from './mage-ai.ts';
import { airRows } from './data.generated.ts';
import { newSchoolState, schoolPresets } from './schools.ts';
import { newWaterState, presets } from './catalog.ts';
import { distance, sub, unit } from './math.ts';
import { defaultTuning, type CombatTuning } from './tuning.ts';
import { idleInput, type Actor, type ArenaState, type InputFrame } from './types.ts';
import type { Vec } from './math.ts';

// The same fixture as parity/cr-007.test.ts (VR MakeAir, the PC feel layer off), kept here so neither test imports the other.
const vrFeel: CombatTuning = { ...defaultTuning, spells: {}, accelerationMps2: 0, decelerationMps2: 0, hitStunS: 0, hitStunPerDamageS: 0, knockbackM: 0,
  castMoveMultiplier: 1, castCommitFraction: 1, castRecoveryS: 0, rollRecoveryMoveMultiplier: 1 };
function makeAir(rangeM: number, seed = 23): { state: ArenaState; gale: Actor; target: Actor } {
  const state = createArena(seed); state.balance = 'canonical'; state.tuning = vrFeel;
  const centre: Vec = { x: 16, y: 10 }, gale = addMage(state, 0, centre, 'Gale'), target = addMage(state, 1, { x: centre.x + rangeM, y: centre.y }, 'Target');
  gale.schoolState = { ...newSchoolState(schoolPresets.air[0]!), catalogue: true }; gale.tier = 4;
  for (const a of [gale, target]) { a.maxHp = a.hp = 1000; a.maxMana = a.mana = 500; }
  return { state, gale, target };
}

const slotOf = (id: string): number => airSheet.findIndex(r => r.id === id);
const ss = (a: Actor): AirSchoolState => a.schoolState as AirSchoolState;
const step = (state: ArenaState, a: Actor, input: InputFrame): void => stepArena(state, { [a.id]: input });
const castAt = (aim: { x: number; y: number }, slot: number): InputFrame => ({ ...idleInput(aim), slot, cast: true });
const rows = (): Record<string, string>[] => (airRows as unknown as Record<string, string>[]).map(r => ({ ...r }));
const mutate = (id: string, column: string, value: string): Record<string, string>[] => rows().map(r => r.id === id ? { ...r, [column]: value } : r);

describe('Air strict load (VR MageArena.Air.StrictLoad)', () => {
  it('parses the committed sheet: ten rows, one kind per row', () => {
    expect(parseAirRows(rows()).map(r => r.kind)).toEqual(['projectile', 'twin', 'dash', 'veer', 'zone', 'form', 'squall', 'self', 'line', 'beam']);
  });
  it.each([
    ['a cooldown cell with a unit', mutate('air_bolt', 'cooldown_s', '0.30s')],
    ['an empty mana cell', mutate('air_shear', 'mana', '')],
    ['tier 5', mutate('air_tempest', 'tier', '5')],
    ['an unknown shape', mutate('air_downdraft', 'shape', 'ground square 2.5 m at a point')],
    ['a dash whose reach disagrees with range_m', mutate('air_slipstream', 'shape', 'dash 7 m')],
    ['an unknown momentum cell', mutate('air_squall', 'momentum_gain', '3 per orb')],
    ['an unknown blockable cell', mutate('air_tempest', 'blockable', 'unblockable-ish')],
    ['a beam without a tick', mutate('air_cyclone', 'damage', '12')],
    ['a form without its Momentum need', mutate('air_form', 'notes', 'evade 60 % of physical and 30 % of magic hits; unblockables are not evaded. Needs a breeze.')],
    ['a momentum mode that does not fit the shape', mutate('air_bolt', 'momentum_gain', 'spends 40')],
    ['n/a on a damaging row', mutate('air_veer', 'blockable', 'n/a')],
    ['a renamed header', rows().map(({ momentum_gain, ...rest }) => ({ ...rest, heat_gain: momentum_gain! }))],
    ['a duplicate id', [...rows(), rows()[0]!]],
  ])('refuses %s', (_name, sheet) => {
    expect(() => parseAirRows(sheet)).toThrow(/spells-air\.csv/);
  });
});

describe('Air Momentum (PC readings)', () => {
  it('the Eye lock restores 100 the tick after Air Form spends 40 under it', () => {
    const { state, gale, target } = makeAir(10);
    step(state, gale, castAt(target.pos, slotOf('air_eye')));
    while (gale.pending) step(state, gale, idleInput(target.pos));
    step(state, gale, castAt(target.pos, slotOf('air_form')));
    expect(ss(gale).value).toBe(60);
    step(state, gale, idleInput(target.pos));
    expect(ss(gale).value).toBe(100);
  });
  it('an encased or staggered actor skips its move, so Momentum decays as still', () => {
    for (const hold of ['encase', 'stagger'] as const) {
      const { state, gale } = makeAir(10); ss(gale).value = 30;
      if (hold === 'encase') gale.water.encasedUntil = state.tick + 10; else { gale.staggerUntil = state.tick + 10; gale.tags.push('STAGGERED'); }
      step(state, gale, { ...idleInput({ x: gale.pos.x + 1, y: gale.pos.y }), move: { x: 0, y: 1 } });
      expect(ss(gale).value).toBeCloseTo(30 - 25 * DT, 12);
    }
  });
  it('an Air-versus-Air contact pays the thrower once, and an evaded hit pays nothing', () => {
    const { state, gale, target } = makeAir(3);
    target.schoolState = newSchoolState(schoolPresets.air[0]!);
    ss(target).formUntil = state.tick + 1000;
    let evaded = 0, landed = 0;
    for (let i = 0; i < 20; i++) {
      const before = ss(gale).value, hp = target.hp;
      const hit: AirHit = { ownerId: gale.id, activationId: state.nextId++, damage: 1, family: 'magic', tier: 0, source: { ...gale.pos }, momentumOnHit: 2 };
      resolveHit(state, target, hit);
      if (target.hp < hp) { landed++; expect(ss(gale).value - before).toBe(2); } else { evaded++; expect(ss(gale).value).toBe(before); }
      ss(gale).value = 0;
    }
    expect(evaded).toBeGreaterThan(0); expect(landed).toBeGreaterThan(0);
    expect(ss(target).value).toBe(0);
  });
});

describe('Air volley and interrupts', () => {
  const squall = (feel = true) => {
    const fixture = makeAir(12); if (!feel) delete fixture.state.tuning;
    step(fixture.state, fixture.gale, castAt(fixture.target.pos, slotOf('air_squall')));
    while (fixture.gale.pending) step(fixture.state, fixture.gale, idleInput(fixture.target.pos));
    return fixture;
  };
  const thrown = (state: ArenaState, gale: Actor): number => new Set(state.projectiles.filter(p => p.ownerId === gale.id).map(p => p.activationId)).size;
  it('keeps the hands busy: no other cast starts while the volley runs', () => {
    const { state, gale, target } = squall();
    expect(airChannelBusy(state, gale)).toBe(true);
    const casts = gale.metrics.casts;
    step(state, gale, castAt(target.pos, slotOf('air_bolt')));
    expect(gale.metrics.casts).toBe(casts);
  });
  it('a roll drops the orbs not yet thrown', () => {
    const { state, gale, target } = squall();
    const seen = new Set(state.projectiles.filter(p => p.ownerId === gale.id).map(p => p.activationId));
    expect(seen.size).toBe(1);
    step(state, gale, { ...idleInput(target.pos), move: { x: 0, y: 1 }, roll: true });
    expect(ss(gale).volley).toBeUndefined();
    for (let t = 0; t < 60; t++) { step(state, gale, idleInput(target.pos)); for (const p of state.projectiles) if (p.ownerId === gale.id) seen.add(p.activationId); }
    expect(seen.size).toBe(1);
    expect(1000 - target.hp).toBeLessThanOrEqual(11);
  });
  it('a stagger (PC hit stun) drops the orbs not yet thrown', () => {
    const { state, gale, target } = squall(false);
    resolveHit(state, gale, { ownerId: target.id, activationId: state.nextId++, damage: 5, family: 'physical', tier: 0, source: { ...target.pos } });
    expect(gale.tags).toContain('STAGGERED');
    const before = thrown(state, gale);
    step(state, gale, idleInput(target.pos));
    expect(ss(gale).volley).toBeUndefined();
    for (let t = 0; t < 60; t++) step(state, gale, idleInput(target.pos));
    expect(thrown(state, gale)).toBeLessThanOrEqual(before);
  });
  it('a connecting staff strike interrupts a pending Air cast (combat.json interruptsCasts), with the PC hit stun off', () => {
    const { state, gale, target } = makeAir(1.2);
    step(state, gale, castAt({ x: gale.pos.x - 5, y: gale.pos.y }, slotOf('air_tempest')));
    expect(gale.pending?.spellId).toBe('air_tempest');
    for (let t = 0; t < 20 && gale.pending; t++) stepArena(state, { [gale.id]: idleInput({ x: gale.pos.x - 5, y: gale.pos.y }), [target.id]: castAt(gale.pos, 0) });
    expect(gale.pending).toBeUndefined();
    expect(state.events.some(e => e.kind === 'interrupt' && e.actorId === gale.id)).toBe(true);
  });
});

describe('Air deflect replaces the Water mirror', () => {
  it('a Gale carrying Mirror A sends exactly one bolt back, along its aim, not at the caster', () => {
    const state = createArena(5); state.tuning = vrFeel; state.balance = 'canonical';
    const centre = { x: 16, y: 10 }, player = addMage(state, 0, { x: 8, y: 10 }, 'Cassia'), gale = addMage(state, 1, centre, 'Gale');
    gale.water = newWaterState(presets.find(p => p.name === 'Mirror tide')!);
    gale.schoolState = newSchoolState(schoolPresets.air[0]!); gale.tier = 2;
    spawnProjectile(state, { ownerId: player.id, activationId: state.nextId++, damage: 10, family: 'magic', tier: 0, source: { x: 8, y: 10 } }, { x: 13, y: 10 }, { x: 1, y: 0 }, 12, 10);
    const facing = unit({ x: -1, y: 1 });
    for (let t = 1; t <= 20 && gale.metrics.perfects === 0; t++) step(state, gale, { ...idleInput({ x: centre.x + facing.x, y: centre.y + facing.y }), absorb: t >= 11 });
    const back = state.projectiles.filter(p => p.ownerId === gale.id);
    expect(back).toHaveLength(1);
    expect(unit(back[0]!.velocity).y).toBeCloseTo(facing.y, 12);
  });
  it('a reflected bolt is not deflected again, and nothing else answers it', () => {
    const state = createArena(5); state.tuning = vrFeel;
    const player = addMage(state, 0, { x: 8, y: 10 }, 'Cassia'), gale = addMage(state, 1, { x: 16, y: 10 }, 'Gale');
    gale.schoolState = newSchoolState(schoolPresets.air[0]!); gale.tier = 4;
    const p = spawnProjectile(state, { ownerId: player.id, activationId: state.nextId++, damage: 10, family: 'magic', tier: 0, source: { x: 8, y: 10 } }, { x: 13, y: 10 }, { x: 1, y: 0 }, 12, 10);
    p.reflected = true;
    for (let t = 1; t <= 20 && gale.metrics.perfects === 0; t++) step(state, gale, { ...idleInput({ x: 15, y: 10 }), absorb: t >= 11 });
    expect(gale.metrics.perfects).toBe(1);
    expect(state.projectiles.filter(q => q.ownerId === gale.id)).toHaveLength(0);
  });
});

describe('Gale mage AI seams', () => {
  it('presents its pending Veering Bolt, Downdraft and staff windup, and a running volley, to the opponent', () => {
    const { state, gale, target } = makeAir(8);
    step(state, gale, castAt(target.pos, slotOf('air_veer')));
    const veer = airBrain.threats(state, gale, target);
    expect(veer).toEqual([expect.objectContaining({ id: gale.pending!.activationId, family: 'magic', aimedAtUs: true, damage: 24 })]);
    expect(threats(state, target).some(t => t.id === gale.pending!.activationId)).toBe(true);
    const zone = makeAir(8);
    step(zone.state, zone.gale, castAt({ x: zone.target.pos.x + 20, y: zone.target.pos.y }, slotOf('air_downdraft')));
    const [placed] = airBrain.threats(zone.state, zone.gale, zone.target);
    expect(placed!.origin.x).toBeCloseTo(zone.gale.pos.x + 12, 9);
    expect(placed!.aimedAtUs).toBe(false);
    const volley = makeAir(10);
    step(volley.state, volley.gale, castAt(volley.target.pos, slotOf('air_squall')));
    while (volley.gale.pending) step(volley.state, volley.gale, idleInput(volley.target.pos));
    expect(airBrain.threats(volley.state, volley.gale, volley.target)).toEqual([expect.objectContaining({ id: -(volley.gale.id * 100 + 3), aimedAtUs: true, damage: 11 })]);
  });
  it('keeps the Slipstream end inside the arena: at the east edge, moving east, it dashes west', () => {
    const { state, gale, target } = makeAir(4); gale.pos = { x: 60, y: 10 }; target.pos = { x: 60, y: 6 }; // the arena spans x -31..63 (94 m wide, centre 16)
    const aim = slipstreamAim(gale, target, { x: 1, y: 0 }, 6);
    expect(aim.x).toBeCloseTo(54, 9);
    expect(distance(aim, gale.pos)).toBeCloseTo(6, 9);
    expect(sub(aim, gale.pos).y).toBe(0);
    expect(state.tick).toBe(0);
  });
  it('aims its lead with Gale Dart, 24 m/s', () => {
    const { gale } = makeAir(4);
    expect(airBrain.boltSpeedMps(gale)).toBe(24);
  });
});

describe('Air hash neutrality', () => {
  it('a Water-only state carries no school key after stepping, and the same inputs give the same hash with an Air actor', () => {
    const water = createArena(9), a = addMage(water, 0, { x: 10, y: 10 }), b = addMage(water, 1, { x: 20, y: 10 });
    for (let t = 0; t < 60; t++) stepArena(water, { [a.id]: castAt(b.pos, 0) });
    expect('schoolEffects' in water).toBe(false);
    expect('schoolState' in a || 'schoolState' in b).toBe(false);
    const run = (): string => {
      const { state, gale, target } = makeAir(8);
      for (let t = 0; t < 120; t++) step(state, gale, castAt(target.pos, [0, 1, 3, 6][t % 4]!));
      return stateHash(state);
    };
    expect(run()).toBe(run());
  });
});

describe('Air shapes from lane F (skipped until shapes.ts lands)', () => {
  it.skip('Downdraft lands at the aim point clamped to 12 m (x1.3 at Momentum 80) for 26 and pays 5 per target (needs lane F shapes.ts)', () => {
    const { state, gale, target } = makeAir(6);
    step(state, gale, castAt(target.pos, slotOf('air_downdraft')));
    for (let t = 0; t < 45; t++) step(state, gale, idleInput(target.pos));
    expect(1000 - target.hp).toBe(26);
    expect(ss(gale).value).toBe(5);
  });
  it.skip('Cyclone: every 0.25 s tick is its own activation and a fresh ward perfects any tick, not only the first (needs lane F shapes.ts)', () => {
    const { state, gale, target } = makeAir(6);
    step(state, gale, castAt(target.pos, slotOf('air_cyclone')));
    for (let t = 0; t < 40; t++) stepArena(state, { [gale.id]: idleInput(target.pos), [target.id]: { ...idleInput(gale.pos), absorb: t >= 35 } });
    expect(target.metrics.perfects).toBeGreaterThanOrEqual(1);
    const ids = state.events.filter(e => e.kind === 'hit' && e.targetId === gale.id).map(e => e.activationId);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it.skip('Slipstream displacement is not locomotion: the tick after the dash, Momentum is +30 minus nothing gained from the dash (needs lane F shapes.ts)', () => {
    const { state, gale } = makeAir(10);
    step(state, gale, castAt({ x: gale.pos.x, y: gale.pos.y + 20 }, slotOf('air_slipstream')));
    expect(ss(gale).value).toBe(30);
    step(state, gale, idleInput({ x: gale.pos.x + 1, y: gale.pos.y }));
    expect(ss(gale).value).toBeCloseTo(30 - 25 * DT, 12);
  });
  it.skip('Tempest Lance hits every body on the 16 m line, unblockable, and a blink through it is not hit (needs lane F shapes.ts)', () => {
    const { state, gale, target } = makeAir(8);
    const second = addMage(state, 1, { x: gale.pos.x + 14, y: gale.pos.y }, 'Second'); second.maxHp = second.hp = 1000;
    step(state, gale, castAt(target.pos, slotOf('air_tempest')));
    for (let t = 0; t < 80; t++) step(state, gale, idleInput(target.pos));
    expect([1000 - target.hp, 1000 - second.hp]).toEqual([85, 85]);
    expect(ss(gale).value).toBe(20);
  });
});

describe('Air in the kernel (skipped until kernel request R1 lands)', () => {
  it.skip('an evaded projectile flies on through the formed body and cannot hit it again (needs kernel R1)', () => {
    const { state, gale, target } = makeAir(4);
    target.schoolState = newSchoolState(schoolPresets.air[0]!); ss(target).formUntil = 1000;
    const behind = addMage(state, 1, { x: gale.pos.x + 7, y: gale.pos.y }, 'Behind'); behind.maxHp = behind.hp = 1000;
    for (let shot = 0; shot < 12; shot++) {
      spawnProjectile(state, { ownerId: gale.id, activationId: state.nextId++, damage: 1, family: 'magic', tier: 0, source: { ...gale.pos } }, gale.pos, { x: 1, y: 0 }, 24, 14);
      for (let t = 0; t < 30; t++) step(state, gale, idleInput(target.pos));
    }
    const evades = state.randomLog.filter(r => r.purpose.startsWith(`air ${target.id} evade`)).filter(r => r.value < 0.3).length;
    expect(evades).toBeGreaterThan(0);
    expect(1000 - behind.hp).toBe(evades);
  });
});
