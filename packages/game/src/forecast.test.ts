import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultLabConfig, drain, duelForecast, forecastDeltas, makeTuning, runFight, runtime } from "@mage/core/arena";
import { ForecastClient } from "./forecast-client.ts";
import { ForecastRunner, forecastLabel, forecastPolicy, labConfigOf, runForecast } from "./forecast-job.ts";
import { duelDelta } from "./lab-compare.ts";
import { withSchool } from "./lab-picks.ts";

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

describe("Lab forecast against a pinned baseline (tuning + builds)", () => {
  // Shares the suite's runner, so Current is already cached; the 0.25 s absorb tuning is the pinned baseline here.
  const wide = { ...makeTuning(), absorbWindowS: 0.25 }, pin = { tuning: wide, lab: defaultLabConfig };
  it("a pinned 0.25 s absorb window against the factory candidate negates the factory-baseline / 0.25-candidate deltas", () => {
    const pinned = runForecast({ id: 10, tuning: makeTuning(), lab: defaultLabConfig, baseline: pin }, runner),
      reverse = runForecast({ id: 11, tuning: wide, lab: defaultLabConfig }, runner);
    expect(pinned.sameAsCurrent).toBe(false);
    expect(pinned.candidate).toEqual(reverse.current);
    expect(pinned.current).toEqual(reverse.candidate);
    const a = forecastDeltas(pinned.current.waves, pinned.candidate.waves), b = forecastDeltas(reverse.current.waves, reverse.candidate.waves);
    expect(a.some((d) => d.perfectRateDelta !== 0)).toBe(true);
    a.forEach((d, i) => expect(d.perfectRateDelta).toBeCloseTo(-b[i]!.perfectRateDelta, 12));
  }, 180000);
  it("a baseline equal to the candidate is the same-as-baseline forecast, and a repeat plan costs nothing", () => {
    const r = runForecast({ id: 12, tuning: structuredClone(wide), lab: defaultLabConfig, baseline: pin }, runner);
    expect(r.sameAsCurrent).toBe(true);
    expect(r.candidate).toEqual(r.current);
    expect(runner.plan({ id: 13, tuning: wide, lab: defaultLabConfig, baseline: pin }).total).toBe(0);
  }, 180000);
  it("a pinned baseline is computed once: a new candidate against it costs only its own fights", () => {
    const plan = runner.plan({ id: 14, tuning: { ...makeTuning(), walkMps: 5 }, lab: defaultLabConfig, baseline: pin });
    expect(plan.total).toBe(forecastPolicy.seedsPerWave * 4 + forecastPolicy.labDuels);
  });
  it("pinned builds: the baseline duel plays the pinned lab, and the duel delta is candidate minus baseline", () => {
    const air = withSchool(defaultLabConfig, "player", "air"),
      r = runForecast({ id: 15, tuning: makeTuning(), lab: air, baseline: { tuning: makeTuning(), lab: defaultLabConfig } }, runner),
      plan = { lab: labConfigOf(defaultLabConfig), duels: forecastPolicy.labDuels, competence: forecastPolicy.duelPlayerCompetence, capS: forecastPolicy.duelCapS };
    expect(r.sameAsCurrent).toBe(false);
    expect(r.current.duel).toEqual(drain(duelForecast(makeTuning(), plan)));
    expect(r.candidate.waves).toEqual(r.current.waves);
    expect(duelDelta(r).winRate).toBe(r.candidate.duel.winRate - r.current.duel.winRate);
  }, 180000);
});

describe("ForecastClient keys a request by its baseline", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it("a different pin posts a new run; the same pin twice posts once", () => {
    vi.useFakeTimers();
    const posts: { kind: string; request?: { baseline?: unknown } }[] = [];
    vi.stubGlobal(
      "Worker",
      class {
        postMessage(m: (typeof posts)[number]) {
          posts.push(m);
        }
        addEventListener() {}
        terminate() {}
      },
    );
    const client = new ForecastClient(() => {}),
      t = makeTuning(),
      pinA = { tuning: { ...t, walkMps: 5 }, lab: defaultLabConfig },
      pinB = { tuning: { ...t, walkMps: 6 }, lab: defaultLabConfig };
    const runs = () => posts.filter((m) => m.kind === "run");
    client.want(t, defaultLabConfig, pinA);
    vi.runAllTimers();
    client.want(t, defaultLabConfig, pinB);
    vi.runAllTimers();
    expect(runs().length).toBe(2);
    expect(runs()[1]!.request!.baseline).toEqual({ tuning: pinB.tuning, lab: labConfigOf(defaultLabConfig) });
    client.want(t, defaultLabConfig, pinA);
    vi.runAllTimers();
    client.want(t, defaultLabConfig, pinA);
    vi.runAllTimers();
    expect(runs().length).toBe(3);
    client.want(t, defaultLabConfig);
    vi.runAllTimers();
    expect(runs().length).toBe(4);
    expect(runs()[3]!.request).not.toHaveProperty("baseline");
    client.dispose();
  });
});
