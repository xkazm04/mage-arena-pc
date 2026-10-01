import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTables, canonical } from './tables.mjs';
import { requestKey } from './request-key.mjs';
import { check, readArtifacts } from './check.mjs';
import { goldenNights, calendar, createState, decision, legalProblem, lineProblem, reconcile, resolve } from './reference.mjs';

test('stored golden nights replay exactly with source references', () => {
  const t = loadTables(), a = readArtifacts();
  assert.deepEqual(check(t,a.fixtures,a.prose,a.template),[]);
  assert.equal(a.fixtures.length,3);
  assert.ok(a.fixtures.every(n => n.trace.length > 0 && n.rolls.length > 0));
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
