// Plan-branch ledger (challenge 2026-10-25): archetypes.ts names the branch behind every archetype pick or withhold, and a census
// (or a test) that enabled the trace on a state counts them per actor. Measurement only: the trace sits in a WeakMap keyed by the
// state (the rival-phases.ts pattern), so stateHash never reads it and an untraced state pays one WeakMap miss per decision.
import type { ArenaState } from './types.ts';

/** Every branch archetypeChoose returns from (`<archetype>:<step>`, or the shared answer / signature steps). */
export type PlanBranch =
  | 'answer:incoming' | 'answer:pressed' | 'signature'
  | 'close:dash-in' | 'close:payoff' | 'close:hit' | 'close:dash-build' | 'close:build' | 'close:spend' | 'close:bolt' | 'close:idle'
  | 'light:dash-out' | 'light:dash-build' | 'light:build' | 'light:alternate' | 'light:bolt' | 'light:idle'
  | 'heavy:dash-out' | 'heavy:payoff' | 'heavy:build' | 'heavy:bolt' | 'heavy:waiting' | 'heavy:reserve' | 'heavy:idle';
/** The branches where the plan withheld (returned no pick): waiting for its payoff tier, keeping its payoff's mana, or nothing legal. */
export const withheldBranches: ReadonlySet<PlanBranch> = new Set<PlanBranch>(['close:idle', 'light:idle', 'heavy:waiting', 'heavy:reserve', 'heavy:idle']);

export type PlanCounts = Partial<Record<PlanBranch, number>>;
const traces = new WeakMap<ArenaState, Map<number, PlanCounts>>();

/** Start counting plan branches on this state (idempotent). */
export function enablePlanTrace(state: ArenaState): void {
  if (!traces.has(state)) traces.set(state, new Map());
}
/** Branch counts per actor id; undefined when the trace is not enabled on this state. */
export const planTrace = (state: ArenaState): ReadonlyMap<number, Readonly<PlanCounts>> | undefined => traces.get(state);
/** Count one decision of `actorId` on `branch` (a no-op on an untraced state). */
export function notePlan(state: ArenaState, actorId: number, branch: PlanBranch): void {
  const trace = traces.get(state); if (!trace) return;
  const counts = trace.get(actorId) ?? {}; counts[branch] = (counts[branch] ?? 0) + 1; trace.set(actorId, counts);
}
