import contract from "../data/camera.json" with { type: "json" };
export { contract };
export interface Point {
  x: number;
  y: number;
}
export interface Viewport {
  width: number;
  height: number;
}
export interface Camera extends Viewport {
  centre: Point;
  zoom: number;
  elevation: number;
}
const standard = contract.distances.find((d) => d.id === "standard")!;
export function makeCamera(
  viewport: Viewport,
  centre: Point,
  zoom = standard.zoom,
  elevation = contract.camera.elevation_above_ground_degrees,
): Camera {
  if (
    ![
      viewport.width,
      viewport.height,
      centre.x,
      centre.y,
      zoom,
      elevation,
    ].every(Number.isFinite) ||
    viewport.width <= 0 ||
    viewport.height <= 0 ||
    elevation < contract.camera.elevation_range_degrees[0]! ||
    elevation > contract.camera.elevation_range_degrees[1]!
  )
    throw Error("Invalid camera");
  return {
    ...viewport,
    centre: { ...centre },
    zoom: Math.max(
      contract.camera.zoom_range[0]!,
      Math.min(contract.camera.zoom_range[1]!, zoom),
    ),
    elevation,
  };
}
/** Presentation only: stay fixed until the feet leave the wide safe rectangle. */
export function followCamera(
  c: Camera,
  player: Point,
  deltaSeconds: number,
): Camera {
  if (
    ![player.x, player.y, deltaSeconds].every(Number.isFinite) ||
    deltaSeconds < 0
  )
    throw Error("Invalid camera follow");
  const m = cameraMetrics(c),
    f = contract.follow;
  const zone = f.dead_zone_normalized;
  const excess = (d: number, min: number, max: number) =>
    d < min ? d - min : d > max ? d - max : 0;
  const blend = -Math.expm1(
    -f.response_per_second * Math.min(deltaSeconds, f.max_delta_seconds),
  );
  return makeCamera(
    c,
    {
      x:
        c.centre.x +
        excess(
          player.x - c.centre.x,
          ((zone[0]! - 0.5) * c.width) / m.pxPerMetreX,
          ((zone[2]! - 0.5) * c.width) / m.pxPerMetreX,
        ) *
          blend,
      y:
        c.centre.y +
        excess(
          player.y - c.centre.y,
          ((zone[1]! - 0.5) * c.height) / m.pxPerMetreY,
          ((zone[3]! - 0.5) * c.height) / m.pxPerMetreY,
        ) *
          blend,
    },
    c.zoom,
    c.elevation,
  );
}
export function cameraMetrics(c: Camera) {
  const resolutionScale = c.height / contract.reference_viewport_px[1]!;
  const pxPerMetreX =
    contract.camera.standard_ground_pixels_per_metre_at_1080p *
    c.zoom *
    resolutionScale;
  const pxPerMetreY = pxPerMetreX * Math.sin((c.elevation * Math.PI) / 180);
  return {
    resolutionScale,
    pxPerMetreX,
    pxPerMetreY,
    metresPerPixelX: 1 / pxPerMetreX,
    metresPerPixelY: 1 / pxPerMetreY,
    figureHeightPx: contract.character.nominal_height_metres * pxPerMetreX,
    visibleGroundM: { x: c.width / pxPerMetreX, y: c.height / pxPerMetreY },
    outlinePx: contract.telegraph.minimum_outline_px_at_1080p * resolutionScale,
    projectileCorePx:
      contract.telegraph.minimum_projectile_core_px_at_1080p * resolutionScale,
  };
}
export function groundToScreen(p: Point, c: Camera): Point {
  const m = cameraMetrics(c);
  return {
    x: c.width / 2 + (p.x - c.centre.x) * m.pxPerMetreX,
    y: c.height / 2 + (p.y - c.centre.y) * m.pxPerMetreY,
  };
}
export function screenToGround(p: Point, c: Camera): Point {
  const m = cameraMetrics(c);
  return {
    x: c.centre.x + (p.x - c.width / 2) / m.pxPerMetreX,
    y: c.centre.y + (p.y - c.height / 2) / m.pxPerMetreY,
  };
}
export function clientToGround(
  p: Point,
  bounds: { left: number; top: number; width: number; height: number },
  c: Camera,
): Point {
  return screenToGround(
    {
      x: ((p.x - bounds.left) * c.width) / bounds.width,
      y: ((p.y - bounds.top) * c.height) / bounds.height,
    },
    c,
  );
}
export function interpolate(
  previous: Point,
  current: Point,
  alpha: number,
): Point {
  return {
    x: previous.x + (current.x - previous.x) * alpha,
    y: previous.y + (current.y - previous.y) * alpha,
  };
}
export function depthOrder(
  a: { id: number; foot: Point },
  b: { id: number; foot: Point },
): number {
  return a.foot.y - b.foot.y || a.id - b.id;
}
/** A ground-space arc stays an ellipse segment on screen, including its endpoints. */
export function arcPoints(
  centre: Point,
  radius: number,
  angle: number,
  sweepDegrees: number,
  segments = 40,
): Point[] {
  const sweep = (sweepDegrees * Math.PI) / 180;
  return Array.from({ length: segments + 1 }, (_, i) => ({
    x: centre.x + Math.cos(angle - sweep / 2 + (sweep * i) / segments) * radius,
    y: centre.y + Math.sin(angle - sweep / 2 + (sweep * i) / segments) * radius,
  }));
}
