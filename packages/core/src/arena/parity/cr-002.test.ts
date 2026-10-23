// CR-002 parity suite: every "Hand checks the port should reproduce" bullet with its exact number, plus the two VR fire
// duel scenarios compared on outcome fields (mage-arena-vr docs/change-requests/CR-002-fire-school.md). Setups mirror
// mage-arena-vr Tests/FireTests.cpp. The state runs canonical (no PC overlay) and, unless a check names the PC feel
// layer, the feel tuning VR's kernel has: no hit stun, no generic knockback, instant acceleration (vrFeel below).
import { describe, expect, it } from 'vitest';
import { addMage, createArena, defeatActor, interrupt, resolveHit, stepArena, ticks } from '../kernel.ts';
import { addEnemy } from '../enemies.ts';
import { createGames, stepGames } from '../games.ts';
import { presets } from '../catalog.ts';
import { runtime } from '../kernel.ts';
import { newSchoolState, schoolPresets } from '../schools.ts';
import { makeTuning, type CombatTuning } from '../tuning.ts';
import { fireShapes, fireState, heatValue } from '../fire.ts';
import type { ShapeEffect } from '../shapes.ts';
import { segmentHit, unit, type Vec } from '../math.ts';
import { idleInput, type Actor, type ArenaState, type Hit, type InputFrame } from '../types.ts';
import fixture from './cr-002.json' with { type: 'json' };

const vrFeel = (): CombatTuning => ({ ...makeTuning(), hitStunS: 0, hitStunPerDamageS: 0, knockbackM: 0, accelerationMps2: 0, decelerationMps2: 0, castMoveMultiplier: 1, castCommitFraction: 1, castRecoveryS: 0 });
function arena(seed: number, feel = true): ArenaState {
  const state = createArena(seed); state.balance = 'canonical';
  if (feel) state.tuning = vrFeel();
  return state;
}
function ember(state: ArenaState, pos: Vec, tier = 4): Actor {
  const a = addMage(state, 0, pos, 'Ember');
  a.school = 'fire'; a.schoolState = { ...newSchoolState(schoolPresets.fire[0]!), catalogue: true }; a.tier = tier; a.lastUnlockTick = 1e9;
  return a;
}
const pool = (a: Actor, hp: number, mana: number): void => { a.maxHp = a.hp = hp; a.maxMana = a.mana = mana; };
/** VR MakeFire: Ember at (10,10) tier 4 and a Water target `range` metres along +x, both with 1000 HP and 500 mana. */
function makeFire(range: number, feel = true) {
  const state = arena(11, feel), actor = ember(state, { x: 10, y: 10 }), target = addMage(state, 1, { x: 10 + range, y: 10 }, 'Target');
  pool(actor, 1000, 500); pool(target, 1000, 500);
  return { state, actor, target };
}
const slot = (id: string): number => fireShapes.findIndex(s => s.id === id);
const cast = (aim: Vec, s: number): InputFrame => ({ ...idleInput(aim), slot: s, cast: true });
const hold = (aim: Vec, absorb: boolean): InputFrame => ({ ...idleInput(aim), absorb });
const step = (state: ArenaState, inputs: Record<number, InputFrame> = {}): void => stepArena(state, inputs);
const advance = (state: ArenaState, n: number): void => { for (let i = 0; i < n; i++) stepArena(state); };
const count = (state: ArenaState, kind: string, actorId: number): number => state.events.filter(e => e.kind === kind && e.actorId === actorId).length;
const heat = (a: Actor): number => heatValue(a);
const effects = (state: ArenaState): ShapeEffect[] => (state.schoolEffects ?? []) as ShapeEffect[];
function projectileConnects(state: ArenaState, target: Actor): boolean {
  return state.projectiles.some(p => {
    const travel = Math.min(Math.hypot(p.velocity.x, p.velocity.y) / 60, p.remainingM), d = unit(p.velocity);
    return segmentHit(p.pos, { x: p.pos.x + d.x * travel, y: p.pos.y + d.y * travel }, target.pos, target.radius + p.radius) !== undefined;
  });
}
const near = (actual: number, expected: number): void => expect(actual).toBeCloseTo(expected, 9);

