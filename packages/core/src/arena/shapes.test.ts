// The shared shapes on their own (lane F; lane A builds Air on these signatures). Owners here are plain mages with no
// school, so no live multiplier applies; the Fire uses are proven in parity/cr-002.test.ts.
import { describe, expect, it } from 'vitest';
import { addMage, createArena, defeatActor, stepArena } from './kernel.ts';
import { addEnemy } from './enemies.ts';
import { makeTuning } from './tuning.ts';
import { constrainToArena } from './geometry.ts';
import { dash, queueDetonation, resolveLine, shapeHooks, startBeam, stepSchoolEffects, type ShapeEffect } from './shapes.ts';
import { idleInput, type Actor, type ArenaState, type Hit } from './types.ts';

function arena(): ArenaState {
  const state = createArena(21);
  state.tuning = { ...makeTuning(), hitStunS: 0, hitStunPerDamageS: 0, knockbackM: 0 };
  return state;
}
const tough = (a: Actor): Actor => { a.maxHp = a.hp = 1000; return a; };
const hit = (owner: Actor, damage = 10, extra: Partial<Hit> = {}): Hit => ({ ownerId: owner.id, activationId: 99, damage, family: 'magic', tier: 2, source: { ...owner.pos }, ...extra });
const advance = (state: ArenaState, n: number): void => { for (let i = 0; i < n; i++) stepArena(state); };

describe('shapes: resolveLine', () => {
  it('hits every hostile body the segment (plus half the width) touches, at once, and returns their ids', () => {
    const state = arena(), owner = addMage(state, 0, { x: 5, y: 10 });
    const on = tough(addMage(state, 1, { x: 9, y: 10.3 })), wide = tough(addMage(state, 1, { x: 12, y: 10.9 })), off = tough(addMage(state, 1, { x: 12, y: 12 }));
    const friend = tough(addMage(state, 0, { x: 7, y: 10 }));
    expect(resolveLine(state, owner, hit(owner), owner.pos, { x: 19, y: 10 }, 0)).toEqual([on.id]);
    expect(resolveLine(state, owner, hit(owner), owner.pos, { x: 19, y: 10 }, 1.2)).toEqual([on.id, wide.id]);
    expect([on.hp, wide.hp, off.hp, friend.hp]).toEqual([980, 990, 1000, 1000]);
  });
  it('a plain line is stopped by a Scutum front; a piercing one is not and stays magic', () => {
    for (const piercing of [false, true]) {
      const state = arena(), owner = addMage(state, 0, { x: 10, y: 10 }), shield = addEnemy(state, 'shieldman', { x: 16, y: 10 });
      shield.facing = { x: -1, y: 0 }; const hp = shield.hp;
      resolveLine(state, owner, hit(owner, 20), owner.pos, { x: 24, y: 10 }, 0, { piercing });
      expect(hp - shield.hp).toBe(piercing ? 20 : 0);
      expect(state.events.at(-1)?.family).toBe('magic');
    }
  });
});

describe('shapes: queueDetonation', () => {
  it('lands once after the delay on bodies within radius plus body radius, and leaves nothing behind', () => {
    const state = arena(), owner = addMage(state, 0, { x: 5, y: 10 });
    const inside = tough(addMage(state, 1, { x: 15 + 3 + 0.37, y: 10 })), outside = tough(addMage(state, 1, { x: 15, y: 10 + 3 + 0.39 }));
    expect('schoolEffects' in state).toBe(false);
    queueDetonation(state, owner, hit(owner, 30), { x: 15, y: 10 }, 3, 10, { spellId: 'test' });
    expect(state.schoolEffects).toHaveLength(1);
    advance(state, 9); expect(inside.hp).toBe(1000);
    advance(state, 1); expect([inside.hp, outside.hp]).toEqual([970, 1000]);
    expect(state.schoolEffects).toEqual([]);
  });
  it('a plain detonation dies with its owner; a committed one (survivesOwner) lands anyway', () => {
    for (const survivesOwner of [false, true]) {
      const state = arena(), owner = addMage(state, 0, { x: 5, y: 10 }), target = tough(addMage(state, 1, { x: 15, y: 10 }));
      queueDetonation(state, owner, hit(owner, 30), target.pos, 2, 10, { survivesOwner });
      defeatActor(state, owner);
      advance(state, 10);
      expect(target.hp).toBe(survivesOwner ? 970 : 1000);
    }
  });
});

