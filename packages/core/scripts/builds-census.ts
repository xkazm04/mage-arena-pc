// Builds census (spark combat-system-depth WP2): each authored rival build (arena/data/rival-builds.json) against the reference
// player on the build's wave, the PC overlay on, no named phases (every build on the same footing). Pure: no I/O, like
// named-census.ts, so report-builds.ts and builds-census.test.ts share one runner. The fight is the census kit's (census-kit.ts):
// buildGames, runCensus and the builds reading as a read-only observer.
// The curve signature (owner target, spark wave 5): the rival's win share among fights that end before the reference player's
// tier III unlock, against its win share among fights that reach the reference player's tier IV.
import { combat, runtime, seconds, spells, stateHash, threats, tiro, type Actor, type Games } from '../src/arena/index.ts';
import { answersShape, rivalBuilds, roleOf } from '../src/arena/archetypes.ts';
import { schoolSpellById } from '../src/arena/schools.ts';
import type { ShapeClass } from '../src/arena/mage-ai.ts';
import { enablePlanTrace, planTrace, type PlanCounts } from '../src/arena/plan-trace.ts';
import { buildGames, median, outcomeOf, planBranches, runCensus, share, type CensusObserver, type CensusOptions } from './census-kit.ts';
export { evidenceDir, planBranches, whyLine } from './census-kit.ts';

/** Director target (spark wave 5), not canon: the reference player's win rate against each build. */
export const buildWinRateTarget: readonly [number, number] = [0.4, 0.65];
/** Distance-over-time buckets (seconds from the bell). */
export const distanceBucketS = 15;
export type AnswerReading = 'answered' | 'other' | 'none';
/** Tide Ward, the Water row that answers beams (read for a player composition that slots the mend line). */
const tideWard = spells.find(s => s.effect === 'ward')!;
const answerReading = (aimed: (ShapeClass | undefined)[], shape: ShapeClass): AnswerReading => aimed.includes(shape) ? 'answered' : aimed.length ? 'other' : 'none';

/** The builds reading as a read-only observer on a build fight: the rival's casts, what each answer met, exchanges and their full
 * hits, and the rival-to-player distance over time. */
export function buildsObserver(g: Games, rival: Actor) {
  const casts: Record<string, number> = {}, answers: Record<string, Record<AnswerReading, number>> = {};
  const distanceSum: number[] = [], distanceSteps: number[] = []; let distanceTotal = 0, steps = 0;
  // Exchanges (D1 section 6): an exchange is one side's run of landed blows until the other side lands one; its full hits are the
  // blows that went through unguarded (no ward, no exchange window). Hits per exchange = full hits / exchanges.
  let cleanHits = 0, exchanges = 0, lastHitter = 0;
  const observer: CensusObserver = { step(_, events) {
    for (const e of events) {
      if (e.kind === 'hit' && e.value > 0 && (e.actorId === rival.id || e.actorId === g.player.id) && e.targetId !== e.actorId) {
        if (e.targetId !== lastHitter) { exchanges++; lastHitter = e.targetId ?? 0; }
        if (!e.guarded) cleanHits++;
      }
      if (e.actorId === g.player.id && e.kind === 'release' && e.spellId === tideWard.id) {
        const reading = answerReading(threats(g.state, g.player).filter(t => t.aimedAtUs).map(t => t.shape), 'beam');
        answers[tideWard.id] ??= { answered: 0, other: 0, none: 0 }; answers[tideWard.id]![reading]++;
      }
      if (e.actorId !== rival.id || e.kind !== 'release') continue;
      const id = e.spellId ?? 'staff'; casts[id] = (casts[id] ?? 0) + 1;
      const spell = e.spellId ? schoolSpellById(e.spellId) : undefined, shape = spell && answersShape(spell);
      if (!spell || !shape) continue;
      // What the answer met: an aimed blow of its own shape class, only other classes, or nothing aimed (read on the release tick).
      // Close pressure is also a body inside the answer's reach (archetypes.ts answers a pressed Ring the same way).
      const pressed = shape === 'close' && Math.hypot(rival.pos.x - g.player.pos.x, rival.pos.y - g.player.pos.y) <= spell.rangeM + g.player.radius;
      const reading = pressed ? 'answered' : answerReading(threats(g.state, rival).filter(t => t.aimedAtUs).map(t => t.shape), shape);
      answers[spell.id] ??= { answered: 0, other: 0, none: 0 }; answers[spell.id]![reading]++;
    }
    const d = Math.hypot(rival.pos.x - g.player.pos.x, rival.pos.y - g.player.pos.y), bucket = Math.floor(seconds(g.state.tick - g.waveStartTick) / distanceBucketS);
    distanceSum[bucket] = (distanceSum[bucket] ?? 0) + d; distanceSteps[bucket] = (distanceSteps[bucket] ?? 0) + 1;
    distanceTotal += d; steps++;
  } };
  const reading = () => ({ casts, answers, cleanHits, exchanges, meanDistanceM: distanceTotal / Math.max(1, steps), distanceByBucket: distanceSum.map((sum, i) => sum / Math.max(1, distanceSteps[i]!)) });
  return { observer, reading };
}

/** `compositionName` swaps the reference preset (a supplement: 'Mirror tide' slots Tide Ward, which Rotation does not);
 * `week` adds the week sweep's enemy level, reference spell ranks and mage-side arm (week-census.ts weekOptions); `trace` counts the
 * rival's plan branches (plan-trace.ts, outside the hashed state: the fight and its hash are the same with it off). */
