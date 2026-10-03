import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { checkFunds, estimate, accountCost } from './elevenlabs.mjs';
// Preserve AU2 regression fixtures independently of the currently open round.
const b = JSON.parse(fs.readFileSync(new URL('../../docs/audio/evidence/r2-final/budget.json', import.meta.url)));
test('cap and reserve boundaries, invalid counters and pending reservations', () => {
  assert.doesNotThrow(() => checkFunds(b, 4900, 0, 14100, 100));
  assert.throws(() => checkFunds(b, 4901, 0, 90000, 100), /cap refusal/);
  assert.throws(() => checkFunds(b, 0, 0, 8099, 100), /reserve refusal/);
  assert.throws(() => checkFunds(b, 4800, 101, 90000, 100), /cap refusal/);
  for (const bad of [NaN, Infinity, -1]) assert.throws(() => checkFunds(b, bad, 0, 90000, 100));
  assert.equal(estimate('sfx', 2, 0, b), 40);
  assert.equal(estimate('music', 20, 0, b), 600);
});
function fixture(t, scenario) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mage-audio-guard-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('mage-audio-guard-'));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  fs.mkdirSync(path.join(dir, 'tools/audio'), { recursive: true });
  fs.copyFileSync(new URL('./elevenlabs.mjs', import.meta.url), path.join(dir, 'tools/audio/elevenlabs.mjs'));
  fs.writeFileSync(path.join(dir, 'tools/audio/budget.json'), JSON.stringify({ ...b, status: 'proofs' }));
  // Every HTTP request is intercepted. A real key is never read; no network calls.
  const mock = `import fs from 'node:fs';
const nativeTimer=globalThis.setTimeout;
globalThis.setTimeout=(fn,ms,...args)=>nativeTimer(fn,ms>=2000?0:ms,...args);
let gets=0; let balanceGets=0;
globalThis.fetch = async (url, init) => {
 fs.appendFileSync(${JSON.stringify(path.join(dir, 'calls.txt'))}, init.method+' '+new URL(url).pathname+'\\n');
 ${scenario === 'get429' ? "if(init.method==='GET' && gets++===0) return Response.json({detail:{status:'rate_limit_exceeded'}},{status:429});" : ''}
 ${scenario === 'postGet429' ? "if(init.method==='GET' && gets++>=1) return Response.json({detail:{status:'rate_limited'}},{status:429});" : ''}
 if(new URL(url).pathname==='/v1/user/subscription') return Response.json({tier:'starter',character_count:${scenario === 'musicLag' ? '(balanceGets++>=2?1600:1000)' : scenario === 'floorBefore' ? '76001' : scenario === 'floorAfter' ? '(balanceGets++===0?75950:76010)' : '1000'},character_limit:90000,next_character_count_reset_unix:1791142301});
 if(init.method!=='POST'||!['/v1/sound-generation','/v1/music'].includes(new URL(url).pathname)) throw Error('Unexpected request blocked');
 ${scenario === '429' ? "return Response.json({detail:{status:'rate_limit_exceeded'}},{status:429});" : scenario === 'quota' ? "return Response.json({detail:{status:'quota_exceeded'}},{status:401});" : ['missing-header','musicLag'].includes(scenario) ? "return new Response(new Uint8Array([73,68,51,0]));" : "return new Response(new Uint8Array([73,68,51,0]),{headers:{'character-cost':'20'}});"}
};`;
  fs.writeFileSync(path.join(dir, 'mock.mjs'), mock);
  const run = (file = 'test', seconds = '2', text = 'Test', kind = 'sfx', round = 'r2') => spawnSync(process.execPath, ['--import', pathToFileURL(path.join(dir, 'mock.mjs')).href, path.join(dir, 'tools/audio/elevenlabs.mjs'), kind, kind === 'music' ? '--prompt' : '--text', text, '--seconds', seconds, '--out', `docs/audio/audition/${round}/${file}.mp3`], { cwd: dir, encoding: 'utf8', env: { ...process.env, ELEVENLABS_API_KEY: 'fake-test-key-never-sent' } });
  return { dir, run, calls: () => fs.existsSync(path.join(dir, 'calls.txt')) ? fs.readFileSync(path.join(dir, 'calls.txt'), 'utf8') : '' };
}
for (const scenario of ['429', 'quota']) test(`first ${scenario} permanently latches; POST is not retried`, t => {
  const f = fixture(t, scenario), first = f.run();
  assert.equal(first.status, 1);
  assert.equal((f.calls().match(/POST/g)||[]).length, 1);
  assert.ok(fs.existsSync(path.join(f.dir, 'tools/audio/STOP.json')));
  const old = f.calls();
  assert.equal(f.run('second').status, 1);
  assert.equal(f.calls(), old);
});
test('first read-only 429 recovers after backoff and continues under AU2 authorization', t => {
  const f = fixture(t, 'get429');
  assert.equal(f.run().status, 0);
  assert.equal((f.calls().match(/GET/g)||[]).length, 3);
  assert.equal((f.calls().match(/POST/g)||[]).length, 1);
  assert.equal(fs.existsSync(path.join(f.dir, 'tools/audio/STOP.json')), false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir,'tools/audio/pacing.json'))).gapMs,15000);
});
test('missing billing header settles by estimate and allows another call', t => {
  const f = fixture(t, 'missing-header');
  assert.equal(f.run().status, 0); // stale shared counter uses nonzero estimate
  const entry = JSON.parse(fs.readFileSync(path.join(f.dir, 'tools/audio/ledger.jsonl'), 'utf8'));
  assert.equal(entry.measuredCredits, null);
  assert.equal(entry.chargedCredits, 40);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir, 'tools/audio/state.json'))).pending, null);
  assert.equal(fs.existsSync(path.join(f.dir, 'tools/audio/STOP.json')), false);
  const old = f.calls();
  assert.equal(f.run('second').status, 0);
  assert.notEqual(f.calls(), old);
});
test('successful stale-balance response retains conservative estimate alongside header and creates matching ledger and sidecar', t => {
  const f = fixture(t, 'ok');
  const first = f.run();
  assert.equal(first.status, 0, first.stderr);
  const entry = JSON.parse(fs.readFileSync(path.join(f.dir, 'tools/audio/ledger.jsonl'), 'utf8'));
  const side = JSON.parse(fs.readFileSync(path.join(f.dir, 'docs/audio/audition/r2/test.mp3.json')));
  assert.deepEqual(entry, side);
  assert.equal(entry.accountDelta, 0);
  assert.equal(entry.chargedCredits, 40);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir, 'tools/audio/state.json'))).pending, null);
  const old = f.calls();
  assert.equal(f.run().status, 1); // paid overwrite is refused before network
  assert.equal(f.calls(), old);
});
test('closed budget, invalid duration, and unresolved pending block POST', t => {
  const f = fixture(t, 'ok');
  assert.equal(f.run('invalid', 'NaN').status, 1);
  assert.equal(f.calls(), '');
  fs.writeFileSync(path.join(f.dir, 'tools/audio/state.json'), JSON.stringify({ pending: { reservedCredits: 100 } }));
  assert.equal(f.run().status, 1);
  assert.equal(f.calls(), '');
  fs.writeFileSync(path.join(f.dir, 'tools/audio/state.json'), JSON.stringify({ pending: null }));
  fs.writeFileSync(path.join(f.dir, 'tools/audio/budget.json'), JSON.stringify({ ...b, status: 'closed' }));
  assert.equal(f.run().status, 1);
  assert.equal(f.calls(), '');
});

