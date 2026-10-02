import { expect, it } from 'vitest';
import { createTraining, idleInput, runtime, stepTraining, ticks } from './index.ts';
it('keeps the performance field at 100 moving projectiles on every completed tick, including expiration', () => {
  const t = createTraining('performance', 7);
  let maximumId = 0;
  for (let i = 0; i < ticks(9); i++) {
    stepTraining(t, idleInput(t.dummy.pos));
    expect(t.state.projectiles).toHaveLength(runtime.training.performanceProjectiles);
    expect(t.state.projectiles.every(p => p.velocity.x > 0 && p.damage === 0)).toBe(true);
    maximumId = Math.max(maximumId, ...t.state.projectiles.map(p => p.id));
  }
  expect(maximumId).toBeGreaterThan(runtime.training.performanceProjectiles * 3);
  expect(t.player.hp).toBe(t.player.maxHp);
});
