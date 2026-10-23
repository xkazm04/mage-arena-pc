import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { loadKernel } from './conformance.mjs';
import { recordVector, replayVector, vectorProblems } from './vectors.mjs';

const script = fileURLToPath(new URL('./vectors.mjs', import.meta.url));
const handPath = fileURLToPath(new URL('./vectors/water-hand.vector.json', import.meta.url));
const hand = () => JSON.parse(readFileSync(handPath, 'utf8'));
const cli = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });

function planted() {
  const v = hand();
  v.name = 'water-hand-planted';
  v.checkpoints[1].actors[0].hp += 1;
  return v;
}

test('vr:vectors passes the hand Water vector (default directory and explicit path)', () => {
  for (const args of [[], [handPath]]) {
    const r = cli(...args);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /pass {2}water-hand/);
    assert.match(r.stdout, /1\/1 vectors pass/);
  }
});

test('vr:vectors fails the planted vector and names the first mismatch', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mage-vr-vectors-'));
  try {
    const file = join(dir, 'water-hand-planted.vector.json');
    writeFileSync(file, JSON.stringify(planted()));
    const r = cli(file);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    const tick = hand().checkpoints[1].tick;
    assert.match(r.stdout, /FAIL {2}water-hand-planted /);
    assert.ok(r.stdout.includes(`first mismatch at tick ${tick} (checkpoint 1) actors[0].hp: vector ${hand().checkpoints[1].actors[0].hp + 1} PC ${hand().checkpoints[1].actors[0].hp}`), r.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('replayVector reports the planted change and nothing earlier; the hand vector re-records to itself', async () => {
  const k = await loadKernel();
  assert.deepEqual(replayVector(k, hand()).mismatch, null);
  const m = replayVector(k, planted()).mismatch;
  assert.equal(m.checkpoint, 1);
  assert.equal(m.path, 'actors[0].hp');
  assert.equal(m.expected, hand().checkpoints[1].actors[0].hp + 1);
  const skeleton = hand();
  skeleton.checkpoints = skeleton.checkpoints.map((c) => ({ tick: c.tick, events: Object.fromEntries(Object.keys(c.events).map((e) => [e, 0])) }));
  assert.deepEqual(recordVector(k, skeleton), hand());
});

test('positions compare within 1e-6 and event kinds only when listed', async () => {
  const k = await loadKernel();
  const near = hand();
  near.checkpoints[0].actors[0].x += 9e-7;
  assert.equal(replayVector(k, near).pass, true);
  const far = hand();
  far.checkpoints[0].actors[0].x += 2e-6;
  assert.equal(replayVector(k, far).mismatch.path, 'actors[0].x');
  const fewer = hand();
  for (const c of fewer.checkpoints) c.events = { cast: c.events.cast };
  assert.equal(replayVector(k, fewer).pass, true);
  const extra = hand();
  extra.checkpoints[0].events.release = 99;
  assert.equal(replayVector(k, extra).mismatch.path, 'events.release');
});

test('a malformed vector is refused before it runs', async () => {
  const k = await loadKernel();
  const bad = hand();
  bad.inputs[1].from = 5;
  bad.setup.difficulty = 'brutal';
  const problems = vectorProblems(bad);
  assert.ok(problems.some((p) => p.startsWith('inputs[1]')));
  assert.ok(problems.some((p) => p.startsWith('setup.difficulty')));
  assert.equal(replayVector(k, bad).pass, false);
});

test('difficulty null replays unpaced (as VR runs): the player walks at 1x, not the paced 1.5x', async () => {
  const k = await loadKernel();
  const paced = hand();
  const unpaced = hand();
  unpaced.setup.difficulty = null;
  unpaced.checkpoints = [{ tick: 30, events: {} }];
  paced.checkpoints = [{ tick: 30, events: {} }];
  const slow = recordVector(k, unpaced).checkpoints[0].actors[0];
  const fast = recordVector(k, paced).checkpoints[0].actors[0];
  const spawn = k.runtime.games.playerSpawn.x;
  assert.ok(slow.x - spawn > 0 && fast.x - spawn > slow.x - spawn, `unpaced ${slow.x} paced ${fast.x}`);
  assert.equal(replayVector(k, recordVector(k, unpaced)).pass, true);
});
