// Census compare reader (D1 before/after readings): `npm --prefix packages/core run census:compare -- <before.json> <after.json>`.
// Paths resolve from where npm was invoked (the repo root, usually docs/change-requests/evidence/... or docs/waves/W8-evidence/...).
// Reads two evidence files of one census kind (builds, weeks, counters or named) and prints the before -> after markdown table
// with per-row verdicts (census-compare.ts): 'same' (digests equal on the same seeds), 'moved' or 'noise' (two-proportion z on
// the reference win rate), band and range verdicts with 'on edge' from a Wilson 95% interval. Runs no fight, writes nothing.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compareEvidence, renderTable } from './census-compare.ts';

const files = process.argv.slice(2);
if (files.length !== 2 || files.some(f => !f.endsWith('.json'))) throw Error('Invalid report arguments: census:compare -- <before.json> <after.json>');
const base = process.env.INIT_CWD ?? process.cwd();
const [before, after] = files.map(f => JSON.parse(readFileSync(resolve(base, f), 'utf8')) as unknown);
console.log(renderTable(compareEvidence(before, after)));
