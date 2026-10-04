import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { combat, runFight, runtime, tiro } from '../src/arena/index.ts';
const args = process.argv.slice(2), countIndex = args.indexOf('--count'), tagIndex = args.indexOf('--tag');
const count = countIndex >= 0 ? Number(args[countIndex + 1]) : runtime.games.censusFightsPerWave;
const tag = tagIndex >= 0 ? args[tagIndex + 1]! : 'census';
if (!/^[a-z0-9-]+$/.test(tag) || !Number.isInteger(count) || count < 1) throw Error('Invalid report arguments');
const directoryIndex = args.indexOf('--evidence'), evidence = directoryIndex >= 0 ? args[directoryIndex + 1]! : 'W4-evidence';
if (!/^(?:W(?:4|4b|7)|U[12456]|CF[12]|H1)-evidence$/.test(evidence)) throw Error('Invalid evidence directory');
const destination = new URL(`../../../docs/waves/${evidence}/`, import.meta.url); mkdirSync(destination, { recursive: true });
const quantile = (values: number[], q: number): number => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * q))] ?? 0;
const summary = (values: number[]) => ({ min: Math.min(...values), p10: quantile(values, 0.1), p50: quantile(values, 0.5), p90: quantile(values, 0.9), max: Math.max(...values) });
const start = performance.now(); const waves = []; let allPassed = true;
for (let wave = 0; wave < tiro.waves.length; wave++) {
  const fights = [];
  for (let i = 0; i < count; i++) fights.push(runFight(runtime.games.censusSeedStart + i, wave));
  const completed = fights.filter(f => f.outcome !== 'timeout'), wins = fights.filter(f => f.outcome === 'win');
  const duration = summary(completed.map(f => f.durationS)), target = tiro.waves[wave]!.targetDurationS;
  const replayFailures = fights.filter((_, i) => i % runtime.games.sampleReplayStride === 0).filter(f => runFight(f.seed, wave).hash !== f.hash).map(f => f.seed);
  const failures = {
    medianOutOfBand: !completed.length || duration.p50 < target[0] || duration.p50 > target[1],
    timeoutRate: fights.filter(f => f.outcome === 'timeout').length / count > runtime.games.timeoutRateMax,
    earlyDowns: fights.filter(f => f.outcome === 'loss' && f.durationS < combat.reactionBands.playerDeathNotBeforeS).map(f => f.seed),
    invalidStates: fights.filter(f => !f.finite).map(f => f.seed), replayFailures
  };
  const passed = !failures.medianOutOfBand && !failures.timeoutRate && !failures.earlyDowns.length && !failures.invalidStates.length && !replayFailures.length;
  allPassed &&= passed;
  const report = { wave: wave + 1, kind: tiro.waves[wave]!.kind, fights: count, targetDurationS: target, wins: wins.length, losses: fights.filter(f => f.outcome === 'loss').length,
    timeouts: fights.filter(f => f.outcome === 'timeout').length, durationS: duration, winDurationS: wins.length ? summary(wins.map(f => f.durationS)) : null,
    inBandFraction: completed.filter(f => f.durationS >= target[0] && f.durationS <= target[1]).length / Math.max(1, completed.length),
    deadAirFraction: fights.reduce((sum, f) => sum + f.deadAirBuckets, 0) / fights.reduce((sum, f) => sum + f.buckets, 0),
    perfectRate: fights.reduce((sum, f) => sum + f.perfects, 0) / Math.max(1, fights.reduce((sum, f) => sum + f.incomingHits, 0)),
    finalMana: summary(fights.map(f => f.mana)), finalHp: summary(fights.map(f => f.hp)), failures, passed,
    digest: createHash('sha256').update(fights.map(f => `${f.seed}:${f.hash}`).join('\n')).digest('hex') };
  waves.push(report); writeFileSync(new URL(`${tag}-wave-${wave + 1}.json`, destination), JSON.stringify({ label: 'simulated', summary: report, fights }, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
const report = { label: 'simulated', layout: '94 x 62 m compact oval; scale-contract-v3; original opening separation', supplementalHashes: Object.fromEntries(['art/scale-contract-v3.json', 'packages/core/src/arena/data/runtime.json','packages/core/src/arena/data/feel.json','packages/core/src/arena/data/lab-schools.json','packages/core/src/arena/kernel.ts','packages/core/src/arena/mage-ai.ts','packages/core/src/arena/water.ts'].map(file => [file, createHash('sha256').update(readFileSync(new URL(`../../../${file}`, import.meta.url))).digest('hex')])), command: `npm --prefix packages/core run report:w4${args.length ? ` -- ${args.join(' ')}` : ''}`, countPerWave: count,
  seedRange: [runtime.games.censusSeedStart, runtime.games.censusSeedStart + count - 1], reference: { competence: runtime.games.referenceCompetence, preset: runtime.games.referencePreset, ranks: runtime.training.defaultRanks },
  methodology: 'Independent fresh wave starts, baseline enemy HP/counts/attacks. Both sides use fixed-step combat and resource rules; the reference player is an explicitly authored input policy. Completed-bout median includes wins and losses. No resource refill, forced outcome, duration padding, or dropped seeds. Remaining hostile hazards settle before a clear.',
  wallSecondsMeasured: (performance.now() - start) / 1000, waves, fullCensus: count === runtime.games.censusFightsPerWave, allPassed,
  sourceHashes: Object.fromEntries(['combat.json','spells-water.csv','enemies.json','arena-tiers.json'].map(file => [file, createHash('sha256').update(readFileSync(new URL(`../../../docs/design/reconciled/data/arena/${file}`, import.meta.url))).digest('hex')])) };
writeFileSync(new URL(`${tag}.json`, destination), JSON.stringify(report, null, 2) + '\n');
console.log(`W4 ${tag}: ${count} fights/wave in ${report.wallSecondsMeasured.toFixed(1)} s; gate ${allPassed ? 'PASS' : 'FAIL'}.`);
if (!allPassed && count === runtime.games.censusFightsPerWave) process.exitCode = 1;
