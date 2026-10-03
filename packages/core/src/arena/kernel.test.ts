import { makeTuning } from './tuning.ts';
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { addMage, combat, createArena, drainPerSecond, DT, FixedStepper, perfectReturn, resetWave, resolveHit, runtime, spawnProjectile, stateHash, stepArena, ticks } from './kernel.ts';
import { inArc, rotate } from './math.ts';
import { createTraining, runTimingBot, stepTraining } from './training.ts';
import { idleInput, type Family } from './types.ts';
function hitCase(age: number, degrees: number, family: Family = 'magic', tier = 1, nerve = 1) {
  const s = createArena(17), a = addMage(s, 0, { x: 10, y: 10 }, 'test', { vigor: 1, focus: 1, nerve });
  a.mana = 20; a.absorb = true; a.absorbFreshTick = 0; s.tick = age;
  const d = rotate({ x: 1, y: 0 }, degrees * Math.PI / 180);
  const result = resolveHit(s, a, { ownerId: 99, activationId: 100, damage: 20, family, tier, source: { x: a.pos.x + d.x, y: a.pos.y + d.y } });
  return { s, a, result };
}
describe('directional absorb', () => {
  it('includes both arc boundaries and excludes outside/back attacks', () => {
    for (const angle of [-70, -69, 69, 70]) expect(hitCase(12, angle).result.damage).toBeCloseTo(3);
    for (const angle of [-71, 71, 180]) expect(hitCase(0, angle).result.damage).toBe(20);
    expect(inArc({ x: 1, y: 0 }, { x: -1, y: 0 }, 360)).toBe(true);
  });
  it('uses inclusive nine-tick perfect window, not ten', () => {
    expect(hitCase(ticks(combat.absorb.perfect.windowS), 0).result.perfect).toBe(true);
    expect(hitCase(ticks(combat.absorb.perfect.windowS) + 1, 0).result.perfect).toBe(false);
  });
  it('never perfects steel and never blocks unblockables', () => {
    expect(hitCase(0, 0, 'physical').result).toEqual({ damage: 14, perfect: false });
    expect(hitCase(0, 0, 'unblockable').result).toEqual({ damage: 20, perfect: false });
  });
  it('derives all rank/tier mana rewards and drain, capping actual returns', () => {
    for (let nerve = 1; nerve <= 5; nerve++) {
      expect(drainPerSecond(nerve)).toBe(30 - 3 * nerve);
      for (let tier = 0; tier <= 4; tier++) {
        const expected = tier === 0 ? 4 : 10 * tier * (1 + 0.1 * nerve);
        expect(perfectReturn(tier, nerve)).toBeCloseTo(expected);
        expect(hitCase(0, 0, 'magic', tier, nerve).a.mana).toBeCloseTo(20 + expected);
      }
    }
    const { s, a } = hitCase(0, 0); a.mana = a.maxMana - 1;
    resolveHit(s, a, { ownerId: 99, activationId: 1, damage: 2, family: 'magic', tier: 4, source: { x: 11, y: 10 } });
    expect(a.mana).toBe(a.maxMana);
  });
  it('charges raise and drain, requires release time, and latches exhaustion', () => {
    const s = createArena(), a = addMage(s, 0, { x: 10, y: 10 }); const input = { ...idleInput(), absorb: true };
    stepArena(s, { [a.id]: input }); expect(a.mana).toBeCloseTo(a.maxMana - 5 - 27 * DT);
    stepArena(s, { [a.id]: idleInput() }); const released = s.tick;
    for (let i = 0; i < ticks(combat.absorb.minReleaseBeforeReRaiseS) - 1; i++) stepArena(s, { [a.id]: input });
    expect(a.absorb).toBe(false); stepArena(s, { [a.id]: input });
    expect(a.absorbFreshTick - released).toBe(ticks(combat.absorb.minReleaseBeforeReRaiseS));
    a.mana = 0; stepArena(s, { [a.id]: input }); expect(a.absorbExhausted).toBe(true);
    for (let i = 0; i < ticks(3); i++) stepArena(s, { [a.id]: input });
    expect(a.absorb).toBe(false); expect(a.mana).toBeGreaterThan(5);
  });
  it('holding a stream only perfects the first hit', () => {
    const { s, a } = hitCase(0, 0);
    for (let i = 1; i < runtime.training.streamCount; i++) {
      s.tick = i * ticks(runtime.training.streamIntervalS);
      resolveHit(s, a, { ownerId: 99, activationId: i, damage: 20, family: 'magic', tier: 1, source: { x: 11, y: 10 } });
    }
    expect(a.metrics.perfects).toBe(1); expect(a.metrics.blocks).toBe(2);
  });
});
describe('movement, actions and clock', () => {
  it('normalizes diagonals at instant acceleration, sprints with cost, and rolls four metres once per press', () => {
    const s = createArena(), a = addMage(s, 0, { x: 10, y: 10 });
    s.tuning = {...makeTuning(),accelerationMps2:0,decelerationMps2:0};
    for (let i = 0; i < ticks(1); i++) stepArena(s, { [a.id]: { ...idleInput(), move: { x: 1, y: 1 } } });
    expect(Math.hypot(a.pos.x - 10, a.pos.y - 10)).toBeCloseTo(combat.movement.walkMps);
    a.pos = { x: 10, y: 10 };
    for (let i = 0; i < ticks(1); i++) stepArena(s, { [a.id]: { ...idleInput(), move: { x: 1, y: 0 }, sprint: true } });
    expect(a.pos.x).toBeCloseTo(16.5); expect(a.stamina).toBeCloseTo(a.maxStamina - 15);
    a.pos = { x: 10, y: 10 }; const before = a.stamina;
    for (let i = 0; i < ticks(combat.roll.durationS); i++) stepArena(s, { [a.id]: { ...idleInput(), roll: true } });
    expect(a.pos.x).toBeCloseTo(14); expect(a.stamina).toBeCloseTo(before - combat.roll.staminaCost);
    expect(a.metrics.rolls).toBe(1);
  });
  it('roll immunity expires before movement recovery', () => {
    const s = createArena(), a = addMage(s, 0, { x: 10, y: 10 });
    stepArena(s, { [a.id]: { ...idleInput(), roll: true } });
    const hit = { ownerId: 99, activationId: 1, damage: 10, family: 'unblockable' as const, tier: 4, source: { x: 20, y: 10 } };
    expect(resolveHit(s, a, hit).damage).toBe(0);
    s.tick = a.immuneUntil; expect(resolveHit(s, a, hit).damage).toBe(10);
    expect(s.tick).toBeLessThan(a.rollUntil);
  });
  it('sweeps fast projectiles and consumes them after one hit', () => {
    const s = createArena(), a = addMage(s, 0, { x: 5, y: 10 }), b = addMage(s, 1, { x: 10, y: 10 });
    const c = addMage(s, 1, { x: 11, y: 10 });
    spawnProjectile(s, { ownerId: a.id, activationId: 1, damage: 6, family: 'magic', tier: 0, source: a.pos }, a.pos, { x: 1, y: 0 }, 600, 12);
    stepArena(s); expect(b.hp).toBe(b.maxHp - 6); expect(c.hp).toBe(c.maxHp); expect(s.projectiles).toHaveLength(0);
  });
  it('staff strike interrupts a charge before it resolves', () => {
    const t = createTraining('charge'); t.dummy.pos = { x: t.player.pos.x + 1, y: t.player.pos.y }; t.nextAttack = 1;
    for (let i = 0; i < ticks(0.9); i++) stepTraining(t, { ...idleInput(t.dummy.pos), cast: i === 0 });
    expect(t.state.events.some(e => e.kind === 'interrupt' && e.actorId === t.dummy.id)).toBe(true);
    expect(t.player.hp).toBe(t.player.maxHp); expect(t.state.telegraphs).toHaveLength(0);
  });
  it('advances collar with a minimum gap and resets all wave timing', () => {
    const s = createArena(), a = addMage(s, 0, { x: 10, y: 10 }); a.clockAdvanceTicks = ticks(100);
    for (let i = 0; i < ticks(18); i++) stepArena(s);
    expect(a.unlockTicks).toEqual([0, ticks(6), ticks(12), ticks(18)]);
    a.hp = 45; resetWave(s, a);
    expect(a.tier).toBe(1); expect(a.hp).toBe(60); expect(a.clockAdvanceTicks).toBe(0);
  });
});
describe('evidence and deterministic boundary', () => {
  it('replays 120 seconds with equal full state hashes every second', () => {
    function replay(seed: number) {
      const t = createTraining('flanker', seed); const hashes: string[] = [];
      for (let i = 0; i < ticks(120); i++) {
        stepTraining(t, { ...idleInput(t.dummy.pos), move: { x: 0, y: Math.sin(i / 60) }, cast: i % 5 === 0, absorb: i % 80 < 12, roll: i % 90 === 0 });
        if (i % 60 === 0) hashes.push(stateHash(t.state));
      }
      return hashes;
    }
    expect(replay(17)).toEqual(replay(17)); expect(replay(17)).not.toEqual(replay(18));
  });
  it('30 and 60 Hz render input produce identical fixed-step movement and drain', () => {
    function run(fps: number) {
      const s = createArena(), a = addMage(s, 0, { x: 10, y: 10 }), clock = new FixedStepper();
      for (let i = 0; i < fps; i++) clock.advance(1 / fps, () => stepArena(s, { [a.id]: { ...idleInput(), move: { x: 1, y: 0 }, absorb: true } }));
      return { pos: a.pos, mana: a.mana, tick: s.tick };
    }
    expect(run(30)).toEqual(run(60));
  });
  it('timing policies separate perfect, late, holder and never', () => {
    const perfect = runTimingBot('perfect', 30), late = runTimingBot('late', 30), holder = runTimingBot('holder', 30), never = runTimingBot('never', 30);
    expect(perfect.perfectRate).toBe(1); expect(late.perfects).toBe(0); expect(holder.perfects).toBe(0); expect(never.perfects).toBe(0);
    expect(perfect.manaReturned).toBeGreaterThan(0); expect(holder.manaDrained).toBeGreaterThan(perfect.manaDrained);
  });
  it('contains no ambient clock, unseeded random or DOM dependencies', () => {
    const files = readdirSync(new URL('.', import.meta.url)).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    for (const file of files) expect(readFileSync(new URL(file, import.meta.url), 'utf8')).not.toMatch(/Math\.random\s*\(|Date\.now\s*\(|performance\.now\s*\(|\bdocument\s*\.|\bwindow\s*\./);
  });
});
