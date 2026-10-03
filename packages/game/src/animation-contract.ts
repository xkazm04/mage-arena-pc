export type Direction = "ne" | "se" | "sw" | "nw";
export type BodyState = "idle" | "run" | "cast" | "absorb" | "hit" | "death";
export type Element = "water" | "fire" | "earth" | "air";
export interface Clip {
  page: string;
  frames: { rect: [number, number, number, number]; durationMs: number }[];
  frameCount: number;
  loop: boolean;
  mirrorX?: boolean;
  anchor?: [number, number];
  designSize1080?: [number, number];
  blend?: "lighter" | "source-over";
}
export interface PageSpec {
  id: string;
  size: [number, number];
  sha256: string;
  file: string;
}
export interface EffectManifest {
  schemaVersion: 1;
  pages: PageSpec[];
  clips: Record<string, Clip>;
}
export interface Body {
  anchor: [number, number];
  designSize1080: [number, number];
  designBodyHeight1080: number;
  clips: Partial<Record<BodyState, Partial<Record<Direction, Clip>>>>;
}
export interface BodyManifest {
  schemaVersion: 1;
  pages: PageSpec[];
  entities: Record<string, Body>;
  backlog: string[];
}
export function frameIndex(
  clip: Clip,
  elapsedMs: number,
  hold = false,
): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return -1;
  const total = clip.frames.reduce((n, f) => n + f.durationMs, 0);
  if (!total || (!clip.loop && !hold && elapsedMs >= total)) return -1;
  let t = clip.loop ? elapsedMs % total : Math.min(elapsedMs, total - 0.001);
  for (let i = 0; i < clip.frames.length; i++) {
    if (t < clip.frames[i]!.durationMs) return i;
    t -= clip.frames[i]!.durationMs;
  }
  return -1;
}
export function facingFromVector(
  x: number,
  y: number,
  previous: Direction = "se",
): Direction {
  if (Math.abs(x) + Math.abs(y) < 1e-6) return previous;
  return `${Math.abs(y) < 1e-6 ? previous[0] : y > 0 ? "s" : "n"}${Math.abs(x) < 1e-6 ? previous[1] : x > 0 ? "e" : "w"}` as Direction;
}
export function validateClips(pages: PageSpec[], clips: Clip[]) {
  if (
    !Array.isArray(pages) ||
    new Set(pages.map((p) => p.id)).size !== pages.length
  )
    throw Error("Invalid animation pages");
  for (const c of clips) {
    const p = pages.find((p) => p.id === c.page);
    if (
      !p ||
      !c.frames?.length ||
      c.frameCount !== c.frames.length ||
      typeof c.loop !== "boolean"
    )
      throw Error("Invalid animation clip");
    for (const f of c.frames) {
      const r = f.rect;
      if (
        !Array.isArray(r) ||
        r.length !== 4 ||
        !r.every(Number.isInteger) ||
        r[0] < 0 ||
        r[1] < 0 ||
        r[2] <= 0 ||
        r[3] <= 0 ||
        r[0] + r[2] > p.size[0] ||
        r[1] + r[3] > p.size[1] ||
        !Number.isFinite(f.durationMs) ||
        f.durationMs <= 0
      )
        throw Error("Invalid animation frame");
    }
  }
}
