import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { checkFunds, estimate } from './elevenlabs.mjs';
const b = JSON.parse(fs.readFileSync(new URL('./budget.json', import.meta.url)));
test('cap and reserve boundaries, invalid counters and pending reservations', () => {
  assert.doesNotThrow(() => checkFunds(b, 11900, 0, 8100, 100));
  assert.throws(() => checkFunds(b, 11901, 0, 90000, 100), /cap refusal/);
  assert.throws(() => checkFunds(b, 0, 0, 8099, 100), /reserve refusal/);
  assert.throws(() => checkFunds(b, 11800, 101, 90000, 100), /cap refusal/);
  for (const bad of [NaN, Infinity, -1]) assert.throws(() => checkFunds(b, bad, 0, 90000, 100));
  assert.equal(estimate('sfx', 2, 0, b), 100);
  assert.equal(estimate('music', 20, 0, b), 1200);
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
let gets=0;
globalThis.fetch = async (url, init) => {
 fs.appendFileSync(${JSON.stringify(path.join(dir, 'calls.txt'))}, init.method+' '+new URL(url).pathname+'\\n');
 ${scenario === 'get429' ? "if(init.method==='GET' && gets++===0) return Response.json({detail:{status:'rate_limit_exceeded'}},{status:429});" : ''}
 if(new URL(url).pathname==='/v1/user/subscription') return Response.json({tier:'starter',character_count:1000,character_limit:90000,next_character_count_reset_unix:1791142301});
 if(init.method!=='POST'||!new URL(url).pathname.includes('sound-generation')) throw Error('Unexpected request blocked');
 ${scenario === '429' ? "return Response.json({detail:{status:'rate_limit_exceeded'}},{status:429});" : scenario === 'quota' ? "return Response.json({detail:{status:'quota_exceeded'}},{status:401});" : scenario === 'missing-header' ? "return new Response(new Uint8Array([73,68,51,0]));" : "return new Response(new Uint8Array([73,68,51,0]),{headers:{'character-cost':'20'}});"}
};`;
  fs.writeFileSync(path.join(dir, 'mock.mjs'), mock);
  const run = (file = 'test', seconds = '2') => spawnSync(process.execPath, ['--import', pathToFileURL(path.join(dir, 'mock.mjs')).href, path.join(dir, 'tools/audio/elevenlabs.mjs'), 'sfx', '--text', 'Test', '--seconds', seconds, '--out', `docs/audio/audition/r1/${file}.mp3`], { cwd: dir, encoding: 'utf8', env: { ...process.env, ELEVENLABS_API_KEY: 'fake-test-key-never-sent' } });
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
test('read-only 429 backs off but recovered lookup never proceeds to POST', t => {
  const f = fixture(t, 'get429');
  assert.equal(f.run().status, 1);
  assert.equal((f.calls().match(/GET/g)||[]).length, 2);
  assert.equal((f.calls().match(/POST/g)||[]).length, 0);
  assert.ok(fs.existsSync(path.join(f.dir, 'tools/audio/STOP.json')));
});
test('missing billing header preserves the sample, reservation and debit, and latches', t => {
  const f = fixture(t, 'missing-header');
  assert.equal(f.run().status, 0); // a sample exists, but generation is latched
  const entry = JSON.parse(fs.readFileSync(path.join(f.dir, 'tools/audio/ledger.jsonl'), 'utf8'));
  assert.equal(entry.measuredCredits, null);
  assert.equal(entry.chargedCredits, 100);
  assert.ok(JSON.parse(fs.readFileSync(path.join(f.dir, 'tools/audio/state.json'))).pending);
  assert.ok(fs.existsSync(path.join(f.dir, 'tools/audio/STOP.json')));
  const old = f.calls();
  assert.equal(f.run('second').status, 1);
  assert.equal(f.calls(), old);
});
test('successful stale-balance response accounts by header and creates matching ledger and sidecar', t => {
  const f = fixture(t, 'ok');
  const first = f.run();
  assert.equal(first.status, 0, first.stderr);
  const entry = JSON.parse(fs.readFileSync(path.join(f.dir, 'tools/audio/ledger.jsonl'), 'utf8'));
  const side = JSON.parse(fs.readFileSync(path.join(f.dir, 'docs/audio/audition/r1/test.mp3.json')));
  assert.deepEqual(entry, side);
  assert.equal(entry.accountDelta, 0);
  assert.equal(entry.chargedCredits, 20);
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