test('shared billing anomalies are flagged, not fatal, and always debited conservatively', () => {
 assert.deepEqual(accountCost(-20, 40), {chargedCredits:40,flags:['negative_balance_delta']});
 assert.deepEqual(accountCost(300, 40), {chargedCredits:300,flags:['shared_delta_implausibly_large']});
 assert.deepEqual(accountCost(0, 40), {chargedCredits:40,flags:['balance_may_lag']});
 assert.deepEqual(accountCost(null, 40), {chargedCredits:40,flags:['balance_unavailable']});
 assert.equal(accountCost(50, 40).chargedCredits,50);
 assert.equal(accountCost(0, 40, 60).chargedCredits,60);
});
test('cap cannot be raised and exhaustion refuses before POST with a funds latch', t => {
 const f=fixture(t,'ok');
 const budgetPath=path.join(f.dir,'tools/audio/budget.json');
 fs.writeFileSync(budgetPath,JSON.stringify({...b,status:'proofs',capCredits:5001}));
 assert.equal(f.run().status,1);assert.equal(f.calls(),'');
 fs.writeFileSync(budgetPath,JSON.stringify({...b,status:'proofs',capCredits:20}));
 assert.equal(f.run().status,1);
 assert.equal((f.calls().match(/POST/g)||[]).length,0);
 assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir,'tools/audio/STOP.json'))).reason,'cap_or_reserve_refusal');
});

