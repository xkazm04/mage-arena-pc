// Counter coverage writer (D1 4.2, section 6.4): `npm --prefix packages/core run census:counters -- [--count n] [--tag t]
// [--out-dir docs/...]`. Runs the default census waves (the reference preset) and every rival build twice: against the
// reference preset (the committed builds census) and against 'Mirror tide' (the supplement that slots Tide Ward, which the
// reference preset does not). Prints one line per cell and row: blows of the row's class met while slotted, while castable,
// answered, and the coverage (answered / castable). With --tag it writes `<tag>.json` to --out-dir (default the change-request
// evidence folder). Per-cell digests are the census fights' own (the reader never writes the state).
import { performance } from 'node:perf_hooks';
import { runtime, tiro } from '../src/arena/index.ts';
import { rivalBuildIds, rivalBuilds } from '../src/arena/archetypes.ts';
import { censusCommand, evidenceEnvelope, fightDigest, median, parseCensusArgs, writeEvidence } from './census-kit.ts';
import { addTally, coverage, coverageBuildFight, coverageDefaultFight, defensiveRows, emptyTally, type RowTally } from './counter-coverage.ts';

const args = process.argv.slice(2), { count, tag, outDir } = parseCensusArgs(args, { outDir: 'docs/change-requests/evidence' });
const supplement = 'Mirror tide', start = performance.now(), seeds = Array.from({ length: count }, (_, i) => runtime.games.censusSeedStart + i);
const pct = (x: number | null): string => x === null ? '   -' : `${(x * 100).toFixed(1)}%`.padStart(6);
type Fight = { seed: number; tallies: Record<string, RowTally>; hash: string; outcome: string; durationS: number };
function cell(name: string, census: string, fights: Fight[], band: readonly number[]) {
  const rows: Record<string, RowTally & { coverage: number | null }> = {};
  for (const f of fights) for (const [id, t] of Object.entries(f.tallies)) addTally(rows[id] ??= { ...emptyTally(), coverage: null }, t);
  for (const r of Object.values(rows)) r.coverage = coverage(r);
  for (const [id, r] of Object.entries(rows)) console.log(`${census.padEnd(22)} ${name.padEnd(11)} ${id.padEnd(12)} holders ${String(r.holderFights).padStart(3)} casts ${String(r.casts).padStart(5)}`
    + ` | slotted ${String(r.slotted).padStart(5)} castable ${String(r.reachable).padStart(5)} answered ${String(r.answered).padStart(5)} coverage ${pct(r.coverage)}`);
  const winRate = fights.filter(f => f.outcome === 'win').length / fights.length, medianS = median(fights.filter(f => f.outcome !== 'timeout').map(f => f.durationS));
  console.log(`${census.padEnd(22)} ${name.padEnd(11)} reference wins ${pct(winRate)} median ${medianS?.toFixed(1) ?? '-'} s [${band.join('-')}]`);
  return { cell: name, census, fights: fights.length, winRate, medianS, targetDurationS: band, rows,
    digest: fightDigest(fights) };
}
const cells = [
  ...tiro.waves.map((w, wave) => cell(`wave ${wave + 1}`, 'default', seeds.map(seed => coverageDefaultFight(seed, wave)), w.targetDurationS)),
  ...rivalBuildIds.map(id => cell(id, 'builds', seeds.map(seed => coverageBuildFight(seed, id)), tiro.waves[rivalBuilds[id]!.wave]!.targetDurationS)),
  ...rivalBuildIds.map(id => cell(id, `builds (${supplement})`, seeds.map(seed => coverageBuildFight(seed, id, supplement)), tiro.waves[rivalBuilds[id]!.wave]!.targetDurationS)),
];
// Per row over every cell: the reading 6.4 sets its target from.
const rows = Object.fromEntries(defensiveRows.map(row => {
  const total = emptyTally();
  for (const c of cells) if (c.rows[row.id]) addTally(total, c.rows[row.id]!);
  return [row.id, { name: row.name, school: row.school, tier: row.tier, ...total, coverage: coverage(total) }];
}));
for (const [id, r] of Object.entries(rows)) console.log(`all cells ${id.padEnd(12)} ${r.name.padEnd(16)} slotted ${r.slotted} castable ${r.reachable} answered ${r.answered} coverage ${pct(r.coverage)} casts ${r.casts}`);
console.log(`counter coverage: ${count} fights/cell, ${cells.length} cells in ${((performance.now() - start) / 1000).toFixed(1)} s.`);
if (tag) writeEvidence(outDir, `${tag}.json`, { ...evidenceEnvelope({ command: censusCommand('census:counters', args), count, reference: { supplement } }),
    date: new Date().toISOString().slice(0, 10), countPerCell: count,
    method: 'Threat-answer ledger units (graded contacts plus avoided aimed threats) on every mage holding an answer row; a unit counts when its shape class is one the row answers and it is blockable. slotted: the row is in the loadout; reachable: castable by collar tier at that tick (coverage denominator); answered: the row effect was up at the blow, or the row was released between first sight of the blow and its contact. PC overlay on, exchange windows on.',
    rows, cells });