describe('CR-002 hand checks: Heat', () => {
  it('five connecting bolts at 6 m pay 10 heat; the 2 s idle holds it; 60 decay ticks leave 4', () => {
    const { state, actor, target } = makeFire(6);
    let hits = 0, guard = 0;
    while (hits < 5 && guard++ < 400) {
      const ready = !state.projectiles.length && state.tick + 1 >= (fireState(actor)!.cooldowns.fire_bolt ?? 0);
      step(state, ready ? { [actor.id]: cast(target.pos, slot('fire_bolt')) } : {});
      hits = count(state, 'hit', target.id);
    }
    expect(hits).toBe(5); expect(state.projectiles).toHaveLength(0);
    near(heat(actor), 10);
    const gain = fireState(actor)!.lastGainTick;
    while (state.tick < gain + ticks(2) - 1) advance(state, 1);
    near(heat(actor), 10);
    advance(state, 60);
    near(heat(actor), 4);
  });
  it('Kindle releases 24 ticks after the press and pays 25; a second Kindle from 90 clamps at 100', () => {
    const state = arena(2), actor = ember(state, { x: 10, y: 10 });
    step(state, { [actor.id]: cast({ x: 11, y: 10 }, slot('fire_kindle')) });
    expect(actor.pending?.releaseTick).toBe(1 + 24);
    advance(state, 24);
    expect(actor.pending).toBeUndefined();
    near(heat(actor), 25);
    const gain = fireState(actor)!.lastGainTick;
    expect(gain).toBe(25);
    while (state.tick < gain + ticks(2) - 1) advance(state, 1);
    near(heat(actor), 25);
    advance(state, 60);
    near(heat(actor), 19);
    Object.assign(fireState(actor)!, { value: 90, lastGainTick: state.tick, cooldowns: {} });
    step(state, { [actor.id]: cast({ x: 11, y: 10 }, slot('fire_kindle')) });
    advance(state, 24);
    near(heat(actor), 100);
  });
  it('two enemies inside 3 m for 60 ticks pay 6, one pays 3; leaving the ring starts the idle without a drop', () => {
    const state = arena(3), actor = ember(state, { x: 10, y: 10 }, 1);
    const a = addMage(state, 1, { x: 12, y: 10 }, 'Near'), b = addMage(state, 1, { x: 10, y: 12 }, 'Other');
    advance(state, 60);
    near(heat(actor), 6);
    a.pos = { x: 30, y: 10 }; b.pos = { x: 30, y: 12 };
    const held = heat(actor), stamp = state.tick;
    while (state.tick < stamp + ticks(2) - 1) advance(state, 1);
    near(heat(actor), held);
    const one = arena(4), solo = ember(one, { x: 10, y: 10 }, 1);
    addMage(one, 1, { x: 12, y: 10 }, 'Near');
    advance(one, 60);
    near(heat(solo), 3);
  });
  it('Furnace locks at 100 through tick 390 (release 31, lock 360); a gifted 50 is discarded; tick 391 is 100 - 6/60', () => {
    const state = arena(5), actor = ember(state, { x: 10, y: 10 }), target = addMage(state, 1, { x: 20, y: 10 }, 'Target');
    pool(actor, 1000, 500);
    step(state, { [actor.id]: cast({ x: 11, y: 10 }, slot('fire_furnace')) });
    advance(state, ticks(0.5));
    near(heat(actor), 100);
    expect(fireState(actor)!.lockedUntil).toBe(31 + 360);
    const gift: Hit = { ownerId: actor.id, activationId: 1, damage: 0, family: 'magic', tier: 0, source: { x: 20, y: 10 }, heat: 50 };
    resolveHit(state, target, gift);
    near(heat(actor), 100);
    while (state.tick < 390) advance(state, 1);
    near(heat(actor), 100);
    advance(state, 1);
    expect(state.tick).toBe(391);
    near(heat(actor), 100 - 6 / 60);
  });
  it('an unabsorbed hit taken pays 12; a perfect absorb pays no extra heat', () => {
    const { state, actor, target } = makeFire(6);
    target.school = 'fire'; target.schoolState = newSchoolState(schoolPresets.fire[0]!);
    resolveHit(state, target, { ownerId: actor.id, activationId: 7, damage: 10, family: 'magic', tier: 0, source: { ...actor.pos } });
    near(heat(target), 12);
    target.absorb = true; target.absorbFreshTick = state.tick; target.facing = { x: -1, y: 0 };
    resolveHit(state, target, { ownerId: actor.id, activationId: 8, damage: 10, family: 'magic', tier: 0, source: { ...actor.pos } });
    near(heat(target), 12);
    near(target.hp, 1000 - 10);
  });
});

