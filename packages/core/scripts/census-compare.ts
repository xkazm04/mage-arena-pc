// census:compare (D1 6.1 / 6.5 / 6.8 readings): a pure reader over two committed evidence files of one census kind. It
// adapts the four writer shapes - builds `summaries[]`, weeks `cells[].waves/builds`, counters `cells[]`, named `waves[]` -
// to flat cells, aligns them by key and gives every row a verdict: 'same' when the per-cell digests are equal (only when
// both files ran the same seeds), else a two-proportion z-test on the reference win rate ('moved' past |z| 1.96, else
// 'noise'), plus band verdicts for the median and the win-rate range, 'on edge' when a Wilson 95% interval straddles a bound.
// No fight is run here; report-compare.ts reads the files and prints renderTable.

export type CensusKind = 'builds' | 'weeks' | 'counters' | 'named';
export type Range = [number, number];
export type Cell = { key: string; label: string; fights: number; winRate: number; medianS: number | null; digest: string | null;
  targetDurationS: Range | null; winRateTarget: Range | null };
export type Evidence = { kind: CensusKind; command: string | null; count: number | null; seedRange: Range | null; cells: Cell[] };
export type Side = { fights: number; winRate: number; medianS: number | null; digest: string | null; interval: Range; band: string | null; range: string | null };
export type CompareRow = { key: string; label: string; before: Side; after: Side; z: number; verdict: 'same' | 'moved' | 'noise';
  band: string | null; range: string | null; targetDurationS: Range | null; winRateTarget: Range | null };
export type Comparison = { kind: CensusKind; before: Evidence; after: Evidence; warnings: string[]; rows: CompareRow[] };

const Z95 = 1.96;
type Json = Record<string, unknown>;
const isObject = (x: unknown): x is Json => typeof x === 'object' && x !== null && !Array.isArray(x);
const num = (x: unknown): number | null => typeof x === 'number' && Number.isFinite(x) ? x : null;
const range = (x: unknown): Range | null => Array.isArray(x) && x.length === 2 && num(x[0]) !== null && num(x[1]) !== null ? [x[0] as number, x[1] as number] : null;
const str = (x: unknown): string | null => typeof x === 'string' ? x : null;

function cell(raw: unknown, key: string, label: string, medianS: unknown, winRateTarget: Range | null): Cell {
  if (!isObject(raw)) throw Error(`census evidence cell ${key}: not an object`);
  const fights = num(raw.fights), winRate = num(raw.winRate);
  if (fights === null || fights < 1 || winRate === null || winRate < 0 || winRate > 1) throw Error(`census evidence cell ${key}: needs fights and winRate`);
  return { key, label, fights, winRate, medianS: num(medianS), digest: str(raw.digest), targetDurationS: range(raw.targetDurationS), winRateTarget: range(raw.winRateTarget) ?? winRateTarget };
}

/** Adapts one evidence file (parsed JSON) of any census kind to flat cells keyed for alignment. */
export function loadCells(json: unknown): Evidence {
  if (!isObject(json)) throw Error('unknown census evidence shape');
  const target = range(json.winRateTarget), list = (x: unknown): unknown[] => Array.isArray(x) ? x : [];
  const head = { command: str(json.command), count: num(json.countPerBuild ?? json.countPerCell ?? json.countPerWave), seedRange: range(json.seedRange) };
  if (Array.isArray(json.summaries)) return { kind: 'builds', ...head, cells: json.summaries.map(s => isObject(s)
    ? cell(s, String(s.build), String(s.rival ?? ''), s.medianS, target) : cell(s, '?', '', null, target)) };
  if (Array.isArray(json.waves) && json.waves.every(w => isObject(w) && num(w.wave) !== null && isObject(w.durationS))) return { kind: 'named', ...head,
    cells: json.waves.map(w => { const o = w as Json; return cell(o, `wave ${o.wave}`, String(o.rival ?? ''), (o.durationS as Json).p50, target); }) };
  const cells = list(json.cells);
  if (cells.length && cells.every(c => isObject(c) && Array.isArray(c.waves) && Array.isArray(c.builds))) return { kind: 'weeks', ...head,
    cells: cells.flatMap(c => { const o = c as Json; return [...list(o.waves), ...list(o.builds)].map(x => isObject(x)
      ? cell(x, `${o.profile}/week ${o.week}/${x.id}`, String(x.kind ?? ''), x.medianS, target) : cell(x, '?', '', null, target)); }) };
  if (cells.length && cells.every(c => isObject(c) && typeof c.cell === 'string' && typeof c.census === 'string')) return { kind: 'counters', ...head,
    cells: cells.map(c => { const o = c as Json; return cell(o, `${o.census}/${o.cell}`, '', o.medianS, target); }) };
  throw Error('unknown census evidence shape');
}

