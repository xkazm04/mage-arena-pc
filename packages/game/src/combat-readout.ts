import {
  combat,
  flowShift,
  tapContacts,
  ticks,
  type Actor,
  type ArenaState,
  type FlowMark,
  type Grade,
  type Spell,
  type ThreatLedger,
} from "@mage/core/arena";
import { collarClock } from "./rival-collar.ts";
import policy from "../data/combat-feedback.json" with { type: "json" };

/** Pure readers that put the kernel's own numbers on screen: ward words, slot prices, the Flow tip and perfect gains. */
export const hexColour = (s: string) => parseInt(s.slice(1), 16);
const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));

export interface Word {
  text: string;
  fill: number;
}
/** The word for one graded contact; only committed ward mistakes carry one (a plain open hit, a perfect or a dodge has none). */
export function wardWord(g: Grade | undefined): Word | undefined {
  if (!policy.wardWords.enabled || !g?.mistake) return;
  const w = policy.wardWords.words[g.mistake];
  return { text: fill(w.text, { n: g.lateTicks ?? 0 }), fill: hexColour(w.fill) };
}
/** The ledger entry for one kernel hit event (same tick and activation), newest first. */
export function gradeFor(l: ThreatLedger | undefined, tick: number, activationId?: number): Grade | undefined {
  if (!l || activationId === undefined) return;
  for (let i = l.entries.length - 1; i >= 0 && l.entries[i]!.tick >= tick; i--) {
    const e = l.entries[i]!;
    if (e.tick === tick && e.activationId === activationId) return e;
  }
}
/** At most one word per minGapS so the words never become noise; a capped hit falls back to its plain number. */
export const wordAllowed = (lastS: number, nowS: number) => nowS - lastS >= policy.wardWords.minGapS;
/** Label of one damage number: the word, beside the numeral when the hit also cost health. */
export function hitLabel(word: Word | undefined, damage: number): string | undefined {
  const n = damage >= policy.minimumNumberDamage ? String(Math.round(damage * 10) / 10) : "";
  if (!word) return n || undefined;
  return n && policy.wardWords.withNumber ? `${word.text}  ${n}` : word.text;
}

export interface SlotPrice {
  mana: number;
  crest: boolean;
  damageMult: number;
  text: string;
  /** Casting this slot now would repeat the last line and zero the standing Flow. */
  repeat: boolean;
}
/** What trySpellCast charges for this slot right now: a crest costs combat.flow.crest.manaCost at Flow max, else the spell's own mana. */
export function slotPrice(a: Actor, s: Spell): SlotPrice {
  const w = a.water,
    crest = w.flow >= combat.flow.max,
    mana = crest ? combat.flow.crest.manaCost : s.mana,
    damageMult = crest ? combat.flow.crest.damageMult : 1;
  return {
    mana,
    crest,
    damageMult,
    text: crest
      ? fill(policy.slotPrice.crest, { mana, mult: damageMult })
      : `${mana} mana  /  Tier ${a.tier}`,
    repeat:
      combat.flow.resetOnSameLineTwice &&
      s.kind !== "passive" &&
      w.flow > 0 &&
      !crest &&
      s.line === w.lastLine,
  };
}

export const lineName = (line: string) =>
  line.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
export interface FlowTip {
  text: string;
  untilS: number;
}
export const idleTip = (): FlowTip => ({ text: policy.flowTip.idle, untilS: -1e9 });
/** Next Flow tip from the change between two marks: a rise names the weave, a repeat names the broken line. */
export function nextFlowTip(tip: FlowTip, before: FlowMark, after: FlowMark, nowS: number): FlowTip {
  const shift = flowShift(before, after),
    t = policy.flowTip,
    until = nowS + t.holdS;
  if (shift?.kind === "rise") return { text: fill(t.rise, { from: lineName(shift.from), to: lineName(shift.to) }), untilS: until };
  if (shift?.kind === "break") return { text: fill(t.break, { line: lineName(shift.line) }), untilS: until };
  if (shift?.kind === "crest") return { text: t.crest, untilS: until };
  if (shift?.kind === "fade") return { text: t.fade, untilS: until };
  return tip;
}
/** At Flow max the tip is always the free crest; otherwise a recent change holds for holdS, then the idle hint. */
export const flowTipText = (tip: FlowTip, flow: number, nowS: number) =>
  flow >= combat.flow.max ? policy.flowTip.freeCrest : nowS < tip.untilS ? tip.text : policy.flowTip.idle;

export interface PerfectGain {
  mana: number;
  flow: number;
  /** Collar credit in seconds; 0 once all four runes are awake. */
  collarS: number;
  /** The credit is in the clock but the minimum gap between unlocks still holds the countdown. */
  banked: boolean;
  text: string;
}
/**
 * What a perfect actually gained: the refund the kernel paid (already capped at max mana), the Flow it added from flowBefore
 * (capped at max), and the collar credit; banked when the countdown is held by the minimum gap rather than shortened.
 * Read on the state after the perfect's tick.
 */
export function perfectGain(state: ArenaState, a: Actor, refund: number, flowBefore: number, perfectTick: number): PerfectGain {
  const flow = Math.min(combat.flow.max, flowBefore + combat.flow.perfectAbsorbGives) - flowBefore,
    credit = combat.tierClock.perfectAbsorbAdvanceS;
  let collarS = 0,
    banked = false;
  if (a.tier < 4 || a.lastUnlockTick >= perfectTick) {
    collarS = credit;
    if (a.lastUnlockTick < perfectTick) {
      const now = collarClock(state, a).untilS,
        without = collarClock(state, { ...a, clockAdvanceTicks: a.clockAdvanceTicks - ticks(credit) }).untilS;
      banked = without - now < credit - 1e-9;
    }
  }
  const p = policy.perfectGain,
    s = collarS.toFixed(1);
  return {
    mana: refund,
    flow,
    collarS,
    banked,
    text: fill(p.text, { mana: refund.toFixed(1), flow, collar: collarS ? fill(banked ? p.banked : p.collar, { s }) : "" }),
  };
}

/** Presentation-side tap: the actor's Flow just before each contact, so a perfect can say what it added. Never writes state. */
export class FlowBeforeContact {
  private state?: ArenaState;
  private actorId = -1;
  private seen = new Map<string, number>();
  private off?: () => void;
  watch(state: ArenaState, actorId: number) {
    if (state === this.state && actorId === this.actorId) return;
    this.dispose();
    this.state = state;
    this.actorId = actorId;
    this.off = tapContacts(state, (s, target, hit) => {
      if (target.id !== this.actorId) return;
      this.seen.set(`${s.tick}:${hit.activationId}`, target.water.flow);
      if (this.seen.size > 64) this.seen.delete(this.seen.keys().next().value!);
    });
  }
  /** Flow before the contact behind the kernel's perfect event at index i (its hit event follows it on the same tick). */
  before(state: ArenaState, i: number): number | undefined {
    const e = state.events[i]!;
    const hit = state.events.slice(i + 1).find((h) => h.kind === "hit" && h.tick === e.tick && h.actorId === e.actorId);
    return hit ? this.seen.get(`${e.tick}:${hit.activationId}`) : undefined;
  }
  dispose() {
    this.off?.();
    this.off = undefined;
    this.state = undefined;
    this.seen.clear();
  }
}
