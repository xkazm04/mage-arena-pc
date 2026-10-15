import { describe, expect, it } from 'vitest';
import { answers, combat, createLedger, createTraining, distance, gradeContact, idleInput, observeLedger, reviveActor, runFight, runTimingBot, runtime, spellFor, stateHash, stepTraining, sub, ticks, timingBot, unit,
  type InputFrame, type Training, type TrainingKind } from './index.ts';

const windowTicks = ticks(combat.absorb.perfect.windowS);
function lesson(kind: TrainingKind, policy: (t: Training) => InputFrame, durationS = 30) {
  const t = createTraining(kind), ledger = createLedger(t.state, t.player.id);
  for (let i = 0; i < ticks(durationS); i++) {
    stepTraining(t, policy(t)); observeLedger(ledger, t.state);
    if (t.player.tags.includes('DEFEATED')) { reviveActor(t.state, t.player); t.player.hp = t.player.maxHp; }
  }
  return { t, ledger, contacts: ledger.entries.filter(e => e.answer !== 'avoided') };
}
/** Ticks until the nearest hostile projectile of a family reaches the player, as the W2 timing bot measures it. */
function impact(t: Training, family: string) {
  return t.state.projectiles.filter(p => p.ownerId !== t.player.id && p.family === family).map(p => {
    const toward = unit(sub(t.player.pos, p.pos)), speed = p.velocity.x * toward.x + p.velocity.y * toward.y;
    return { p, inTicks: speed > 0 ? Math.max(1, Math.ceil((distance(p.pos, t.player.pos) - p.radius - t.player.radius) / (speed / combat.simStepHz) - 1e-9)) : Infinity };
  }).sort((a, b) => a.inTicks - b.inTicks)[0];
}

describe('gradeContact', () => {
  const facts = { family: 'magic' as const, wardUp: true, inArc: true, ageTicks: 3, windowTicks, absorbHeld: true, castBlocked: false };
  it('applies the kernel window and names each mistake', () => {
    expect(gradeContact({ ...facts, ageTicks: windowTicks })).toMatchObject({ answer: 'perfect', guarded: true });
    expect(gradeContact({ ...facts, ageTicks: windowTicks + 2 })).toMatchObject({ answer: 'held', lateTicks: 2, mistake: 'late' });
    expect(gradeContact({ ...facts, inArc: false })).toMatchObject({ answer: 'wrong-facing', mistake: 'behind' });
    expect(gradeContact({ ...facts, family: 'physical' })).toMatchObject({ answer: 'guarded', mistake: 'steel' });
    expect(gradeContact({ ...facts, family: 'unblockable' })).toMatchObject({ answer: 'took', wardUp: true, mistake: 'leave' });
    expect(gradeContact({ ...facts, wardUp: false, castBlocked: true })).toMatchObject({ answer: 'cast-blocked', mistake: 'cast' });
    expect(gradeContact({ ...facts, wardUp: false, absorbHeld: false })).toEqual({ family: 'magic', answer: 'took', wardUp: false, inArc: true, guarded: false, absorbHeld: false });
    expect(gradeContact({ ...facts, immune: 'roll' })).toMatchObject({ answer: 'rolled' });
    expect(gradeContact({ ...facts, ageTicks: Number.NaN })).toMatchObject({ answer: 'unclassified' });
  });
});