export function runBuildFight(seed: number, buildId: string, maxSeconds = runtime.games.fightTimeoutS, compositionName = runtime.games.referencePreset, week: Pick<CensusOptions, 'enemyLevel' | 'spellRanks' | 'opponentMage' | 'exchangeReach' | 'rankDefence' | 'referenceRange'> = {}, trace = true) {
  const { g, build, rival } = buildGames(seed, buildId, compositionName, week);
  if (trace) enablePlanTrace(g.state);
  const builds = buildsObserver(g, rival);
  runCensus(g, maxSeconds, [builds.observer]);
  const { casts, answers, cleanHits, exchanges, meanDistanceM, distanceByBucket } = builds.reading();
  // unlockTicks[0] is the tier I start; [2] is the tier III unlock, [3] tier IV.
  const playerTier = g.player.tier;
  return { seed, build: buildId, school: build.school, archetype: build.archetype, wave: build.wave + 1, rival: rival.label,
    outcome: outcomeOf(g), durationS: seconds(g.state.tick - g.waveStartTick),
    endedBeforeTier3: playerTier < 3, reachedTier4: playerTier >= 4, hp: g.player.hp, rivalHp: rival.hp, rivalMaxHp: rival.maxHp,
    casts, answers, branches: { ...planTrace(g.state)?.get(rival.id) } as PlanCounts, cleanHits, exchanges, meanDistanceM, distanceByBucket,
    hash: stateHash(g.state) };
}
export type BuildFight = ReturnType<typeof runBuildFight>;


/** One build's reading: win rate, median, the curve signature, the cast histogram (share of releases), mean distance, answers. */
export function summariseBuild(fights: BuildFight[]) {
  const first = fights[0]!, build = rivalBuilds[first.build]!, count = fights.length;
  const losses = fights.filter(f => f.outcome === 'loss'), wins = fights.filter(f => f.outcome === 'win'), completed = fights.filter(f => f.outcome !== 'timeout');
  const short = fights.filter(f => f.endedBeforeTier3 && f.outcome !== 'timeout'), long = fights.filter(f => f.reachedTier4 && f.outcome !== 'timeout');
  const casts: Record<string, number> = {}, answers: Record<string, Record<AnswerReading, number>> = {};
  for (const f of fights) {
    for (const [id, n] of Object.entries(f.casts)) casts[id] = (casts[id] ?? 0) + n;
    for (const [id, r] of Object.entries(f.answers)) { answers[id] ??= { answered: 0, other: 0, none: 0 }; for (const k of ['answered', 'other', 'none'] as const) answers[id]![k] += r[k]; }
  }
  const cleanHits = fights.reduce((a, f) => a + f.cleanHits, 0), exchanges = fights.reduce((a, f) => a + f.exchanges, 0);
  const totalCasts = Object.values(casts).reduce((a, b) => a + b, 0);
  const histogram = Object.fromEntries(Object.entries(casts).sort((x, y) => y[1] - x[1]).map(([id, n]) => [id, n / Math.max(1, totalCasts)]));
  const roles: Record<string, number> = {};
  for (const [id, n] of Object.entries(casts)) { const s = schoolSpellById(id), role = s ? roleOf(s) : 'staff'; roles[role] = (roles[role] ?? 0) + n / Math.max(1, totalCasts); }
  const buckets = Math.max(...fights.map(f => f.distanceByBucket.length));
  const distanceOverTime = Array.from({ length: buckets }, (_, i) => { const xs = fights.map(f => f.distanceByBucket[i]).filter((v): v is number => v !== undefined); return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length); });
  const target = tiro.waves[build.wave]!.targetDurationS as [number, number], winRate = wins.length / Math.max(1, count), p50 = median(completed.map(f => f.durationS));
  return { build: build.id, school: build.school, archetype: build.archetype, wave: build.wave + 1, rival: first.rival, fights: count,
    winRate, rivalWinShare: losses.length / Math.max(1, count), timeouts: count - completed.length, medianS: p50, targetDurationS: target,
    medianInBand: p50 !== null && p50 >= target[0] && p50 <= target[1], winRateInRange: winRate >= buildWinRateTarget[0] && winRate <= buildWinRateTarget[1],
    curve: { shortFights: short.length, rivalShareShort: share(short.filter(f => f.outcome === 'loss').length, short.length),
      tier4Fights: long.length, rivalShareTier4: share(long.filter(f => f.outcome === 'loss').length, long.length) },
    hitsPerExchange: cleanHits / Math.max(1, exchanges), histogram, roles, meanDistanceM: fights.reduce((a, f) => a + f.meanDistanceM, 0) / Math.max(1, count), distanceOverTime, answers,
    ...planBranches(fights) };
}
export type BuildSummary = ReturnType<typeof summariseBuild>;
/** The shape class each answer row answers, for the report legend. */
export const answerClasses = (): Record<string, ShapeClass> => Object.fromEntries(Object.values(rivalBuilds).flatMap(b => b.loadout.slots).map(id => [id, answersShape(schoolSpellById(id)!)]).filter((e): e is [string, ShapeClass] => e[1] !== undefined));
/** Combat pacing constant re-exported for the writer's methodology line. */
export const simStepHz = combat.simStepHz;
