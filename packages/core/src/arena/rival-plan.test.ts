import { describe, expect, it } from 'vitest';
import { enemyData } from './data.generated.ts';
import { attachMageAI, attachRivalPlan, bolt, competence, createGames, createLab, defaultLabConfig, distance, idleInput, mageInput, paceOf, presets, rivalPlanData, rivalPlanPresets, rivalSteer, runtime, stateHash, stepGames, stepLab, ticks } from './index.ts';
import type { Actor, ArenaState, InputFrame } from './types.ts';

const seeds = Array.from({ length: 100 }, (_, i) => 1000 + i), boutTicks = ticks(30);
const rival = (preset: string, plan: boolean, seed: number, distanceM: number, level = defaultLabConfig.competence) =>
  createLab({ ...defaultLabConfig, opponent: 'mage', rivalPreset: preset, rivalPlan: plan, competence: level, seed, distanceM });
/** Undertow against the reference brain (competence 2, which keeps 5-8 m): did the rival walk into 3 m and land a Lash? */
function undertowBout(seed: number, plan: boolean) {
  const lab = rival('Undertow', plan, seed, 10), { state, player, dummy } = lab.training; attachMageAI(player, runtime.games.referenceCompetence);
  let entered = false;
  for (let i = 0; i < boutTicks; i++) { stepLab(lab, mageInput(state, player), false); entered ||= distance(player.pos, dummy.pos) <= 3; }
  const lash = new Set(state.events.filter(e => e.kind === 'release' && e.actorId === dummy.id && e.spellId?.startsWith('lash:')).map(e => e.activationId));
  const landed = state.events.some(e => e.kind === 'hit' && e.actorId === player.id && lash.has(e.activationId) && (e.contactDamage ?? e.value) > 0);
  return { entered, landed, state, dummy };
}
/** A scripted needle stream: Rain Needle every 0.5 s, led on the rival's last step. */
const needle = (p: Actor, t: Actor, i: number): InputFrame => {
  const lead = distance(p.pos, t.pos) / bolt.speedMps * ticks(1);
  return { ...idleInput({ x: t.pos.x + (t.pos.x - t.previousPos.x) * lead, y: t.pos.y + (t.pos.y - t.previousPos.y) * lead }), cast: i % ticks(0.5) === 0 };
};
/** Mirror tide under the stream: a cycle is an enemy release the rival guarded or rolled, then a rival cast after that defence and within N ticks of the release. */
function mirrorBout(seed: number, plan: boolean, level = defaultLabConfig.competence) {
  const lab = rival('Mirror tide', plan, seed, 8, level), { state, player, dummy } = lab.training, N = ticks((rivalPlanData('Mirror tide') as { counterWindowS: number }).counterWindowS);
  for (let i = 0; i < boutTicks; i++) stepLab(lab, needle(player, dummy, i), false);
  const ev = state.events, casts = ev.filter(e => e.kind === 'cast' && e.actorId === dummy.id).map(e => e.tick), used = new Set<number>();
  let cycles = 0;
  for (const r of ev.filter(e => e.kind === 'release' && e.actorId === player.id)) {
    const defence = ev.find(e => e.kind === 'hit' && e.actorId === dummy.id && e.activationId === r.activationId && e.guarded)?.tick
      ?? ev.find(e => e.kind === 'roll' && e.actorId === dummy.id && e.tick >= r.tick && e.tick <= r.tick + N)?.tick;
    const cast = defence === undefined ? undefined : casts.find(t => t > defence && t <= r.tick + N && !used.has(t));
    if (cast !== undefined) { used.add(cast); cycles++; }
  }
  return { cycles, state, dummy };
}
/** Perfects the rival scored on a hit whose own perfect roll failed or was never drawn. */
const unearnedPerfects = (state: ArenaState, a: Actor): number => state.events.filter((e, k) => {
  if (e.kind !== 'perfect' || e.actorId !== a.id) return false;
  const hit = state.events.slice(k + 1).find(h => h.kind === 'hit' && h.actorId === a.id && h.tick === e.tick)!;
  const roll = state.randomLog.find(r => r.purpose === `mage ${a.id} perfect ${hit.activationId}`);
  return !roll || roll.value >= competence(a.mageAI!.competence).perfectChance;
}).length;

