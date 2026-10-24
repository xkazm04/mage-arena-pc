// Builds census writer (spark combat-system-depth WP2): `npm --prefix packages/core run census:builds -- [--count n] [--only id,id] [--tag t]
// [--exchange on|off] [--ranks build:spell=rank,...] [--out-dir docs/...]`. `--exchange off` is the before arm of D1's exchange windows (exchange.ts), nothing else changed.
// Runs every authored rival build (arena/data/rival-builds.json) against the reference player on the build's wave and prints one
// summary line per build: reference win rate, rival win share, median, the curve signature, mean distance, cast roles. With --tag it
// also writes `<tag>.json` (summaries with a per-build digest, no per-fight rows) to docs/waves/W8-evidence/ or --out-dir.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { runtime } from '../src/arena/index.ts';
import { rivalBuildIds, rivalBuilds } from '../src/arena/archetypes.ts';
import { ultimateFor } from '../src/arena/progression.ts';
import { exchangeOff } from '../src/arena/exchange.ts';
import { buildWinRateTarget, evidenceDir, runBuildFight, summariseBuild } from './builds-census.ts';

const args = process.argv.slice(2), arg = (name: string): string | undefined => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const count = Number(arg('--count') ?? 200), tag = arg('--tag'), only = arg('--only')?.split(','), exchange = arg('--exchange') ?? 'on', outDir = arg('--out-dir') ?? 'docs/waves/W8-evidence';
// `--ranks build:spell=rank,...` overrides a build's spell ranks for this run only (how an ultimate is judged: rank 4 vs rank 5 in its build).
const rankOverrides = (arg('--ranks')?.split(',') ?? []).map(entry => /^([a-z_]+):([a-z_]+)=([1-5])$/.exec(entry));
if (rankOverrides.some(m => !m || !rivalBuilds[m[1]!] || (Number(m[3]) === 5 && !ultimateFor(m[2]!, 5)))) throw Error('Invalid --ranks (build:spell=rank, rank 5 only on a row with an ultimate form)');
for (const m of rankOverrides) rivalBuilds[m![1]!]!.spellRanks = { ...rivalBuilds[m![1]!]!.spellRanks, [m![2]!]: Number(m![3]) };
if (!Number.isInteger(count) || count < 1 || (tag !== undefined && !/^[a-z0-9-]+$/.test(tag)) || only?.some(id => !rivalBuildIds.includes(id))
  || !['on', 'off'].includes(exchange) || !evidenceDir.test(outDir)) throw Error('Invalid report arguments');
const start = performance.now(), pct = (x: number | null): string => x === null ? '  -' : `${Math.round(x * 100)}%`.padStart(4);
const run = <T>(body: () => T): T => exchange === 'off' ? exchangeOff(body) : body();
const summaries = (only ?? rivalBuildIds).map(id => {
  const fights = run(() => Array.from({ length: count }, (_, i) => runBuildFight(runtime.games.censusSeedStart + i, id)));
  const s = { ...summariseBuild(fights), digest: createHash('sha256').update(fights.map(f => `${f.seed}:${f.hash}`).join('\n')).digest('hex') };
  console.log(`${id.padEnd(11)} ${s.rival.padEnd(18)} wave ${s.wave} ref win ${pct(s.winRate)} rival ${pct(s.rivalWinShare)} median ${s.medianS.toFixed(1).padStart(5)} s [${s.targetDurationS.join('-')}]`
    + ` | short ${String(s.curve.shortFights).padStart(3)} rival ${pct(s.curve.rivalShareShort)} | tier IV ${String(s.curve.tier4Fights).padStart(3)} rival ${pct(s.curve.rivalShareTier4)} | ${s.meanDistanceM.toFixed(1)} m | hits/exch ${s.hitsPerExchange.toFixed(2)}`
    + ` | ${Object.entries(s.roles).sort((x, y) => y[1] - x[1]).map(([r, v]) => `${r} ${Math.round(v * 100)}`).join(' ')}`);
  return s;
});
console.log(`builds census: ${count} fights/build in ${((performance.now() - start) / 1000).toFixed(1)} s (reference win target ${buildWinRateTarget.join('-')}).`);
if (tag) {
  const destination = new URL(`../../../${outDir}/`, import.meta.url); mkdirSync(destination, { recursive: true });
  writeFileSync(new URL(`${tag}.json`, destination), JSON.stringify({ label: 'simulated', mode: `createGames(..., { rivalBuild }), PC overlay on, exchange windows ${exchange}, no named phases${rankOverrides.length ? `, spell ranks overridden: ${arg('--ranks')}` : ''}`,
    command: `npm --prefix packages/core run census:builds -- ${args.join(' ')}`, countPerBuild: count, seedRange: [runtime.games.censusSeedStart, runtime.games.censusSeedStart + count - 1],
    reference: { competence: runtime.games.referenceCompetence, preset: runtime.games.referencePreset }, winRateTarget: buildWinRateTarget, summaries }, null, 2) + '\n');
}