describe('threat-answer ledger', () => {
  it('grades every W2 timing-bot contact by the kernel window, matching the bot counts and hashes exactly', () => {
    // docs/waves/W2-evidence/bots.json predates the current kernel (its hashes no longer replay), so the live bot is the oracle.
    for (const lead of runtime.training.windowSweepTicks) {
      const { t, ledger, contacts } = lesson('magic', t => timingBot(t, 'perfect', lead), runtime.training.reportDurationS);
      const bot = runTimingBot('perfect', runtime.training.reportDurationS, lead);
      expect(stateHash(t.state)).toBe(bot.hash); expect(contacts).toHaveLength(bot.hits);
      expect(ledger.counts.magic.perfect).toBe(bot.perfects); expect(ledger.counts.magic.held).toBe(bot.blocks); expect(ledger.counts.magic.unclassified).toBe(0);
      for (const c of contacts) {
        expect([lead, lead + 1]).toContain(c.ageTicks);
        expect(c.ageTicks! <= windowTicks ? { answer: c.answer } : { answer: c.answer, lateTicks: c.lateTicks }).toEqual(c.ageTicks! <= windowTicks ? { answer: 'perfect' } : { answer: 'held', lateTicks: c.ageTicks! - windowTicks });
      }
      // The ward rises the tick the bot asks and the paced bog glob lands on the bot's estimate: a lead of n ages n
      // (at the authored 1x the estimate sat on a float boundary, 10.5 m / 0.15 m per tick, and aged n + 1).
      if (lead < windowTicks) expect(ledger.ages).toEqual({ [lead]: bot.hits });
      if (lead > windowTicks) expect(contacts.every(c => c.answer === 'held' && [lead - windowTicks, lead - windowTicks + 1].includes(c.lateTicks!))).toBe(true);
    }
  });
  it('magic lesson: on time is perfect, never warding is took', () => {
    expect(lesson('magic', t => timingBot(t, 'perfect')).contacts.every(c => c.answer === 'perfect')).toBe(true);
    const never = lesson('magic', t => timingBot(t, 'never')).contacts;
    expect(never.length).toBeGreaterThan(5); expect(never.every(c => c.answer === 'took' && !c.wardUp && !c.mistake)).toBe(true);
  });
  it('physical lesson: a roll into steel is rolled, a ward against steel is guarded (steel)', () => {
    const roll = lesson('physical', t => { const i = idleInput(t.dummy.pos), next = impact(t, 'physical');
      if (next && next.inTicks <= 2 && !t.player.lastInput.roll) { i.roll = true; i.move = unit(sub(next.p.pos, t.player.pos)); } return i; });
    expect(roll.contacts.length).toBeGreaterThan(5); expect(roll.contacts.every(c => c.answer === 'rolled' && c.family === 'physical')).toBe(true);
    const ward = lesson('physical', t => ({ ...idleInput(t.dummy.pos), absorb: (impact(t, 'physical')?.inTicks ?? Infinity) <= 20 }));
    expect(ward.contacts.length).toBeGreaterThan(5); expect(ward.contacts.every(c => c.answer === 'guarded' && c.mistake === 'steel')).toBe(true);
  });
  it('flanker lesson: tracking the shot is perfect, a ward left facing front is wrong-facing (behind)', () => {
    expect(lesson('flanker', t => timingBot(t, 'perfect')).contacts.every(c => c.answer === 'perfect')).toBe(true);
    const fixed = lesson('flanker', t => ({ ...timingBot(t, 'perfect'), aim: { ...runtime.training.front } })).contacts;
    expect(fixed.filter(c => c.answer === 'perfect').length).toBeGreaterThan(2);
    expect(fixed.filter(c => c.answer === 'wrong-facing' && c.mistake === 'behind').length).toBeGreaterThan(2);
    expect(fixed.every(c => c.answer === 'perfect' || c.answer === 'wrong-facing')).toBe(true);
  });
  it('charge lesson: warding an unblockable is took (leave); rolling is rolled; stepping out is avoided', () => {
    const lane = (t: Training) => t.state.telegraphs.find(x => x.family === 'unblockable');
    const ward = lesson('charge', t => ({ ...idleInput(t.dummy.pos), absorb: !!lane(t) && lane(t)!.resolveTick - t.state.tick <= 10 })).contacts;
    expect(ward.length).toBeGreaterThan(5); expect(ward.every(c => c.answer === 'took' && c.wardUp && c.mistake === 'leave')).toBe(true);
    const roll = lesson('charge', t => ({ ...idleInput(t.dummy.pos), ...(lane(t) && lane(t)!.resolveTick - t.state.tick === 2 ? { move: { x: 0, y: t.attacks % 2 ? 1 : -1 }, roll: true } : {}) })).contacts;
    expect(roll.length).toBeGreaterThan(5); expect(roll.every(c => c.answer === 'rolled')).toBe(true);
    const step = lesson('charge', t => ({ ...idleInput(t.dummy.pos), move: { x: 0, y: lane(t) ? (t.attacks % 2 ? 1 : -1) : 0 } }), 10);
    expect(step.contacts).toHaveLength(0); expect(step.ledger.counts.unblockable.avoided).toBeGreaterThan(1);
  });
  it('stream lesson: holding through the stream is perfect once, then held late', () => {
    const { contacts } = lesson('stream', t => ({ ...timingBot(t, 'perfect'), absorb: timingBot(t, 'perfect').absorb || t.player.absorb }), 10);
    expect(contacts[0]!.answer).toBe('perfect');
    expect(contacts.slice(1, runtime.training.streamCount).every(c => c.answer === 'held' && c.mistake === 'late' && c.lateTicks === c.ageTicks! - windowTicks)).toBe(true);
  });
  it('a ward wanted during a cast windup is cast-blocked', () => {
    let slot = -1;
    const { contacts, ledger } = lesson('magic', t => {
      slot = slot >= 0 ? slot : [1, 2, 3].find(s => Math.max(spellFor(t.player, s, t.state)?.castS ?? 0, spellFor(t.player, s, t.state)?.telegraphS ?? 0) >= 0.3) ?? 0;
      const next = impact(t, 'magic'), i = idleInput(t.dummy.pos);
      if (next && next.inTicks === 15) { i.cast = true; i.slot = slot; }
      i.absorb = !!next && next.inTicks <= 6; return i;
    }, 10);
    // Mire's cooldown skips some casts; those contacts meet a fresh ward and stay perfect.
    expect(ledger.counts.magic['cast-blocked']).toBeGreaterThan(1); expect(contacts.every(c => c.answer === 'cast-blocked' ? !c.wardUp && c.absorbHeld && c.mistake === 'cast' : c.answer === 'perfect')).toBe(true);
  });
  it('observes without touching the simulation: census fights hash the same with answers attached', () => {
    const fight = runFight(40000, 2);
    expect(fight.hash).toBe(runFight(40000, 2).hash);
    expect(Object.keys(fight.answers.magic)).toEqual([...answers]);
    expect(fight.answers.magic.perfect).toBe(fight.perfects);
  });
});
