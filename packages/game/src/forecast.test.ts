import { describe, expect, it } from "vitest";
import { defaultLabConfig, forecastDeltas, makeTuning, runFight, runtime } from "@mage/core/arena";
import { ForecastRunner, forecastLabel, forecastPolicy, labConfigOf, runForecast } from "./forecast-job.ts";

// One runner across the suite: the Current forecast is computed once and cached, as in the worker.
const runner = new ForecastRunner();
// H1 evidence predates committed-body lunges (item L) and the 2026-10-15 pace (every wave), so the forecast is checked
// per fight against the live census path; it no longer replays docs/waves/H1-evidence.
const census = (wave: number): { seed: number; outcome: string; durationS: number; hash: string }[] =>
  Array.from({ length: forecastPolicy.seedsPerWave }, (_, i) => runFight(runtime.games.censusSeedStart + i, wave - 1));

describe("Lab census forecast (the pure job the worker runs)", () => {
  it("reads its sample size and pacing from data and labels itself as a simulation", () => {
    expect(forecastPolicy.seedsPerWave).toBe(50);
    expect(forecastLabel).toBe("simulated · reference policy · n=50");
    expect(labConfigOf({ ...defaultLabConfig, creature: "mire_maw" } as typeof defaultLabConfig)).toEqual(defaultLabConfig);
  });
  it("Current reproduces the census seeds 40000-40049 per fight: outcome, durationS and hash", () => {
    const r = runForecast({ id: 1, tuning: makeTuning(), lab: defaultLabConfig }, runner);
    expect(r.sameAsCurrent).toBe(true);
    expect(r.candidate).toEqual(r.current);
    for (const w of r.current.waves) {
      const recorded = census(w.wave).slice(0, forecastPolicy.seedsPerWave);
      expect(recorded[0]!.seed).toBe(runtime.games.censusSeedStart);
      expect(w.fights.map(({ seed, outcome, durationS, hash }) => ({ seed, outcome, durationS, hash }))).toEqual(
        recorded.map(({ seed, outcome, durationS, hash }) => ({ seed, outcome, durationS, hash })),
      );
    }
    expect(r.current.duel.duels).toBe(forecastPolicy.labDuels);
    expect(runner.plan({ id: 2, tuning: makeTuning(), lab: defaultLabConfig }).total).toBe(0);
  }, 180000);
  it("a wider perfect absorb window (0.15 -> 0.25 s) moves the forecast perfect rate in one cycle", () => {
    expect(makeTuning().absorbWindowS).toBe(0.15);
    const tuning = { ...makeTuning(), absorbWindowS: 0.25 }, plan = runner.plan({ id: 3, tuning, lab: defaultLabConfig });
    expect(plan.total).toBe(forecastPolicy.seedsPerWave * 4 + forecastPolicy.labDuels);
    const r = runForecast({ id: 3, tuning, lab: defaultLabConfig }, runner), deltas = forecastDeltas(r.current.waves, r.candidate.waves);
    console.log(JSON.stringify(deltas.map((d) => ({ wave: d.wave, perfectRateDelta: d.perfectRateDelta, winRateDelta: d.winRateDelta, medianDeltaS: d.medianDeltaS }))));
    expect(r.sameAsCurrent).toBe(false);
    expect(deltas.some((d) => d.perfectRateDelta !== 0)).toBe(true);
    expect(r.candidate.waves[0]!.fights[0]!.hash).not.toBe(r.current.waves[0]!.fights[0]!.hash);
  }, 180000);
});
