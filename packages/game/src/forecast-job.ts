import {
  censusForecast,
  defaultDifficulty,
  drain,
  duelForecast,
  isCurrentTuning,
  makeTuning,
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
export interface ForecastRequest { id: number; tuning: CombatTuning; lab: LabConfig }
export interface ForecastSide { waves: WaveForecast[]; duel: DuelForecast }
export interface ForecastResult { id: number; current: ForecastSide; candidate: ForecastSide; sameAsCurrent: boolean }
const labKeys = ["opponent", "dummyAttack", "playerSchool", "opponentSchool", "competence", "aggression", "distanceM", "seed", "randomSeed", "composition", "difficulty"] as const;
/** Lab setups carry presentation extras (creature targets); the duel uses only the core setup, always vs the mage rival. */
export function labConfigOf(setup: LabConfig): LabConfig {
  return structuredClone(Object.fromEntries(labKeys.map((k) => [k, setup[k]]))) as unknown as LabConfig;
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
/** Current results persist across requests (and survive cancellation mid-run); candidates are rebuilt per request. */
export class ForecastRunner {
  /** Per difficulty: the Lab's difficulty paces the census opponents as it paces the Lab's own. */
  private currentWavesBy = new Map<Difficulty, Memo<WaveForecast[]>>();
  private census(tuning: CombatTuning | undefined, difficulty: Difficulty) {
    return new Memo(censusForecast(tuning, policy.seedsPerWave, undefined, difficulty), policy.seedsPerWave * 4);
  }
  private currentDuels = new Map<string, Memo<DuelForecast>>();
  private duelMemo(tuning: CombatTuning, lab: LabConfig) {
    return new Memo(duelForecast(tuning, { lab, duels: policy.labDuels, competence: policy.duelPlayerCompetence, capS: policy.duelCapS }), policy.labDuels);
  }
  /** Returns the remaining fight count and a generator that yields once per fight. */
  plan(req: ForecastRequest): { total: number; steps: Generator<number, ForecastResult> } {
    const lab = labConfigOf(req.lab), key = JSON.stringify(lab), same = isCurrentTuning(req.tuning), difficulty = lab.difficulty ?? defaultDifficulty;
    let duel = this.currentDuels.get(key), current = this.currentWavesBy.get(difficulty);
    if (!duel) this.currentDuels.set(key, (duel = this.duelMemo(makeTuning(), lab)));
    if (!current) this.currentWavesBy.set(difficulty, (current = this.census(undefined, difficulty)));
    const work: Memo<unknown>[] = [current, duel];
    const waves = same ? current : this.census(req.tuning, difficulty);
    const candidateDuel = same ? duel : this.duelMemo(req.tuning, lab);
    if (!same) work.push(waves, candidateDuel);
    const pending = [...new Set(work)].filter((m) => m.value === undefined);
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