test('second paced subscription 429 saves audio and latches all further generation', t => {
 const f=fixture(t,'postGet429');
 assert.equal(f.run().status,0);
 assert.equal((f.calls().match(/POST/g)||[]).length,1);
 assert.equal((f.calls().match(/GET/g)||[]).length,3);
 const entry=JSON.parse(fs.readFileSync(path.join(f.dir,'tools/audio/ledger.jsonl'),'utf8'));
 assert.equal(entry.chargedCredits,40);
 assert.equal(entry.accountAfter,null);
 const stop=JSON.parse(fs.readFileSync(path.join(f.dir,'tools/audio/STOP.json')));
 assert.equal(stop.status,429);assert.equal(stop.method,'GET');
 assert.equal(stop.endpoint,'/v1/user/subscription');
 const old=f.calls();assert.equal(f.run('second').status,1);assert.equal(f.calls(),old);
});


test('14000 floor blocks even while the 8000 reserve is safe', () => {
 assert.throws(() => checkFunds(b,0,0,14039,40), /floor refusal/);
 assert.doesNotThrow(() => checkFunds(b,0,0,14040,40));
});
test('all commands share the same lock, including balance reads', t => {
 const f=fixture(t,'ok');
 fs.writeFileSync(path.join(f.dir,'tools/audio/.generation.lock'),'test');
 assert.equal(f.run().status,1);assert.equal(f.calls(),'');
});
test('AU1 debit is preserved but does not spend AU2 cap', t => {
 const f=fixture(t,'ok');
 fs.writeFileSync(path.join(f.dir,'tools/audio/ledger.jsonl'),JSON.stringify({wave:'AU1',chargedCredits:4990})+'\n');
 const result=f.run();assert.equal(result.status,0,result.stderr);
 assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir,'tools/audio/state.json'))).spentCredits,40);
});


test('oversized SFX is refused locally without spending or reserving', t => {
 const f=fixture(t,'ok');
 assert.equal(f.run('long','2','x'.repeat(451)).status,1);
 assert.equal(f.calls(),'');
 assert.equal(fs.existsSync(path.join(f.dir,'tools/audio/state.json')),false);
});
test('music records immediate zero and delayed charge before allowing the next request', t => {
 const f=fixture(t,'musicLag');const r=f.run('music','20','Original melody','music');
 assert.equal(r.status,0,r.stderr);
 const entry=JSON.parse(fs.readFileSync(path.join(f.dir,'tools/audio/ledger.jsonl'),'utf8'));
 assert.equal(entry.accountDelta,0);assert.equal(entry.settledDelta,600);
 assert.equal(entry.chargedCredits,600);assert.equal(entry.settlementReads.length,1);
 assert.ok(entry.flags.includes('charge_visible_only_after_settlement_wait'));
 assert.equal((f.calls().match(/POST/g)||[]).length,1);
 assert.equal((f.calls().match(/GET/g)||[]).length,3);
});
for(const scenario of ['floorBefore','floorAfter']) test(`account floor latches on ${scenario}`, t => {
 const f=fixture(t,scenario);const r=f.run();
 assert.equal(r.status,scenario==='floorBefore'?1:0,r.stderr);
 const stop=JSON.parse(fs.readFileSync(path.join(f.dir,'tools/audio/STOP.json')));
 assert.equal(stop.reason,'account_floor_reached');assert.ok(stop.remaining<14000);
 assert.equal((f.calls().match(/POST/g)||[]).length,scenario==='floorBefore'?0:1);
 const prior=f.calls();assert.equal(f.run('later').status,1);assert.equal(f.calls(),prior);
});

