import { enemyData } from './data.generated.ts';
import { spellFor } from './catalog.ts';
import { combat, random, ticks } from './kernel.ts';
import { distance, sub, unit, type Vec } from './math.ts';
import type { Actor, ArenaState, InputFrame, WaterLine } from './types.ts';
import type { Threat } from './mage-ai.ts';
// Rival plans (enemies.json mages.plans): opt-in tactics layered on the competence policy in mage-ai.ts.
// A plan only reads what has already happened (events at least the reaction delay old) and the target's visible ward.
interface ClosePlan { style: 'close'; commitLine: WaterLine; engageFractionOfRange: number; armFractionOfRange: number; openingWeights: { release: number; roll: number; wardDown: number }; openingWindowS: number; approachMaxS: number; approachSprint: boolean; withdrawS: number; rearmS: number }
interface RangedPlan { style: 'ranged'; holdFractionOfRange: readonly [number, number]; wardReserveFraction: number; lowValueDamage: number; streamWindowS: number; counterWindowS: number }
const planData = enemyData.mages.plans as unknown as Record<string, ClosePlan | RangedPlan | string | number>, margin = enemyData.mages.plans.deniedPerfectMarginS;
export const rivalPlanPresets: string[] = Object.keys(planData).filter(k => typeof planData[k] === 'object');
export const rivalPlanData = (preset: string): ClosePlan | RangedPlan | undefined => { const p = planData[preset]; return typeof p === 'object' ? p : undefined; };
/** Opts a mage brain into its preset's plan. A preset without a plan stays plan-free and serializes as before. */
export function attachRivalPlan(a: Actor): boolean {
  if (!a.mageAI || !rivalPlanData(a.water.composition.name)) return false;
  a.mageAI.rival = { preset: a.water.composition.name, phase: 'hold', until: 0, rearmTick: 0, seenRelease: -1e9, prevRelease: -1e9, flight: 0, counterUntil: -1, armed: false, counterTick: -1, wardFrom: -1 };
  return true;
}
/** Ranged ward budget: below the mana reserve a low-value threat is taken instead of warded. */
export function rivalSkipsWard(a: Actor, damage: number): boolean {
  const data = rivalPlanData(a.mageAI!.rival!.preset)!;
  return data.style === 'ranged' && a.mana < data.wardReserveFraction * a.maxMana && damage < data.lowValueDamage;
}
/** Per-tick plan bookkeeping; may pull the next decision forward (own phase change, or a counter after a seen release) or hold a stream ward. */
export function rivalTick(state: ArenaState, a: Actor, target: Actor | undefined, seen: Threat[], window: number, reactionTicks: number, reRaiseGap = ticks(combat.absorb.minReleaseBeforeReRaiseS)): void {
  const brain = a.mageAI!, plan = brain.rival!, data = rivalPlanData(plan.preset)!;
  if (data.style === 'close') {
    // The committed line is cast and released (its cooldown runs) or the approach timed out: back off through the recovery.
    if (plan.phase === 'approach' && ((!a.pending && (a.water.cooldowns[data.commitLine] ?? 0) > state.tick) || state.tick >= plan.until)) {
      plan.phase = 'withdraw'; plan.until = state.tick + ticks(data.withdrawS); brain.nextDecisionTick = Math.min(brain.nextDecisionTick, state.tick);
    } else if (plan.phase === 'withdraw' && state.tick >= plan.until) { plan.phase = 'hold'; plan.rearmTick = state.tick + ticks(data.rearmS); }
    return;
  }
  const newest = state.tick - reactionTicks;
  for (let i = state.events.length - 1; i >= 0 && state.events[i]!.tick > plan.seenRelease; i--) {
    const e = state.events[i]!;
    if (e.tick > newest || e.kind !== 'release' || state.actors.find(o => o.id === e.actorId)?.team === a.team) continue;
    plan.prevRelease = plan.seenRelease; plan.seenRelease = e.tick; plan.counterUntil = e.tick + ticks(data.counterWindowS); plan.armed = true;
    // The stream's flight time, from the seen shot: still flying at us, or already landed on us.
    const shot = seen.find(t => t.id === e.activationId && t.aimedAtUs), landed = shot ? undefined : state.events.slice(i).find(h => h.kind === 'hit' && h.actorId === a.id && h.activationId === e.activationId);
    if (shot) plan.flight = shot.impactTick - e.tick;
    else if (landed) plan.flight = landed.tick - e.tick;
    break;
  }
  if (plan.armed && state.tick > plan.counterUntil) plan.armed = false;
  const planned = state.tick + 1 <= brain.plannedReleaseTick && brain.plannedRaiseTick <= brain.plannedReleaseTick;
  const fresh = a.absorb ? a.absorbFreshTick : state.tick + 1, gift = (from: number) => seen.some(t => t.aimedAtUs && t.impactTick > state.tick && t.impactTick <= from + window + ticks(margin));
  if (plan.wardFrom >= 0 && planned) {
    // The stream ward drops once it has guarded a hit (the counter follows), or while it is (or would come up) fresh for a seen impact:
    // the kernel can delay a raise, and a stream ward must never hand out a perfect its roll did not.
    let guarded = false;
    for (let i = state.events.length - 1; i >= 0 && state.events[i]!.tick >= plan.wardFrom && !guarded; i--) { const e = state.events[i]!; guarded = e.kind === 'hit' && e.actorId === a.id && !!e.guarded; }
    if (guarded || gift(fresh)) { brain.plannedReleaseTick = state.tick; plan.wardFrom = -1; }
  } else if (plan.wardFrom >= 0) plan.wardFrom = -1;
  else {
    // A seen stream (two releases inside streamWindowS) whose shots land before the reaction delay is warded ahead of its next expected
    // shot on the seen rhythm and flight, raised old enough that the shot lands outside the perfect window, and never fresh into a visible
    // impact: no perfect without its roll. A stream it can react to is left to the competence policy.
    const period = plan.seenRelease - plan.prevRelease, stream = ticks(data.streamWindowS);
    if (target && plan.flight > 0 && plan.flight <= reactionTicks && period > 0 && period <= stream) {
      let impact = plan.seenRelease + period + plan.flight; while (impact <= state.tick + 1 + window) impact += period;
      if (impact - plan.seenRelease - plan.flight <= stream && state.tick + 1 >= impact - window - reRaiseGap - 1 && !a.pending && state.tick >= a.rollUntil
        && a.mana >= data.wardReserveFraction * a.maxMana && !gift(state.tick + 1)) {
        brain.plan = undefined; brain.plannedRaiseTick = state.tick + 1; brain.plannedReleaseTick = impact + window; brain.targetPoint = { ...target.pos }; plan.wardFrom = state.tick + 1;
      }
    }
  }
  const warding = a.absorb || (state.tick + 1 >= brain.plannedRaiseTick && state.tick + 1 <= brain.plannedReleaseTick);
  if (plan.armed && !warding && !a.pending && state.tick >= a.rollUntil && state.tick >= brain.defendUntil && state.tick - (brain.decisionTicks.at(-1) ?? -1e9) >= reactionTicks) {
    plan.armed = false; plan.counterTick = state.tick; brain.nextDecisionTick = Math.min(brain.nextDecisionTick, state.tick);
  }
}
/** Per-tick gate. A curve row's denied-perfect raise keeps a margin over the live impact (plan movement makes impact estimates drift),
 * the committed press waits for reach, and the chase pauses while a ward is planned or up. */
