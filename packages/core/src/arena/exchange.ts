// Exchange windows (D1 4.1 option A, docs/concepts/D1-combat-followup-and-progression.md): a clean close hit grants the
// defender a short punish window. Its ward re-raises at once against that attacker: for guardS it takes the attacker's next
// guardHits close blows (each lands guarded, guardReduction of it stopped, the way a held ward stops a blow). A run of blows stops
// paying in full after the first, so trades alternate instead of stacking. (D1's other punish, a faster next cast, was
// measured and left out: it favoured the slow-casting rival builds; D1 section 6.) Rule state only (`Actor.exchange`), read on the
// existing hit path: no new event kind; the window's guard shows as the `guarded` flag of the hit it blocks.
// Gate: the numbers live in the PC overlay (school-balance.pc.json `exchange`); a state that runs balance 'canonical'
// (CR-002/CR-007 parity) ignores them, and a window opens only in a contact a Fire/Air actor takes part in, so Water-only
// states (goldens, the default census digests) never carry the key and step exactly as before.
// D1 6.10 (a reading, off by default): `setExchangeReach` lets the window's reach grow with the defender's gained spell ranks; a
// state without one plays closeRangeM exactly as before.
// Imports stay leaf-ward (data, types) so kernel.ts can read it.
import balance from './data/school-balance.pc.json' with { type: 'json' };
import { combat } from './data.generated.ts';
import type { Actor, ArenaState, Family } from './types.ts';

export interface ExchangeRule {
  /** Owner-to-target distance at contact that makes a hit a close hit (metres). */
  closeRangeM: number;
  /** How long the defender's ward stays up against the attacker after a clean close hit (seconds), how many of the attacker's
   * blows it takes in that time, and the share of each it stops (unblockable blows pass). */
  guardS: number; guardHits: number; guardReduction: number;
}
const ruleKeys = ['closeRangeM', 'guardS', 'guardHits', 'guardReduction'] as const;
/** Problems with an `exchange` block: exactly the rule's keys, each a finite number in range. Absent is valid (no windows). */
export function exchangeProblems(candidate: unknown): string[] {
  if (candidate === undefined) return [];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return ['school-balance.pc.json exchange: not an object'];
  const have = Object.keys(candidate), value = candidate as Record<string, unknown>;
  const out = [...have.filter(k => !(ruleKeys as readonly string[]).includes(k)).map(k => `school-balance.pc.json exchange: unknown key ${k}`),
    ...ruleKeys.filter(k => !have.includes(k)).map(k => `school-balance.pc.json exchange: missing ${k}`)];
  const n = (k: typeof ruleKeys[number]): number => typeof value[k] === 'number' && Number.isFinite(value[k]) ? value[k] : NaN;
  if (!(n('closeRangeM') > 0)) out.push('school-balance.pc.json exchange.closeRangeM must be above 0');
  if (!(n('guardS') > 0 && n('guardS') <= 10)) out.push('school-balance.pc.json exchange.guardS must be in (0, 10] s');
  if (!(Number.isInteger(n('guardHits')) && n('guardHits') >= 1 && n('guardHits') <= 10)) out.push('school-balance.pc.json exchange.guardHits must be an integer 1..10');
  if (!(n('guardReduction') >= 0 && n('guardReduction') <= 1)) out.push('school-balance.pc.json exchange.guardReduction must be 0..1');
  return out;
}
const loaded = (balance as { exchange?: unknown }).exchange;
const loadErrors = exchangeProblems(loaded);
if (loadErrors.length) throw Error(loadErrors.join(' '));
/** The overlay's rule, one shared object (tests plant numbers on it, the census switches it off with `exchangeOff`). */
export const exchangeRule: Partial<ExchangeRule> = { ...(loaded as ExchangeRule | undefined) };
const rule = (state: ArenaState): ExchangeRule | undefined =>
  state.balance !== 'canonical' && exchangeRule.closeRangeM !== undefined ? exchangeRule as ExchangeRule : undefined;
