// Engine-independent trigonometry for the hashed arena state. The ECMAScript spec leaves Math.sin/cos/tan/atan2
// "implementation-approximated", and engines disagree in the last bit: HeadlessChrome 153 and Node 24 (V8 13.6) differ on
// about 2% of Math.cos/sin and 15% of Math.atan2 results. The browser steps a season bout and the director replays it, so a
// one-ulp difference in a mage's aim became a different state hash ('Arena checkpoint mismatch.'). These are FreeBSD
// msun / fdlibm ports (the routines V8 ships as base::ieee754), built only from + - * / and bit access, which IEEE 754
// fixes exactly in every engine; they match Node's Math bit for bit, so goldens and digests do not move.
// Rule: kernel, AI and season code reads these, never Math.sin/cos/tan/atan/atan2 (fdlibm.test.ts scans the sources).
const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer), i32 = new Int32Array(f64.buffer);
const little = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1, HI = little ? 1 : 0, LO = little ? 0 : 1;
const high = (x: number): number => { f64[0] = x; return i32[HI]!; };
const low = (x: number): number => { f64[0] = x; return u32[LO]!; };
const words = (hi: number, lo: number): number => { u32[HI] = hi >>> 0; u32[LO] = lo >>> 0; return f64[0]!; };
const clearLow = (x: number): number => { f64[0] = x; u32[LO] = 0; return f64[0]!; };

function kernelSin(x: number, y: number, iy: number): number {
  const S1 = -1.66666666666666324348e-01, S2 = 8.33333333332248946124e-03, S3 = -1.98412698298579493134e-04,
    S4 = 2.75573137070700676789e-06, S5 = -2.50507602534068634195e-08, S6 = 1.58969099521155010221e-10;
  if ((high(x) & 0x7fffffff) < 0x3e400000 && Math.trunc(x) === 0) return x;
  const z = x * x, v = z * x, r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  return iy === 0 ? x + v * (S1 + z * r) : x - ((z * (0.5 * y - v * r) - y) - v * S1);
}
function kernelCos(x: number, y: number): number {
  const C1 = 4.16666666666666019037e-02, C2 = -1.38888888888741095749e-03, C3 = 2.48015872894767294178e-05,
    C4 = -2.75573143513906633035e-07, C5 = 2.08757232129817482790e-09, C6 = -1.13596475577881948265e-11;
  const ix = high(x) & 0x7fffffff;
  if (ix < 0x3e400000 && Math.trunc(x) === 0) return 1;
  const z = x * x, r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  if (ix < 0x3fd33333) return 1 - (0.5 * z - (z * r - x * y));
  const qx = ix > 0x3fe90000 ? 0.28125 : words(ix - 0x00200000, 0), hz = 0.5 * z - qx, a = 1 - qx;
  return a - (hz - (z * r - x * y));
}
const T = [3.33333333333334091986e-01, 1.33333333333201242699e-01, 5.39682539762260521377e-02, 2.18694882948595424599e-02,
  8.86323982359930005737e-03, 3.59207910759131235356e-03, 1.45620945432529025516e-03, 5.88041240820264096874e-04,
  2.46463134818469906812e-04, 7.81794442939557092300e-05, 7.14072491382608190305e-05, -1.85586374855275456654e-05,
  2.59073051863633712884e-05] as const;
const pio4 = words(0x3fe921fb, 0x54442d18), pio4lo = words(0x3c81a626, 0x33145c07);
function kernelTan(x: number, y: number, iy: number): number {
  const hx = high(x), ix = hx & 0x7fffffff;
  if (ix < 0x3e300000 && Math.trunc(x) === 0) {
    if (((ix | low(x)) | (iy + 1)) === 0) return 1 / Math.abs(x);
    if (iy === 1) return x;
    const w = x + y, z = clearLow(w), v = y - (z - x), a = -1 / w, t = clearLow(a), s = 1 + t * z;
    return t + a * (s + t * v);
  }
  const big = ix >= 0x3fe59428;
  if (big) { if (hx < 0) { x = -x; y = -y; } x = (pio4 - x) + (pio4lo - y); y = 0; }
  let z = x * x, w = z * z;
  let r = T[1] + w * (T[3] + w * (T[5] + w * (T[7] + w * (T[9] + w * T[11]))));
  let v = z * (T[2] + w * (T[4] + w * (T[6] + w * (T[8] + w * (T[10] + w * T[12])))));
  const s = z * x;
  r = y + z * (s * (r + v) + y); r += T[0] * s; w = x + r;
  if (big) { v = iy; return (1 - ((hx >> 30) & 2)) * (v - 2 * (x - (w * w / (w + v) - r))); }
  if (iy === 1) return w;
  z = clearLow(w); v = r - (z - x);
  const a = -1 / w, t = clearLow(a), s2 = 1 + t * z;
  return t + a * (s2 + t * v);
}

