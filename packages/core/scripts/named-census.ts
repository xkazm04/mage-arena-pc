// Named-duel census (W8 lane B): the Tiro semifinal and final with schoolRivals 'named' (Brennic Fire, Lio Air), the PC
// balance overlay on, the reference player at runtime.games.referenceCompetence with runtime.games.referencePreset.
// Pure: no I/O, so report-named.ts (the evidence writer) and named-census.test.ts (the pinned claim) share one runner.
// The fight loop is runFight's (games.ts), run by the census kit (census-kit.ts) with the createGames `schoolRivals: 'named'`
// option, which runFight does not pass; the dead-air, resource and answer readings are a read-only observer.
import { combat, createLedger, emptyAnswerCounts, answers as answerKinds, families, observeLedger, runtime, seconds, stateHash, ticks, tiro } from '../src/arena/index.ts';
import { rivalRuntime } from '../src/arena/rival-phases.ts';
import { censusGames, outcomeOf, quantile, runCensus } from './census-kit.ts';

/** The named waves, 0-based Tiro indices: 2 is the semifinal (Brennic), 3 the final (Lio). */
export const namedWaves = [2, 3] as const;
/** Director target (2026-10-23), not canon: the reference player's win rate in each named duel. */
export const winRateTarget: readonly [number, number] = [0.4, 0.65];

export function runNamedFight(seed: number, wave: number, maxSeconds = runtime.games.fightTimeoutS) {
  const g = censusGames(seed, wave, { schoolRivals: 'named' }), ledger = createLedger(g.state, g.player.id);
  const rival = g.state.actors.find(a => a.schoolState !== undefined && a.team !== g.player.team)!;
  const deadAirBuckets: boolean[] = []; let bucketActive = false, resourceSum = 0, steps = 0;
  runCensus(g, maxSeconds, [{ step(_, events) {
    observeLedger(ledger, g.state);
    if (events.some(e => e.kind === 'cast' || e.kind === 'hit') || g.state.projectiles.length || g.state.telegraphs.length || g.state.actors.some(a => a.pending)) bucketActive = true;
    if (g.state.tick % ticks(combat.pacingTargets.deadAirBucketS) === 0) { deadAirBuckets.push(!bucketActive); bucketActive = false; }
    resourceSum += rival.schoolState!.value; steps++;
  } }]);
  const phases = rivalRuntime(g.state);
  return { seed, wave: wave + 1, rival: rival.label, school: rival.schoolState!.school, outcome: outcomeOf(g), durationS: seconds(g.state.tick),
    hp: g.player.hp, mana: g.player.mana, stamina: g.player.stamina, rivalHp: rival.hp, rivalMeanResource: resourceSum / Math.max(1, steps),
    phasesBroken: phases?.phasesBroken ?? 0, signatureCast: phases?.grantUsed ?? false,
    perfects: g.player.metrics.perfects, incomingHits: g.player.metrics.hits, damageDealt: g.player.metrics.damageDealt, damageTaken: g.player.metrics.damageTaken,
    deadAirBuckets: deadAirBuckets.filter(Boolean).length, buckets: deadAirBuckets.length, answers: ledger.counts,
    hash: stateHash(g.state), finite: g.state.actors.every(a => [a.hp, a.mana, a.stamina, a.pos.x, a.pos.y].every(Number.isFinite) && a.hp >= 0 && a.hp <= a.maxHp && a.mana >= 0 && a.mana <= a.maxMana && a.stamina >= 0 && a.stamina <= a.maxStamina) };
}
export type NamedFight = ReturnType<typeof runNamedFight>;

const summary = (values: number[]) => ({ min: Math.min(...values), p10: quantile(values, 0.1), p50: quantile(values, 0.5), p90: quantile(values, 0.9), max: Math.max(...values) });

/** The report-w4 wave summary (fields vr:tuning-return reads), plus the win-rate check and the phase readings. */
export function summariseNamedWave(fights: NamedFight[], wave: number, replayFailures: number[] = []) {
  const count = fights.length, completed = fights.filter(f => f.outcome !== 'timeout'), wins = fights.filter(f => f.outcome === 'win');
  const duration = summary(completed.map(f => f.durationS)), target = tiro.waves[wave]!.targetDurationS as [number, number], winRate = wins.length / Math.max(1, count);
  const failures = {
    medianOutOfBand: duration.p50 === null || duration.p50 < target[0] || duration.p50 > target[1],
    winRateOutOfRange: winRate < winRateTarget[0] || winRate > winRateTarget[1],
    timeoutRate: fights.filter(f => f.outcome === 'timeout').length / count > runtime.games.timeoutRateMax,
    earlyDowns: fights.filter(f => f.outcome === 'loss' && f.durationS < combat.reactionBands.playerDeathNotBeforeS).map(f => f.seed),
    invalidStates: fights.filter(f => !f.finite).map(f => f.seed), replayFailures,
  };
  const answers = emptyAnswerCounts();
  for (const f of fights) for (const family of families) for (const answer of answerKinds) answers[family][answer] += f.answers[family][answer];
  const passed = !failures.medianOutOfBand && !failures.winRateOutOfRange && !failures.timeoutRate && !failures.earlyDowns.length && !failures.invalidStates.length && !replayFailures.length;
  return { wave: wave + 1, kind: tiro.waves[wave]!.kind, rival: fights[0]?.rival ?? null, school: fights[0]?.school ?? null, fights: count, targetDurationS: target,
    wins: wins.length, losses: fights.filter(f => f.outcome === 'loss').length, timeouts: fights.filter(f => f.outcome === 'timeout').length,
    winRate, winRateTarget, durationS: duration, winDurationS: wins.length ? summary(wins.map(f => f.durationS)) : null,
    lossDurationS: count - wins.length ? summary(fights.filter(f => f.outcome === 'loss').map(f => f.durationS)) : null,
    inBandFraction: completed.filter(f => f.durationS >= target[0] && f.durationS <= target[1]).length / Math.max(1, completed.length),
    phases: { reachedPhase2: fights.filter(f => f.phasesBroken >= 1).length / Math.max(1, count), reachedPhase3: fights.filter(f => f.phasesBroken >= 2).length / Math.max(1, count),
      signatureCast: fights.filter(f => f.signatureCast).length / Math.max(1, count) },
    rivalMeanResource: fights.reduce((sum, f) => sum + f.rivalMeanResource, 0) / Math.max(1, count),
    deadAirFraction: fights.reduce((sum, f) => sum + f.deadAirBuckets, 0) / Math.max(1, fights.reduce((sum, f) => sum + f.buckets, 0)),
    perfectRate: fights.reduce((sum, f) => sum + f.perfects, 0) / Math.max(1, fights.reduce((sum, f) => sum + f.incomingHits, 0)),
    finalMana: summary(fights.map(f => f.mana)), finalHp: summary(fights.map(f => f.hp)), answers, failures, passed };
}
