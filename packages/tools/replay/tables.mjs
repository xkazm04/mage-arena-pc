import { readFileSync } from 'node:fs';
export const designRoot = new URL('../../../docs/design/reconciled/', import.meta.url);
export function loadTables(root = designRoot) {
  return Object.fromEntries(['season', 'death-reservation', 'characters', 'relationships', 'facts', 'schools', 'rules', 'intents', 'goals', 'phrases', 'locations', 'scenarios'].map(name => [name, JSON.parse(readFileSync(new URL(`data/${name}.json`, root), 'utf8'))]));
}
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
