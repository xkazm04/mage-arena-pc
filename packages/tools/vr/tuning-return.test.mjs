import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { DEFAULT_OVERLAY, tuningReturn } from './tuning-return.mjs';

const script = fileURLToPath(new URL('./tuning-return.mjs', import.meta.url));
const evidence = fileURLToPath(new URL('../../../docs/waves/W4-evidence/census-wave-1.json', import.meta.url));
const cli = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });

function withTemp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'mage-vr-tuning-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A temp copy of the real overlay with `overrides` planted; the real overlay is never written. */
function plantedOverlay(dir, overrides) {
  const file = join(dir, 'school-balance.pc.json');
  copyFileSync(DEFAULT_OVERLAY, file);
  const json = JSON.parse(readFileSync(file, 'utf8'));
  json.overrides = overrides;
  writeFileSync(file, JSON.stringify(json));
  return file;
}

test('vr:tuning-return says "no deviations" for the real overlay today', () => {
  assert.deepEqual(JSON.parse(readFileSync(DEFAULT_OVERLAY, 'utf8')).overrides, {}, 'the real overlay gained a key: update this test');
  const r = cli();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /no deviations/);
  assert.doesNotMatch(r.stdout, /-> PC/);
});

test('a planted override prints VR canonical -> PC, read from the canon CSV and schools-combat.json', () => {
  withTemp((dir) => {
    const overlay = plantedOverlay(dir, { 'fire_flick.cooldownS': 2.5, 'air_shear.damage': 8, 'fire.identity.decay.perSecond': 5 });
    const r = cli('--overlay', overlay);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes('- `fire_flick.cooldownS`: VR 3 -> PC 2.5 (spells-fire.csv)'), r.stdout);
    assert.ok(r.stdout.includes('- `air_shear.damage`: VR 9 -> PC 8 (spells-air.csv, cell "9 each")'), r.stdout);
    assert.ok(r.stdout.includes('- `fire.identity.decay.perSecond`: VR 6 -> PC 5 (schools-combat.json)'), r.stdout);
    assert.doesNotMatch(r.stdout, /no deviations/);
  });
});

test('--out writes the addendum with the census evidence summary', () => {
  withTemp((dir) => {
    const out = join(dir, 'addendum.md');
    const r = cli('--evidence', evidence, '--out', out);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, '');
    const text = readFileSync(out, 'utf8');
    const s = JSON.parse(readFileSync(evidence, 'utf8')).summary;
    assert.match(text, /no deviations/);
    assert.ok(text.includes(`Median duration ${Number(s.durationS.p50.toFixed(6))} s, band ${s.targetDurationS[0]}-${s.targetDurationS[1]} s`), text);
    assert.ok(text.includes(`Wins ${s.wins} of ${s.fights}`), text);
    assert.ok(text.includes(`In-band fraction ${Number(s.inBandFraction.toFixed(6))}`), text);
  });
});

test('an unknown key or a non-census evidence file is refused, as schools.ts refuses it', () => {
  withTemp((dir) => {
    const overlay = plantedOverlay(dir, { 'fire_nope.damage': 1 });
    const r = cli('--overlay', overlay);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /fire_nope\.damage/);
    assert.throws(() => tuningReturn({ overlay: plantedOverlay(dir, { 'fire_flick.shape': 1 }) }), /unknown spell or column/);
    assert.throws(() => tuningReturn({ overlay: plantedOverlay(dir, { 'air.identity.nope': 1 }) }), /not a number/);
    const notCensus = join(dir, 'other.json');
    writeFileSync(notCensus, '{"summary":{"wave":1}}');
    assert.throws(() => tuningReturn({ evidence: notCensus }), /not a census wave file/);
  });
});
