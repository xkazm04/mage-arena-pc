import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { DEFAULT_VR, driftReport, renderText } from './drift.mjs';
import { close, firstDiff, loadKernel, readConformanceVectors, replayConformance, snapshot, exportEvents } from './conformance.mjs';

const jsonClone = (value) => JSON.parse(JSON.stringify(value));

const script = fileURLToPath(new URL('./drift.mjs', import.meta.url));
const pcRoot = fileURLToPath(new URL('../../../', import.meta.url));
const vrPresent = existsSync(join(DEFAULT_VR, 'apps', 'vr', 'data', 'PINNED.json'));
const git = (...args) => execFileSync('git', ['-C', pcRoot, ...args], { encoding: 'utf8' }).trim();

/** A fake VR checkout: only apps/vr/data/PINNED.json, pinning `commit` with the given file rows. */
function fakeVr(commit, files) {
  const dir = mkdtempSync(join(tmpdir(), 'mage-vr-drift-'));
  mkdirSync(join(dir, 'apps', 'vr', 'data'), { recursive: true });
  writeFileSync(join(dir, 'apps', 'vr', 'data', 'PINNED.json'), JSON.stringify({ commit, files }));
  return dir;
}

test('drift lists exactly the watched-path commits between a pin and HEAD (hermetic pin at HEAD~3)', () => {
  const pin = git('rev-parse', 'HEAD~3');
  const vr = fakeVr(pin, [{ path: 'package.json', sha256: '0'.repeat(64), bytes: 1 }]);
  try {
    const report = driftReport({ pcRoot, vrRoot: vr });
    const expected = git('log', '--format=%H', `${pin}..HEAD`, '--', 'packages/core/src/arena', 'packages/core/scripts', 'docs/design/reconciled/data').split('\n').filter(Boolean);
    assert.deepEqual(report.commits.map((c) => c.sha), expected);
    assert.equal(report.pinnedFiles[0].status, 'changed');
    assert.equal(report.head, git('rev-parse', 'HEAD'));
  } finally {
    rmSync(vr, { recursive: true, force: true });
  }
});

test('drift refuses a pin this repo does not have', () => {
  const vr = fakeVr('f'.repeat(40), []);
  try {
    assert.throws(() => driftReport({ pcRoot, vrRoot: vr }), /is not in/);
  } finally {
    rmSync(vr, { recursive: true, force: true });
  }
});

test('vr:drift runs against the real VR checkout and lists the arena commits since baeac66', { skip: !vrPresent && `no VR checkout at ${DEFAULT_VR}` }, () => {
  const pin = JSON.parse(readFileSync(join(DEFAULT_VR, 'apps', 'vr', 'data', 'PINNED.json'), 'utf8'));
  const r = spawnSync(process.execPath, [script, '--json'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const report = JSON.parse(r.stdout);
  assert.equal(report.pinnedCommit, pin.commit);
  const expected = git('log', '--format=%H', `${pin.commit}..HEAD`, '--', 'packages/core/src/arena', 'packages/core/scripts', 'docs/design/reconciled/data').split('\n').filter(Boolean);
  assert.ok(expected.length > 0);
  assert.deepEqual(report.commits.map((c) => c.sha), expected);
  assert.equal(report.pinnedFiles.length, pin.files.length);
  for (const f of report.pinnedFiles) {
    const bytes = execFileSync('git', ['-C', pcRoot, 'show', `HEAD:${f.path}`]);
    assert.equal(f.status === 'unchanged', bytes.length === f.pinnedBytes && f.headSha256 === f.pinnedSha256);
  }
  const text = renderText(report);
  assert.match(text, new RegExp(`Commits ${pin.commit.slice(0, 7)}\\.\\.`));
});

test('conformance comparison follows the C++ rule: 1e-6 relative / 1e-9 absolute, integers exact, stateHash skipped', () => {
  assert.equal(close(1 + 5e-7, 1), true);
  assert.equal(close(1 + 2e-6, 1), false);
  assert.equal(close(5e-10, 0), true);
  assert.equal(firstDiff({ rng: 4000000000 }, { rng: 4000000001 }, '').path, 'rng');
  assert.equal(firstDiff({ stateHash: 'a', hp: 10 }, { stateHash: 'b', hp: 10 }, ''), null);
  assert.equal(firstDiff({ a: [1, 2] }, { a: [1] }, '').detail, 'count expected 2 got 1');
  assert.equal(firstDiff({ d: null }, { d: undefined }, ''), null);
});

test('the conformance replay passes a vector recorded from this kernel and fails one changed field', { skip: !vrPresent && `no VR checkout at ${DEFAULT_VR}` }, async () => {
  const k = await loadKernel();
  // VR's bolt-hit setup and frames, with checkpoints re-recorded from the PC kernel at the same ticks.
  const v = jsonClone(readConformanceVectors(DEFAULT_VR).find((x) => x.name === 'bolt-hit'));
  const pc = jsonClone(v);
  const state = k.createArena(v.seed);
  for (const a of v.setup.actors) k.addMage(state, a.team, { x: a.x, y: a.y }, a.label, a.ranks);
  const held = {};
  const rows = [{ tick: 0, when: 'pre-ops', ...snapshot(state) }];
  for (let tick = 1; tick <= v.ticks; tick++) {
    for (const f of v.frames.filter((x) => x.tick === tick)) Object.assign(held, f.inputs);
    k.stepArena(state, held);
    if (v.checkpoints.some((c) => c.tick === tick)) rows.push({ tick, when: 'pre-ops', ...snapshot(state) });
  }
  pc.checkpoints = rows;
  pc.events = exportEvents(state.events);
  assert.equal(replayConformance(k, pc).pass, true, JSON.stringify(replayConformance(k, pc).diff));
  const planted = jsonClone(pc);
  planted.checkpoints[1].actors[1].hp += 0.5;
  const diff = replayConformance(k, planted).diff;
  assert.equal(diff.field, 'actors[1].hp');
  assert.equal(diff.tick, planted.checkpoints[1].tick);
});

test('--vectors replays all of VR\'s conformance vectors and reports each as pass or diff', { skip: !vrPresent && `no VR checkout at ${DEFAULT_VR}` }, () => {
  const r = spawnSync(process.execPath, [script, '--vectors', '--json'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const { vectors } = JSON.parse(r.stdout);
  assert.equal(vectors.total, readConformanceVectors(DEFAULT_VR).length);
  for (const res of vectors.results) assert.ok(res.pass ? res.diff === null : typeof res.diff.field === 'string', res.name);
});