describe('shapes: startBeam', () => {
  it('ticks every interval for the duration along the owner live facing; perfects stay open every tick unless first-only', () => {
    const state = arena(), owner = addMage(state, 0, { x: 10, y: 10 });
    const ahead = tough(addMage(state, 1, { x: 15, y: 10 })), side = tough(addMage(state, 1, { x: 10, y: 15 }));
    startBeam(state, owner, hit(owner, 5), 8, 10, 40);
    advance(state, 20);
    expect(ahead.hp).toBe(990);
    stepArena(state, { [owner.id]: idleInput({ x: 10, y: 20 }) });
    for (let i = 0; i < 25; i++) stepArena(state, { [owner.id]: idleInput({ x: 10, y: 20 }) });
    expect([ahead.hp, side.hp]).toEqual([990, 990]);
    expect(state.schoolEffects).toEqual([]);
  });
  it('without perfectFirstTickOnly a fresh ward perfects a later tick (Air Cyclone); with it the tick chips', () => {
    for (const perfectFirstTickOnly of [false, true]) {
      const state = arena(), owner = addMage(state, 0, { x: 10, y: 10 }), target = tough(addMage(state, 1, { x: 15, y: 10 }));
      startBeam(state, owner, hit(owner, 10), 8, 10, 30, { perfectFirstTickOnly });
      advance(state, 10);
      expect(target.hp).toBe(990);
      for (let i = 0; i < 10; i++) stepArena(state, { [target.id]: { ...idleInput(owner.pos), absorb: state.tick + 1 >= 18 } });
      expect(state.events.filter(e => e.kind === 'perfect').length).toBe(perfectFirstTickOnly ? 0 : 1);
      expect(target.hp).toBeCloseTo(perfectFirstTickOnly ? 990 - 10 * 0.15 : 990, 9);
    }
  });
});

describe('shapes: dash and the effect step', () => {
  it('a dash without a trail moves along the direction, clamps to the arena, and creates no effect', () => {
    const state = arena(), owner = addMage(state, 0, { x: 10, y: 10 });
    expect(dash(state, owner, { x: 1, y: 0 }, 5)).toEqual({ from: { x: 10, y: 10 }, to: { x: 15, y: 10 } });
    const edge = dash(state, owner, { x: 1, y: 0 }, 500);
    expect(edge.to).toEqual(constrainToArena({ x: 515, y: 10 }, owner.radius)); expect(edge.to.x).toBeLessThan(515); expect(owner.pos).toEqual(edge.to);
    expect('schoolEffects' in state).toBe(false);
  });
  it('a trail ticks on the travelled segment with a fresh activation each tick, deduped per owner per tick', () => {
    const state = arena(), owner = addMage(state, 0, { x: 10, y: 10 }), target = tough(addMage(state, 1, { x: 30, y: 10 }));
    dash(state, owner, { x: 1, y: 0 }, 5, { hit: hit(owner, 6), everyTicks: 30, durationTicks: 120, spellId: 'test' });
    const trail = state.schoolEffects![0] as ShapeEffect;
    state.schoolEffects!.push({ ...structuredClone(trail), id: state.nextId++ });
    target.pos = { x: 12, y: 10 };
    advance(state, 120);
    expect(target.hp).toBe(1000 - 4 * 6);
    expect(new Set(state.events.filter(e => e.kind === 'hit').map(e => e.activationId)).size).toBe(4);
  });
  it('steps nothing without effects, and hands a kind it does not own to the registered stepper', () => {
    const state = arena();
    stepSchoolEffects(state);
    expect('schoolEffects' in state).toBe(false);
    const owner = addMage(state, 0, { x: 10, y: 10 });
    let calls = 0;
    shapeHooks.step.volley = () => ++calls < 3;
    state.schoolEffects = [{ id: 1, ownerId: owner.id, activationId: 1, spellId: 'v', kind: 'volley', startTick: 0, nextTick: 1, endTick: 9, origin: owner.pos, target: owner.pos, damage: 1, family: 'magic', tier: 1, hitLog: [] }];
    advance(state, 5);
    delete shapeHooks.step.volley;
    expect(calls).toBe(3); expect(state.schoolEffects).toEqual([]);
  });
});