export function rivalGate(state: ArenaState, a: Actor, target: Actor | undefined, result: InputFrame, seen: Threat[], window: number, curve: boolean): void {
  const brain = a.mageAI!, plan = brain.rival!, data = rivalPlanData(plan.preset)!;
  const live = curve && brain.plan && !brain.plan.perfect && result.absorb && !a.absorb ? seen.find(t => t.id === brain.plan!.threatId) : undefined;
  if (live && live.impactTick - (state.tick + 1) <= window + ticks(margin)) { result.absorb = false; brain.plannedRaiseTick = 1e9; brain.plan = undefined; }
  if (!target || data.style !== 'close' || plan.phase !== 'approach') return;
  if (result.cast && a.water.composition.lines.indexOf(data.commitLine) + 1 === result.slot) result.cast = distance(a.pos, target.pos) <= spellFor(a, result.slot, state)!.rangeM * data.engageFractionOfRange;
  if (state.tick + 1 <= brain.plannedReleaseTick && brain.plannedRaiseTick <= brain.plannedReleaseTick) { result.move = { x: 0, y: 0 }; result.sprint = false; }
}
export interface RivalSteer { band?: [number, number]; move?: Vec; sprint?: boolean; chase?: boolean; slot?: number; cast?: boolean; counter?: boolean }
/** Decision-time steering: spacing band or movement, a committed slot, or a counter flag. Empty means the competence policy decides. */
export function rivalSteer(state: ArenaState, a: Actor, target: Actor, d: number, reactionTicks: number): RivalSteer {
  const plan = a.mageAI!.rival!, data = rivalPlanData(plan.preset)!;
  if (data.style === 'ranged') {
    const reach = Math.max(0, ...a.water.composition.lines.map((_, i) => spellFor(a, i + 1, state)!).filter(s => s.damage > 0).map(s => s.rangeM));
    return { ...(reach > 0 ? { band: [reach * data.holdFractionOfRange[0], reach * data.holdFractionOfRange[1]] as [number, number] } : {}), counter: plan.counterTick === state.tick };
  }
  const slot = a.water.composition.lines.indexOf(data.commitLine) + 1, s = slot ? spellFor(a, slot, state) : undefined;
  if (!s) return {};
  const ready = (a.water.cooldowns[s.line] ?? 0) <= state.tick && (a.water.flow >= combat.flow.max || s.mana <= a.mana);
  if (plan.phase === 'hold' && ready && state.tick >= plan.rearmTick) {
    const newest = state.tick - reactionTicks, oldest = newest - ticks(data.openingWindowS); let release = false, roll = false;
    for (let i = state.events.length - 1; i >= 0 && state.events[i]!.tick >= oldest; i--) {
      const e = state.events[i]!; if (e.tick > newest || e.actorId !== target.id) continue;
      release ||= e.kind === 'release'; roll ||= e.kind === 'roll';
    }
    const w = data.openingWeights, weight = (release ? w.release : 0) + (roll ? w.roll : 0) + (target.absorb ? 0 : w.wardDown);
    if (weight > 0 && random(state, `mage ${a.id} plan approach`) < weight) { plan.phase = 'approach'; plan.until = state.tick + ticks(data.approachMaxS); }
  }
  const toward = unit(sub(target.pos, a.pos));
  // On the way in it fights as usual; near reach the commit is decided here and rivalGate holds the press until the target is in reach.
  if (plan.phase === 'approach') return { move: toward, chase: true, sprint: data.approachSprint, ...(ready && d <= s.rangeM * data.armFractionOfRange ? { slot, cast: true } : {}) };
  if (plan.phase === 'withdraw') return { move: { x: -toward.x, y: -toward.y } };
  return {};
}
