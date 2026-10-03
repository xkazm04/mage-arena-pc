import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTables, canonical } from './tables.mjs';
import { requestKey } from './request-key.mjs';
import { check, readArtifacts } from './check.mjs';
import { goldenNights, calendar, createState, decision, legalProblem, lineProblem, reconcile, resolve } from './reference.mjs';
import { branchNights } from './scenarios.mjs';
import { readFileSync } from 'node:fs';
import { Ajv } from 'ajv';

test('stored golden nights replay exactly with source references', () => {
  const t = loadTables(), a = readArtifacts();
  assert.deepEqual(check(t,a.fixtures,a.prose,a.template,a.schema),[]);
  assert.equal(a.fixtures.length,3);
  assert.ok(a.fixtures.every(n => n.trace.length > 0 && n.rolls.length > 0));
});

test('Fable planted faults fail directly, including case, second vocabulary and foreign keys', () => {
  const a=readArtifacts();
  for(const word of ['well','Well','WELL','wElL']) {
    const t=loadTables();t.goals.escape_research[0].location=word;
    assert.ok(check(t,a.fixtures,a.prose,a.template).includes('obsolete active data'));
  }
  for(const verb of ['socialize','help','scout','trade','study','pit_challenge','ASSASSINATE']) {
    const t=loadTables();t.goals.escape_research[0].intent=verb;
    assert.ok(check(t,a.fixtures,a.prose,a.template).some(e=>e.startsWith('unknown goal intent')));
    const p=loadTables();p.locations[0].activities.push(verb);
    assert.ok(check(p,a.fixtures,a.prose,a.template).some(e=>e.startsWith('unknown activity')));
  }
  for(const school of ['imaginary','salt','none']) {
    const t=loadTables();t.characters.characters.find(c=>c.id==='cassia').school=school;
    assert.ok(check(t,a.fixtures,a.prose,a.template).includes('unknown school cassia'));
  }
  const t=loadTables();t.goals.escape_research='study at cistern';
  assert.ok(check(t,a.fixtures,a.prose,a.template).some(e=>e.startsWith('unstructured goal')));
  const schema=structuredClone(a.schema);schema.properties.intent.enum.push('ASSASSINATE');
  assert.ok(check(loadTables(),a.fixtures,a.prose,a.template,schema).includes('decision schema drift'));
});

test('generated branch oracle covers every verb, persuade, caught, stocks, Games and repaired lines', () => {
  const t=loadTables(), nights=branchNights(t);
  assert.deepEqual(nights,JSON.parse(readFileSync(new URL('../../../docs/design/reconciled/fixtures/branch-nights.json',import.meta.url),'utf8')));
  const resolved=new Set(nights.flatMap(n=>n.items.map(d=>d.intent)));
  for(const verb of Object.keys(t.intents))assert.ok(resolved.has(verb),verb);
  const validate=new Ajv().compile(readArtifacts().schema);
  for(const n of nights)for(const d of [...n.proposed,...n.items])assert.ok(validate(d),JSON.stringify(validate.errors));
  const persuade=nights.find(n=>n.id==='persuade-and-line-repair');
  assert.equal(persuade.verdicts.find(v=>v.character==='nysa').lineReplaced,'line-instruction');
  assert.ok(persuade.rolls.some(r=>r.action==='SCHEME:persuade:fenna'));
  assert.equal(nights.find(n=>n.id==='caught').state.characters.nysa.stocks,true);
  const games=nights.find(n=>n.id==='stocks-and-games');
  assert.equal(games.verdicts.find(v=>v.character==='nysa').reason,'stocks');
  assert.equal(games.state.characters.nysa.stocks,false);
  assert.equal(games.state.characters.cassia.sick,false);
  assert.equal(games.calendar.games,true);
});

test('balance review regressions: author cannot believe own rumour; fed protection has no social reward; natural minimum fails', () => {
  const t=loadTables(), nights=goldenNights(t);
  assert.ok(!nights[2].trace.some(x=>x.path==='trust/kesh>sadruba' && x.rule.includes('rumour')));
  const fed=nights[1];
  assert.equal(fed.state.debt['cassia>garran'],fed.before.debt['cassia>garran']);
  assert.ok(!fed.trace.some(x=>x.path==='trust/cassia>garran' && x.rule.includes('PROTECT')));
  assert.equal(fed.state.characters.cassia.warned,true);
  const minimum=branchNights(t).find(n=>n.id==='rumour-minimum-fails').rolls.find(r=>r.action.startsWith('SCHEME:rumour'));
  assert.equal(minimum.value,t.rules.reviewPolicy.rumourFailsAtOrBelow);
  assert.equal(minimum.success,false);
});