const invpio2 = words(0x3fe45f30, 0x6dc9c883), pio2_1 = words(0x3ff921fb, 0x54400000), pio2_1t = words(0x3dd0b461, 0x1a626331),
  pio2_2 = words(0x3dd0b461, 0x1a600000), pio2_2t = words(0x3ba3198a, 0x2e037073), pio2_3 = words(0x3ba3198a, 0x2e000000),
  pio2_3t = words(0x397b839a, 0x252049c1);
const npio2hw = [0x3ff921fb, 0x400921fb, 0x4012d97c, 0x401921fb, 0x401f6a7a, 0x4022d97c, 0x4025fdbb, 0x402921fb, 0x402c463a,
  0x402f6a7a, 0x4031475c, 0x4032d97c, 0x40346b9c, 0x4035fdbb, 0x40378fdb, 0x403921fb, 0x403ab41b, 0x403c463a, 0x403dd85a,
  0x403f6a7a, 0x40407e4c, 0x4041475c, 0x4042106c, 0x4042d97c, 0x4043a28c, 0x40446b9c, 0x404534ac, 0x4045fdbb, 0x4046c6cb,
  0x40478fdb, 0x404858eb, 0x404921fb];
/** The largest |x| reduced here (2^19·π/2); fdlibm's multi-precision reduction above it is not ported. */
export const maxTrigArgument = words(0x413921fb, 0xffffffff);
/** x = n·π/2 + y0 + y1 for π/4 < |x| <= maxTrigArgument (fdlibm __ieee754_rem_pio2). */
function remPio2(x: number, y: [number, number]): number {
  const hx = high(x), ix = hx & 0x7fffffff;
  if (ix < 0x4002d97c) {
    let z: number;
    if (hx > 0) {
      z = x - pio2_1;
      if (ix !== 0x3ff921fb) { y[0] = z - pio2_1t; y[1] = (z - y[0]) - pio2_1t; }
      else { z -= pio2_2; y[0] = z - pio2_2t; y[1] = (z - y[0]) - pio2_2t; }
      return 1;
    }
    z = x + pio2_1;
    if (ix !== 0x3ff921fb) { y[0] = z + pio2_1t; y[1] = (z - y[0]) + pio2_1t; }
    else { z += pio2_2; y[0] = z + pio2_2t; y[1] = (z - y[0]) + pio2_2t; }
    return -1;
  }
  if (ix > 0x413921fb) throw Error(`Arena trigonometry argument ${x} is out of range.`);
  let t = Math.abs(x);
  const n = Math.trunc(t * invpio2 + 0.5), fn = n;
  let r = t - fn * pio2_1, w = fn * pio2_1t;
  if (n < 32 && ix !== npio2hw[n - 1]) y[0] = r - w;
  else {
    const j = ix >> 20;
    y[0] = r - w;
    if (j - ((high(y[0]) >> 20) & 0x7ff) > 16) {
      t = r; w = fn * pio2_2; r = t - w; w = fn * pio2_2t - ((t - r) - w); y[0] = r - w;
      if (j - ((high(y[0]) >> 20) & 0x7ff) > 49) { t = r; w = fn * pio2_3; r = t - w; w = fn * pio2_3t - ((t - r) - w); y[0] = r - w; }
    }
  }
  y[1] = (r - y[0]) - w;
  if (hx < 0) { y[0] = -y[0]; y[1] = -y[1]; return -n; }
  return n;
}
const reduced: [number, number] = [0, 0];