/** Run `body` with the rule switched off (the census's before arm; nothing else changes). */
export function exchangeOff<T>(body: () => T): T {
  const saved = { ...exchangeRule };
  for (const k of ruleKeys) delete exchangeRule[k];
  try { return body(); } finally { Object.assign(exchangeRule, saved); }
}

/** The rank-scaled reach (D1 6.10 lever, a reading only): per state, the metres the window's reach grows per rank step a defender
 * has gained (games.ts records each mage's steps at spawn: progression.ts rankSteps above its authored build), so a ranked
 * defender's window opens on and guards blows from further out. Kept outside the hashed state like the arena hooks; set only by
 * the createGames `exchangeReach` option. */
export interface ExchangeReach { perRankStepM: number }
const reachByState = new WeakMap<ArenaState, { perRankStepM: number; steps: Map<number, number> }>();
/** Problems with an `exchangeReach` option: exactly `perRankStepM`, a finite number in (0, 5] m. */
export function exchangeReachProblems(candidate: unknown): string[] {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return ['Exchange reach is not an object.'];
  const c = candidate as Record<string, unknown>;
  return [...Object.keys(c).filter(k => k !== 'perRankStepM').map(k => `Exchange reach: unknown key ${k}.`),
    ...(typeof c.perRankStepM === 'number' && c.perRankStepM > 0 && c.perRankStepM <= 5 ? [] : [`Exchange reach: perRankStepM ${String(c.perRankStepM)} is not in (0, 5] m.`])];
}
export function setExchangeReach(state: ArenaState, reach: ExchangeReach): void {
  const problems = exchangeReachProblems(reach);
  if (problems.length) throw Error(problems.join(' '));
  reachByState.set(state, { perRankStepM: reach.perRankStepM, steps: new Map() });
}
/** Record the rank steps `a` defends with under the state's reach (no reach set: nothing to record). */
export function setReachSteps(state: ArenaState, a: Actor, steps: number): void {
  reachByState.get(state)?.steps.set(a.id, steps);
}
/** The defender's window reach in this state: closeRangeM, plus perRankStepM per recorded rank step when the state has a reach. */
export function exchangeReachM(state: ArenaState, r: ExchangeRule, defender: Actor): number {
  const reach = reachByState.get(state);
  return reach === undefined ? r.closeRangeM : r.closeRangeM + reach.perRankStepM * (reach.steps.get(defender.id) ?? 0);
}

const ticksOf = (seconds: number): number => Math.ceil(seconds * combat.simStepHz - 1e-9);
/** Is the attacker inside the defender's window reach: closeRangeM, plus the rank-scaled reach when the state carries one. */
const close = (state: ArenaState, r: ExchangeRule, attacker: Actor, defender: Actor): boolean =>
  Math.hypot(attacker.pos.x - defender.pos.x, attacker.pos.y - defender.pos.y) <= exchangeReachM(state, r, defender);
/** The share of `owner`'s blow that `target`'s window stops (undefined when no window guards it: another attacker, a blow
 * from beyond close range, an unblockable blow, the window over or its blows spent). */
export function exchangeGuard(state: ArenaState, target: Actor, owner: Actor | undefined, family: Family): number | undefined {
  const w = target.exchange, r = rule(state);
  return r && w && owner && family !== 'unblockable' && w.fromId === owner.id && state.tick < w.guardUntil && w.guardsLeft > 0 && close(state, r, owner, target) ? r.guardReduction : undefined;
}
/** After a contact resolved: a blow the window guarded spends one of its blows, and a clean close hit (damage through, not
 * guarded) in a contact a Fire/Air actor takes part in opens the target's window against the owner. */
export function exchangeAfterHit(state: ArenaState, target: Actor, owner: Actor | undefined, hpRemoved: number, guarded: boolean, windowGuard: boolean): void {
  if (windowGuard && target.exchange) target.exchange.guardsLeft--;
  const r = rule(state);
  if (!r || !owner || owner === target || hpRemoved <= 0 || guarded || target.tags.includes('DEFEATED')) return;
  if ((!target.schoolState && !owner.schoolState) || !close(state, r, owner, target)) return;
  target.exchange = { fromId: owner.id, guardUntil: state.tick + ticksOf(r.guardS), guardsLeft: r.guardHits };
}
