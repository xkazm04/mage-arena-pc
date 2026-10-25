// vr:drift --triage: VR's conformance results replayed with the PC-only event kinds masked (divergences.json), the
// failures grouped by driver and field, each group tagged with the known cause it matches or left as residue. Read-side
// only: the raw report (vr:drift --vectors) stays the default and is printed beside the masked count.
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

export const DIVERGENCES = fileURLToPath(new URL('./divergences.json', import.meta.url));

/** divergences.json, checked: `mask` a list of event kinds, `causes` a list of {id, cr, note, match: {driver?, field, tick?}}. */
export function loadDivergences(path = DIVERGENCES) {
  const d = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(d.mask) || !d.mask.every((k) => typeof k === 'string')) throw new Error(`${path}: mask must be a list of event kinds`);
  if (!Array.isArray(d.causes)) throw new Error(`${path}: causes must be a list`);
  for (const [i, c] of d.causes.entries()) {
    if (typeof c.id !== 'string' || typeof c.cr !== 'string' || typeof c.match?.field !== 'string') throw new Error(`${path}: causes[${i}] needs id, cr and match.field`);
  }
  return { mask: d.mask, causes: d.causes };
}

/** A diff path with its indices dropped: actors[1].x -> actors[].x. */
export const normaliseField = (path) => path.replace(/\[\d+\]/g, '[]');

/** The cause `entry` (a failing result with its driver) matches, as 'id (CR)', or null. */
export function explain(entry, causes = []) {
  const field = normaliseField(entry.record.path);
  const c = causes.find((x) => x.match.field === field && (x.match.driver == null || x.match.driver === entry.driver) && (x.match.tick == null || x.match.tick === entry.record.tick));
  return c ? `${c.id} (${c.cr})` : null;
}

/** Failing results grouped by {driver, normalised field, cause}, largest first: { driver, field, explained, count, names, ticks }. */
export function groupDiffs(entries, causes = []) {
  const groups = new Map();
  for (const e of entries) {
    if (e.pass) continue;
    const field = normaliseField(e.record.path);
    const explained = explain(e, causes);
    const key = `${e.driver}\u0000${field}\u0000${explained}`;
    if (!groups.has(key)) groups.set(key, { driver: e.driver, field, explained, count: 0, names: [], ticks: [e.record.tick, e.record.tick] });
    const g = groups.get(key);
    g.count++;
    g.names.push(e.name);
    g.ticks = [Math.min(g.ticks[0], e.record.tick), Math.max(g.ticks[1], e.record.tick)];
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

/**
 * The triage of one run: `raw` and `masked` are replayConformance results in the same order, each with its vector's
 * `driver`. Returns { total, rawPassed, passed, mask, explained, unexplained } (passed: the masked count).
 */
export function triage(raw, masked, divergences) {
  const groups = groupDiffs(masked, divergences.causes);
  return {
    total: raw.length, rawPassed: raw.filter((r) => r.pass).length, passed: masked.filter((r) => r.pass).length, mask: divergences.mask,
    explained: groups.filter((g) => g.explained), unexplained: groups.filter((g) => !g.explained),
  };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const span = ([a, b]) => (a === b ? `tick ${a}` : `ticks ${a}-${b}`);

/** The --triage section of the drift report. */
export function renderTriage(t) {
  const lines = [`Conformance vectors against PC HEAD: raw ${t.rawPassed}/${t.total} pass, masked ${t.passed}/${t.total} pass (masked: ${t.mask.join(', ')}; the default report is raw)`];
  for (const [title, groups] of [['Explained', t.explained], ['Unexplained', t.unexplained]]) {
    lines.push(`${title}: ${plural(groups.length, 'group')}, ${plural(groups.reduce((n, g) => n + g.count, 0), 'vector')}`);
    for (const g of groups) lines.push(`  ${g.count}  ${g.driver} ${g.field} ${span(g.ticks)}${g.explained ? `  ${g.explained}` : ''}: ${g.names.join(', ')}`);
  }
  return lines;
}
