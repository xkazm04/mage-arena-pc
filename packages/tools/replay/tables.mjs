import { readFileSync } from 'node:fs';
import { tableNames } from '../../director/src/data.ts';
export const designRoot = new URL('../../../docs/design/reconciled/', import.meta.url);
// The director's camp tables plus the canon that core imports directly, so check() sees every reference.
export const checkedNames = [...tableNames, 'camp-play', 'parley', 'season-bridge', 'arena/arena-tiers'];
export function loadTables(root = designRoot) {
  return Object.fromEntries(checkedNames.map(name => [name, JSON.parse(readFileSync(new URL(`data/${name}.json`, root), 'utf8'))]));
}
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
