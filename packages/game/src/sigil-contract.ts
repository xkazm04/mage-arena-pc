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