describe('CR-002 hand checks: thresholds', () => {
  it('bolt damage at heat 49, 50, 80 and 100 is 8, 9.2, 10.4, 10.4 (a higher band replaces)', () => {
    for (const [value, expected] of [[49, 8], [50, 9.2], [80, 10.4], [100, 10.4]] as const) {
      const { state, actor, target } = makeFire(6);
      fireState(actor)!.value = value;
      step(state, { [actor.id]: cast(target.pos, slot('fire_bolt')) });
      expect(state.projectiles).toHaveLength(1);
      near(state.projectiles[0]!.damage, expected);
    }
  });
  it('one stamina tick after the 0.8 s delay from empty is 20/60 x 0.7 at Blazing, 20/60 cold', () => {
    for (const [value, expected] of [[80, 20 / 60 * 0.7], [0, 20 / 60]] as const) {
      const state = arena(6), actor = ember(state, { x: 10, y: 10 }, 1);
      fireState(actor)!.value = value; actor.stamina = 0; actor.staminaUsedTick = 0;
      advance(state, ticks(0.8));
      near(actor.stamina, expected);
    }
  });
  it('sixty ticks of a held ward at Blazing drain 27 x 1.5; under Furnace the same minute drains 27 x 3', () => {
    const state = arena(8), actor = ember(state, { x: 10, y: 10 }, 1);
    fireState(actor)!.value = 80; pool(actor, 1000, 500);
    for (let i = 0; i < 60; i++) step(state, { [actor.id]: hold({ x: 11, y: 10 }, true) });
    near(actor.metrics.manaDrained, 27 * 1.5);
    const furnace = arena(9), mage = ember(furnace, { x: 10, y: 10 });
    pool(mage, 1000, 500);
    step(furnace, { [mage.id]: cast({ x: 11, y: 10 }, slot('fire_furnace')) });
    advance(furnace, ticks(0.5));
    const drained = mage.metrics.manaDrained;
    for (let i = 0; i < 60; i++) step(furnace, { [mage.id]: hold({ x: 11, y: 10 }, true) });
    near(mage.metrics.manaDrained - drained, 27 * 3);
    expect(furnace.tick).toBeLessThan(fireState(mage)!.lockedUntil);
  });
});

