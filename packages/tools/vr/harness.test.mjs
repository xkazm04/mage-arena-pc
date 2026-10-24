import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { loadKernel, createContext, exportEvents, replayConformance, snapshot } from './conformance.mjs';
import { compare, createBout, POLICY, renderDiff } from './harness.mjs';
import { replayVector } from './vectors.mjs';

const jsonClone = (value) => JSON.parse(JSON.stringify(value));
const dir = fileURLToPath(new URL('./', import.meta.url));
const hand = () => JSON.parse(readFileSync(fileURLToPath(new URL('./vectors/water-hand.vector.json', import.meta.url)), 'utf8'));
const unpacedSetup = { seed: 7, preset: 'Rotation', startWave: 0, referencePlayer: false, difficulty: null, balance: 'canonical' };
const DIFF_KEYS = ['tick', 'when', 'path', 'expected', 'actual', 'detail'];

test('createBout unpaces and sets balance through createGames options, not by editing kernel state', async () => {
  const k = await loadKernel();
  const calls = [];
  const spy = { ...k, createGames: (...args) => { calls.push(args); return k.createGames(...args); } };
  const games = createBout(spy, unpacedSetup);
  assert.equal('difficulty' in games.state, false);
  assert.ok(games.state.actors.every((a) => !('pace' in a)));
  assert.equal(games.state.balance, 'canonical');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][7], { unpaced: true, balance: 'canonical' });
});

test('createBout(difficulty null) plays 600 idle ticks exactly as the old hand-strip path did', async () => {
  const k = await loadKernel();
  const viaOption = createBout(k, unpacedSetup);
  // The path vectors.mjs took before the unpaced option: a paced Games, the pace deleted before tick 1.
  const stripped = k.createGames(7, k.presets.find((c) => c.name === 'Rotation'), 0, false, undefined, undefined, undefined, {});
  delete stripped.state.difficulty;
  for (const a of stripped.state.actors) delete a.pace;
  stripped.state.balance = 'canonical';
  for (let t = 0; t < 600; t++) {
    k.stepGames(viaOption, undefined);
    k.stepGames(stripped, undefined);
  }
  const view = (g) => g.state.actors.map((a) => ({ id: a.id, hp: a.hp, x: a.pos.x, y: a.pos.y }));
  assert.deepEqual(view(viaOption), view(stripped));
  assert.equal(viaOption.state.events.length, stripped.state.events.length);
});

test('a conformance games vector replays unpaced, as the pinned kernel ran it', async () => {
  const k = await loadKernel();
  const v = { name: 'synthetic-soldiers', driver: 'games', seed: 7, games: { preset: null, startWave: 0 } };
  const ctx = createContext(k, v);
  assert.equal('difficulty' in ctx.games.state, false);
  assert.ok(ctx.games.state.actors.every((a) => !('pace' in a)));
  assert.notEqual(ctx.games.state.balance, 'canonical', 'balance is not forced: the vector does not ask for it');
});

test('compare: the reverse policy bounds positions at 1e-6; the conformance policy keeps ints exact and skips stateHash', () => {
  const near = compare({ actors: [{ x: 1 }] }, { actors: [{ x: 1 + 9e-7 }] }, POLICY.reverse);
  assert.equal(near, null);
  const far = compare({ actors: [{ x: 1 }] }, { actors: [{ x: 1 + 2e-6 }] }, POLICY.reverse);
  assert.equal(far.path, 'actors[0].x');
  assert.equal(compare({ rng: 4000000000 }, { rng: 4000000001 }, POLICY.conformance).path, 'rng');
  assert.equal(compare({ stateHash: 'a', hp: 10 }, { stateHash: 'b', hp: 10 }, POLICY.conformance), null);
  assert.equal(compare({ d: null }, { d: undefined }, POLICY.conformance), null);
  assert.notEqual(compare({ d: null }, { d: undefined }, POLICY.reverse), null);
});

/** A VR-shaped training vector recorded from the PC kernel itself (dummy-wave's shape, hermetic: no VR checkout). */
function recordedTrainingVector(k) {
  const training = k.createTraining('magic', 7);
  const rows = [{ tick: 0, when: 'pre-ops', ...snapshot(training.state) }];
  for (let tick = 1; tick <= 120; tick++) {
    k.stepTraining(training, k.idleInput(training.dummy.pos));
    if (tick % 60 === 0) rows.push({ tick, when: 'pre-ops', ...snapshot(training.state) });
  }
  return { name: 'dummy-wave-pc', driver: 'training', trainingKind: 'magic', seed: 7, ticks: 120, frames: [], ops: [], checkpoints: rows, events: exportEvents(training.state.events) };
}

test('both replayers return the same Diff record, rendered by one line format', async () => {
  const k = await loadKernel();
  const water = hand();
  water.checkpoints[1].actors[0].hp += 1;
  const reverse = replayVector(k, water).diff;
  const training = recordedTrainingVector(k);
  assert.equal(replayConformance(k, training).pass, true, JSON.stringify(replayConformance(k, training).diff));
  training.checkpoints[1].actors[1].hp += 0.5;
  const conformance = replayConformance(k, training).record;
  assert.deepEqual(Object.keys(reverse), DIFF_KEYS);
  assert.deepEqual(Object.keys(conformance), DIFF_KEYS);
  assert.equal(reverse.path, 'actors[0].hp');
  assert.equal(conformance.path, 'actors[1].hp');
  const line = /^tick \d+ \S+( \d+\))? \S+: .+$/;
  assert.match(renderDiff(reverse), line);
  assert.match(renderDiff(conformance), line);
  assert.equal(renderDiff(conformance), `tick 60 pre-ops actors[1].hp: ${conformance.detail}`);
});

test('no VR tool edits kernel state to unpace a bout; the hand vector still passes', async () => {
  const sources = readdirSync(dir).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs'));
  for (const f of sources) {
    const text = readFileSync(`${dir}${f}`, 'utf8');
    assert.ok(!text.includes('delete games.state'), f);
    assert.ok(!text.includes('delete a.pace'), f);
  }
  const k = await loadKernel();
  assert.equal(replayVector(k, jsonClone(hand())).pass, true);
});
