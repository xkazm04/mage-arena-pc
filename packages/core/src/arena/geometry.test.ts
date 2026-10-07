import { describe, expect, it } from 'vitest';
import { addEnemy, addMage, arenaContains, arenaGeometry, constrainToArena, createArena, createGames, distance, idleInput, openingSeparationM, stepArena, ticks } from './index.ts';

describe('the playable open oval', () => {
  it('uses the art contract and a conservative disk inset at every part of its perimeter', () => {
    expect(arenaGeometry).toEqual({ centre: { x: 16, y: 10 }, widthM: 94, heightM: 62 });
    expect(arenaContains({ x: -31, y: 10 })).toBe(true); expect(arenaContains({ x: 16, y: -21 })).toBe(true);
    expect(arenaContains({ x: -31, y: -21 })).toBe(false);
    for (let i = 0; i < 72; i++) for (const radius of [0.38, 0.7, 2]) {
      const p = constrainToArena({ x: 16 + 200 * Math.cos(i * Math.PI / 36), y: 10 + 200 * Math.sin(i * Math.PI / 36) }, radius);
      expect(arenaContains(p, radius)).toBe(true);
      for (let j = 0; j < 36; j++) expect(arenaContains({ x: p.x + radius * Math.cos(j * Math.PI / 18), y: p.y + radius * Math.sin(j * Math.PI / 18) })).toBe(true);
    }
    const p = { x: 13.2345, y: 10.111 }; expect(constrainToArena(p, 0.38)).toEqual(p);
  });
  it('permits movement beyond the old court and clamps walks, rolls, and charges to the same boundary', () => {
    const state = createArena(), p = addMage(state, 0, { x: 31, y: 20 });
    for (let i = 0; i < ticks(2); i++) stepArena(state, { [p.id]: { ...idleInput({ x: 100, y: 20 }), move: { x: 1, y: 0 } } });
    expect(p.pos.x).toBeGreaterThan(39);
    p.pos = { x: 110, y: 62 }; p.previousPos = { ...p.pos };
    for (let i = 0; i < ticks(2); i++) stepArena(state, { [p.id]: { ...idleInput({ x: 120, y: 62 }), move: { x: 1, y: 1 }, roll: true } });
    expect(arenaContains(p.pos, p.radius)).toBe(true);
    const thorn = addEnemy(state, 'thornback', { x: 108, y: 64 });
    state.telegraphs.push({ id: 100, activationId: 100, ownerId: thorn.id, source: thorn.pos, origin: thorn.pos, target: { x: 200, y: 100 }, kind: 'charge', startTick: state.tick, resolveTick: state.tick + 1, damage: 0, family: 'unblockable', tier: 1, speedMps: 0, rangeM: 40, widthM: 2, wallStunS: 1 });
    stepArena(state); expect(arenaContains(thorn.pos, thorn.radius)).toBe(true); expect(thorn.enemy!.stunnedUntil).toBeGreaterThan(state.tick);
  });
  it('spaces every initial Tiro opponent by at least six metres without placing anyone outside', () => {
    for (let seed = 0; seed < 100; seed++) for (let wave = 0; wave < 4; wave++) {
      const g = createGames(seed, undefined, wave);
      for (const a of g.state.actors) {
        expect(arenaContains(a.pos, a.radius)).toBe(true);
        for (const b of g.state.actors) if (a.id !== b.id) expect(distance(a.pos, b.pos)).toBeGreaterThanOrEqual(openingSeparationM);
      }
    }
  });
});