describe('CR-002 hand checks: gating and the ward', () => {
  it('mana 3 refuses the bolt; a second press inside 18 ticks does not cast', () => {
    const refused = makeFire(6);
    refused.actor.mana = 3;
    step(refused.state, { [refused.actor.id]: cast(refused.target.pos, slot('fire_bolt')) });
    expect(refused.actor.pending).toBeUndefined(); expect(refused.actor.metrics.casts).toBe(0);
    near(refused.actor.mana, 3 + 7.5 / 60);
    const { state, actor, target } = makeFire(6);
    actor.mana = 50;
    step(state, { [actor.id]: cast(target.pos, slot('fire_bolt')) });
    expect(fireState(actor)!.cooldowns.fire_bolt).toBe(1 + 18);
    step(state, { [actor.id]: cast(target.pos, slot('fire_bolt')) });
    expect(actor.metrics.casts).toBe(1);
    near(actor.mana, 50 + 2 * 7.5 / 60 - 4);
  });
  it('slot 0 inside 1.6 m is a staff strike: stamina 12, no bolt mana, no bolt heat, one proximity tick of 3/60', () => {
    const { state, actor, target } = makeFire(1);
    const stamina = actor.stamina; actor.mana = 400;
    step(state, { [actor.id]: cast(target.pos, 0) });
    expect(actor.pending?.kind).toBe('staff');
    near(actor.stamina, stamina - 12);
    near(actor.mana, 400 + 7.5 / 60);
    near(heat(actor), 3 / 60);
  });
  it('a stale ward chips a bolt to 8 x 0.15', () => {
    const { state, actor, target } = makeFire(6);
    target.facing = { x: -1, y: 0 };
    for (let i = 0; i < ticks(0.15) + 2; i++) step(state, { [target.id]: hold(actor.pos, true) });
    expect(target.absorb).toBe(true); expect(state.tick - target.absorbFreshTick).toBeGreaterThan(ticks(0.15));
    let cast0 = false, guard = 0;
    while (guard++ < 80 && (state.projectiles.length || !cast0)) {
      step(state, cast0 ? { [target.id]: hold(actor.pos, true) } : { [actor.id]: cast(target.pos, slot('fire_bolt')), [target.id]: hold(actor.pos, true) });
      cast0 = true;
    }
    near(1000 - target.hp, 8 * 0.15);
  });
  it('a fresh ward perfects the bolt and the caster still gains 2', () => {
    const { state, actor, target } = makeFire(6);
    target.facing = { x: -1, y: 0 };
    step(state, { [actor.id]: cast(target.pos, slot('fire_bolt')) });
    for (let guard = 0; guard < 80 && target.hp === 1000; guard++) {
      if (projectileConnects(state, target)) { step(state, { [target.id]: hold(actor.pos, true) }); break; }
      advance(state, 1);
    }
    expect(count(state, 'perfect', target.id)).toBe(1);
    near(target.hp, 1000);
    near(heat(actor), 2);
  });
});

describe('CR-002 hand checks: Sunfall', () => {
  const meteor = { x: 16, y: 10 };
  it('rooted for 48 ticks; the shadow resolves 72 ticks later for 95 through a held ward, no perfect, 10 heat', () => {
    const { state, actor, target } = makeFire(8);
    target.facing = { x: -1, y: 0 };
    step(state, { [actor.id]: cast(meteor, slot('fire_sunfall')) });
    expect(actor.pending?.releaseTick).toBe(1 + 48);
    const rooted = actor.pos.x, move: InputFrame = { ...idleInput(meteor), move: { x: 1, y: 0 } };
    for (let i = 0; i < 48; i++) step(state, { [actor.id]: move });
    near(actor.pos.x, rooted);
    expect(actor.pending).toBeUndefined();
    const shadow = effects(state);
    expect(shadow).toHaveLength(1);
    expect(shadow[0]).toMatchObject({ kind: 'detonation', survivesOwner: true, endTick: state.tick + 72, radiusM: 3.5, damage: 95, family: 'unblockable' });
    step(state, { [actor.id]: move });
    near(actor.pos.x, rooted + 4.5 / 60);
    while (state.tick < 120) step(state, { [target.id]: hold(actor.pos, true) });
    expect(state.tick - target.absorbFreshTick).toBeGreaterThan(ticks(0.15));
    step(state, { [target.id]: hold(actor.pos, true) });
    expect(state.tick).toBe(1 + 48 + 72);
    near(1000 - target.hp, 95);
    expect(count(state, 'perfect', target.id)).toBe(0);
    near(heat(actor), 10);
  });
  it('a fresh ward still takes 95 and is not a perfect', () => {
    const { state, actor, target } = makeFire(8);
    target.facing = { x: -1, y: 0 };
    step(state, { [actor.id]: cast(meteor, slot('fire_sunfall')) });
    while (state.tick < 48 + 72) advance(state, 1);
    step(state, { [target.id]: hold(actor.pos, true) });
    near(1000 - target.hp, 95);
    expect(count(state, 'perfect', target.id)).toBe(0);
  });
  it('a staff strike during the cast cancels it and does not loose the meteor (PC: the strike interrupts through hit stun)', () => {
    // PC realises "staff strike interrupts casts" through resolveHit's stagger, so this check runs the PC feel layer.
    const state = arena(12, false), caster = ember(state, { x: 10, y: 10 }), striker = addMage(state, 1, { x: 9, y: 10 }, 'Striker');
    pool(caster, 1000, 500); pool(striker, 1000, 500);
    step(state, { [caster.id]: cast(striker.pos, slot('fire_sunfall')), [striker.id]: cast(caster.pos, 0) });
    expect(caster.pending?.spellId).toBe('fire_sunfall');
    advance(state, ticks(0.25));
    expect(caster.pending).toBeUndefined();
    expect(fireState(caster)!.sunfallLoosed).toBeUndefined();
    expect(fireState(caster)!.rootUntil).toBeUndefined();
    expect(effects(state)).toHaveLength(0);
    near(1000 - caster.hp, 6);
  });
  it('after release, an interrupt and the owner going down keep the shadow and it still lands', () => {
    const { state, actor, target } = makeFire(6);
    step(state, { [actor.id]: cast(target.pos, slot('fire_sunfall')) });
    advance(state, ticks(0.8));
    expect(effects(state)).toHaveLength(1);
    interrupt(state, actor);
    expect(effects(state)).toHaveLength(1);
    defeatActor(state, actor);
    while (state.tick < 1 + 48 + 72) advance(state, 1);
    near(1000 - target.hp, 95);
  });
});

