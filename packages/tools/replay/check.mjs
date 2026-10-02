import { readFileSync } from 'node:fs';
import { canonical, designRoot } from './tables.mjs';
import { goldenNights, lineProblem } from './reference.mjs';
import { Ajv } from 'ajv';
import { itemSchema } from '../../director/src/schema.ts';

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

export function check(t, fixtures, prose, template, schema = itemSchema(t)) {
  const errors = [];
  if (prose !== render(t,template)) errors.push('prose contradicts authoritative data/template');
  const ids = t.characters.characters.map(c => c.id), verbs = Object.keys(t.intents), places = t.locations.map(p => p.id);
  if (new Set(ids).size !== ids.length) errors.push('duplicate character');
  if (verbs.some(v => !t.phrases[v] || !t.rules.resolutionOrder.includes(v))) errors.push('missing phrase/order');
  for (const [verb,line] of Object.entries(t.phrases)) if (lineProblem(t,line)) errors.push(`invalid phrase ${verb}: ${lineProblem(t,line)}`);
  for (const c of t.characters.characters) {
    if (!t.schools.some(s => s.id === c.school) && t.rules.officialSchools?.[c.id] !== c.school) errors.push(`unknown school ${c.id}`);
    if (!Object.hasOwn(t.goals,c.goal.id)) errors.push(`unknown goal ${c.id}`);
    if (c.knowledgeSeed.some(id => !t.facts.some(f => f.id === id))) errors.push(`unknown knowledge ${c.id}`);
    if (c.values.some(v => !t.characters.valueVocabulary.includes(v))) errors.push(`unknown value ${c.id}`);
  }
  const covered = new Set();
  for (const place of t.locations) for (const token of place.activities) {
    const [verb, arg, extra] = token.split(':');
    if (!verbs.includes(verb) || extra || (arg && (verb !== 'TRAIN' || !t.rules.stats.names.includes(arg)))) errors.push(`unknown activity ${place.id}:${token}`);
    covered.add(verb);
  }
  for (const verb of verbs) if (!covered.has(verb)) errors.push(`intent has no place: ${verb}`);
  const bindings = ['$preferredStat','$elder','$rival','$goalTarget','$schemer','$stray','$creditor','$peer','$knownFact'];
  for (const [goal, steps] of Object.entries(t.goals)) {
    if (!Array.isArray(steps) || !steps.length) { errors.push(`unstructured goal ${goal}`); continue; }
    for (const step of steps) {
      const def = t.intents[step?.intent];
      if (!def || !step.args || typeof step.args !== 'object' || Array.isArray(step.args)) { errors.push(`unknown goal intent ${goal}`); continue; }
      if (def.args.some(a => typeof step.args[a] !== 'string') || Object.keys(step.args).some(a => ![...def.args,...def.optionalArgs].includes(a))) errors.push(`invalid goal args ${goal}`);
      if (step.location && !places.includes(step.location)) errors.push(`unknown goal location ${goal}`);
      for (const [arg, value] of Object.entries(step.args)) {
        if (typeof value !== 'string') { errors.push(`invalid goal arg ${goal}`); continue; }
        if (value.startsWith('$')) { if (!bindings.includes(value)) errors.push(`unknown goal binding ${goal}`); continue; }
        const domain = {target:ids,stat:t.rules.stats.names,kind:Object.keys(t.rules.schemes),topic:Object.keys(t.rules.schemes.rumour.reactions),factId:t.facts.map(f=>f.id),toTent:t.schools.map(s=>s.tent),terms:['favour_for_training','back_entrant']}[arg];
        if (domain && !domain.includes(value)) errors.push(`unknown goal argument ${goal}:${arg}`);
      }
    }
  }
  for (const rel of t.relationships) if (!ids.includes(rel.from) || !ids.includes(rel.to)) errors.push('relationship outside cast');
  if (!places.includes(t.season.trialLocation) || !places.includes(t.season.fourthWatchLocation)) errors.push('unknown calendar place');
  if (t.locations.find(p => p.id === t.season.trialLocation)?.open.includes(t.season.trialSlot) !== true) errors.push('trial place closed');
  if (t.locations.find(p => p.id === t.season.fourthWatchLocation)?.open.includes(t.season.fourthWatchSlot) !== true) errors.push('watch place closed');
  if (/remembersLoops|loopChronicle|echoStats|resetsAtRingTurn|\bwell\b/i.test(JSON.stringify(t))) errors.push('obsolete active data');
  if (t['death-reservation'].enabled || verbs.includes('KILL') || verbs.includes('ASSASSINATE')) errors.push('death gameplay enabled');
  const expected = goldenNights(t);
  if (canonical(schema) !== canonical(itemSchema(t))) errors.push('decision schema drift');
  const validate = new Ajv({strict:true}).compile(schema);
  for (const night of fixtures) for (const item of [...night.proposed,...night.items]) if (!validate(item)) errors.push(`fixture schema ${night.id}:${item.character}`);
  if (canonical(fixtures) !== canonical(expected)) errors.push('fixtures contradict deterministic replay');
  for (const night of fixtures) for (const entry of night.trace) {
    try { lookup(t,entry.rule); } catch { errors.push(`untraceable delta: ${entry.rule}`); }
  }
  return errors;
}

export function readArtifacts(root = designRoot) {
  return { fixtures: JSON.parse(readFileSync(new URL('fixtures/golden-nights.json',root),'utf8')),
    schema: JSON.parse(readFileSync(new URL('data/decision.schema.json',root),'utf8')),
    prose: readFileSync(new URL('README.md',root),'utf8'), template: readFileSync(new URL('README.template.md',root),'utf8') };
}
