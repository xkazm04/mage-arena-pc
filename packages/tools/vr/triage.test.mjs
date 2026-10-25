import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { URL } from 'node:url';
import { DEFAULT_VR, exitCodeFor, parseArgs, renderText, vectorsReport } from './drift.mjs';
import { createContext, exportEvents, loadKernel, readConformanceVectors, replayConformance, snapshot } from './conformance.mjs';
import { groupDiffs, loadDivergences, normaliseField, triage } from './triage.mjs';

const jsonClone = (value) => JSON.parse(JSON.stringify(value));
const vrPresent = existsSync(join(DEFAULT_VR, 'apps', 'vr', 'data', 'conformance'));
const MASK = ['release', 'stagger', 'phase'];

/**
 * A VR-shaped arena vector recorded from the PC kernel (bolt-hit's shape, hermetic: no VR checkout): a Water caster
 * fires at a target 6 m away. With `withoutKinds`, those event kinds are left out of the events and of every row's
 * eventCount, as a kernel that never emitted them would have recorded it.
 */
async function recordedArenaVector(withoutKinds = []) {
  const k = await loadKernel();
  const mage = (id, team, x, label) => ({
    id, team, x, y: 10, label, ranks: { vigor: 1, focus: 1, nerve: 1 }, tier: 1, lastUnlockTick: 0, dummy: false, hp: 95, maxHp: 95, mana: 95,
    composition: { name: 'Undertow', lines: ['lash', 'tide_orb', 'mire'], branches: { lash: 'A', mirror: 'A', tide_orb: 'A' } }, enemy: null,
    facing: { x: team ? -1 : 1, y: 0 }, clockAdvanceTicks: 0, absorb: false, absorbFreshTick: -1e9, releaseTick: -1e9, absorbExhausted: false, flow: 0,
  });
  const setup = { actors: [mage(1, 0, 10, 'Caster'), mage(2, 1, 16, 'Target')] };
  const { state } = createContext(k, { driver: 'arena', seed: 7, replaySetup: true, setup });
  const input = (cast) => ({ move: { x: 0, y: 0 }, aim: { x: 16, y: 10 }, slot: 0, cast, absorb: false, roll: false, sprint: false });
  const frames = [{ tick: 1, inputs: { 1: input(true) } }, { tick: 2, inputs: { 1: input(false) } }];
  const visible = () => state.events.filter((e) => !withoutKinds.includes(e.kind));
  const row = (when) => ({ when, ...snapshot(state), tick: state.tick, eventCount: visible().length });
  const checkpoints = [row('pre-ops')];
  const held = {};
  for (let tick = 1; tick <= 40; tick++) {
    for (const f of frames.filter((x) => x.tick === tick)) Object.assign(held, f.inputs);
    k.stepArena(state, held);
    if (tick % 20 === 0) checkpoints.push(row('pre-ops'));
  }
  const vector = { name: 'bolt-hit-pc', driver: 'arena', seed: 7, ticks: 40, replaySetup: true, setup, frames, ops: [], checkpoints, events: exportEvents(visible()) };
  return { k, vector, kinds: new Set(state.events.map((e) => e.kind)) };
}

const games = (name, tick = 0, i = 1) => ({ name, driver: 'games', pass: false, record: { tick, when: 'pre-ops', path: `actors[${i}].x`, expected: 24, actual: 15, detail: 'off' } });
const training = (name) => ({ name, driver: 'training', pass: false, record: { tick: 60, when: 'pre-ops', path: 'telegraphs[0].resolveTick', expected: 102, actual: 88, detail: 'off' } });

test('case 1: maskEventKinds hides PC-only kinds in the exported view only; unmasked the same vector fails on that kind', async () => {
  const { k, vector, kinds } = await recordedArenaVector(['release']);
  assert.ok(kinds.has('release'), 'the recorded bout emits release (else the case proves nothing)');
  const masked = replayConformance(k, jsonClone(vector), { maskEventKinds: ['release'] });
  assert.equal(masked.pass, true, JSON.stringify(masked.record));
  const raw = replayConformance(k, jsonClone(vector));
  assert.equal(raw.pass, false);
  assert.match(raw.record.path, /^events\[\d+\]|^eventCount$/);
  assert.match(raw.record.detail, /"kind":"release"/);
});

test('case 2: a mask may never hide a kind the vector carries', async () => {
  const { k, vector } = await recordedArenaVector([]);
  assert.ok(vector.events.some((e) => e.kind === 'release'));
  const r = replayConformance(k, vector, { maskEventKinds: ['release'] });
  assert.equal(r.pass, false);
  assert.equal(r.record.path, 'mask');
  assert.equal(r.record.detail, 'mask hides kind release that the vector carries');
});

test('case 3: groupDiffs keys failures by driver and index-normalised field', () => {
  assert.equal(normaliseField('actors[1].x'), 'actors[].x');
  assert.equal(normaliseField('telegraphs[0].resolveTick'), 'telegraphs[].resolveTick');
  const results = [games('a'), games('b', 0, 2), games('c'), games('d'), games('e'), training('t1'), training('t2'), training('t3'), training('t4'), { name: 'ok', driver: 'games', pass: true, record: null }];
  const groups = groupDiffs(results);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((g) => [g.driver, g.field, g.count]), [['games', 'actors[].x', 5], ['training', 'telegraphs[].resolveTick', 4]]);
  assert.deepEqual(groups[0].names, ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(groups[1].names, ['t1', 't2', 't3', 't4']);
});

