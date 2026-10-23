// Reverse vectors: replays VR-recorded Games bouts (format in VECTORS.md) against the PC kernel and reports the first
// checkpoint mismatch. `--record` fills a skeleton's checkpoints from the PC kernel (the PC reference recorder).
//   npm run vr:vectors [-- <file|dir> ...] [--json]
//   node packages/tools/vr/vectors.mjs --record <skeleton.json> [--out <file>]
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { close, isDown, loadKernel, TOLERANCE } from './conformance.mjs';

const jsonClone = (value) => JSON.parse(JSON.stringify(value));

export const FORMAT = 'mage-arena-vector-1';
export const DEFAULT_DIR = fileURLToPath(new URL('./vectors/', import.meta.url));
const POS_ABS = 1e-6;
const INPUT_KEYS = ['move', 'aim', 'slot', 'cast', 'absorb', 'roll', 'sprint'];

/** Structural checks; a vector that breaks the format is refused before any tick runs. */
export function vectorProblems(v) {
  const p = [];
  if (v?.format !== FORMAT) p.push(`format must be ${FORMAT}`);
  const s = v?.setup ?? {};
  if (!Number.isInteger(s.seed) || s.seed < 0 || s.seed > 0xffffffff) p.push('setup.seed must be a uint32');
  if (!Number.isInteger(s.wave) || s.wave < 0) p.push('setup.wave must be a non-negative int');
  if (![null, 'fire', 'air', 'named'].includes(s.schoolRivals)) p.push('setup.schoolRivals must be null, fire, air or named');
  if (![null, 'easy', 'normal', 'hard'].includes(s.difficulty)) p.push('setup.difficulty must be null, easy, normal or hard');
  if (!['canonical', 'pc'].includes(s.balance)) p.push('setup.balance must be canonical or pc');
  if (typeof s.preset !== 'string') p.push('setup.preset must be a preset name');
  if (typeof s.referencePlayer !== 'boolean') p.push('setup.referencePlayer must be a bool');
  if (!Number.isInteger(v?.ticks) || v.ticks < 1) p.push('ticks must be a positive int');
  let last = 0;
  for (const [i, run] of (Array.isArray(v?.inputs) ? v.inputs : []).entries()) {
    if (!Number.isInteger(run.from) || !Number.isInteger(run.to) || run.from <= last || run.to < run.from || run.to > v.ticks) p.push(`inputs[${i}]: runs must be sorted, disjoint and inside 1..ticks`);
    else last = run.to;
    if (!run.input || INPUT_KEYS.some((k) => !(k in run.input))) p.push(`inputs[${i}].input must have ${INPUT_KEYS.join(', ')}`);
  }
  if (!Array.isArray(v?.inputs)) p.push('inputs must be an array');
  let lastTick = 0;
  for (const [i, c] of (Array.isArray(v?.checkpoints) ? v.checkpoints : []).entries()) {
    if (!Number.isInteger(c.tick) || c.tick <= lastTick || c.tick > v.ticks) p.push(`checkpoints[${i}]: ticks must be sorted, unique and inside 1..ticks`);
    else lastTick = c.tick;
  }
  if (!Array.isArray(v?.checkpoints) || v.checkpoints.length === 0) p.push('checkpoints must be a non-empty array');
  return p;
}

function createBout(k, setup) {
  const preset = k.presets.find((c) => c.name === setup.preset);
  if (!preset) throw new Error(`unknown preset ${setup.preset}`);
  const options = setup.schoolRivals ? { schoolRivals: setup.schoolRivals } : {};
  const games = k.createGames(setup.seed, preset, setup.wave, setup.referencePlayer, undefined, undefined, setup.difficulty ?? undefined, options);
  if (setup.difficulty === null) {
    // Unpaced, as VR runs (VR has no pace): createGames always paces, so the pace is lifted before tick 1. Later
    // spawns read state.difficulty, which is gone, so they are unpaced too. (Request: an unpaced createGames option.)
    delete games.state.difficulty;
    for (const a of games.state.actors) delete a.pace;
  }
  if (setup.balance === 'canonical') games.state.balance = 'canonical';
  return games;
}

const round6 = (n) => Math.round(n * 1e6) / 1e6;

/** The outcome fields of one checkpoint, as VECTORS.md defines them. `kinds` are the event kinds to count. */
export function outcome(games, kinds) {
  const state = games.state;
  const events = {};
  for (const kind of kinds) events[kind] = state.events.filter((e) => e.kind === kind).length;
  return {
    tick: state.tick, phase: games.phase, wave: games.wave,
    actors: state.actors.map((a) => ({
      id: a.id, team: a.team, hp: a.hp, mana: a.mana, stamina: a.stamina, x: round6(a.pos.x), y: round6(a.pos.y),
      school: a.schoolState ? a.schoolState.value : null, down: isDown(a),
    })),
    events,
  };
}

function inputAt(runs, tick) {
  const run = runs.find((r) => tick >= r.from && tick <= r.to);
  return run ? run.input : undefined;
}

/** Steps the bout and calls visit(checkpointIndex, games) after each checkpoint tick. */
function run(k, v, visit) {
  const games = createBout(k, v.setup);
  let next = 0;
  for (let tick = 1; tick <= v.ticks && next < v.checkpoints.length; tick++) {
    k.stepGames(games, inputAt(v.inputs, tick));
    if (v.setup.autoAdvance && games.phase === 'intermission') k.advanceGames(games);
    if (v.checkpoints[next].tick === tick) {
      if (visit(next, games) === false) return;
      next++;
    }
  }
}

