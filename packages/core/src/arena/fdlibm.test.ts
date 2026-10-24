import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { atan, atan2, cos, sin, tan } from './fdlibm.ts';

// The day-7 Tiro Games of smoke:u3 failed its last batch with 'Arena checkpoint mismatch.': HeadlessChrome 153 stepped a
// mage's aim error (math.ts rotate) through Math.cos/sin one ulp apart from the director's Node, at log entry 5361 of 5407.
const engineMath = /\bMath\.(sin|cos|tan|asin|acos|atan2?|sinh|cosh|tanh|asinh|acosh|atanh|exp|expm1|log|log1p|log2|log10|cbrt)\(/;
const sources = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? sources(join(dir, e.name)) : e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') && e.name !== 'fdlibm.ts' ? [join(dir, e.name)] : []);

describe('engine-independent arena trigonometry', () => {
  it('no hashed-state source reads an implementation-approximated Math function', () => {
    const offenders = sources(join(import.meta.dirname, '..')).flatMap(file => readFileSync(file, 'utf8').split('\n')
      .flatMap((line, i) => engineMath.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : []));
    expect(offenders).toEqual([]);
  });
  it('returns the fdlibm value where HeadlessChrome 153 Math rounds the other way', () => {
    // [x, fdlibm (= Node 24 Math), HeadlessChrome 153 Math]
    const cases: [(x: number) => number, number, number, number][] = [
      [sin, -11.992395743727684, 0.5429742244039726, 0.5429742244039725], [sin, -2.552544189989567, -0.5555701008592797, -0.5555701008592798],
      [cos, 0.17465597740374506, 0.9847863777653221, 0.9847863777653222], [cos, 2.8639260217547418, -0.9616976609147916, -0.9616976609147917],
      [tan, -0.47733655720949175, -0.5172301931247645, -0.5172301931247644], [tan, 8.533084467053413, -1.238883197031413, -1.2388831970314127],
    ];
    for (const [f, x, fdlibm, chrome] of cases) { expect(f(x)).toBe(fdlibm); expect(f(x)).not.toBe(chrome); }
    expect(atan2(2.5999734446406366, 19.725776612758636)).toBe(0.13105046508762286);
    expect(atan2(-17.63887509703636, -0.912108488380909)).toBe(-1.6224604386806845);
    expect(atan2(-0.21345546715892852, 17.43515146896243)).toBe(-0.012242211017529385);
  });
  it('matches the Node Math every golden and digest was pinned with, bit for bit', () => {
    let seed = 987654321;
    const next = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
    const scales = [1e-9, 1e-3, 0.5, 1, 2, 4, 10, 100, 1e4, 1e5];
    for (let i = 0; i < 100000; i++) {
      const x = (next() * 2 - 1) * scales[i % scales.length]!, y = (next() * 2 - 1) * scales[(i >> 2) % scales.length]!;
      expect([sin(x), cos(x), tan(x), atan(x), atan2(y, x)]).toEqual([Math.sin(x), Math.cos(x), Math.tan(x), Math.atan(x), Math.atan2(y, x)]);
    }
    for (let k = -64; k <= 64; k++) for (const x of [k * Math.PI / 2, k * Math.PI / 4 + 1e-13]) expect([sin(x), cos(x), tan(x)]).toEqual([Math.sin(x), Math.cos(x), Math.tan(x)]);
    for (const x of [0, -0, Infinity, -Infinity, NaN, 5e-324]) {
      expect([sin(x), cos(x), tan(x), atan(x)]).toEqual([Math.sin(x), Math.cos(x), Math.tan(x), Math.atan(x)]);
      for (const y of [0, -0, 1, -1, Infinity, -Infinity, NaN]) expect(Object.is(atan2(y, x), Math.atan2(y, x))).toBe(true);
    }
  });
});
