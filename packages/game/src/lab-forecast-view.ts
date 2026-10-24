import { forecastDeltas, tiro } from "@mage/core/arena";
import type { ForecastView } from "./forecast-client.ts";
import { forecastPolicy } from "./forecast-job.ts";

/**
 * The Lab forecast's words and tones, without the canvas: lab-ui.ts maps each tone to an ink and writes the
 * text into its cells. `baseline` names what the forecast compares against ("Current", the factory preset).
 */
export type ForecastTone = "text" | "muted" | "danger";
export interface ForecastCell {
  text: string;
  tone: ForecastTone;
}
export interface ForecastLines {
  /** One row per Tiro wave: band, median, median change, win change, perfect change. */
  rows: ForecastCell[][];
  ttk: ForecastCell;
  dpm: ForecastCell;
  status: ForecastCell;
}

const signed = (n: number | null | undefined, digits: number, unit = "") =>
  n === null || n === undefined ? "--" : `${Number(n.toFixed(digits)) < 0 ? "-" : "+"}${Math.abs(n).toFixed(digits)}${unit}`;

export const forecastHeading = (baseline = "Current") => `Census forecast vs ${baseline}`;

/** The tuning page's census panel: per-wave median vs band and changes vs the baseline, plus the Lab duel's TTK and damage per mana. */
export function forecastLines(v: ForecastView, baseline = "Current"): ForecastLines {
  const r = v.result,
    fresh = v.status === "done",
    deltas = r ? forecastDeltas(r.current.waves, r.candidate.waves) : [],
    ink: ForecastTone = fresh ? "text" : "muted";
  const rows = tiro.waves.map((w, i) => {
    const band = w.targetDurationS,
      d = deltas[i],
      values = [
        `${i + 1}  ${band[0]}-${band[1]}s`,
        d?.medianDurationS == null ? "--" : `${d.medianDurationS.toFixed(1)}s`,
        signed(d?.medianDeltaS, 1, "s"),
        d ? signed(d.winRateDelta * 100, 0, "%") : "--",
        d ? signed(d.perfectRateDelta * 100, 1, "%") : "--",
      ];
    return values.map(
      (text, c): ForecastCell => ({
        text,
        tone: c === 1 && d && !d.inBand && fresh ? "danger" : c === 0 ? "muted" : ink,
      }),
    );
  });
  const duel = r?.candidate.duel,
    base = r?.current.duel,
    ttkDelta = duel?.ttkMedianS != null && base?.ttkMedianS != null ? duel.ttkMedianS - base.ttkMedianS : null,
    dpmDelta = duel?.damagePerMana != null && base?.damagePerMana != null ? duel.damagePerMana - base.damagePerMana : null;
  const status =
    v.status === "waiting"
      ? "Change noticed; simulating shortly"
      : v.status === "running"
        ? `Simulating ${v.done} / ${v.total} fights`
        : v.status === "error"
          ? `Forecast failed: ${v.error ?? "unknown"}`.slice(0, 48)
          : r
            ? `${r.sameAsCurrent ? `${baseline} baseline` : `Change vs ${baseline}`} in ${((v.ms ?? 0) / 1000).toFixed(1)} s`
            : "";
  return {
    rows,
    ttk: {
      text: `Duel TTK ${duel?.ttkMedianS == null ? "--" : duel.ttkMedianS.toFixed(1) + "s"} (${signed(ttkDelta, 1, "s")})   win ${duel ? Math.round(duel.winRate * 100) + "%" : "--"}`,
      tone: ink,
    },
    dpm: { text: `Damage / mana ${duel?.damagePerMana == null ? "--" : duel.damagePerMana.toFixed(2)} (${signed(dpmDelta, 2)})`, tone: ink },
    status: { text: status, tone: v.status === "error" ? "danger" : "muted" },
  };
}

/** The builds page's one line: the draft's forecast duel (you as the reference AI against this rival). */
export function buildsForecastLine(v: ForecastView): ForecastCell {
  const duel = v.status === "done" ? v.result?.candidate.duel : undefined;
  return {
    text:
      v.status === "running"
        ? `Forecast duel: simulating ${v.done} / ${v.total} fights`
        : v.status === "error"
          ? `Forecast failed: ${v.error ?? "unknown"}`.slice(0, 120)
          : duel
            ? `Forecast duel (you as the competence ${forecastPolicy.duelPlayerCompetence} reference AI vs this rival, ${duel.duels} seeds): win ${Math.round(duel.winRate * 100)}%   median TTK ${duel.ttkMedianS == null ? "--" : duel.ttkMedianS.toFixed(1) + " s"}`
            : "Forecast duel: change noticed; simulating shortly",
    tone: v.status === "error" ? "danger" : duel ? "text" : "muted",
  };
}