export function sin(x: number): number {
  const ix = high(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kernelSin(x, 0, 0);
  if (ix >= 0x7ff00000) return NaN;
  const n = remPio2(x, reduced), [y0, y1] = reduced;
  switch (n & 3) { case 0: return kernelSin(y0, y1, 1); case 1: return kernelCos(y0, y1); case 2: return -kernelSin(y0, y1, 1); default: return -kernelCos(y0, y1); }
}
export function cos(x: number): number {
  const ix = high(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kernelCos(x, 0);
  if (ix >= 0x7ff00000) return NaN;
  const n = remPio2(x, reduced), [y0, y1] = reduced;
  switch (n & 3) { case 0: return kernelCos(y0, y1); case 1: return -kernelSin(y0, y1, 1); case 2: return -kernelCos(y0, y1); default: return kernelSin(y0, y1, 1); }
}
export function tan(x: number): number {
  const ix = high(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kernelTan(x, 0, 1);
  if (ix >= 0x7ff00000) return NaN;
  const n = remPio2(x, reduced);
  return kernelTan(reduced[0], reduced[1], 1 - ((n & 1) << 1));
}

const atanhi = [words(0x3fddac67, 0x0561bb4f), words(0x3fe921fb, 0x54442d18), words(0x3fef730b, 0xd281f69b), words(0x3ff921fb, 0x54442d18)] as const;
const atanlo = [words(0x3c7a2b7f, 0x222f65e2), words(0x3c81a626, 0x33145c07), words(0x3c700788, 0x7af0cbbd), words(0x3c91a626, 0x33145c07)] as const;
const aT = [3.33333333333329318027e-01, -1.99999999998764832476e-01, 1.42857142725034663711e-01, -1.11111104054623557880e-01,
  9.09088713343650656196e-02, -7.69187620504482999495e-02, 6.66107313738753120669e-02, -5.83357013379057348645e-02,
  4.97687799461593236017e-02, -3.65315727442169155270e-02, 1.62858201153657823623e-02] as const;
export function atan(x: number): number {
  const hx = high(x), ix = hx & 0x7fffffff;
  let id: number;
  if (ix >= 0x44100000) {
    if (Number.isNaN(x)) return NaN;
    return hx > 0 ? atanhi[3] + atanlo[3] : -atanhi[3] - atanlo[3];
  }
  if (ix < 0x3fdc0000) {
    if (ix < 0x3e400000) return x;
    id = -1;
  } else {
    x = Math.abs(x);
    if (ix < 0x3ff30000) {
      if (ix < 0x3fe60000) { id = 0; x = (2 * x - 1) / (2 + x); } else { id = 1; x = (x - 1) / (x + 1); }
    } else if (ix < 0x40038000) { id = 2; x = (x - 1.5) / (1 + 1.5 * x); } else { id = 3; x = -1 / x; }
  }
  const z = x * x, w = z * z;
  const s1 = z * (aT[0] + w * (aT[2] + w * (aT[4] + w * (aT[6] + w * (aT[8] + w * aT[10])))));
  const s2 = w * (aT[1] + w * (aT[3] + w * (aT[5] + w * (aT[7] + w * aT[9]))));
  if (id < 0) return x - x * (s1 + s2);
  const r = atanhi[id]! - ((x * (s1 + s2) - atanlo[id]!) - x);
  return hx < 0 ? -r : r;
}
const pi = words(0x400921fb, 0x54442d18), piLo = words(0x3ca1a626, 0x33145c07), pio2 = words(0x3ff921fb, 0x54442d18);
export function atan2(y: number, x: number): number {
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
  const hx = high(x), lx = low(x), ix = hx & 0x7fffffff, hy = high(y), ly = low(y), iy = hy & 0x7fffffff;
  if (hx - 0x3ff00000 === 0 && lx === 0) return atan(y);
  let m = ((hy >> 31) & 1) | ((hx >> 30) & 2);
  if ((iy | ly) === 0) return m < 2 ? y : m === 2 ? pi : -pi;
  if ((ix | lx) === 0) return hy < 0 ? -pio2 : pio2;
  if (ix === 0x7ff00000) {
    if (iy === 0x7ff00000) return [pio4, -pio4, 3 * pio4, -3 * pio4][m]!;
    return [0, -0, pi, -pi][m]!;
  }
  if (iy === 0x7ff00000) return hy < 0 ? -pio2 : pio2;
  const k = (iy - ix) >> 20;
  let z: number;
  if (k > 60) { z = pio2 + 0.5 * piLo; m &= 1; }
  else if (hx < 0 && k < -60) z = 0;
  else z = atan(Math.abs(y / x));
  switch (m) { case 0: return z; case 1: return -z; case 2: return pi - (z - piLo); default: return (z - piLo) - pi; }
}
