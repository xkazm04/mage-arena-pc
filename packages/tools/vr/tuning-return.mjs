// Tuning return: turns PC's Fire/Air balance overlay into a markdown addendum for VR, one line per deviation from
// VR's canonical value, with optional census evidence. Node built-ins only.
//   npm run vr:tuning-return [-- --evidence <wave json>] [--out <file>] [--overlay <json>] [--canon <dir>]
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
export const DEFAULT_OVERLAY = join(root, 'packages/core/src/arena/data/school-balance.pc.json');
export const DEFAULT_CANON = join(root, 'docs/design/reconciled/data/arena');
export const SCHOOLS = ['fire', 'air'];
// The overlay columns and their CSV cells, as packages/core/src/arena/schools.ts `balanceColumns` / `readRow` read them.
export const COLUMNS = { castS: 'cast_s', cooldownS: 'cooldown_s', mana: 'mana', damage: 'damage', telegraphS: 'telegraph_s', rangeM: 'range_m' };

/** Strict CSV reader for the canon files: no quoting is allowed, and every row has the header's width. */
export function readCsv(path) {
  const lines = readFileSync(path, 'utf8').replace(/\r\n/g, '\n').split('\n').filter((line) => line.length > 0);
  const header = lines[0].split(',');
  return lines.slice(1).map((line, i) => {
    if (line.includes('"')) throw new Error(`${path}:${i + 2}: quoted cells are not read`);
    const cells = line.split(',');
    if (cells.length !== header.length) throw new Error(`${path}:${i + 2}: ${cells.length} cells, header has ${header.length}`);
    return Object.fromEntries(header.map((h, j) => [h, cells[j]]));
  });
}

/** The canonical number for one column, read as schools.ts readRow reads it (a damage cell is its leading number). */
export function canonicalCell(row, column) {
  const cell = row[COLUMNS[column]];
  if (column === 'damage') return /^\d/.test(cell) ? { value: parseFloat(cell), cell } : { value: 0, cell };
  const value = Number(cell);
  if (cell === '' || !Number.isFinite(value)) throw new Error(`${row.id}.${column}: canon cell "${cell}" is not a number`);
  return { value, cell };
}

export function loadCanon(canonDir = DEFAULT_CANON) {
  const spells = new Map();
  for (const school of SCHOOLS) for (const row of readCsv(join(canonDir, `spells-${school}.csv`))) spells.set(row.id, { school, row });
  const identity = JSON.parse(readFileSync(join(canonDir, 'schools-combat.json'), 'utf8'));
  return { spells, identity };
}

const readPath = (source, path) => path.reduce((at, key) => (at && typeof at === 'object' ? at[key] : undefined), source);

/** One resolved line per overlay key; an unknown or non-numeric key throws, as schools.ts overlayProblems refuses it. */
export function deviations(overrides, canon) {
  return Object.entries(overrides).map(([key, value]) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`overlay key ${key}: value is not a finite number`);
    const [head, column, ...rest] = key.split('.');
    if (SCHOOLS.includes(head) && column === 'identity' && rest.length > 0) {
      const canonical = readPath(canon.identity[head], rest);
      if (typeof canonical !== 'number') throw new Error(`overlay key ${key}: schools-combat.json ${head}.${rest.join('.')} is not a number`);
      return { key, source: 'schools-combat.json', canonical, canonicalCell: String(canonical), pc: value };
    }
    const spell = canon.spells.get(head);
    if (!spell || !(column in COLUMNS) || rest.length > 0) throw new Error(`overlay key ${key}: unknown spell or column`);
    const { value: canonical, cell } = canonicalCell(spell.row, column);
    return { key, source: `spells-${spell.school}.csv`, canonical, canonicalCell: cell, pc: value };
  });
}