test('AU2b has independent 3000 cap, 13000 floor and rejects non-plan/production/early optional requests before any HTTP', t => {
 const f=fixture(t,'ok');
 const b3={...b,wave:'AU2b',capCredits:3000,stopBelowCredits:13000,status:'audition'};
 const bp=path.join(f.dir,'tools/audio/budget.json');
 fs.writeFileSync(bp,JSON.stringify(b3));
 fs.writeFileSync(path.join(f.dir,'tools/audio/audition-plan-r3.json'),JSON.stringify({samples:[{id:'test',kind:'sfx',prompt:'Test',seconds:2},{id:'menu',kind:'music',prompt:'Original melody',seconds:30},{id:'collar',kind:'sfx',prompt:'Test',seconds:2,optional:true}]}));
 assert.doesNotThrow(()=>checkFunds(b3,2960,0,13040,40));
 assert.throws(()=>checkFunds(b3,2961,0,90000,40),/cap refusal/);
 assert.throws(()=>checkFunds(b3,0,0,13039,40),/floor refusal/);
 assert.equal(f.run('test','2','Test','sfx','r2').status,1);
 assert.equal(f.run('test','2','Changed','sfx','r3').status,1);
 assert.equal(f.run('menu','150','Original melody','music','r3').status,1);
 assert.equal(f.run('collar','2','Test','sfx','r3').status,1);
 fs.writeFileSync(bp,JSON.stringify({...b3,capCredits:3001}));
 assert.equal(f.run('test','2','Test','sfx','r3').status,1);
 assert.equal(f.calls(),'');
 fs.writeFileSync(bp,JSON.stringify(b3));
 fs.writeFileSync(path.join(f.dir,'tools/audio/ledger.jsonl'),JSON.stringify({wave:'AU2',chargedCredits:4995})+'\n');
 const r=f.run('menu','30','Original melody','music','r3'); assert.equal(r.status,0,r.stderr);
 const e=JSON.parse(fs.readFileSync(path.join(f.dir,'tools/audio/ledger.jsonl'),'utf8').trim().split('\n').at(-1));
 assert.equal(e.wave,'AU2b');assert.equal(e.chargedCredits,900);
 assert.equal(e.request.music_length_ms,30000);
 assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir,'tools/audio/state.json'))).spentCredits,900);
});

for (const scenario of ['floorBefore','floorAfter']) test(`AU2b 13000 observed floor latches on ${scenario}, including outside spending`, t => {
 const f=fixture(t,scenario);
 const mock=path.join(f.dir,'mock.mjs');
 fs.writeFileSync(mock,fs.readFileSync(mock,'utf8').replaceAll('76001','77001').replaceAll('75950','76950').replaceAll('76010','77010'));
 fs.writeFileSync(path.join(f.dir,'tools/audio/budget.json'),JSON.stringify({...b,wave:'AU2b',capCredits:3000,stopBelowCredits:13000,status:'audition'}));
 fs.writeFileSync(path.join(f.dir,'tools/audio/audition-plan-r3.json'),JSON.stringify({samples:[{id:'test',kind:'sfx',prompt:'Test',seconds:2}]}));
 const r=f.run('test','2','Test','sfx','r3');
 assert.equal(r.status,scenario==='floorBefore'?1:0,r.stderr);
 const stop=JSON.parse(fs.readFileSync(path.join(f.dir,'tools/audio/STOP.json')));
 assert.equal(stop.reason,'account_floor_reached');assert.ok(stop.remaining<13000);
 assert.equal((f.calls().match(/POST/g)||[]).length,scenario==='floorBefore'?0:1);
 const prior=f.calls();assert.equal(f.run('test','2','Test','sfx','r3').status,1);assert.equal(f.calls(),prior);
});
