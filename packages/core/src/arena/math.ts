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