test('case 4: a divergences entry explains the results it matches; any other diff stays unexplained', () => {
  const causes = [{ id: 'x', cr: 'CR-003', note: 'n', match: { driver: 'games', field: 'actors[].x', tick: 0 } }];
  const planted = { name: 'p', driver: 'games', pass: false, record: { tick: 0, when: 'pre-ops', path: 'actors[1].hp', expected: 1, actual: 2, detail: 'off' } };
  const late = games('late', 60);
  const groups = groupDiffs([games('a'), games('b'), planted, late], causes);
  const by = (n) => groups.find((g) => g.names.includes(n));
  assert.equal(by('a').explained, 'x (CR-003)');
  assert.equal(by('a').count, 2);
  assert.equal(by('p').explained, null);
  assert.equal(by('late').explained, null, 'the entry pins tick 0');
});

test('case 5: the triage text names raw and masked counts side by side, then explained and unexplained groups', () => {
  const div = { mask: MASK, causes: [{ id: 'x', cr: 'CR-003', note: 'n', match: { driver: 'games', field: 'actors[].x', tick: 0 } }] };
  const raw = [games('a'), games('b'), training('t1'), { name: 'ok', driver: 'arena', pass: false, record: { tick: 1, when: 'pre-ops', path: 'events[1].kind', detail: 'release' } }];
  const masked = [games('a'), games('b'), training('t1'), { name: 'ok', driver: 'arena', pass: true, record: null }];
  const t = triage(raw, masked, div);
  assert.deepEqual([t.total, t.rawPassed, t.passed], [4, 0, 1]);
  const text = renderText({ pinnedShort: 'abc1234', headShort: 'def5678', vr: '/vr', watched: [], commits: [], pinnedFiles: [], vectors: { total: 4, passed: 0, results: raw, triage: t } });
  const lines = text.split('\n');
  const head = lines.findIndex((l) => l.startsWith('Conformance vectors'));
  assert.equal(lines[head], 'Conformance vectors against PC HEAD: raw 0/4 pass, masked 1/4 pass (masked: release, stagger, phase; the default report is raw)');
  assert.equal(lines[head + 1], 'Explained: 1 group, 2 vectors');
  assert.match(lines[head + 2], /^ {2}2 {2}games actors\[\]\.x tick 0 {2}x \(CR-003\): a, b$/);
  assert.equal(lines[head + 3], 'Unexplained: 1 group, 1 vector');
  assert.match(lines[head + 4], /^ {2}1 {2}training telegraphs\[\]\.resolveTick tick 60: t1$/);
  assert.ok(!text.includes('  diff  '), 'the triage view replaces the per-vector lines');
});

test('case 6: --vectors stays the raw report; --triage opts in; --fail-on-unexplained exits 1 only on residue', () => {
  assert.deepEqual(parseArgs(['--vectors']), { vr: DEFAULT_VR, vectors: true, json: false, triage: false, failOnUnexplained: false });
  assert.equal(parseArgs(['--triage']).vectors, true);
  assert.deepEqual(parseArgs(['--vectors', '--fail-on-unexplained']), { vr: DEFAULT_VR, vectors: true, json: false, triage: true, failOnUnexplained: true });
  assert.throws(() => parseArgs(['--vectors', '--strict']), /unknown argument: --strict/);
  const opts = parseArgs(['--fail-on-unexplained']);
  const report = (unexplained) => ({ vectors: { triage: { unexplained } } });
  assert.equal(exitCodeFor(report([{ count: 1 }]), opts), 1);
  assert.equal(exitCodeFor(report([]), opts), 0);
  assert.equal(exitCodeFor(report([{ count: 1 }]), parseArgs(['--triage'])), 0);
  assert.equal(exitCodeFor({}, parseArgs([])), 0);
  const div = loadDivergences();
  assert.deepEqual(div.mask, MASK);
  assert.deepEqual(div.causes, []);
});

test('case 7: on the real VR checkout the mask only lifts, the default stays raw, and no masked kind is one VR records', { skip: !vrPresent && `no VR checkout at ${DEFAULT_VR}` }, async () => {
  const k = await loadKernel();
  const vectors = readConformanceVectors(DEFAULT_VR);
  for (const v of vectors) for (const e of v.events) assert.ok(!MASK.includes(e.kind), `${v.name} records ${e.kind}`);
  const plain = await vectorsReport(DEFAULT_VR);
  assert.equal(plain.triage, undefined);
  assert.deepEqual(plain.results, vectors.map((v) => replayConformance(k, v)));
  const triaged = await vectorsReport(DEFAULT_VR, { triage: true });
  assert.deepEqual(triaged.results, plain.results);
  const t = triaged.triage;
  assert.equal(t.rawPassed, plain.passed);
  assert.ok(t.passed >= t.rawPassed, `masked ${t.passed} < raw ${t.rawPassed}`);
  const grouped = [...t.explained, ...t.unexplained].reduce((n, g) => n + g.count, 0);
  assert.equal(grouped, t.total - t.passed);
  assert.equal(JSON.parse(readFileSync(new URL('./divergences.json', import.meta.url), 'utf8')).mask.length, MASK.length);
});
