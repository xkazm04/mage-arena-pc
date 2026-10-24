// Named-duel census writer (W8 lane B): `npm --prefix packages/core run census:named -- [--count n] [--tag t] [--out-dir docs/...]`.
// Runs only the semifinal (Brennic, Fire) and the final (Lio, Air) with schoolRivals 'named' and the PC overlay on, and
// writes report-w4-shaped evidence (`<tag>-wave-<n>.json` = { label, summary, fights }, plus `<tag>.json`) to
// docs/waves/W8-evidence/ (or --out-dir), so `npm run vr:tuning-return -- --evidence <wave file>` reads it.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { runtime } from '../src/arena/index.ts';
import { namedWaves, runNamedFight, summariseNamedWave, winRateTarget } from './named-census.ts';
import { evidenceDir } from './builds-census.ts';

const args = process.argv.slice(2), countIndex = args.indexOf('--count'), tagIndex = args.indexOf('--tag');
const count = countIndex >= 0 ? Number(args[countIndex + 1]) : runtime.games.censusFightsPerWave;
const tag = tagIndex >= 0 ? args[tagIndex + 1]! : 'named', outIndex = args.indexOf('--out-dir'), outDir = outIndex >= 0 ? args[outIndex + 1]! : 'docs/waves/W8-evidence';
if (!/^[a-z0-9-]+$/.test(tag) || !Number.isInteger(count) || count < 1 || !evidenceDir.test(outDir)) throw Error('Invalid report arguments');
const destination = new URL(`../../../${outDir}/`, import.meta.url); mkdirSync(destination, { recursive: true });
const start = performance.now(); const waves = []; let allPassed = true;
for (const wave of namedWaves) {
  const fights = [];
  for (let i = 0; i < count; i++) fights.push(runNamedFight(runtime.games.censusSeedStart + i, wave));
  const replayFailures = fights.filter((_, i) => i % runtime.games.sampleReplayStride === 0).filter(f => runNamedFight(f.seed, wave).hash !== f.hash).map(f => f.seed);
  const report = { ...summariseNamedWave(fights, wave, replayFailures), digest: createHash('sha256').update(fights.map(f => `${f.seed}:${f.hash}`).join('\n')).digest('hex') };
  allPassed &&= report.passed;
  waves.push(report); writeFileSync(new URL(`${tag}-wave-${wave + 1}.json`, destination), JSON.stringify({ label: 'simulated', summary: report, fights }, null, 2) + '\n');
  console.log(JSON.stringify({ ...report, answers: undefined }));
}
const hashOf = (file: string): string => createHash('sha256').update(readFileSync(new URL(`../../../${file}`, import.meta.url))).digest('hex');
const report = { label: 'simulated', mode: "createGames(..., { schoolRivals: 'named' }), PC overlay on, rival phases on",
  command: `npm --prefix packages/core run census:named${args.length ? ` -- ${args.join(' ')}` : ''}`, countPerWave: count,
  seedRange: [runtime.games.censusSeedStart, runtime.games.censusSeedStart + count - 1], reference: { competence: runtime.games.referenceCompetence, preset: runtime.games.referencePreset, ranks: runtime.training.defaultRanks },
  winRateTarget, winRateTargetSource: 'Director target 2026-10-23 (W8 lane B brief), not canon',
  methodology: 'Independent fresh wave starts at the semifinal and the final, the named Fire/Air rivals in place of the Water proxies. Same loop, checks and digest as report-w4 (runFight), plus the win-rate check and the CR-005 phase readings. No resource refill, forced outcome, duration padding, or dropped seeds.',
  wallSecondsMeasured: (performance.now() - start) / 1000, waves, fullCensus: count === runtime.games.censusFightsPerWave, allPassed,
  supplementalHashes: Object.fromEntries(['packages/core/src/arena/data/school-balance.pc.json', 'packages/core/src/arena/data/rivals.json', 'packages/core/src/arena/data/runtime.json',
    'packages/core/src/arena/data/feel.json', 'packages/core/src/arena/fire.ts', 'packages/core/src/arena/air.ts', 'packages/core/src/arena/mage-ai.ts', 'packages/core/src/arena/mage-ai-fire.ts',
    'packages/core/src/arena/mage-ai-air.ts', 'packages/core/src/arena/rival-phases.ts', 'packages/core/src/arena/kernel.ts', 'packages/core/src/arena/exchange.ts', 'packages/core/src/arena/data/rival-builds.json'].map(file => [file, hashOf(file)])),
  sourceHashes: Object.fromEntries(['combat.json', 'spells-water.csv', 'spells-fire.csv', 'spells-air.csv', 'schools-combat.json', 'enemies.json', 'arena-tiers.json'].map(file => [file, hashOf(`docs/design/reconciled/data/arena/${file}`)])) };
writeFileSync(new URL(`${tag}.json`, destination), JSON.stringify(report, null, 2) + '\n');
console.log(`W8 named ${tag}: ${count} fights/duel in ${report.wallSecondsMeasured.toFixed(1)} s; gate ${allPassed ? 'PASS' : 'FAIL'}.`);
if (!allPassed && count === runtime.games.censusFightsPerWave) process.exitCode = 1;