describe('rival plans (enemies.json mages.plans)', () => {
  it('are off unless enabled: Tiro flag false, Lab default plan-free, and a plan-free brain serializes exactly as before', () => {
    expect(runtime.games.rivalPlans).toBe(false);
    for (const wave of [2, 3]) {
      const g = createGames(40000, presets[2]!, wave, true);
      expect(g.state.actors[1]!.mageAI!.rival).toBeUndefined(); expect(JSON.stringify(g.state)).not.toContain('"rival"');
    }
    const run = (config: object) => { const lab = createLab({ ...defaultLabConfig, opponent: 'mage', ...config }); for (let i = 0; i < 600; i++) stepLab(lab, idleInput(), false); return stateHash(lab.training.state); };
    expect(run({ rivalPreset: 'Rotation', rivalPlan: false })).toBe(run({}));
    expect(run({ rivalPreset: 'Rotation', rivalPlan: true }), 'Rotation has no authored plan').toBe(run({}));
    expect(() => createLab({ ...defaultLabConfig, rivalPreset: 'Nope' })).toThrow();
  });

  it('reads engagement distances from the composition spell ranges', () => {
    const lab = rival('Mirror tide', true, 1, 8), { state, player, dummy } = lab.training;
    expect(rivalSteer(state, dummy, player, 8, 0).band).toEqual([6, 9]); // Bubble Shot 12 m
    dummy.tier = 4; expect(rivalSteer(state, dummy, player, 8, 0).band).toEqual([5, 7.5]); // Rain of Orbs 10 m
    const close = rivalPlanData('Undertow') as { engageFractionOfRange: number; commitLine: string };
    expect(close.commitLine).toBe('lash'); expect(close.engageFractionOfRange).toBeLessThan(1);
    expect(rivalPlanPresets).toEqual(runtime.games.opponentPresets);
  });

  it('Undertow voluntarily enters 3 m and lands Lash over 100 seeds only with its plan on', () => {
    const count = (plan: boolean) => seeds.reduce((n, seed) => { const b = undertowBout(seed, plan); return n + Number(b.entered && b.landed); }, 0);
    const off = count(false), on = count(true);
    expect(off).toBe(0);
    expect(on).toBe(70); // at the default difficulty (Normal); AI reaction at pace (W8 lane X: was 73)
  });

  it('Mirror tide completes defend-then-counter cycles under a Rain Needle stream only with its plan on (Lab competence 2)', () => {
    const off = seeds.reduce((n, seed) => n + mirrorBout(seed, false).cycles, 0), on = seeds.map(seed => mirrorBout(seed, true).cycles);
    expect(off).toBe(0);
    expect([on.reduce((a, b) => a + b, 0), on.filter(Boolean).length]).toEqual([145, 69]); // AI reaction at pace (W8 lane X: was 77, 58)
  });

  it('keeps the fairness rules with plans on: reaction floor, seeded draws logged, no perfect it did not roll', () => {
    for (const seed of seeds.slice(0, 20)) {
      for (const { state, dummy } of [undertowBout(seed, true), mirrorBout(seed, true), mirrorBout(seed, true, 4)]) {
        expect(Math.min(...dummy.mageAI!.reactionAges)).toBeGreaterThanOrEqual(ticks(enemyData.mages.caps.reactionDelayMinS / paceOf(dummy))); // authored floor at the mage's pace
        if (competence(dummy.mageAI!.competence).curve) expect(unearnedPerfects(state, dummy)).toBe(0);
        expect(state.randomLog.every(r => !r.purpose.includes('plan') || r.purpose === `mage ${dummy.id} plan approach`)).toBe(true);
      }
    }
    expect(undertowBout(1000, true).state.randomLog.some(r => r.purpose.endsWith('plan approach'))).toBe(true);
  });

  it("a planned rival's input at T is independent of the player's input at T+1", () => {
    const script = (tick: number, variant: number): InputFrame => ({ move: { x: Math.sin(tick / 25 + variant * 2), y: Math.cos(tick / 40) }, aim: { x: 30 + variant * 5, y: 10 + variant * 4 },
      slot: (tick + variant) % 4, cast: (tick + variant) % 13 === 0, absorb: variant === 1 || tick % 50 < 8, roll: variant === 1 && tick % 20 === 0, sprint: false });
    for (const wave of [2, 3]) for (const k of [40, 120, 300]) {
      const run = (variant: number) => {
        const g = createGames(40000, presets[2]!, wave), opponent = g.state.actors[1]!; attachMageAI(opponent, 4); expect(attachRivalPlan(opponent)).toBe(true);
        for (let t = 1; t <= k && g.phase === 'active'; t++) stepGames(g, script(t, t === k ? variant : 0));
        expect(g.phase).toBe('active');
        return { input: JSON.stringify(opponent.lastInput), brain: JSON.stringify(opponent.mageAI), hash: stateHash(g.state) };
      };
      const x = run(0), y = run(1);
      expect(y.input, `wave ${wave} step ${k}`).toBe(x.input); expect(y.brain).toBe(x.brain); expect(y.hash).not.toBe(x.hash);
    }
  });
});
