export interface Vec { x: number; y: number }
export const length = (v: Vec): number => Math.hypot(v.x, v.y);
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export function unit(v: Vec, fallback: Vec = { x: 1, y: 0 }): Vec {
  const n = length(v); return n > 0 ? { x: v.x / n, y: v.y / n } : { ...fallback };
}
export const distance = (a: Vec, b: Vec): number => length(sub(a, b));
export const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
export function inArc(facing: Vec, toward: Vec, arcDeg: number): boolean {
  if (length(toward) === 0 || arcDeg >= 360) return true;
  const a = unit(facing), b = unit(toward);
  return a.x * b.x + a.y * b.y >= Math.cos(arcDeg * Math.PI / 360) - 1e-12;
}
export function segmentHit(from: Vec, to: Vec, centre: Vec, radius: number): number | undefined {
  const d = sub(to, from), f = sub(from, centre);
  const a = d.x * d.x + d.y * d.y;
  const c = f.x * f.x + f.y * f.y - radius * radius;
  if (c <= 0) return 0;
  if (a === 0) return undefined;
  const b = 2 * (f.x * d.x + f.y * d.y), disc = b * b - 4 * a * c;
  if (disc < 0) return undefined;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : undefined;
}
export function rotate(v: Vec, radians: number): Vec {
  return { x: v.x * Math.cos(radians) - v.y * Math.sin(radians), y: v.x * Math.sin(radians) + v.y * Math.cos(radians) };
}
/**
 * segmentHit's companion for a weapon carried by a moving body: a sector of `radius` and `arcDeg`, centred on `dir`,
 * slides from `from` to `to` along `dir`. Returns the earliest fraction in [0, 1] at which it covers `centre`.
 */
export function sectorSweep(from: Vec, to: Vec, dir: Vec, centre: Vec, radius: number, arcDeg: number): number | undefined {
  const d = unit(dir), q = sub(centre, from), len = Math.max(0, d.x * (to.x - from.x) + d.y * (to.y - from.y));
  const u = q.x * d.x + q.y * d.y, v = Math.abs(q.x * d.y - q.y * d.x);
  if (v > radius) return undefined;
  const half = Math.sqrt(radius * radius - v * v), hi = arcDeg >= 360 ? u + half : Math.min(u + half, u - v / Math.tan(arcDeg * Math.PI / 360));
  const s = Math.max(0, u - half);
  if (s > Math.min(len, hi) + 1e-12) return undefined;
  return len > 0 ? Math.min(1, s / len) : 0;
}