function compareNumber(field, expected, actual) {
  if (typeof expected !== 'number' || typeof actual !== 'number') return expected === actual;
  if (field === 'x' || field === 'y') return Math.abs(expected - actual) <= POS_ABS;
  if (Number.isInteger(expected) && Number.isInteger(actual)) return expected === actual;
  return close(actual, expected, TOLERANCE);
}

/** First mismatch between a vector checkpoint and the PC outcome at that tick, or null. */
export function checkpointMismatch(expected, actual) {
  const at = (path, e, a) => ({ path, expected: e, actual: a });
  for (const key of ['tick', 'phase', 'wave']) if (expected[key] !== undefined && expected[key] !== actual[key]) return at(key, expected[key], actual[key]);
  if (expected.actors) {
    if (expected.actors.length !== actual.actors.length) return at('actors.length', expected.actors.length, actual.actors.length);
    for (let i = 0; i < expected.actors.length; i++) {
      const e = expected.actors[i], a = actual.actors[i];
      for (const field of ['id', 'team', 'hp', 'mana', 'stamina', 'x', 'y', 'school', 'down']) {
        if (!(field in e)) continue;
        const ok = e[field] === null || typeof e[field] === 'boolean' ? e[field] === a[field] : compareNumber(field, e[field], a[field]);
        if (!ok) return at(`actors[${i}].${field}`, e[field], a[field]);
      }
    }
  }
  for (const [kind, count] of Object.entries(expected.events ?? {})) {
    if (actual.events[kind] !== count) return at(`events.${kind}`, count, actual.events[kind]);
  }
  return null;
}

/** Replays one vector. Returns { name, pass, mismatch: { tick, path, expected, actual } | null, problems }. */
export function replayVector(k, v) {
  const problems = vectorProblems(v);
  const result = { name: v?.name ?? '(unnamed)', pass: false, mismatch: null, problems };
  if (problems.length) return result;
  try {
    let reached = 0;
    run(k, v, (i, games) => {
      const expected = v.checkpoints[i];
      const actual = outcome(games, Object.keys(expected.events ?? {}));
      reached = i + 1;
      const m = checkpointMismatch(expected, actual);
      if (m) {
        result.mismatch = { tick: expected.tick, checkpoint: i, ...m };
        return false;
      }
      return true;
    });
    if (!result.mismatch && reached !== v.checkpoints.length) {
      result.mismatch = { tick: v.checkpoints[reached].tick, checkpoint: reached, path: 'tick', expected: v.checkpoints[reached].tick, actual: 'not reached' };
    }
    result.pass = !result.mismatch;
  } catch (err) {
    result.mismatch = { tick: null, checkpoint: null, path: 'kernel', expected: null, actual: err?.message ?? String(err) };
  }
  return result;
}

/** Fills every checkpoint of a skeleton from the PC kernel (the event kinds a skeleton lists are kept). */
export function recordVector(k, skeleton) {
  const v = jsonClone(skeleton);
  v.format = FORMAT;
  const problems = vectorProblems(v);
  if (problems.length) throw new Error(`skeleton: ${problems.join('; ')}`);
  run(k, v, (i, games) => {
    v.checkpoints[i] = outcome(games, Object.keys(v.checkpoints[i].events ?? {}));
  });
  return v;
}

export function vectorFiles(paths) {
  return paths.flatMap((p) => (statSync(p).isDirectory()
    ? readdirSync(p).filter((f) => f.endsWith('.vector.json')).sort().map((f) => join(p, f))
    : [p]));
}

const show = (x) => JSON.stringify(x);
export function renderResult(file, r) {
  if (r.pass) return `pass  ${r.name}  (${file})`;
  if (r.problems.length) return `FAIL  ${r.name}  (${file}): invalid vector: ${r.problems.join('; ')}`;
  const m = r.mismatch;
  return `FAIL  ${r.name}  (${file}): first mismatch at tick ${m.tick} (checkpoint ${m.checkpoint}) ${m.path}: vector ${show(m.expected)} PC ${show(m.actual)}`;
}

async function main() {
  const argv = process.argv.slice(2);
  try {
    const k = await loadKernel();
    const recordAt = argv.indexOf('--record');
    if (recordAt >= 0) {
      const src = argv[recordAt + 1];
      if (!src) throw new Error('--record requires a skeleton path');
      const outAt = argv.indexOf('--out');
      const text = `${JSON.stringify(recordVector(k, JSON.parse(readFileSync(src, 'utf8'))), null, 2)}\n`;
      if (outAt >= 0 && argv[outAt + 1]) writeFileSync(argv[outAt + 1], text);
      else process.stdout.write(text);
      return;
    }
    const json = argv.includes('--json');
    const unknown = argv.filter((a) => a.startsWith('--') && a !== '--json');
    if (unknown.length) throw new Error(`unknown argument: ${unknown[0]}`);
    const paths = argv.filter((a) => !a.startsWith('--'));
    const files = vectorFiles(paths.length ? paths : [DEFAULT_DIR]);
    if (!files.length) throw new Error('no .vector.json files found');
    const results = files.map((file) => ({ file, ...replayVector(k, JSON.parse(readFileSync(file, 'utf8'))) }));
    if (json) process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
    else process.stdout.write(`${results.map((r) => renderResult(r.file, r)).join('\n')}\n${results.filter((r) => r.pass).length}/${results.length} vectors pass\n`);
    process.exitCode = results.every((r) => r.pass) ? 0 : 1;
  } catch (err) {
    process.stderr.write(`vr:vectors: ${err.message}\n`);
    process.exitCode = 2;
  }
}

const invoked = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : '';
if (invoked === fileURLToPath(import.meta.url).toLowerCase()) await main();
