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
  errors.push(...campPlayProblems(t, ids, places, verbs));
  if (!places.includes(t.season.trialLocation) || !places.includes(t.season.fourthWatchLocation)) errors.push('unknown calendar place');
  const time = t.season, end = time.wakeHour + time.wakingHours;
  const positive = n => Number.isInteger(n) && n > 0;
  if (!positive(time.wakingHours) || time.wakeHour < 0 || end > 24 || time.phases.day !== time.wakeHour || !(time.phases.day < time.phases.dusk && time.phases.dusk < time.phases.night && time.phases.night < end)) errors.push('invalid waking hours or phases');
  if (time.travelHours !== 0) errors.push('travel must be free');
  for (const verb of [...verbs, 'PARLEY', 'LISTEN']) if (!positive(time.activityHours[verb]) || time.activityHours[verb] > time.wakingHours) errors.push(`invalid activity hours ${verb}`);
  for (const place of t.locations) {
    if (!Number.isInteger(place.openHour) || !Number.isInteger(place.closeHour) || place.openHour < time.wakeHour || place.closeHour > end || place.openHour >= place.closeHour) errors.push(`invalid opening hours ${place.id}`);
    for (const token of place.activities) if (time.activityHours[token.split(':')[0]] > place.closeHour - place.openHour) errors.push(`activity exceeds opening ${place.id}:${token}`);
  }
  const trial = t.locations.find(p => p.id === time.trialLocation), watch = t.locations.find(p => p.id === time.fourthWatchLocation);
  if (!trial || time.trialHour < trial.openHour || time.trialHour + time.trialHours > trial.closeHour) errors.push('trial place closed');
  if (!watch || time.fourthWatchHour < watch.openHour || time.fourthWatchHour >= watch.closeHour) errors.push('watch place closed');
  if (!positive(time.trialHours) || time.trialHour !== time.phases.dusk || time.trialHour + time.trialHours > time.phases.night || !positive(time.gamesHours) || time.gamesHour !== time.wakeHour || time.gamesHour + time.gamesHours > time.phases.dusk) errors.push('invalid fixed appointments');
  if (time.activityHours.LISTEN !== end - time.phases.night) errors.push('night act must fill final hours');
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

// camp-session.ts reads these without a door: a dangling presence place silently hides a character,
// an unknown map node makes travel cost Infinity. Name every dangling reference here instead.
function campPlayProblems(t, ids, places, verbs) {
  const errors = [], play = t['camp-play'], parley = t.parley, bridge = t['season-bridge'];
  const nodes = Object.keys(play.map.nodes), unknown = (list, known) => list.filter(id => !known.includes(id));
  if (!places.includes(play.startLocation)) errors.push(`camp-play start is not a place: ${play.startLocation}`);
  for (const id of unknown(nodes, places)) errors.push(`camp-play map node is not a place: ${id}`);
  for (const id of unknown(places, nodes)) errors.push(`place missing from camp-play map: ${id}`);
  for (const id of unknown(play.map.routes.flat(), nodes)) errors.push(`camp-play route to unknown node: ${id}`);
  for (const [who, slots] of Object.entries(play.presence)) {
    if (!ids.includes(who)) errors.push(`camp-play presence for unknown character: ${who}`);
    if (!Array.isArray(slots) || slots.length !== 3) errors.push(`camp-play presence needs day, dusk and night: ${who}`);
    else for (const id of unknown(slots, places)) errors.push(`camp-play presence ${who} at unknown place: ${id}`);
  }
  for (const id of unknown(Object.keys(play.descriptions), places)) errors.push(`camp-play description for unknown place: ${id}`);
  for (const fact of [...play.discoveries, ...parley.facts])
    for (const id of unknown([fact.actor, fact.target, ...fact.holders].filter(Boolean), ids)) errors.push(`fact ${fact.id} names unknown character: ${id}`);
  for (const verb of unknown(parley.friendlyIntents, verbs)) errors.push(`parley friendly intent is not an intent: ${verb}`);
  const playable = t.characters.characters.find(c => c.id === bridge.playableCharacter);
  if (!playable) errors.push(`season-bridge playable character unknown: ${bridge.playableCharacter}`);
  if (!t.schools.some(s => s.id === bridge.playableSchool)) errors.push(`season-bridge playable school unknown: ${bridge.playableSchool}`);
  else if (playable && playable.school !== bridge.playableSchool) errors.push(`season-bridge playable character ${playable.id} is not of school ${bridge.playableSchool}`);
  if (!places.includes(t['arena/arena-tiers'].tentTrial.where)) errors.push(`tent trial at unknown place: ${t['arena/arena-tiers'].tentTrial.where}`);
  return errors;
}

/** Every file `cli.mjs generate` writes into fixtures/; anything else there is an orphan nothing re-derives. */
export const generatedFixtures = ['golden-nights.json', 'branch-nights.json', 'hour-days.json'];
export function orphanFixtures(names) { return names.filter(name => !generatedFixtures.includes(name)); }

export function readArtifacts(root = designRoot) {
  return { fixtures: JSON.parse(readFileSync(new URL('fixtures/golden-nights.json',root),'utf8')),
    schema: JSON.parse(readFileSync(new URL('data/decision.schema.json',root),'utf8')),
    prose: readFileSync(new URL('README.md',root),'utf8'), template: readFileSync(new URL('README.template.md',root),'utf8') };
}
