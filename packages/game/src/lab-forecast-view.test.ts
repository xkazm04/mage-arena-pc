import { describe, expect, it } from "vitest";
import { tiro, type WaveForecast } from "@mage/core/arena";
import type { ForecastResult } from "./forecast-job.ts";
import { buildsForecastLine, forecastHeading, forecastLines } from "./lab-forecast-view.ts";

const wave = (i: number, median: number | null, inBand: boolean, winRate = 0.5, perfectRate = 0.25): WaveForecast => ({
  wave: i + 1, kind: tiro.waves[i]!.kind, targetDurationS: tiro.waves[i]!.targetDurationS as [number, number], fights: [],
  medianDurationS: median, inBand, winRate, perfectRate, timeouts: 0,
});
const duel = (winRate: number, ttk: number | null, dpm: number | null) => ({ duels: 8, wins: Math.round(winRate * 8), winRate, ttkMedianS: ttk, damagePerMana: dpm });
const result = (): ForecastResult => ({
  id: 1, sameAsCurrent: false,
  current: { waves: tiro.waves.map((w, i) => wave(i, w.targetDurationS[0] + 1, true)), duel: duel(0.5, 20, 1.5) },
  candidate: { waves: tiro.waves.map((w, i) => (i === 3 ? wave(i, w.targetDurationS[1] + 9, false, 0.75, 0.3) : wave(i, w.targetDurationS[0] + 1, true))), duel: duel(0.625, 18.5, 1.75) },
});

describe("Lab forecast view", () => {
  it("reports progress while the worker simulates", () => {
    const v = forecastLines({ status: "running", done: 3, total: 250 });
    expect(v.status).toEqual({ text: "Simulating 3 / 250 fights", tone: "muted" });
    expect(v.rows).toHaveLength(tiro.waves.length);
    expect(v.rows[0]!.map((c) => c.text).slice(1)).toEqual(["--", "--", "--", "--"]);
    expect(v.ttk.text).toBe("Duel TTK -- (--)   win --");
  });
  it("flags an out-of-band median and signs every change", () => {
    const v = forecastLines({ status: "done", done: 0, total: 0, result: result(), ms: 2340 });
    const band = tiro.waves[3]!.targetDurationS, row = v.rows[3]!;
    expect(row.map((c) => c.text)).toEqual([`4  ${band[0]}-${band[1]}s`, `${(band[1] + 9).toFixed(1)}s`, `+${(band[1] + 9 - band[0] - 1).toFixed(1)}s`, "+25%", "+5.0%"]);
    expect(row.map((c) => c.tone)).toEqual(["muted", "danger", "text", "text", "text"]);
    expect(v.rows[0]!.map((c) => c.tone)).toEqual(["muted", "text", "text", "text", "text"]);
    expect(v.rows.slice(0, 3).every((r) => r[1]!.tone !== "danger")).toBe(true);
    expect(v.ttk.text).toBe("Duel TTK 18.5s (-1.5s)   win 63%");
    expect(v.dpm.text).toBe("Damage / mana 1.75 (+0.25)");
    expect(v.status).toEqual({ text: "Change vs Current in 2.3 s", tone: "muted" });
    expect(forecastLines({ status: "done", done: 0, total: 0, result: { ...result(), sameAsCurrent: true }, ms: 0 }).status.text).toBe("Current baseline in 0.0 s");
  });
  it("greys a stale result while a new run waits, without flagging its bands", () => {
    const v = forecastLines({ status: "waiting", done: 0, total: 0, result: result() });
    expect(v.status.text).toBe("Change noticed; simulating shortly");
    expect(v.rows[3]!.map((c) => c.tone)).toEqual(["muted", "muted", "muted", "muted", "muted"]);
    expect(v.ttk.tone).toBe("muted");
  });
  it("truncates a failure to the panel's width and tints it", () => {
    const v = forecastLines({ status: "error", done: 0, total: 0, error: "x".repeat(200) });
    expect(v.status.text).toHaveLength(48);
    expect(v.status.text.startsWith("Forecast failed: x")).toBe(true);
    expect(v.status.tone).toBe("danger");
    expect(forecastLines({ status: "idle", done: 0, total: 0 }).status.text).toBe("");
  });
  it("words the builds page's duel line", () => {
    expect(buildsForecastLine({ status: "running", done: 2, total: 8 })).toEqual({ text: "Forecast duel: simulating 2 / 8 fights", tone: "muted" });
    expect(buildsForecastLine({ status: "waiting", done: 0, total: 0 })).toEqual({ text: "Forecast duel: change noticed; simulating shortly", tone: "muted" });
    const e = buildsForecastLine({ status: "error", done: 0, total: 0, error: "y".repeat(300) });
    expect([e.text.length, e.tone]).toEqual([120, "danger"]);
    const done = buildsForecastLine({ status: "done", done: 0, total: 0, result: result() });
    expect(done.tone).toBe("text");
    expect(done.text).toMatch(/8 seeds\): win 63% {3}median TTK 18\.5 s$/);
    expect(forecastHeading()).toBe("Census forecast vs Current");
  });
});
