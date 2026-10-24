import { lightingDefaults } from "./lighting-math.ts";
/**
 * Quality tier for the lit-body material (D2 step 3). `lit` draws the one body that has a derived normal map with
 * `litBodyMesh`; `unlit` keeps every body on the plain painted sprite. `?lighting=unlit` picks the fallback tier.
 */
export type LightingTier = "lit" | "unlit";
export function pickLightingTier(
  search = globalThis.location?.search ?? "",
): LightingTier {
  return new URLSearchParams(search).get("lighting") === "unlit"
    ? "unlit"
    : "lit";
}
/** A10 pages with a derived normal map (`packages/tools/art/derive-normal-map.py`); the cassia page only, as in e8ea1aa. */
export const normalMaps: Record<string, string> = {
  cassia: "/normal-maps/cassia.png",
};
/** Why a body is or is not drawn with the lit material this frame. */
export type LitChoice =
  | "lit"
  | "tier-unlit"
  | "no-normal-map"
  | "normal-map-loading"
  | "flashing"
  | "another-body-lit";
export function litBodyChoice(o: {
  tier: LightingTier;
  page?: string;
  normalReady: boolean;
  flashing: boolean;
  anotherLit: boolean;
}): LitChoice {
  if (o.tier === "unlit") return "tier-unlit";
  if (!o.page || !(o.page in normalMaps)) return "no-normal-map";
  if (!o.normalReady) return "normal-map-loading";
  if (o.flashing) return "flashing";
  if (o.anotherLit) return "another-body-lit";
  return "lit";
}
/** The single scene point light, placed from the lit body's foot in ground metres (a key light at chest height, in front). */
export const keyLight = {
  offsetM: { x: -0.6, y: 0.2 },
  liftM: 1.1,
  zM: 0.7,
  radiusM: 4,
  color: lightingDefaults.color,
} as const;
/** Screen-space light in pixels: `z` out of the screen plane, `radius` the falloff. */
export interface ScreenLight {
  x: number;
  y: number;
  z: number;
  radius: number;
  color: [number, number, number];
}
export function keyLightAt(
  foot: { x: number; y: number },
  pxPerMetreX: number,
  pxPerMetreY: number,
): ScreenLight {
  return {
    x: foot.x + keyLight.offsetM.x * pxPerMetreX,
    y: foot.y + keyLight.offsetM.y * pxPerMetreY - keyLight.liftM * pxPerMetreX,
    z: keyLight.zM * pxPerMetreX,
    radius: keyLight.radiusM * pxPerMetreX,
    color: [...keyLight.color],
  };
}
/**
 * A screen light in the lit quad's own pixel space (`setLights`): `m` maps the unit quad to the light's space, `size`
 * is the frame in page pixels. Height and radius scale by page pixels per screen pixel. A mirrored body mirrors the
 * light with it, so the shading stays consistent with the unmirrored normal map.
 */
export function lightInQuad(
  m: { a: number; b: number; c: number; d: number; tx: number; ty: number },
  size: [number, number],
  light: ScreenLight,
) {
  const det = m.a * m.d - m.b * m.c,
    x = light.x - m.tx,
    y = light.y - m.ty,
    u = (m.d * x - m.c * y) / det,
    v = (-m.b * x + m.a * y) / det,
    pagePerScreen = size[0] / (Math.hypot(m.a, m.b) || 1);
  return {
    x: u * size[0],
    y: v * size[1],
    z: light.z * pagePerScreen,
    radius: light.radius * pagePerScreen,
    color: light.color,
  };
}
