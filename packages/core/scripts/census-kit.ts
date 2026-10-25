// Census kit (challenge 2026-10-25): the one fight runner and report harness every census shares. A census fight is a Games made
// here (censusGames, buildGames: the only createGames call sites for census fights in scripts/) and stepped to its end by runCensus,
// with read-only observers that watch each step's new events beside the state; they never write it, so every fight hashes as its
// plain census fight. The writers share parseCensusArgs, fightDigest, one median/quantile policy and the evidence envelope.
// Pure apart from writeEvidence (the writers' one file sink).
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createGames, presets, runtime, stepGames, ticks, type ArenaEvent, type Games } from '../src/arena/index.ts';
import { rivalBuilds } from '../src/arena/archetypes.ts';
import { withheldBranches, type PlanBranch, type PlanCounts } from '../src/arena/plan-trace.ts';

/** The createGames options a census fight may pass (schoolRivals, enemyLevel, spellRanks, rivalBuild, opponentMage, ...). */
export type CensusOptions = NonNullable<Parameters<typeof createGames>[7]>;
/** A read-only reading: called after every step with the events that step added. */
export interface CensusObserver { step(g: Games, events: readonly ArenaEvent[]): void }

/** A census Games: `compositionName` (default the reference preset) on `wave`, the reference player, `options` as given. */
export function censusGames(seed: number, wave: number, options: CensusOptions = {}, compositionName = runtime.games.referencePreset): Games {
  const composition = presets.find(p => p.name === compositionName); if (!composition) throw Error(`Unknown composition ${compositionName}`);
  return createGames(seed, composition, wave, true, undefined, undefined, undefined, options);
}
/** A builds-census Games: the authored rival build on its own wave (createGames `rivalBuild`), `options` beside it. */
export function buildGames(seed: number, buildId: string, compositionName = runtime.games.referencePreset, options: CensusOptions = {}) {
  const build = rivalBuilds[buildId]; if (!build) throw Error(`Unknown build ${buildId}`);
  const g = censusGames(seed, build.wave, { ...options, rivalBuild: buildId }, compositionName);
  return { g, build, rival: g.state.actors.find(a => a.schoolState !== undefined && a.team !== g.player.team)! };
}
/** Step `g` until the bout ends or `maxSeconds` of state ticks pass, each observer reading every step's new events. */
export function runCensus(g: Games, maxSeconds = runtime.games.fightTimeoutS, observers: readonly CensusObserver[] = []): Games {
  while (g.phase === 'active' && g.state.tick < ticks(maxSeconds)) {
    const eventsBefore = g.state.events.length; stepGames(g);
    if (observers.length) { const events = g.state.events.slice(eventsBefore); for (const o of observers) o.step(g, events); }
  }
  return g;
}
/** The reference player's result: a bout still active at the cap is a timeout. */
export const outcomeOf = (g: Games): 'timeout' | 'loss' | 'win' => g.phase === 'active' ? 'timeout' : g.phase === 'lost' ? 'loss' : 'win';

/** A cell's digest: sha256 over `seed:hash` per fight, newline-joined, in fight order (every committed evidence digest). */
export const fightDigest = (fights: readonly { seed: number; hash: string }[]): string => createHash('sha256').update(fights.map(f => `${f.seed}:${f.hash}`).join('\n')).digest('hex');
/** The value at floor(n * q) of the sorted values (clamped to the last); null when there are none. One policy for every census. */
export function quantile(values: readonly number[], q: number): number | null {
  if (!values.length) return null;
  return [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * q))]!;
}
export const median = (values: readonly number[]): number | null => quantile(values, 0.5);
export const share = (part: number, whole: number): number | null => whole ? part / whole : null;

/** The plan-branch ledger over a build's fights: each branch's share of the plan's decisions (sums to 1), and the share where the
 * plan withheld (null when no fight was traced). Why the build pressed what it pressed, beside the cast roles (what). */
export function planBranches(fights: { branches: PlanCounts }[]): { branches: Partial<Record<PlanBranch, number>>; withheldShare: number | null } {
  const counts: PlanCounts = {};
  for (const f of fights) for (const [b, n] of Object.entries(f.branches) as [PlanBranch, number][]) counts[b] = (counts[b] ?? 0) + n;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const withheld = (Object.entries(counts) as [PlanBranch, number][]).filter(([b]) => withheldBranches.has(b)).reduce((a, [, n]) => a + n, 0);
  return { branches: Object.fromEntries((Object.entries(counts) as [PlanBranch, number][]).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).map(([b, n]) => [b, n / total])), withheldShare: share(withheld, total) };
}
/** The report's why segment: the top three branches by share, in rounded percent. */
export const whyLine = (branches: Record<string, number>): string =>
  `why ${Object.entries(branches).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([b, v]) => `${b} ${Math.round(v * 100)}`).join(' ')}`;

/** Where a census writer may put evidence (repo-relative): the waves evidence folders or the change-request inbox. */
export const evidenceDir = /^docs\/(?:waves|change-requests)\/[A-Za-z0-9-]+$/;
const tagPattern = /^[a-z0-9-]+$/;
export interface CensusArgs { count: number; tag: string | undefined; outDir: string; arg(name: string): string | undefined }
/** The writers' shared flags: `--count n` (a whole number >= 1), `--tag t` (lower-case, digits, dashes), `--out-dir docs/...`
 * (evidenceDir). Throws 'Invalid report arguments' on any bad one; `arg` reads a writer's own flags. */
export function parseCensusArgs(argv: readonly string[], defaults: { count?: number; tag?: string; outDir?: string } = {}): CensusArgs {
  const arg = (name: string): string | undefined => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const count = Number(arg('--count') ?? defaults.count ?? 200), tag = arg('--tag') ?? defaults.tag, outDir = arg('--out-dir') ?? defaults.outDir ?? 'docs/waves/W8-evidence';
  if (!Number.isInteger(count) || count < 1 || (tag !== undefined && !tagPattern.test(tag)) || !evidenceDir.test(outDir)) refuseArgs();
  return { count, tag, outDir, arg };
}
/** A writer's own argument check failed. */
export function refuseArgs(): never { throw Error('Invalid report arguments'); }
/** The command line a writer records: the npm script and the arguments it was given. */
export const censusCommand = (script: string, argv: readonly string[]): string => `npm --prefix packages/core run ${script}${argv.length ? ` -- ${argv.join(' ')}` : ''}`;
/** The head every evidence file carries: label 'simulated', the command, the seed range of `count` census seeds, the reference player. */
export function evidenceEnvelope({ command, count, reference = {} }: { command: string; count: number; reference?: Record<string, unknown> }) {
  return { label: 'simulated' as const, command, seedRange: [runtime.games.censusSeedStart, runtime.games.censusSeedStart + count - 1] as [number, number],
    reference: { competence: runtime.games.referenceCompetence, preset: runtime.games.referencePreset, ...reference } };
}
/** Write `<file>` (JSON, two-space, trailing newline) under the repo-relative `outDir` (evidenceDir), making the folder. */
export function writeEvidence(outDir: string, file: string, body: unknown): void {
  if (!evidenceDir.test(outDir)) refuseArgs();
  const destination = new URL(`../../../${outDir}/`, import.meta.url); mkdirSync(destination, { recursive: true });
  writeFileSync(new URL(file, destination), JSON.stringify(body, null, 2) + '\n');
}
