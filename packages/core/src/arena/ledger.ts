import { spells } from './catalog.ts';
import { tapVerdicts, ticks } from './kernel.ts';
import { threats } from './mage-ai.ts';
import { inArc, sub } from './math.ts';
import { tuningFor } from './tuning.ts';
import { agilityPerfectWindowAddS } from './progression.ts';
import { isDefeated, type ArenaState, type Family } from './types.ts';

export const families = ['magic', 'physical', 'unblockable'] as const satisfies readonly Family[];
export const answers = ['perfect', 'held', 'guarded', 'cast-blocked', 'wrong-facing', 'rolled', 'encased', 'avoided', 'took', 'window', 'evaded', 'unclassified'] as const;
export type Answer = typeof answers[number];
export type Mistake = 'steel' | 'leave' | 'behind' | 'late' | 'cast';
/** Facts at one contact, read before resolveHit applies it. ageTicks = contact tick - absorbFreshTick (meaningful while wardUp).
 * `evaded`, `guard` and `perfect` are the kernel's own verdict (contact.ts) when the ledger heard one: an Air Form evade, the
 * guard that took the blow (a raised ward or an exchange window) and whether the ward was perfect. Without them the ward rule
 * is derived from wardUp / inArc / ageTicks as the kernel's base rule. */
export interface ContactFacts { family: Family; immune?: 'roll' | 'encase'; evaded?: boolean; guard?: 'ward' | 'window'; perfect?: boolean; wardUp: boolean; inArc: boolean; ageTicks: number; windowTicks: number; absorbHeld: boolean; castBlocked: boolean }
export interface Grade { family: Family; answer: Answer; wardUp: boolean; inArc: boolean; guarded: boolean; absorbHeld: boolean; ageTicks?: number; lateTicks?: number; mistake?: Mistake }
export interface LedgerEntry extends Grade { tick: number; activationId: number }
export type AnswerCounts = Record<Family, Record<Answer, number>>;
interface RawContact { tick: number; activationId: number; ownerId: number; family: Family; immune?: 'roll' | 'encase'; evaded?: boolean; guard?: 'ward' | 'window'; perfect?: boolean; reduction?: number; wardUp: boolean; inArc: boolean; ageTicks: number; windowTicks: number }
/** Per-actor record of how each threat was answered. Plain data that lives beside, never inside, ArenaState. */
export interface ThreatLedger {
  actorId: number; entries: LedgerEntry[]; counts: AnswerCounts;
  /** Ward age at contact for every guarded magic contact (perfect and held): the lead histogram. */
  ages: Record<number, number>;
  raw: RawContact[]; tracked: Record<number, { family: Family; contacted: boolean }>; wasPending: boolean;
}
export const emptyAnswerCounts = (): AnswerCounts => Object.fromEntries(families.map(f => [f, Object.fromEntries(answers.map(a => [a, 0]))])) as AnswerCounts;

/**
 * Grade one contact. Immunity grades first (rolled / encased), then an Air Form evade (`evaded`), then a blow an exchange
 * window took (`window`, no mistake). With the ward up: unblockable is `took` (mistake leave),
 * outside the arc is `wrong-facing` (behind, or steel for physical), magic inside the arc is `perfect` when the kernel says so
 * (by default ageTicks <= windowTicks) else `held`: late by lateTicks = ageTicks - windowTicks (late, "HELD +nf"), or on time
 * but refused a perfect (a beam tick after its first) with no lateTicks and no mistake;
 * physical inside the arc is `guarded` (steel). With the ward down: `cast-blocked` when the ward was wanted but refused
 * for a pending cast, else `took`; wanting a ward against steel or an unblockable still carries steel / leave.
 * Facts that cannot be graded honestly return `unclassified` instead of a guess.
 */