describe('CR-002 hand checks: shapes', () => {
  it('Flick hits a centre at 4 m and misses 4.05 m and a body 90 deg off the aim; heat 6 once', () => {
    const state = arena(13), actor = ember(state, { x: 10, y: 10 });
    const edge = addMage(state, 1, { x: 14, y: 10 }, 'Edge'), past = addMage(state, 1, { x: 14.05, y: 10 }, 'Past'), behind = addMage(state, 1, { x: 10, y: 14 }, 'Behind');
    for (const a of [actor, edge, past, behind]) pool(a, 1000, 500);
    step(state, { [actor.id]: cast({ x: 14, y: 10 }, slot('fire_flick')) });
    advance(state, ticks(0.15));
    near(1000 - edge.hp, 20); near(past.hp, 1000); near(behind.hp, 1000);
    near(heat(actor), 6);
  });
  it('Ring at 2 m deals 18, knocks 2 m, and heat is 5 plus 19 ticks of proximity', () => {
    const { state, actor, target } = makeFire(2);
    step(state, { [actor.id]: cast(target.pos, slot('fire_ring')) });
    advance(state, ticks(0.3));
    near(1000 - target.hp, 18);
    near(target.pos.x, 14);
    near(heat(actor), 5 + 19 * 3 / 60);
  });
  it('Lance into a shieldman facing the caster deals 32 (piercing skips the Scutum front block)', () => {
    const state = arena(14), actor = ember(state, { x: 10, y: 10 }), shield = addEnemy(state, 'shieldman', { x: 20, y: 10 });
    pool(actor, 1000, 500); shield.facing = { x: -1, y: 0 };
    const hp = shield.hp;
    step(state, { [actor.id]: cast(shield.pos, slot('fire_lance')) });
    advance(state, ticks(0.6));
    near(hp - shield.hp, 32);
    near(heat(actor), 4);
  });
  it('Pyre windup is 48 ticks, one hit of 48, no leftover telegraph, 8 heat', () => {
    const { state, actor, target } = makeFire(6);
    step(state, { [actor.id]: cast(target.pos, slot('fire_pyre')) });
    expect(actor.pending?.releaseTick).toBe(1 + 48);
    advance(state, 48);
    near(1000 - target.hp, 48);
    expect(state.telegraphs).toHaveLength(0); expect(effects(state)).toHaveLength(0);
    near(heat(actor), 8);
    const left = target.hp;
    advance(state, 60);
    near(target.hp, left);
  });
  it('Cinder moves 5 m for no stamina, then four trail ticks deal 24 and pay 12; a second copy of the trail adds nothing', () => {
    for (const copy of [false, true]) {
      const state = arena(15), actor = ember(state, { x: 10, y: 10 }), target = addMage(state, 1, { x: 30, y: 10 }, 'Off the trail');
      pool(actor, 1000, 500); pool(target, 1000, 500);
      const stamina = actor.stamina;
      step(state, { [actor.id]: cast({ x: 20, y: 10 }, slot('fire_cinderstep')) });
      near(actor.pos.x, 15); near(actor.stamina, stamina);
      expect(effects(state).filter(e => e.kind === 'trail')).toHaveLength(1);
      if (copy) state.schoolEffects!.push({ ...structuredClone(effects(state)[0]!), id: state.nextId++ });
      target.pos = { x: 11, y: 10 };
      while (state.tick < 1 + ticks(2)) advance(state, 1);
      near(1000 - target.hp, 24);
      near(heat(actor), 12);
    }
  });
  it('Wrath: eight hits, 112 damage, 16 heat', () => {
    const { state, actor, target } = makeFire(6);
    const aim = { ...target.pos };
    step(state, { [actor.id]: cast(aim, slot('fire_wrath')) });
    while (state.tick < 1 + ticks(0.2) + ticks(2)) step(state, { [actor.id]: hold(aim, false) });
    expect(count(state, 'hit', target.id)).toBe(8);
    near(1000 - target.hp, 112);
    near(heat(actor), 16);
  });
  it('Wrath: the first tick (28) is perfectable; the second (43), after a drop and the 8-tick re-raise, chips 2.1; both pay heat', () => {
    const { state, actor, target } = makeFire(6);
    const aim = { ...target.pos };
    target.facing = { x: -1, y: 0 };
    const first = 1 + ticks(0.2) + ticks(0.25), second = first + ticks(0.25), raiseAgain = first + ticks(0.12);
    expect([first, second, ticks(0.12)]).toEqual([28, 43, 8]);
    step(state, { [actor.id]: cast(aim, slot('fire_wrath')) });
    while (state.tick < second) {
      const upcoming = state.tick + 1;
      const absorb = upcoming === first - 1 || upcoming === first || (upcoming >= raiseAgain && upcoming <= second);
      step(state, { [actor.id]: hold(aim, false), [target.id]: hold(actor.pos, absorb) });
    }
    expect(count(state, 'perfect', target.id)).toBe(1);
    near(1000 - target.hp, 14 * 0.15);
    near(heat(actor), 2 * 2);
  });
});