/** Wilson score 95% interval of a proportion p over n trials. */
export function wilson95(p: number, n: number): Range {
  const z2 = Z95 * Z95, denom = 1 + z2 / n, centre = (p + z2 / (2 * n)) / denom;
  const half = (Z95 * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / denom;
  return [centre - half, centre + half];
}

/** Pooled two-proportion z statistic, after minus before; 0 when the pooled rate leaves no variance. */
export function twoProportionZ(a: number, na: number, b: number, nb: number): number {
  const p = (a * na + b * nb) / (na + nb), se = Math.sqrt(p * (1 - p) * (1 / na + 1 / nb));
  return se === 0 || a === b ? 0 : (b - a) / se;
}

const inside = (x: number, [lo, hi]: Range): boolean => x >= lo && x <= hi;
const straddles = ([lo, hi]: Range, [a, b]: Range): boolean => (lo < a && a < hi) || (lo < b && b < hi);
const transition = (a: string | null, b: string | null): string | null => a === null || b === null ? null : a === b ? b : `${a} -> ${b}`;

function side(c: Cell, target: Range | null, band: Range | null): Side {
  const interval = wilson95(c.winRate, c.fights);
  return { fights: c.fights, winRate: c.winRate, medianS: c.medianS, digest: c.digest, interval,
    band: band && c.medianS !== null ? (inside(c.medianS, band) ? 'in' : 'out') : null,
    range: target ? `${inside(c.winRate, target) ? 'in' : 'out'}${straddles(interval, target) ? ', on edge' : ''}` : null };
}

const sameRange = (a: Range | null, b: Range | null): boolean => a !== null && b !== null && a[0] === b[0] && a[1] === b[1];

/** Aligns two evidence files of one census kind and gives each shared cell its verdicts. */
export function compareEvidence(beforeJson: unknown, afterJson: unknown): Comparison {
  const before = loadCells(beforeJson), after = loadCells(afterJson);
  if (before.kind !== after.kind) throw Error(`different census kinds: ${before.kind} vs ${after.kind}`);
  const warnings: string[] = [], seedsMatch = sameRange(before.seedRange, after.seedRange) && before.count === after.count;
  if (!seedsMatch) warnings.push('seed ranges differ: digest equality not meaningful');
  const afterByKey = new Map(after.cells.map(c => [c.key, c])), beforeKeys = new Set(before.cells.map(c => c.key));
  const onlyBefore = before.cells.filter(c => !afterByKey.has(c.key)).map(c => c.key), onlyAfter = after.cells.filter(c => !beforeKeys.has(c.key)).map(c => c.key);
  if (onlyBefore.length) warnings.push(`only in before: ${onlyBefore.join(', ')}`);
  if (onlyAfter.length) warnings.push(`only in after: ${onlyAfter.join(', ')}`);
  const rows = before.cells.filter(c => afterByKey.has(c.key)).map((a): CompareRow => {
    const b = afterByKey.get(a.key)!, targetDurationS = b.targetDurationS ?? a.targetDurationS, winRateTarget = b.winRateTarget ?? a.winRateTarget;
    const s = side(a, winRateTarget, targetDurationS), t = side(b, winRateTarget, targetDurationS), z = twoProportionZ(a.winRate, a.fights, b.winRate, b.fights);
    const verdict = seedsMatch && a.digest !== null && a.digest === b.digest ? 'same' : Math.abs(z) > Z95 ? 'moved' : 'noise';
    return { key: a.key, label: b.label || a.label, before: s, after: t, z, verdict, band: transition(s.band, t.band), range: transition(s.range, t.range), targetDurationS, winRateTarget };
  });
  return { kind: before.kind, before, after, warnings, rows };
}

/** One decimal, rounded half up on the decimal value (16.45 -> '16.5', where 16.45.toFixed(1) gives '16.4'). */
export function fixed1(x: number): string {
  const tenths = Number((Number(x.toPrecision(12)) * 10).toPrecision(12));
  return (Math.floor(tenths + 0.5) / 10).toFixed(1);
}

const pair = (a: string, b: string): string => a === b ? b : `${a} -> ${b}`;
const pct = (x: number): string => `${fixed1(x * 100)}%`;
const seconds = (x: number | null): string => x === null ? '-' : fixed1(x);

/** The D1-style markdown before/after table, warnings first. */
export function renderTable(c: Comparison): string {
  const lines = [`census:compare (${c.kind}): ${c.rows.length} rows`, `before: ${c.before.command ?? '-'}`, `after: ${c.after.command ?? '-'}`,
    ...c.warnings.map(w => `> warning: ${w}`), '',
    '| cell | rival / kind | n | median s | band | ref win | win 95% | range | z | verdict |', '|---|---|---|---|---|---|---|---|---|---|'];
  for (const r of c.rows) {
    const ci = (s: Side): string => `${fixed1(s.interval[0] * 100)}-${fixed1(s.interval[1] * 100)}`;
    lines.push(`| ${r.key} | ${r.label || '-'} | ${pair(String(r.before.fights), String(r.after.fights))} | ${pair(seconds(r.before.medianS), seconds(r.after.medianS))}`
      + ` | ${r.band ?? '-'}${r.targetDurationS ? ` [${r.targetDurationS.join('-')}]` : ''} | ${pair(pct(r.before.winRate), pct(r.after.winRate))} | ${pair(ci(r.before), ci(r.after))}`
      + ` | ${r.range ?? '-'}${r.winRateTarget ? ` [${r.winRateTarget.join('-')}]` : ''} | ${r.z === 0 ? '0' : r.z.toFixed(2)} | ${r.verdict} |`);
  }
  return lines.join('\n');
}
