/**
 * Point-light model for normal-mapped painted bodies (D2 section 4.1). One definition: the shader in
 * `lit-body.ts` repeats it, and `packages/tools/art/derive-normal-map.py` draws its proof strip with the same constants.
 */
export const lightingDefaults = {
  ambient: 0.35,
  /** Height of the light above the sprite plane, in sprite pixels. */
  lightZ: 90,
  /** Falloff radius in sprite pixels. */
  lightRadius: 260,
  color: [1, 0.62, 0.3] as [number, number, number],
  /** How much of the light's colour is added on top of the lit paint. */
  tintStrength: 0.35,
} as const;
export interface PointLight {
  x: number;
  y: number;
  z?: number;
  radius?: number;
  color?: [number, number, number];
}
/** Decodes a normal-map texel (0..255 per channel) to a unit vector. */
export function decodeNormal(r: number, g: number, b: number) {
  const n: [number, number, number] = [
    (r / 255) * 2 - 1,
    (g / 255) * 2 - 1,
    (b / 255) * 2 - 1,
  ];
  const len = Math.hypot(...n) || 1;
  return n.map((v) => v / len) as [number, number, number];
}
/** Diffuse term times squared falloff for a texel at (x, y), 0..1. Matches the shader. */
export function lightAmount(
  normal: [number, number, number],
  x: number,
  y: number,
  light: PointLight,
): number {
  const dx = light.x - x,
    dy = light.y - y,
    dz = light.z ?? lightingDefaults.lightZ,
    dist = Math.hypot(dx, dy, dz),
    radius = light.radius ?? lightingDefaults.lightRadius;
  const lambert = Math.max(
    0,
    (normal[0] * dx + normal[1] * dy + normal[2] * dz) / dist,
  );
  const fall = Math.max(0, 1 - dist / radius);
  return lambert * fall * fall;
}
/** Final brightness multiplier for one light on top of ambient. */
export const litFactor = (amount: number) => lightingDefaults.ambient + amount;
