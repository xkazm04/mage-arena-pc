import {
  censusForecast,
  defaultDifficulty,
  drain,
  duelForecast,
  isCurrentTuning,
  makeTuning,
  tuningFields,
  type CombatTuning,
  type Difficulty,
  type DuelForecast,
  type LabConfig,
  type WaveForecast,
} from "@mage/core/arena";
import policy from "../data/forecast.json" with { type: "json" };

/** The pure job the forecast worker runs; tests drive it directly. No DOM, no clock. */
export const forecastPolicy = policy;
export const forecastLabel = policy.label.replace("{n}", String(policy.seedsPerWave));
/** A pinned comparison point: a tuning and the Lab setup (both sides' builds) it was pinned with. Absent = Current on the request's lab. */
export interface ForecastBaseline { tuning: CombatTuning; lab: LabConfig }
export interface ForecastRequest { id: number; tuning: CombatTuning; lab: LabConfig; baseline?: ForecastBaseline }
export interface ForecastSide { waves: WaveForecast[]; duel: DuelForecast }
/** `current` is the baseline side (Current, or the pin); `sameAsCurrent` is true when the candidate is that baseline. */
export interface ForecastResult { id: number; current: ForecastSide; candidate: ForecastSide; sameAsCurrent: boolean }
const labKeys = ["opponent", "dummyAttack", "playerSchool", "opponentSchool", "competence", "aggression", "distanceM", "seed", "randomSeed", "composition", "difficulty", "rivalPreset", "rivalPlan", "playerBuild", "opponentBuild"] as const;
/** Lab setups carry presentation extras (creature targets); the duel uses only the core setup (incl. both sides' build picks and the
 * Water rival's preset), always vs the mage rival. Absent keys stay absent, so a default setup keys and runs as before. */
export function labConfigOf(setup: LabConfig): LabConfig {
  return structuredClone(Object.fromEntries(labKeys.flatMap((k) => (setup[k] === undefined ? [] : [[k, setup[k]]])))) as unknown as LabConfig;
}
class Memo<T> {
  value?: T;
  left: number;
  constructor(private steps: Generator<number, T>, size: number) { this.left = size; }
  *drive(): Generator<void, T> {
    while (this.value === undefined) {
      const next = this.steps.next();
      if (next.done) this.value = next.value;
      else { this.left--; yield; }
    }
    return this.value;
  }
}
/** Field-order key of a tuning; "" is the Current preset, which runs the census path untouched. */
function tuningKey(t: CombatTuning): string {
  return isCurrentTuning(t) ? "" : JSON.stringify([tuningFields.map((f) => t[f.key]), Object.entries(t.spells).sort(([a], [b]) => (a < b ? -1 : 1))]);
}
/** Baseline results (Current or a pin) persist across requests (and survive cancellation mid-run); a candidate reuses a cached
 * baseline result when it is that baseline, and is otherwise rebuilt per request. */
export class ForecastRunner {
  /** Per (tuning, difficulty): the Lab's difficulty paces the census opponents as it paces the Lab's own. */
  private baselineWaves = new Map<string, Memo<WaveForecast[]>>();
  private census(tuning: CombatTuning | undefined, difficulty: Difficulty) {
    return new Memo(censusForecast(tuning, policy.seedsPerWave, undefined, difficulty), policy.seedsPerWave * 4);
  }
  /** Per (tuning, lab). */
  private baselineDuels = new Map<string, Memo<DuelForecast>>();
  private duelMemo(tuning: CombatTuning, lab: LabConfig) {
    return new Memo(duelForecast(tuning, { lab, duels: policy.labDuels, competence: policy.duelPlayerCompetence, capS: policy.duelCapS }), policy.labDuels);
  }
  private keys(tuning: CombatTuning, setup: LabConfig) {
    const lab = labConfigOf(setup), t = tuningKey(tuning);
    return { lab, tuning: t, waves: JSON.stringify([t, lab.difficulty ?? defaultDifficulty]), duel: JSON.stringify([t, lab]) };
  }
  /** Returns the remaining fight count and a generator that yields once per fight. */
  plan(req: ForecastRequest): { total: number; steps: Generator<number, ForecastResult> } {
    const baseTuning = req.baseline?.tuning ?? makeTuning(), base = this.keys(baseTuning, req.baseline?.lab ?? req.lab), cand = this.keys(req.tuning, req.lab);
    const census = (tuning: CombatTuning, k: typeof base) => this.census(k.tuning ? tuning : undefined, k.lab.difficulty ?? defaultDifficulty);
    let current = this.baselineWaves.get(base.waves), duel = this.baselineDuels.get(base.duel);
    if (!current) this.baselineWaves.set(base.waves, (current = census(baseTuning, base)));
    if (!duel) this.baselineDuels.set(base.duel, (duel = this.duelMemo(baseTuning, base.lab)));
    const waves = this.baselineWaves.get(cand.waves) ?? census(req.tuning, cand);
    const candidateDuel = this.baselineDuels.get(cand.duel) ?? this.duelMemo(req.tuning, cand.lab);
    const same = waves === current && candidateDuel === duel;
    const pending = [...new Set<Memo<unknown>>([current, duel, waves, candidateDuel])].filter((m) => m.value === undefined);
    const total = pending.reduce((n, m) => n + m.left, 0);
    const currentWaves = current, currentDuel = duel;
    function* steps(): Generator<number, ForecastResult> {
      let done = 0;
      for (const m of pending) for (const _ of m.drive()) yield ++done;
      return { id: req.id, sameAsCurrent: same, current: { waves: currentWaves.value!, duel: currentDuel.value! }, candidate: { waves: waves.value!, duel: candidateDuel.value! } };
    }
    return { total, steps: steps() };
  }
}
export function runForecast(req: ForecastRequest, runner = new ForecastRunner()): ForecastResult {
  return drain(runner.plan(req).steps);
}
