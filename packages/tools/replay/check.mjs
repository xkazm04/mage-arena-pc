import { readFileSync } from 'node:fs';
import { canonical, designRoot } from './tables.mjs';
import { goldenNights, lineProblem } from './reference.mjs';

export function lookup(t, path) {
  const parts = path.split('/');
  let op;
  if (parts[0].startsWith('@')) op = parts.shift();
  let value = t;
  for (const key of parts) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value,key)) throw new Error(`Unknown rule reference: ${path}`);
    value = value[key];
  }
  return op === '@count' ? Object.keys(value).length : op === '@keys' ? Object.keys(value) : value;
}

export function render(t, template) {
  return template.replace(/\{\{([^}]+)\}\}/g, (_m,path) => {
    const value = lookup(t,path); return typeof value === 'string' ? value : JSON.stringify(value);
  });
}

export function check(t, fixtures, prose, template) {
  const errors = [];
  if (prose !== render(t,template)) errors.push('prose contradicts authoritative data/template');
  const ids = t.characters.characters.map(c => c.id), verbs = Object.keys(t.intents), places = t.locations.map(p => p.id);
  if (new Set(ids).size !== ids.length) errors.push('duplicate character');
  if (verbs.some(v => !t.phrases[v] || !t.rules.resolutionOrder.includes(v))) errors.push('missing phrase/order');
  for (const [verb,line] of Object.entries(t.phrases)) if (lineProblem(t,line)) errors.push(`invalid phrase ${verb}: ${lineProblem(t,line)}`);
  for (const c of t.characters.characters) {
    if (!Object.hasOwn(t.goals,c.goal.id)) errors.push(`unknown goal ${c.id}`);
    if (c.knowledgeSeed.some(id => !t.facts.some(f => f.id === id))) errors.push(`unknown knowledge ${c.id}`);
    if (c.values.some(v => !t.characters.valueVocabulary.includes(v))) errors.push(`unknown value ${c.id}`);
  }
  for (const rel of t.relationships) if (!ids.includes(rel.from) || !ids.includes(rel.to)) errors.push('relationship outside cast');
  if (!places.includes(t.season.trialLocation) || !places.includes(t.season.fourthWatchLocation)) errors.push('unknown calendar place');
  if (t.locations.find(p => p.id === t.season.trialLocation)?.open.includes(t.season.trialSlot) !== true) errors.push('trial place closed');
  if (t.locations.find(p => p.id === t.season.fourthWatchLocation)?.open.includes(t.season.fourthWatchSlot) !== true) errors.push('watch place closed');
  if (JSON.stringify(t).match(/remembersLoops|loopChronicle|echoStats|resetsAtRingTurn|Well/)) errors.push('obsolete active data');
  if (t['death-reservation'].enabled || verbs.includes('KILL') || verbs.includes('ASSASSINATE')) errors.push('death gameplay enabled');
  const expected = goldenNights(t);
  if (canonical(fixtures) !== canonical(expected)) errors.push('fixtures contradict deterministic replay');
  for (const night of fixtures) for (const entry of night.trace) {
    try { lookup(t,entry.rule); } catch { errors.push(`untraceable delta: ${entry.rule}`); }
  }
  return errors;
}

export function readArtifacts(root = designRoot) {
  return { fixtures: JSON.parse(readFileSync(new URL('fixtures/golden-nights.json',root),'utf8')),
    prose: readFileSync(new URL('README.md',root),'utf8'), template: readFileSync(new URL('README.template.md',root),'utf8') };
}