describe('CR-002 VR scenarios (outcome fields; known divergence located, not tuned)', () => {
  const run = (seed: number, wave: number, vrEquivalent: boolean) => {
    const g = createGames(seed, presets.find(p => p.name === runtime.games.referencePreset)!, wave, true, undefined, vrEquivalent ? vrFeel() : undefined, 'normal',
      vrEquivalent ? { schoolRivals: 'fire', balance: 'canonical', unpaced: true } : { schoolRivals: 'fire', balance: 'canonical' });
    while (g.phase === 'active' && g.state.tick < ticks(runtime.games.fightTimeoutS)) stepGames(g);
    const sunfall = g.state.events.filter(e => e.kind === 'release' && e.spellId === 'fire_sunfall').length;
    return { outcome: g.phase === 'lost' ? 'loss' : g.phase === 'active' ? 'timeout' : 'win', phase: g.phase, ticks: g.state.tick, hp: g.player.hp, mana: g.player.mana, wavesCleared: g.wavesCleared, sunfall, kind: g.spawnLog[0]!.kind };
  };
  for (const scenario of fixture.scenarios) for (const vrEquivalent of [false, true]) {
    it(`seed ${scenario.seed} wave ${scenario.wave} (${vrEquivalent ? 'VR-equivalent pace and feel' : 'normal difficulty'})`, () => {
      const pc = run(scenario.seed, scenario.wave, vrEquivalent);
      expect(pc.kind).toBe(scenario.extra.kind);
      expect(pc.sunfall).toBe(scenario.extra.sunfall);
      for (const field of ['outcome', 'phase', 'ticks', 'hp', 'mana', 'wavesCleared'] as const) {
        if (fixture.knownDivergence.fields.includes(field)) continue;
        expect(pc[field], field).toBe(scenario[field]);
      }
    });
  }
});
