import { describe, expect, it } from 'vitest';
import { enemyData } from './data.generated.ts';
import { addMage, attachMageAI, competence, createArena, createGames, mageInput, newWaterState, paceOf, presets, runtime, spellFor, stateHash, stepArena, stepGames, ticks, tuningFor } from './index.ts';
import type { InputFrame } from './types.ts';

describe('tier curve play (usesTierCurve rows 3-4)', () => {
  it('selects the curve row by floor(level); rows below 3 keep the old policy', () => {
    expect([1, 1.5, 2, 2.5, 2.99, 3, 3.5, 4].map(l => competence(l).curve)).toEqual([false, false, false, false, false, true, true, true]);
    expect(enemyData.mages.competence.map(r => r.usesTierCurve)).toHaveLength(4);
    const base = runtime.games.mageAimLeadFraction;
    expect([1, 1.5, 2, 2.5, 3, 3.5, 4].map(l => competence(l).aimLeadFraction)).toEqual([base, base, base, base, 0.6, 0.6, 0.75]);
  });

  it('an L4 mage casts on the tick its ward drops', () => {
    let drops = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const state = createArena(seed), a = addMage(state, 0, { x: 10, y: 10 }), b = addMage(state, 1, { x: 17, y: 10 });
      attachMageAI(a, 4);
      // A pending bolt is a threat aimed at the mage however it strafes; the ward plan follows its live impact tick.
      b.pending = { kind: 'bolt', startTick: 0, releaseTick: ticks(1 + seed / 20), aim: { ...a.pos }, activationId: 900 };
      for (let i = 0; i < ticks(3); i++) {
        const before = a.absorb; stepArena(state, { [a.id]: mageInput(state, a) });
        if (before && !a.absorb && !a.absorbExhausted) {
          drops++; expect(state.events.some(e => e.kind === 'cast' && e.actorId === a.id && e.tick === state.tick) || a.pending?.startTick === state.tick, `seed ${seed} tick ${state.tick}`).toBe(true);
          break;
        }
      }
    }
    expect(drops).toBeGreaterThan(5);
  });

  it("an L4 mage's input at T is independent of the player's input at T+1", () => {
    const script = (tick: number, variant: number): InputFrame => ({ move: { x: Math.sin(tick / 25 + variant * 2), y: Math.cos(tick / 40) }, aim: { x: 30 + variant * 5, y: 10 + variant * 4 },
      slot: (tick + variant) % 4, cast: (tick + variant) % 13 === 0, absorb: variant === 1 || tick % 50 < 8, roll: variant === 1 && tick % 20 === 0, sprint: false });
    for (const k of [40, 120, 300, 600]) {
      const run = (variant: number) => {
        const g = createGames(40000, presets.find(p => p.name === runtime.games.referencePreset)!, 2), opponent = g.state.actors[1]!; attachMageAI(opponent, 4);
        for (let t = 1; t <= k && g.phase === 'active'; t++) stepGames(g, script(t, t === k ? variant : 0));
        const atK = { input: JSON.stringify(opponent.lastInput), brain: JSON.stringify(opponent.mageAI), hash: stateHash(g.state) };
        for (let t = k + 1; t <= k + 120 && g.phase === 'active'; t++) stepGames(g, script(t, variant));
        return { ...atK, later: stateHash(g.state) };
      };
      const x = run(0), y = run(1);
      expect(y.input, `AI input at step ${k}`).toBe(x.input); expect(y.brain, `AI brain at step ${k}`).toBe(x.brain);
      expect(y.hash, 'the perturbed player input must change the simulation').not.toBe(x.hash); expect(y.later).not.toBe(x.later);
    }
  });

  it('100-seed ladder: reference wins fall strictly from L2 to L4, no failed roll becomes a perfect, reactions respect the floor', () => {
    const wins: number[] = [];
    for (const level of [2, 3, 4]) {
      const chance = competence(level).perfectChance; let won = 0, failedRollPerfects = 0;
      for (let i = 0; i < 100; i++) {
        const g = createGames(runtime.games.censusSeedStart + i, presets.find(p => p.name === runtime.games.referencePreset)!, 2, true), opponent = g.state.actors[1]!;
        attachMageAI(opponent, level);
        while (g.phase === 'active' && g.state.tick < ticks(runtime.games.fightTimeoutS)) stepGames(g);
        if (g.phase !== 'active' && g.phase !== 'lost') won++;
        const events = g.state.events;
        events.forEach((e, k) => {
          if (e.kind !== 'perfect' || e.actorId !== opponent.id) return;
          const hit = events.slice(k + 1).find(h => h.kind === 'hit' && h.actorId === opponent.id && h.tick === e.tick)!;
          const roll = g.state.randomLog.find(r => r.purpose === `mage ${opponent.id} perfect ${hit.activationId}`);
          if (roll && roll.value >= chance) failedRollPerfects++;
        });
        // The floor is authored seconds at the mage's own pace (W8 lane X).
        expect(Math.min(...opponent.mageAI!.reactionAges)).toBeGreaterThanOrEqual(ticks(enemyData.mages.caps.reactionDelayMinS / paceOf(opponent)));
      }
      if (competence(level).curve) expect(failedRollPerfects, `L${level}`).toBe(0);
      wins.push(won);
    }
    expect(wins).toEqual([52, 16, 7]); // at the default difficulty (Normal), pace 1.5 on both sides; AI reaction at pace (W8 lane X: was 45, 16, 6)
    expect(wins[0]! > wins[1]! && wins[1]! > wins[2]! && wins[2]! > 0).toBe(true);
  }, 120_000); // ~25 s of fights alone; the 30 s default flakes when the machine is busy

  it('baits with absorbable casts and punishes a raised or fresh ward with an unblockable', () => {
    const pick = (absorb: boolean, freshAgoS: number) => {
      const state = createArena(5), a = addMage(state, 0, { x: 10, y: 10 }), target = addMage(state, 1, { x: 16, y: 10 });
      a.water = newWaterState(presets.find(p => p.name === 'Undertow')!); a.tier = 4; attachMageAI(a, 4);
      state.tick = ticks(5); target.absorb = absorb; target.absorbFreshTick = state.tick - ticks(freshAgoS);
      return spellFor(a, mageInput(state, a).slot, state)!;
    };
    expect(tuningFor(createArena()).absorbWindowS).toBeGreaterThan(0);
    expect(pick(true, 1).family).toBe('unblockable');
    expect(pick(false, competence(4).decisionCadenceS / 2).family).toBe('unblockable');
    expect(pick(false, 2).family).not.toBe('unblockable');
  });
});