/** The census summary fields an addendum quotes, from a report-w4.ts wave file ({ label, summary, fights }). */
export function evidenceSummary(json, path) {
  const s = json.summary ?? json;
  const need = ['wave', 'fights', 'wins', 'targetDurationS', 'durationS', 'inBandFraction'];
  const missing = need.filter((k) => s[k] === undefined);
  if (missing.length || typeof s.durationS?.p50 !== 'number') throw new Error(`${path}: not a census wave file (missing ${missing.join(', ') || 'durationS.p50'})`);
  return {
    path, label: json.label ?? null, wave: s.wave, kind: s.kind ?? null, fights: s.fights, wins: s.wins, losses: s.losses ?? null,
    timeouts: s.timeouts ?? null, medianDurationS: s.durationS.p50, band: s.targetDurationS, inBandFraction: s.inBandFraction,
    passed: s.passed ?? null,
  };
}

const num = (n) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(6))));

export function renderAddendum({ lines, evidence, overlayPath }) {
  const out = ['## PC tuning return', '', `Overlay: \`${overlayPath}\``, ''];
  if (lines.length === 0) out.push('PC plays VR\'s canonical numbers: no deviations.');
  else {
    out.push(`Deviations from VR's canonical values (${lines.length}):`, '');
    for (const l of lines) out.push(`- \`${l.key}\`: VR ${num(l.canonical)} -> PC ${num(l.pc)} (${l.source}${Number.isFinite(Number(l.canonicalCell)) ? '' : `, cell "${l.canonicalCell}"`})`);
  }
  if (evidence) {
    const e = evidence;
    out.push('', '### Evidence', '', `Census: \`${e.path}\`${e.label ? ` (${e.label})` : ''}`, '');
    out.push(`- Wave ${e.wave}${e.kind ? ` (${e.kind})` : ''}, ${e.fights} fights`);
    out.push(`- Median duration ${num(e.medianDurationS)} s, band ${e.band[0]}-${e.band[1]} s`);
    out.push(`- Wins ${e.wins} of ${e.fights}${e.losses !== null ? `, losses ${e.losses}` : ''}${e.timeouts !== null ? `, timeouts ${e.timeouts}` : ''}`);
    out.push(`- In-band fraction ${num(e.inBandFraction)}${e.passed !== null ? `; census ${e.passed ? 'passed' : 'failed'}` : ''}`);
  }
  return `${out.join('\n')}\n`;
}

export function tuningReturn({ overlay = DEFAULT_OVERLAY, canon = DEFAULT_CANON, evidence } = {}) {
  const parsed = JSON.parse(readFileSync(overlay, 'utf8'));
  if (!parsed || typeof parsed.overrides !== 'object' || parsed.overrides === null) throw new Error(`${overlay}: no overrides object`);
  const lines = deviations(parsed.overrides, loadCanon(canon));
  const ev = evidence ? evidenceSummary(JSON.parse(readFileSync(evidence, 'utf8')), evidence) : null;
  return { lines, evidence: ev, markdown: renderAddendum({ lines, evidence: ev, overlayPath: overlay === DEFAULT_OVERLAY ? 'packages/core/src/arena/data/school-balance.pc.json' : overlay }) };
}

export function parseArgs(argv) {
  const opts = {};
  const valued = { '--evidence': 'evidence', '--out': 'out', '--overlay': 'overlay', '--canon': 'canon' };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/s);
    const name = valued[flag];
    if (!name) throw new Error(`unknown argument: ${argv[i]}`);
    const value = inline ?? argv[++i];
    if (!value) throw new Error(`${flag} requires a path`);
    opts[name] = value;
  }
  return opts;
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const { markdown } = tuningReturn(opts);
    if (opts.out) writeFileSync(opts.out, markdown);
    else process.stdout.write(markdown);
  } catch (err) {
    process.stderr.write(`vr:tuning-return: ${err.message}\n`);
    process.exitCode = 2;
  }
}

const invoked = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : '';
if (invoked === fileURLToPath(import.meta.url).toLowerCase()) main();
