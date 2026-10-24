import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { roundOf, dispatchTarget } from './elevenlabs.mjs';
import { settle } from './settle.mjs';
// One registry row per audio round. Offline only: every fetch is intercepted.
const pick = (row, keys) => Object.fromEntries(keys.map(k => [k, row[k]]));
test('registry pins the ceilings each round was authorized with (no loosening)', () => {
  const keys = ['cap', 'floor', 'minReserve', 'dir'];
  assert.deepEqual(pick(roundOf('AU2'), keys), { cap: 5000, floor: 14000, minReserve: 8000, dir: 'r2' });
  assert.deepEqual(pick(roundOf('AU2b'), keys), { cap: 3000, floor: 13000, minReserve: 8000, dir: 'r3' });
  assert.deepEqual(pick(roundOf('AU3'), keys), { cap: 10000, floor: 1000, minReserve: 1000, dir: 'r4' });
  assert.equal(roundOf('AU2').musicMaxSeconds, 20);
  assert.equal(roundOf('AU2b').musicMaxSeconds, 30);
  assert.equal(roundOf('AU3').minMusicPerSecond, 30);
  assert.deepEqual(['AU2', 'AU2b', 'AU3'].map(w => roundOf(w).launcher), ['brief', 'brief', 'composition']);
});
test('an unregistered round is refused', () => {
  assert.throws(() => roundOf('AU4'), /Unregistered audio round/);
  assert.throws(() => roundOf(undefined), /Unregistered audio round/);
});
test('dispatch targets come from the registry; unregistered waves use the legacy in-file r1 path', () => {
  assert.equal(dispatchTarget('AU3', 'build'), 'build-r4-reports.py');
  assert.equal(dispatchTarget('AU2b', 'check'), 'check-r3-reports.py');
  assert.equal(dispatchTarget('AU2', 'build'), 'build-r2-reports.py');
  assert.equal(dispatchTarget('AU2', 'check'), null);
  assert.equal(dispatchTarget('AU1', 'build'), null);
});
test('settle: AU2 path numbers (stale balance, delayed music charge)', () => {
  const lag = settle({ estimate: 40, immediateDelta: 0, settledDeltas: [], header: null });
  assert.deepEqual(pick(lag, ['chargedCredits', 'flags']), { chargedCredits: 40, flags: ['balance_may_lag'] });
  const music = settle({ estimate: 600, immediateDelta: 0, settledDeltas: [600] });
  assert.equal(music.chargedCredits, 600);
  assert.ok(music.flags.includes('charge_visible_only_after_settlement_wait'));
  assert.equal(settle({ estimate: 40, immediateDelta: 0, header: 60 }).chargedCredits, 60);
  assert.deepEqual(pick(settle({ estimate: 40, immediateDelta: null }), ['chargedCredits', 'flags']), { chargedCredits: 40, flags: ['balance_unavailable'] });
});
test('settle: reset-aware AU3 path keeps the estimate across an account reset', () => {
  const r = settle({ estimate: 4500, before: { remaining: 1600, resetsAt: 'old' }, after: { remaining: 89000, used: 1000, resetsAt: 'new' }, resetAware: true });
  assert.equal(r.chargedCredits, 4500);
  assert.equal(r.accountDelta, 1000);
  assert.ok(r.flags.includes('account_reset_during_call_estimate_retained'));
  const before = { remaining: 6000, resetsAt: 'old' };
  const delayed = settle({ estimate: 4500, before, after: { remaining: 6000, resetsAt: 'old' }, settlementReads: [{ remaining: 1000, resetsAt: 'old' }], resetAware: true });
  assert.deepEqual(pick(delayed, ['accountDelta', 'settledDelta', 'chargedCredits', 'flags']), { accountDelta: 0, settledDelta: 5000, chargedCredits: 5000, flags: ['charge_visible_after_settlement'] });
  assert.deepEqual(settle({ estimate: 4500, before, after: null, resetAware: true }).flags, ['balance_unavailable']);
});
function fixture(t, budgetPatch) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mage-audio-rounds-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const base = path.join(dir, 'tools/audio');
  fs.mkdirSync(base, { recursive: true });
  for (const name of ['elevenlabs.mjs', 'settle.mjs', 'rounds.json', 'build-reports.py']) fs.copyFileSync(new URL(name, import.meta.url), path.join(base, name));
  const b = JSON.parse(fs.readFileSync(new URL('../../docs/audio/evidence/r2-final/budget.json', import.meta.url)));
  fs.writeFileSync(path.join(base, 'budget.json'), JSON.stringify({ ...b, status: 'proofs', ...budgetPatch }));
  fs.writeFileSync(path.join(dir, 'mock.mjs'), `import fs from 'node:fs';
globalThis.fetch = async () => { fs.appendFileSync(${JSON.stringify(path.join(dir, 'calls'))}, 'call\\n'); throw Error('blocked'); };`);
  const run = (...args) => spawnSync(process.execPath, ['--import', pathToFileURL(path.join(dir, 'mock.mjs')).href, path.join(base, 'elevenlabs.mjs'), ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, ELEVENLABS_API_KEY: 'fake-never-sent' } });
  return { dir, base, run, calls: () => fs.existsSync(path.join(dir, 'calls')) ? fs.readFileSync(path.join(dir, 'calls'), 'utf8') : '' };
}
test('budget() refuses an unregistered wave and a raised AU2b cap before any fetch', t => {
  const au4 = fixture(t, { wave: 'AU4' });
  const r = au4.run('credits');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Unregistered audio round/);
  assert.equal(au4.calls(), '');
  const raised = fixture(t, { wave: 'AU2b', capCredits: 3001, stopBelowCredits: 13000 });
  const s = raised.run('credits');
  assert.equal(s.status, 1);
  assert.match(s.stderr, /Invalid audition cap\/reserve\/floor\/pacing/);
  assert.equal(raised.calls(), '');
});
const python = spawnSync('python', ['--version']).status === 0;
test('build-reports.py dispatches through the registry row', { skip: !python && 'python unavailable' }, t => {
  const f = fixture(t, {});
  for (const n of ['build-r2-reports.py', 'build-r3-reports.py', 'build-r4-reports.py', 'build-next.py']) fs.writeFileSync(path.join(f.base, n), `print(${JSON.stringify(n)})\n`);
  const dispatch = wave => {
    fs.writeFileSync(path.join(f.base, 'budget.json'), JSON.stringify({ wave }));
    const r = spawnSync('python', ['-I', path.join(f.base, 'build-reports.py')], { cwd: f.dir, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  assert.equal(dispatch('AU3'), 'build-r4-reports.py');
  assert.equal(dispatch('AU2b'), 'build-r3-reports.py');
  assert.equal(dispatch('AU2'), 'build-r2-reports.py');
  // A new round is one row: the dispatcher follows it without a new branch.
  const reg = JSON.parse(fs.readFileSync(path.join(f.base, 'rounds.json'), 'utf8'));
  reg.rounds.AU3 = { ...reg.rounds.AU3, build: 'build-next.py' };
  fs.writeFileSync(path.join(f.base, 'rounds.json'), JSON.stringify(reg));
  assert.equal(dispatch('AU3'), 'build-next.py');
});
