// Builds census writer (spark combat-system-depth WP2): `npm --prefix packages/core run census:builds -- [--count n] [--only id,id] [--tag t]
// [--exchange on|off] [--ranks build:spell=rank,...] [--out-dir docs/...]`. `--exchange off` is the before arm of D1's exchange windows (exchange.ts), nothing else changed.
// Runs every authored rival build (arena/data/rival-builds.json) against the reference player on the build's wave and prints one
// summary line per build: reference win rate, rival win share, median, the curve signature, mean distance, cast roles (what), the plan's
// top branches and withhold share (why, plan-trace.ts). With --tag it
// also writes `<tag>.json` (summaries with a per-build digest, no per-fight rows) to docs/waves/W8-evidence/ or --out-dir.
import { performance } from 'node:perf_hooks';
import { runtime } from '../src/arena/index.ts';
import { rivalBuildIds, rivalBuilds } from '../src/arena/archetypes.ts';
import { ultimateFor } from '../src/arena/progression.ts';
import { exchangeOff } from '../src/arena/exchange.ts';
import { brandDragArms, withBrandDrag } from '../src/arena/brand-drag.ts';
import { buildWinRateTarget, runBuildFight, summariseBuild, whyLine } from './builds-census.ts';
import { censusCommand, evidenceEnvelope, fightDigest, parseCensusArgs, refuseArgs, writeEvidence } from './census-kit.ts';

const args = process.argv.slice(2), { count, tag, outDir, arg } = parseCensusArgs(args), only = arg('--only')?.split(','), exchange = arg('--exchange') ?? 'on', brandDrag = arg('--brand-drag');
// `--ranks build:spell=rank,...` overrides a build's spell ranks for this run only (how an ultimate is judged: rank 4 vs rank 5 in its build).
const rankOverrides = (arg('--ranks')?.split(',') ?? []).map(entry => /^([a-z_]+):([a-z_]+)=([1-5])$/.exec(entry));
if (rankOverrides.some(m => !m || !rivalBuilds[m[1]!] || (Number(m[3]) === 5 && !ultimateFor(m[2]!, 5)))) throw Error('Invalid --ranks (build:spell=rank, rank 5 only on a row with an ultimate form)');
for (const m of rankOverrides) rivalBuilds[m![1]!]!.spellRanks = { ...rivalBuilds[m![1]!]!.spellRanks, [m![2]!]: Number(m![3]) };
// `--brand-drag reserve|early|quick` selects one off-by-default Brand Drag arm (D1 6.13, brand-drag.ts) for this run only.
if (brandDrag !== undefined && !Object.hasOwn(brandDragArms, brandDrag)) refuseArgs();
if (only?.some(id => !rivalBuildIds.includes(id)) || !['on', 'off'].includes(exchange)) refuseArgs();
const start = performance.now(), pct = (x: number | null): string => x === null ? '  -' : `${Math.round(x * 100)}%`.padStart(4);
const run = <T>(body: () => T): T => withBrandDrag(brandDrag, () => exchange === 'off' ? exchangeOff(body) : body());
const summaries = (only ?? rivalBuildIds).map(id => {
  const fights = run(() => Array.from({ length: count }, (_, i) => runBuildFight(runtime.games.censusSeedStart + i, id)));
  const s = { ...summariseBuild(fights), digest: fightDigest(fights) };
  console.log(`${id.padEnd(11)} ${s.rival.padEnd(18)} wave ${s.wave} ref win ${pct(s.winRate)} rival ${pct(s.rivalWinShare)} median ${(s.medianS?.toFixed(1) ?? '-').padStart(5)} s [${s.targetDurationS.join('-')}]`
    + ` | short ${String(s.curve.shortFights).padStart(3)} rival ${pct(s.curve.rivalShareShort)} | tier IV ${String(s.curve.tier4Fights).padStart(3)} rival ${pct(s.curve.rivalShareTier4)} | ${s.meanDistanceM.toFixed(1)} m | hits/exch ${s.hitsPerExchange.toFixed(2)}`
    + ` | ${Object.entries(s.roles).sort((x, y) => y[1] - x[1]).map(([r, v]) => `${r} ${Math.round(v * 100)}`).join(' ')}`
    + ` | ${whyLine(s.branches)} | withheld ${pct(s.withheldShare)}`);
  return s;
});
console.log(`builds census: ${count} fights/build in ${((performance.now() - start) / 1000).toFixed(1)} s (reference win target ${buildWinRateTarget.join('-')}).`);
if (tag) writeEvidence(outDir, `${tag}.json`, { ...evidenceEnvelope({ command: censusCommand('census:builds', args), count }),
  mode: `createGames(..., { rivalBuild }), PC overlay on, exchange windows ${exchange}, no named phases${rankOverrides.length ? `, spell ranks overridden: ${arg('--ranks')}` : ''}${brandDrag ? `, Brand Drag arm ${brandDrag}` : ''}`,
  countPerBuild: count, winRateTarget: buildWinRateTarget, summaries });
