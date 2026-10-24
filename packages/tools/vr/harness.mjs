// The one place that states how PC replays a VR bout. Both vector formats (VR's conformance vectors, conformance.mjs;
// PC's reverse vectors, vectors.mjs) build their bouts, compare their values and report their first difference here,
// so a new vector source is an adapter onto createBout / compare / Diff instead of another copy of each.
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// Copied from mage-arena-vr apps/vr/Game/Source/MageArenaVR/Tests/KernelConformanceTests.cpp FCheck::Close
// (the oracle's TOLERANCE in apps/vr/tools/conformance/oracle.mjs: 1e-6 relative / 1e-9 absolute).
export const TOLERANCE = { relative: 1e-6, absolute: 1e-9 };
export function close(actual, expected, tol = TOLERANCE) {
  if (actual === expected) return true;
  const diff = Math.abs(actual - expected);
  const scale = Math.max(Math.abs(actual), Math.abs(expected));
  return diff <= tol.absolute || diff <= tol.relative * scale;
}

/**
 * A Games bout from a VR setup, through createGames options only (kernel state is never edited after creation).
 * `preset` is a preset name (null/undefined: the kernel default). `difficulty` null is unpaced, as VR runs (the pinned
 * kernel had no pace); undefined is the kernel's default pace; a name paces by it. `balance` 'canonical' plays VR's
 * numbers; anything else leaves the kernel's default. `schoolRivals` null/undefined is the Water proxies.
 */
export function createBout(k, setup) {
  let preset;
  if (setup.preset != null) {
    preset = k.presets.find((c) => c.name === setup.preset);
    if (!preset) throw new Error(`unknown preset ${setup.preset}`);
  }
  const options = {};
  if (setup.schoolRivals) options.schoolRivals = setup.schoolRivals;
  if (setup.difficulty === null) options.unpaced = true;
  if (setup.balance === 'canonical') options.balance = 'canonical';
  return k.createGames(setup.seed, preset, setup.startWave ?? 0, !!setup.referencePlayer, undefined, undefined, setup.difficulty ?? undefined, options);
}

const show = (value) => (value === undefined ? 'undefined' : JSON.stringify(value));

/**
 * Field policies for compare(). Integers on both sides compare exactly (the C++ WantInt / WantUInt rule: rng is a
 * uint32, where a relative tolerance would hide a wrong draw); `abs` names keys compared by an absolute bound; any
 * other number uses close(). `skip` keys are not read. `nullish`: an expected null also accepts undefined.
 * `lengthPath`: an array count mismatch is reported at `<path>.length` with the two counts. `describe(e, a)`: the detail
 * text, or the built-in one.
 */
export const POLICY = {
  /** VR's conformance replay (KernelConformanceTests.cpp). `stateHash` is skipped: the C++ replay does not compare it,
   * and PC's HEAD hash moves with every new optional key. */
  conformance: { tol: TOLERANCE, abs: {}, skip: new Set(['stateHash']), nullish: true, lengthPath: false, describe: null },
  /** PC reverse vectors (VECTORS.md): positions are rounded to 1e-6 when recorded, so they compare within 1e-6. */
  reverse: { tol: TOLERANCE, abs: { x: 1e-6, y: 1e-6 }, skip: new Set(), nullish: false, lengthPath: true, describe: (e, a) => `vector ${show(e)} PC ${show(a)}` },
};

const diffAt = (policy, path, expected, actual, detail) => ({
  path, expected, actual, detail: policy.describe ? policy.describe(expected, actual) : detail,
});

/**
 * Expected-driven comparison: every key `expected` carries must match; keys it omits are not read. Returns the first
 * difference as { path, expected, actual, detail } or null. `policy` is a POLICY entry (or one with its own `tol`).
 */
export function compare(expected, actual, policy = POLICY.conformance, path = '', key = '') {
  const tol = policy.tol ?? TOLERANCE;
  if (expected === null) {
    return actual === null || (policy.nullish && actual === undefined) ? null : diffAt(policy, path, expected, actual, `expected null got ${show(actual)}`);
  }
  if (typeof expected === 'number') {
    if (typeof actual !== 'number') return diffAt(policy, path, expected, actual, `expected ${expected} got ${show(actual)}`);
    const bound = policy.abs?.[key];
    const exact = Number.isInteger(expected) && Number.isInteger(actual);
    const ok = bound !== undefined ? Math.abs(expected - actual) <= bound : exact ? expected === actual : close(actual, expected, tol);
    if (ok) return null;
    const diff = Math.abs(actual - expected), scale = Math.max(Math.abs(actual), Math.abs(expected));
    return diffAt(policy, path, expected, actual, `expected ${expected} got ${actual} (abs ${diff.toPrecision(3)}, rel ${(scale > 0 ? diff / scale : diff).toPrecision(3)})`);
  }
  if (typeof expected === 'string' || typeof expected === 'boolean') {
    return expected === actual ? null : diffAt(policy, path, expected, actual, `expected ${show(expected)} got ${show(actual)}`);
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return diffAt(policy, path, expected, actual, `expected an array got ${show(actual)}`);
    if (expected.length !== actual.length) {
      return policy.lengthPath
        ? diffAt(policy, `${path}.length`, expected.length, actual.length, `count expected ${expected.length} got ${actual.length}`)
        : diffAt(policy, path, expected.length, actual.length, `count expected ${expected.length} got ${actual.length}`);
    }
    for (let i = 0; i < expected.length; i++) {
      const d = compare(expected[i], actual[i], policy, `${path}[${i}]`, key);
      if (d) return d;
    }
    return null;
  }
  if (typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object') return diffAt(policy, path, expected, actual, `expected an object got ${show(actual)}`);
    for (const k of Object.keys(expected)) {
      if (policy.skip?.has(k)) continue;
      const d = compare(expected[k], actual[k], policy, path ? `${path}.${k}` : k, k);
      if (d) return d;
    }
    return null;
  }
  return diffAt(policy, path, expected, actual, `unsupported expected value ${show(expected)}`);
}

/** The one first-difference record every replayer returns. Values a source cannot name are null. */
export function makeDiff({ tick = null, when = null, path, expected = null, actual = null, detail }) {
  return { tick, when, path, expected: expected === undefined ? null : expected, actual: actual === undefined ? null : actual, detail };
}

/** One line for a Diff: `tick <t> <when> <path>: <detail>`. */
export const renderDiff = (d) => `tick ${d.tick} ${d.when} ${d.path}: ${d.detail}`;

/** Runs `main` when the module at `metaUrl` is the script node was started with. */
export async function cliMain(metaUrl, main) {
  const invoked = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : '';
  if (invoked === fileURLToPath(metaUrl).toLowerCase()) await main();
}
