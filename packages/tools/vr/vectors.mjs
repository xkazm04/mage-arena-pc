// Reverse vectors: replays VR-recorded Games bouts (format in VECTORS.md) against the PC kernel and reports the first
// checkpoint mismatch. `--record` fills a skeleton's checkpoints from the PC kernel (the PC reference recorder).
//   npm run vr:vectors [-- <file|dir> ...] [--json]
//   node packages/tools/vr/vectors.mjs --record <skeleton.json> [--out <file>]
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { isDown, loadKernel } from './conformance.mjs';
import { cliMain, compare, createBout as harnessBout, makeDiff, POLICY, renderDiff } from './harness.mjs';

const jsonClone = (value) => JSON.parse(JSON.stringify(value));

export const FORMAT = 'mage-arena-vector-1';
export const DEFAULT_DIR = fileURLToPath(new URL('./vectors/', import.meta.url));
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

// A vector setup as a harness bout: `difficulty` null is unpaced (as VR runs), `balance` canonical plays VR's numbers.
const createBout = (k, setup) => harnessBout(k, { ...setup, startWave: setup.wave });

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

const CHECKPOINT_KEYS = ['tick', 'phase', 'wave', 'actors', 'events'];
const ACTOR_KEYS = ['id', 'team', 'hp', 'mana', 'stamina', 'x', 'y', 'school', 'down'];
const pick = (obj, keys) => Object.fromEntries(keys.filter((key) => obj[key] !== undefined).map((key) => [key, obj[key]]));

/**
 * First mismatch between a vector checkpoint and the PC outcome at that tick, or null: harness.compare with the reverse
 * policy over the fields VECTORS.md defines, in its order (tick, phase, wave, actors, events).
 */
export function checkpointMismatch(expected, actual) {
  const fields = pick(expected, CHECKPOINT_KEYS);
  if (Array.isArray(fields.actors)) fields.actors = fields.actors.map((e) => pick(e, ACTOR_KEYS));
  const d = compare(fields, actual, POLICY.reverse);
  return d && { path: d.path, expected: d.expected, actual: d.actual };
}

const show = (x) => JSON.stringify(x);
const toDiff = (m) => makeDiff({ tick: m.tick, when: `(checkpoint ${m.checkpoint})`, path: m.path, expected: m.expected, actual: m.actual, detail: `vector ${show(m.expected)} PC ${show(m.actual)}` });

/**
 * Replays one vector. Returns { name, pass, mismatch: { tick, checkpoint, path, expected, actual } | null, diff, problems }:
 * `diff` is the mismatch as the harness Diff record.
 */
export function replayVector(k, v) {
  const problems = vectorProblems(v);
  const result = { name: v?.name ?? '(unnamed)', pass: false, mismatch: null, diff: null, problems };
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
  if (result.mismatch) result.diff = toDiff(result.mismatch);
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

export function renderResult(file, r) {
  if (r.pass) return `pass  ${r.name}  (${file})`;
  if (r.problems.length) return `FAIL  ${r.name}  (${file}): invalid vector: ${r.problems.join('; ')}`;
  return `FAIL  ${r.name}  (${file}): first mismatch at ${renderDiff(r.diff)}`;
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

await cliMain(import.meta.url, main);