export function gradeContact(f: ContactFacts): Grade {
  const base = { family: f.family, wardUp: f.wardUp, inArc: f.inArc, guarded: (f.wardUp && f.inArc) || f.guard === 'window', absorbHeld: f.absorbHeld };
  const wanted = f.wardUp || f.absorbHeld;
  const steelOrLeave: Mistake | undefined = f.family === 'physical' && wanted ? 'steel' : f.family === 'unblockable' && wanted ? 'leave' : undefined;
  if (!families.includes(f.family) || !Number.isInteger(f.windowTicks) || f.windowTicks < 0 || (f.wardUp && !(Number.isInteger(f.ageTicks) && f.ageTicks >= 0)))
    return { ...base, answer: 'unclassified' };
  if (f.immune) return { ...base, answer: f.immune === 'roll' ? 'rolled' : 'encased' };
  if (f.evaded) return { ...base, answer: 'evaded' };
  if (f.guard === 'window') return { ...base, answer: 'window' };
  if (f.wardUp) {
    if (f.family === 'unblockable') return { ...base, answer: 'took', ageTicks: f.ageTicks, mistake: 'leave' };
    if (!f.inArc) return { ...base, answer: 'wrong-facing', ageTicks: f.ageTicks, mistake: steelOrLeave ?? 'behind' };
    if (f.family === 'physical') return { ...base, answer: 'guarded', ageTicks: f.ageTicks, mistake: 'steel' };
    if (f.perfect ?? f.ageTicks <= f.windowTicks) return { ...base, answer: 'perfect', ageTicks: f.ageTicks };
    return f.ageTicks > f.windowTicks ? { ...base, answer: 'held', ageTicks: f.ageTicks, lateTicks: f.ageTicks - f.windowTicks, mistake: 'late' }
      : { ...base, answer: 'held', ageTicks: f.ageTicks };
  }
  if (f.castBlocked) return { ...base, answer: 'cast-blocked', mistake: steelOrLeave ?? 'cast' };
  return { ...base, answer: 'took', ...(steelOrLeave ? { mistake: steelOrLeave } : {}) };
}

const detach = new WeakMap<ThreatLedger, () => void>();
/** Start a ledger for one actor; it hears every contact from this state through the kernel's verdict tap, with the gate that
 * ended it or the kernel's verdict (contact.ts). Call observeLedger after every tick. */
export function createLedger(state: ArenaState, actorId: number): ThreatLedger {
  const l: ThreatLedger = { actorId, entries: [], counts: emptyAnswerCounts(), ages: {}, raw: [], tracked: {}, wasPending: !!state.actors.find(a => a.id === actorId)?.pending };
  detach.set(l, tapVerdicts(state, (s, target, hit, outcome, v) => {
    if (target.id !== l.actorId || outcome === 'defeated') return;
    // A contact the gates ended carries no verdict: its ward facts are read here, from the state the verdict would read.
    const tune = tuningFor(s);
    const facts = v ? { ...(v.guard ? { guard: v.guard } : {}), perfect: v.perfect, reduction: v.reduction, inArc: v.inArc, ageTicks: v.ageTicks, windowTicks: v.windowTicks }
      : { inArc: inArc(target.facing, sub(hit.source, target.pos), tune.absorbArcDeg), ageTicks: s.tick - target.absorbFreshTick, windowTicks: ticks(tune.absorbWindowS + agilityPerfectWindowAddS(target, s)) };
    l.raw.push({ tick: s.tick, activationId: hit.activationId, ownerId: hit.ownerId, family: hit.family,
      ...(outcome === 'roll' || outcome === 'encase' ? { immune: outcome } : outcome === 'evaded' ? { evaded: true } : {}), wardUp: target.absorb, ...facts });
  }));
  return l;
}
export function detachLedger(l: ThreatLedger): void { detach.get(l)?.(); detach.delete(l); }
export function resetLedger(l: ThreatLedger): void { Object.assign(l, { entries: [], counts: emptyAnswerCounts(), ages: {}, raw: [], tracked: {} }); }

