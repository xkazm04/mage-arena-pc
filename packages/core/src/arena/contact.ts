// One contact verdict: what a blow that reached its target becomes (front shield, ward, exchange window, perfect, the share
// stopped and the damage through). resolveHit (kernel.ts) decides it here once, after its gates (defeated, roll/encase
// immunity, the Air Form evade that draws the RNG), applies it, and hands it to verdict taps (kernel.ts tapVerdicts); the
// threat-answer ledger grades from it instead of re-deriving the rule. Pure: reads state, writes nothing, draws nothing.
// Every expression keeps the kernel's floating-point order, so no hash moves.
import { combat } from './data.generated.ts';
import { tuningFor } from './tuning.ts';
import { enemySpec } from './enemies.ts';
import { exchangeGuard } from './exchange.ts';
import { agilityPerfectWindowAddS } from './progression.ts';
import { inArc, sub } from './math.ts';
import type { Actor, ArenaState, Hit } from './types.ts';

/** What a contact's gates made of it: `resolved` carries a verdict; the others ended before one (no hit event). */
export type ContactOutcome = 'defeated' | 'roll' | 'encase' | 'evaded' | 'resolved';
export interface ContactVerdict {
  /** An enemy's front shield took the blow (its frontBlockMult scales incomingDamage). */
  shielded: boolean;
  /** The source sits inside the target's ward arc, and the ward is up and covers it. */
  inArc: boolean; warded: boolean;
  /** What guarded the blow: the raised ward, or an exchange window (exchange.ts) against this owner. */
  guard?: 'ward' | 'window';
  perfect: boolean;
  /** Share stopped, the damage after armour and shield, and what goes through (before the Lab's damage switch). */
  reduction: number; incomingDamage: number; damage: number;
  /** Ward age at contact (contact tick - absorbFreshTick, meaningful while the ward is up) and the perfect window in ticks. */
  ageTicks: number; windowTicks: number;
}

const ticksOf = (seconds: number): number => Math.ceil(seconds * combat.simStepHz - 1e-9);
/** The kernel's verdict for `hit` reaching `target` (owner: the actor with hit.ownerId, if still in the state). */
export function contactVerdict(state: ArenaState, target: Actor, owner: Actor | undefined, hit: Hit): ContactVerdict {
  const tune = tuningFor(state);
  const spec = target.enemy ? enemySpec(target) : undefined;
  const shielded = !!(spec?.frontBlockDeg && hit.delivery !== 'area' && !hit.pierceShields && hit.family !== 'unblockable' && inArc(target.facing, sub(hit.source, target.pos), spec.frontBlockDeg));
  const incomingDamage = hit.damage * (hit.bolt ? spec?.armourMultVsBolt ?? 1 : 1) * (shielded ? spec?.frontBlockMult ?? 1 : 1);
  const arc = inArc(target.facing, sub(hit.source, target.pos), tune.absorbArcDeg), warded = target.absorb && arc;
  // An exchange window re-raises the ward at once against the attacker that opened it: a plain ward, no perfect.
  const windowReduction = warded ? undefined : exchangeGuard(state, target, owner, hit.family);
  const ageTicks = state.tick - target.absorbFreshTick, windowTicks = ticksOf(tune.absorbWindowS + agilityPerfectWindowAddS(target, state));
  const perfect = warded && hit.family === 'magic' && !hit.suppressPerfect && ageTicks <= windowTicks;
  const reduction = windowReduction ?? (warded ? (perfect ? combat.absorb.perfect.reduction : combat.absorb.reduction[hit.family]) : combat.absorb.reduction.outsideArc);
  return { shielded, inArc: arc, warded, ...(warded ? { guard: 'ward' as const } : windowReduction !== undefined ? { guard: 'window' as const } : {}),
    perfect, reduction, incomingDamage, damage: incomingDamage * (1 - reduction), ageTicks, windowTicks };
}
