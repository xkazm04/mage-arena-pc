import { tuningDiff, validateLabConfig, validateTuning, type CombatTuning, type LabConfig } from "@mage/core/arena";
import { labConfigOf, type ForecastBaseline, type ForecastResult } from "./forecast-job.ts";

/** A named snapshot of the tuning and both sides' builds that the Lab forecast compares against. */
export interface LabPin {
  name: string;
  tuning: CombatTuning;
  lab: LabConfig;
}
/** The Lab's comparison point: Current, or a pinned tuning + builds. Pure; lab-ui.ts draws its buttons and labels. */
export class LabCompare {
  private pinned?: LabPin;
  /** Pins a copy; returns the validator's reason and keeps the old pin when the snapshot is not playable. */
  pin(tuning: CombatTuning, setup: LabConfig, name: string): string | undefined {
    try {
      this.pinned = { name, tuning: validateTuning(tuning), lab: validateLabConfig(labConfigOf(setup)) };
    } catch (e) {
      return String(e).replace(/^Error: /, "");
    }
  }
  unpin() {
    this.pinned = undefined;
  }
  get name(): string | undefined {
    return this.pinned?.name;
  }
  /** What the forecast lines name as their baseline: "Current" or "pinned <name>". */
  get baselineName(): string {
    return this.pinned ? `pinned ${this.pinned.name}` : "Current";
  }
  get label(): string {
    return `vs ${this.baselineName}`;
  }
  /** The forecast request's baseline; undefined (today's vs-Current request) when nothing is pinned. */
  get baseline(): ForecastBaseline | undefined {
    return this.pinned && { tuning: structuredClone(this.pinned.tuning), lab: structuredClone(this.pinned.lab) };
  }
  /** The tuning the changed-knobs line reads against. */
  get tuning(): CombatTuning | undefined {
    return this.pinned?.tuning;
  }
}
/** Candidate minus baseline for the Lab duel; TTK is null when either side has no win to time. */
export function duelDelta(r: ForecastResult): { winRate: number; ttkMedianS: number | null } {
  const a = r.current.duel, b = r.candidate.duel;
  return { winRate: b.winRate - a.winRate, ttkMedianS: a.ttkMedianS === null || b.ttkMedianS === null ? null : b.ttkMedianS - a.ttkMedianS };
}
const signed = (n: number, digits: number) => `${Number(n.toFixed(digits)) < 0 ? "-" : "+"}${Math.abs(n).toFixed(digits)}`;
/** The builds page's suffix to its duel line, e.g. "(+20% win, -1.5 s TTK vs pinned Brawler v2)". */
export function duelDeltaText(r: ForecastResult, baselineName: string): string {
  const d = duelDelta(r);
  return `(${signed(d.winRate * 100, 0)}% win, ${d.ttkMedianS === null ? "--" : signed(d.ttkMedianS, 1) + " s"} TTK vs ${baselineName})`;
}
const knobValue = (v: unknown) => (typeof v === "number" ? String(Number(v.toFixed(3))) : "");
/** The changed knobs against the baseline as one line, the first `limit` named, then "+n more". */
export function changedKnobs(base: CombatTuning, candidate: CombatTuning, limit = 2): string {
  const changes = tuningDiff(base, candidate);
  if (!changes.length) return "No knobs changed";
  const named = changes.slice(0, limit).map((c) =>
    c.group === "Spells"
      ? `${c.label} override ${c.from === null ? "added" : c.to === null ? "removed" : "changed"}`
      : `${c.label} ${knobValue(c.from)} -> ${knobValue(c.to)} ${c.unit}`.trim(),
  );
  return [...named, ...(changes.length > limit ? [`+${changes.length - limit} more`] : [])].join(", ");
}