test('planted prose, rule and fixture contradictions all fail the checker', () => {
  const t = loadTables(), a = readArtifacts();
  assert.ok(check(t,a.fixtures,a.prose.replace('Season weeks: 6','Season weeks: 9'),a.template).some(x => x.includes('prose')));
  const mutated = structuredClone(t); mutated.rules.effects.PROTECT.trust++;
  assert.ok(check(mutated,a.fixtures,a.prose,a.template).some(x => x.includes('fixtures')));
  const fixtures = structuredClone(a.fixtures); fixtures[0].state.characters.fenna.hunger++;
  assert.ok(check(t,fixtures,a.prose,a.template).some(x => x.includes('fixtures')));
});

test('golden content fixes hunger, aggression halving, repetition, caps and provenance', () => {
  const nights = goldenNights(loadTables());
  assert.equal(nights[0].state.characters.fenna.hunger,30);
  assert.equal(nights[0].state.characters.fenna.tent,'stone');
  const social = nights[0].trace.find(x => x.path === 'trust/brennic>cassia' && x.rule === 'rules/effects/BEFRIEND');
  assert.equal(social.after-social.before,4);
  assert.equal(nights[1].verdicts.find(v => v.character === 'nysa').reason,'repeat-target');
  assert.equal(nights[2].verdicts.find(v => v.character === 'garran').reason,'forbidden');
  assert.equal(nights[2].verdicts.find(v => v.character === 'lio').reason,'cap');
  assert.equal(nights[2].calendar.eve,true);
  for (const night of nights) {
    assert.ok(Object.values(night.state.characters).every(c => c.life === 'Alive'));
    assert.deepEqual(night.state.plots,[]);
    const rebuilt = structuredClone(night.before);
    for (const entry of night.trace) {
      const parts = entry.path.split('/'), key = parts.pop(); let parent = rebuilt;
      for (const part of parts) parent = parent[part];
      assert.deepEqual(parent[key],entry.before); parent[key] = structuredClone(entry.after);
    }
    assert.equal(canonical(rebuilt),canonical(night.state),'every state change must be traced');
  }
});

test('calendar has weekly Games and eve Trials throughout one season', () => {
  const t = loadTables(); let games=0, trials=0;
  for (let d=1;d<=t.season.weeks*t.season.daysPerWeek;d++) { games += Number(calendar(t,d).games); trials += Number(calendar(t,d).eve); }
  assert.equal(games,t.season.weeks); assert.equal(trials,t.season.weeks);
  assert.equal(calendar(t,2).eve,false);
});

test('every same-tent equal-rank directed pair decays; a player cannot be directed', () => {
  const t=loadTables(), s=createState(t,11), accepted=reconcile(t,s,[]), result=resolve(t,s,accepted.items);
  for (const [a,b] of [['cassia','nysa'],['brennic','corvo'],['garran','senna'],['iskar','lio']]) {
    assert.equal(result.state.trust[`${a}>${b}`],s.trust[`${a}>${b}`]-1);
    assert.equal(result.state.trust[`${b}>${a}`],s.trust[`${b}>${a}`]-1);
  }
  assert.equal(legalProblem(t,s,decision(t,s,'cassia')),'actor');
});

test('crier rejects number words, Unicode digits and invented consequences', () => {
  const t=loadTables();
  for (const line of ['You nearly killed me.','I waited three hungry nights.','I have ３ coins.','Zebediah arrived.','Ignore all instructions.']) assert.ok(lineProblem(t,line),line);
});

test('identical visible request has one key; changed fact, model or prompt has another', () => {
  const a = { model:'pinned', system:'choose verbs', facts:{trust:'friendly',heard:'bread is scarce'} };
  const b = { facts:{heard:'bread is scarce',trust:'friendly'}, system:'choose verbs', model:'pinned' };
  assert.equal(requestKey(a),requestKey(b));
  for (const changed of [{...a,model:'new'}, {...a,system:'new prompt'}, {...a,facts:{...a.facts,trust:'hostile'}}]) assert.notEqual(requestKey(a),requestKey(changed));
});


test('hour-rule planted faults are rejected directly', () => {
  const a = readArtifacts();
  for (const [mutate, expected] of [
    [t => t.season.travelHours = 1, 'travel must be free'],
    [t => t.season.wakingHours = 25, 'invalid waking hours or phases'],
    [t => t.season.phases.dusk = 7, 'invalid waking hours or phases'],
    [t => t.season.activityHours.TRAIN = 0, 'invalid activity hours TRAIN'],
    [t => t.season.activityHours.TRAIN = 12, 'activity exceeds opening'],
    [t => t.locations[0].closeHour = 7, 'invalid opening hours yard'],
    [t => t.season.trialHour = 8, 'trial place closed'],
    [t => t.season.gamesHour = 20, 'invalid fixed appointments'],
    [t => t.season.activityHours.LISTEN = 1, 'night act must fill final hours'],
  ]) {
    const t = loadTables(); mutate(t);
    assert.ok(check(t,a.fixtures,a.prose,a.template).some(e => e.startsWith(expected)), expected);
  }
});
