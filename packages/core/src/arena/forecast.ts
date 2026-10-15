import { runFight, tiro } from './games.ts';
import { ticks, runtime } from './kernel.ts';
import { createLab, stepLab, type LabConfig } from './lab.ts';
import { attachMageAI, mageInput } from './mage-ai.ts';
import { makeTuning, tuningFields, validateTuning, type CombatTuning } from './tuning.ts';

/** Census forecast for a Lab tuning: the reference policy fights fixed seeds; never a difficulty verdict. */
export interface ForecastFight { seed: number; outcome: string; durationS: number; hash: string; perfects: number; incomingHits: number }
export interface WaveForecast { wave: number; kind: string; targetDurationS: [number, number]; fights: ForecastFight[]; medianDurationS: number | null; inBand: boolean; winRate: number; perfectRate: number; timeouts: number }
export interface DuelForecast { duels: number; wins: number; winRate: number; ttkMedianS: number | null; damagePerMana: number | null }
export interface DuelPlan { lab: LabConfig; duels: number; competence: number; capS: number }

const median = (v: number[]) => v.length ? [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]! : null;
/** True when `t` is the Current preset; such a forecast runs the census path untouched (no state tuning, identical hashes). */
export function isCurrentTuning(t: CombatTuning): boolean {
  const current = makeTuning();
  return tuningFields.every(f => t[f.key] === current[f.key]) && !Object.keys(t.spells).length;
}
/** Yields after each fight so a host can interleave cancellation; returns per-wave summaries like report-w4. */
export function* censusForecast(tuning: CombatTuning | undefined, seedsPerWave: number, seedStart = runtime.games.censusSeedStart): Generator<number, WaveForecast[]> {
  if (!Number.isInteger(seedsPerWave) || seedsPerWave < 1 || !Number.isInteger(seedStart) || seedStart < 0) throw Error('Invalid forecast plan');
  const effective = tuning && !isCurrentTuning(tuning) ? validateTuning(tuning) : undefined, waves: WaveForecast[] = [];
  for (let wave = 0; wave < tiro.waves.length; wave++) {
    const fights: ForecastFight[] = [];
    for (let i = 0; i < seedsPerWave; i++) {
      const f = runFight(seedStart + i, wave, runtime.games.fightTimeoutS, effective);
      fights.push({ seed: f.seed, outcome: f.outcome, durationS: f.durationS, hash: f.hash, perfects: f.perfects, incomingHits: f.incomingHits });
      yield fights.length + wave * seedsPerWave;
    }
    const target = tiro.waves[wave]!.targetDurationS as [number, number], m = median(fights.filter(f => f.outcome !== 'timeout').map(f => f.durationS));
    waves.push({ wave: wave + 1, kind: tiro.waves[wave]!.kind, targetDurationS: [target[0], target[1]], fights, medianDurationS: m, inBand: m !== null && m >= target[0] && m <= target[1],
      winRate: fights.filter(f => f.outcome === 'win').length / fights.length, timeouts: fights.filter(f => f.outcome === 'timeout').length,
      perfectRate: fights.reduce((n, f) => n + f.perfects, 0) / Math.max(1, fights.reduce((n, f) => n + f.incomingHits, 0)) });
  }
  return waves;
}
/** The CF2 duel loop (packages/tools/src/cf-report.ts) over the current Lab setup, always against the mage rival. */
export function* duelForecast(tuning: CombatTuning, plan: DuelPlan): Generator<number, DuelForecast> {
  if (!Number.isInteger(plan.duels) || plan.duels < 1 || !Number.isInteger(plan.competence) || !(plan.capS > 0)) throw Error('Invalid duel plan');
  const t = validateTuning(tuning), rows: { win: boolean; ttk: number | null; damage: number; mana: number }[] = [];
  for (let i = 0; i < plan.duels; i++) {
    const l = createLab({ ...plan.lab, opponent: 'mage', randomSeed: false, seed: (plan.lab.seed + i) % 0x100000000 }, t), { state, player, dummy } = l.training;
    attachMageAI(player, plan.competence);
    while (state.tick < ticks(plan.capS) && !player.tags.includes('DEFEATED') && !dummy.tags.includes('DEFEATED')) stepLab(l, mageInput(state, player), false);
    rows.push({ win: dummy.tags.includes('DEFEATED'), ttk: l.metrics.timeToKillS, damage: l.metrics.practiceDamage, mana: l.metrics.manaSpent });
    yield rows.length;
  }
  const mana = rows.reduce((n, r) => n + r.mana, 0), wins = rows.filter(r => r.win).length;
  return { duels: rows.length, wins, winRate: wins / rows.length, ttkMedianS: median(rows.flatMap(r => r.win && r.ttk !== null ? [r.ttk] : [])), damagePerMana: mana ? rows.reduce((n, r) => n + r.damage, 0) / mana : null };
}
export function drain<T>(steps: Generator<number, T>): T {
  for (;;) { const next = steps.next(); if (next.done) return next.value; }
}
export interface ForecastDelta { wave: number; medianDurationS: number | null; medianDeltaS: number | null; targetDurationS: [number, number]; inBand: boolean; winRateDelta: number; perfectRateDelta: number }
/** Candidate minus Current, per wave; read-only, never a band. */
export function forecastDeltas(current: WaveForecast[], candidate: WaveForecast[]): ForecastDelta[] {
  return candidate.map((c, i) => {
    const base = current[i]!;
    return { wave: c.wave, medianDurationS: c.medianDurationS, medianDeltaS: c.medianDurationS === null || base.medianDurationS === null ? null : c.medianDurationS - base.medianDurationS,
      targetDurationS: c.targetDurationS, inBand: c.inBand, winRateDelta: c.winRate - base.winRate, perfectRateDelta: c.perfectRate - base.perfectRate };
  });
}
