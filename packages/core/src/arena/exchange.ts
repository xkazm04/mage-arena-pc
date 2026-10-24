// Exchange windows (D1 4.1 option A, docs/concepts/D1-combat-followup-and-progression.md): a clean close hit grants the
// defender a short punish window. Its ward re-raises at once against that attacker: for guardS it takes the attacker's next
// guardHits close blows (each lands guarded, guardReduction of it stopped, the way a held ward stops a blow). A run of blows stops
// paying in full after the first, so trades alternate instead of stacking. (D1's other punish, a faster next cast, was
// measured and left out: it favoured the slow-casting rival builds; D1 section 6.) Rule state only (`Actor.exchange`), read on the
// existing hit path: no new event kind; the window's guard shows as the `guarded` flag of the hit it blocks.
// Gate: the numbers live in the PC overlay (school-balance.pc.json `exchange`); a state that runs balance 'canonical'
// (CR-002/CR-007 parity) ignores them, and a window opens only in a contact a Fire/Air actor takes part in, so Water-only
// states (goldens, the default census digests) never carry the key and step exactly as before.
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

const ticksOf = (seconds: number): number => Math.ceil(seconds * combat.simStepHz - 1e-9);
const close = (r: ExchangeRule, a: Actor, b: Actor): boolean => Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y) <= r.closeRangeM;
/** The share of `owner`'s blow that `target`'s window stops (undefined when no window guards it: another attacker, a blow
 * from beyond close range, an unblockable blow, the window over or its blows spent). */
export function exchangeGuard(state: ArenaState, target: Actor, owner: Actor | undefined, family: Family): number | undefined {
  const w = target.exchange, r = rule(state);
  return r && w && owner && family !== 'unblockable' && w.fromId === owner.id && state.tick < w.guardUntil && w.guardsLeft > 0 && close(r, owner, target) ? r.guardReduction : undefined;
}
/** After a contact resolved: a blow the window guarded spends one of its blows, and a clean close hit (damage through, not
 * guarded) in a contact a Fire/Air actor takes part in opens the target's window against the owner. */
export function exchangeAfterHit(state: ArenaState, target: Actor, owner: Actor | undefined, hpRemoved: number, guarded: boolean, windowGuard: boolean): void {
  if (windowGuard && target.exchange) target.exchange.guardsLeft--;
  const r = rule(state);
  if (!r || !owner || owner === target || hpRemoved <= 0 || guarded || target.tags.includes('DEFEATED')) return;
  if ((!target.schoolState && !owner.schoolState) || !close(r, owner, target)) return;
  target.exchange = { fromId: owner.id, guardUntil: state.tick + ticksOf(r.guardS), guardsLeft: r.guardHits };
}
