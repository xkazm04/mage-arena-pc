import { expect, it } from 'vitest';
import { addEnemy, addMage, createArena, enemyInputs, runtime, stepArena, ticks } from './index.ts';
it('conscripts pay the shared sprint cost while approaching, with no HP or damage subsidy', () => {
  const s = createArena(), p = addMage(s, 0, { x: 8, y: 10 }), a = addEnemy(s, 'conscript', { x: 20, y: 10 });
  const before = a.stamina, hp = a.hp;
  const input = enemyInputs(s); expect(input[a.id]!.sprint).toBe(true); stepArena(s, input);
  expect(a.stamina).toBeLessThan(before); expect(a.hp).toBe(hp); expect(p.hp).toBe(p.maxHp);
  a.pos = { x: 9, y: 10 }; const close = enemyInputs(s);
  expect(close[a.id]!.sprint).toBe(false); expect(s.telegraphs[0]!.damage).toBe(10);
});
it('slingers approach their firing band, then have an ordinary planted reload', () => {
  const s = createArena(), p = addMage(s, 0, { x: 8, y: 10 }), a = addEnemy(s, 'slinger', { x: 24, y: 10 });
  expect(enemyInputs(s)[a.id]!.move.x).toBeLessThan(0); expect(s.telegraphs).toHaveLength(0);
  a.pos = { x: 17, y: 10 }; enemyInputs(s); expect(s.telegraphs).toHaveLength(1);
  expect(s.telegraphs[0]!.rangeM).toBe(runtime.games.rangedRangeM);
  for (let i = 0; i < ticks(0.6); i++) stepArena(s, enemyInputs(s));
  p.pos = { x: 16, y: 10 }; expect(enemyInputs(s)[a.id]!.move).toEqual({ x: 0, y: 0 });
  expect(a.enemy!.recoveryUntil).toBeGreaterThan(s.tick);
});
it('near hounds receive the two engagement slots even if spawned last', () => {
  const s = createArena(); addMage(s, 0, { x: 8, y: 10 });
  const far = addEnemy(s, 'cinder_hound', { x: 20, y: 10 });
  const nearA = addEnemy(s, 'cinder_hound', { x: 8.8, y: 10 });
  const nearB = addEnemy(s, 'cinder_hound', { x: 8, y: 10.8 }); enemyInputs(s);
  expect(s.telegraphs.map(t => t.ownerId).sort()).toEqual([nearA.id, nearB.id].sort());
  expect(s.telegraphs.some(t=>t.ownerId===far.id)).toBe(false);
});
