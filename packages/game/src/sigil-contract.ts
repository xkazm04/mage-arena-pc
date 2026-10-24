import type { Clip, PageSpec } from "./animation-contract.ts";
import policy from "../data/sigils.json" with { type: "json" };
export interface SigilClip extends Clip {
  anchor: [number, number];
  designFrameSize1080: [number, number];
  plane: string;
  kind: string;
  shape?: "ring" | "cone" | "line";
  nominalBoundaryRadiusUV: number;
  nominalRangeUV?: number;
  progress?: { mask: string; baseOpacity: number };
}
export interface SigilManifest {
  schemaVersion: 1;
  pages: PageSpec[];
  clips: Record<string, SigilClip>;
}
export interface ThreatExtent {
  shape: "ring" | "cone" | "line";
  range: number;
  width?: number;
  degrees?: number;
}
/** Whole master frame in world metres, including transparent margins. */
export function threatFrame(
  clip: SigilClip,
  extent: ThreatExtent,
): [number, number] {
  const [sx, sy] = policy.coverageScale[extent.shape] as [number, number];
  if (extent.shape === "ring")
    return [
      (extent.range / clip.nominalBoundaryRadiusUV) * sx,
      (extent.range / clip.nominalBoundaryRadiusUV) * sy,
    ];
  if (extent.shape === "cone")
    return [
      (extent.range / clip.nominalRangeUV!) * sx,
      (extent.range / clip.nominalRangeUV!) * sy,
    ];
  // Lanes use segment/disk collision: include the width/2 endcaps as well as the rails.
  return [
    ((extent.range + extent.width!) / 0.8) * sx,
    (extent.width! / 0.286) * sy,
  ];
}
/** CPU witness for the exact shader's inverse polar mapping. */
export function coneUV(
  u: number,
  v: number,
  degrees: number,
): [number, number] {
  const dx = u - 1 / 3,
    dy = v - 0.5,
    r = Math.hypot(dx, dy),
    angle = (Math.atan2(dy, dx) * 90) / degrees;
  return [1 / 3 + r * Math.cos(angle), 0.5 + r * Math.sin(angle)];
}
export const clampProgress = (p: number) => Math.max(0, Math.min(1, p));
export function rankFill(progress: number, rank: number) {
  return progress <= 0
    ? 0
    : progress >= 1
      ? 1
      : clampProgress((progress - rank) * 255 + 1);
}

/**
 * Procedural telegraph shapes for the closer D2 camera: no painted page, an exact signed-distance field.
 * Local frame in metres: origin at the caster (disc: at the centre), +x along the facing.
 * `sigil-shader.ts` evaluates the same field; these are its CPU witnesses.
 */
export type ProceduralShape =
  | { shape: "disc"; radius: number }
  | { shape: "beam"; length: number; width: number }
  | { shape: "arc"; radius: number; thickness: number; degrees: number };
export const proceduralShapeIds = { disc: 0, beam: 1, arc: 2 } as const;
/** Negative inside, positive outside. */
export function proceduralDistance(
  s: ProceduralShape,
  x: number,
  y: number,
): number {
  if (s.shape === "disc") return Math.hypot(x, y) - s.radius;
  if (s.shape === "beam")
    return Math.max(-x, x - s.length, Math.abs(y) - s.width / 2);
  const r = Math.hypot(x, y),
    half = (s.degrees * Math.PI) / 360;
  return Math.max(
    Math.abs(r - s.radius) - s.thickness / 2,
    (Math.abs(Math.atan2(y, x)) - half) * r,
  );
}
/** 0..1 along the shape's fill direction: disc by radius, beam by length, arc by sweep from one end. */
export function proceduralFillCoord(
  s: ProceduralShape,
  x: number,
  y: number,
): number {
  if (s.shape === "disc") return Math.hypot(x, y) / s.radius;
  if (s.shape === "beam") return x / s.length;
  const half = (s.degrees * Math.PI) / 360;
  return (Math.atan2(y, x) + half) / (2 * half);
}
/** Local-frame bounding box [minX, minY, width, height] in metres, with the feather margin. */
export function proceduralBox(
  s: ProceduralShape,
  margin: number,
): [number, number, number, number] {
  if (s.shape === "disc") {
    const e = s.radius + margin;
    return [-e, -e, 2 * e, 2 * e];
  }
  if (s.shape === "beam")
    return [
      -margin,
      -s.width / 2 - margin,
      s.length + 2 * margin,
      s.width + 2 * margin,
    ];
  const e = s.radius + s.thickness / 2 + margin;
  return [-e, -e, 2 * e, 2 * e];
}