function record(l: ThreatLedger, entry: LedgerEntry): void {
  l.entries.push(entry); l.counts[entry.family][entry.answer]++;
  if (entry.family === 'magic' && entry.guarded && (entry.answer === 'perfect' || entry.answer === 'held')) l.ages[entry.ageTicks!] = (l.ages[entry.ageTicks!] ?? 0) + 1;
}
const hitBearing = (state: ArenaState, id: number): boolean => {
  const p = state.actors.find(a => a.pending?.activationId === id)?.pending;
  if (!p || p.kind !== 'spell') return true;
  const s = p.spell ?? spells.find(s => s.id === p.spellId);
  return !s || s.kind === 'projectile' || s.kind === 'cone' || s.kind === 'ring' || s.kind === 'wave' || (s.kind === 'zone' && s.effect === 'root');
};
/**
 * Fold the completed tick into the ledger: grade the contacts the tap heard from the kernel's verdict, cross-checked against
 * the kernel's hit and perfect events (an assertion: a disagreement, the sign a kernel rule moved past the verdict, grades
 * `unclassified`), grade threats that vanished without contact as `avoided`, and
 * start tracking newly aimed threats. Reads state only.
 */
export function observeLedger(l: ThreatLedger, state: ArenaState): void {
  const a = state.actors.find(x => x.id === l.actorId), contacts = l.raw.splice(0);
  if (!a) { l.tracked = {}; l.wasPending = false; return; }
  const absorbHeld = a.lastInput.absorb, events = [];
  const first = Math.min(state.tick, ...contacts.map(c => c.tick));
  for (let i = state.events.length - 1; i >= 0 && state.events[i]!.tick >= first; i--) if (state.events[i]!.actorId === a.id) events.push(state.events[i]!);
  for (const c of contacts) {
    const grade = gradeContact({ ...c, absorbHeld, castBlocked: absorbHeld && !c.wardUp && l.wasPending });
    const hit = events.findIndex(e => e.kind === 'hit' && e.tick === c.tick && e.activationId === c.activationId);
    const stops = c.reduction === undefined ? c.family !== 'unblockable' : c.reduction > 0;
    let honest = c.immune || c.evaded ? hit < 0 : hit >= 0 && !!events[hit]!.guarded === (grade.guarded && stops);
    if (hit >= 0) events.splice(hit, 1);
    if (!c.immune && !c.evaded && honest) {
      const perfect = events.findIndex(e => e.kind === 'perfect' && e.tick === c.tick && e.targetId === c.ownerId);
      honest = (perfect >= 0) === (grade.answer === 'perfect');
      if (perfect >= 0 && grade.answer === 'perfect') events.splice(perfect, 1);
    }
    record(l, { ...(honest ? grade : { ...grade, answer: 'unclassified', mistake: undefined }), tick: c.tick, activationId: c.activationId });
    (l.tracked[c.activationId] ??= { family: c.family, contacted: true }).contacted = true;
  }
  if (isDefeated(a)) { l.tracked = {}; l.wasPending = false; return; }
  const live = new Set([...state.projectiles.map(p => p.activationId), ...state.telegraphs.map(t => t.activationId), ...state.actors.flatMap(x => x.pending ? [x.pending.activationId] : [])]);
  for (const [key, t] of Object.entries(l.tracked)) {
    const id = Number(key); if (live.has(id)) continue;
    if (!t.contacted) record(l, { family: t.family, answer: 'avoided', wardUp: a.absorb, inArc: false, guarded: false, absorbHeld, tick: state.tick, activationId: id });
    delete l.tracked[id];
  }
  for (const t of threats(state, a)) if (t.aimedAtUs && !(t.id in l.tracked) && families.includes(t.family as Family) && hitBearing(state, t.id)) l.tracked[t.id] = { family: t.family as Family, contacted: false };
  l.wasPending = !!a.pending;
}

export interface FamilySummary extends Record<Answer, number> { total: number; contacts: number }
/** Numbers behind a post-bout line; `contacts` excludes `avoided`, the median covers held magic only. */
export function summarizeLedger(l: ThreatLedger): Record<Family, FamilySummary> & { magicMedianLateTicks?: number } {
  const late = l.entries.flatMap(e => e.family === 'magic' && e.answer === 'held' && e.lateTicks !== undefined ? [e.lateTicks] : []).sort((x, y) => x - y);
  const summary = (f: Family): FamilySummary => { const total = answers.reduce((n, a) => n + l.counts[f][a], 0); return { ...l.counts[f], total, contacts: total - l.counts[f].avoided }; };
  return { magic: summary('magic'), physical: summary('physical'), unblockable: summary('unblockable'), ...(late.length ? { magicMedianLateTicks: late[Math.floor(late.length / 2)]! } : {}) };
}
