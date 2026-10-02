import {
  Container,
  Graphics,
  Sprite,
  Texture,
  TilingSprite,
  Rectangle,
} from "pixi.js";
import { arenaGeometry } from "@mage/core/arena";
import { art } from "./art.ts";
import {
  cameraMetrics,
  groundToScreen,
  makeCamera,
  contract,
  type Camera,
} from "./camera.ts";
import presentation from "../data/covenant.json" with { type: "json" };

export type Palette = "verdigris" | "rust-sand" | "moonlit";
export function paletteForGames(index?: number): Palette {
  return (presentation.palettes[
    String(index) as keyof typeof presentation.palettes
  ] ?? presentation.palettes.training) as Palette;
}
/** Flattened A7 plates are presentation sources, not combat-sized geometry.
 * An edge-blended floor crop tiles the unchanged world at native surface scale.
 * Masked prop silhouettes retain their native pixel size and sort at their feet.
 */
export class ArenaArt {
  readonly plate = new Container();
  readonly props: {
    root: Container;
    foot: { x: number; y: number };
    sprite: Sprite;
    mask: Graphics;
  }[] = [];
  palette: Palette = "verdigris";
  private generation = 0;
  private disposed = false;
  private groundTexture?: Texture;
  private readonly native = cameraMetrics(
    makeCamera(
      {
        width: contract.reference_viewport_px[0]!,
        height: contract.reference_viewport_px[1]!,
      },
      arenaGeometry.centre,
    ),
  );
  derivedBytes = 0;
  private readonly width =
    arenaGeometry.widthM + presentation.plate.worldMarginM * 2;
  private readonly height =
    arenaGeometry.heightM + presentation.plate.worldMarginM * 2;
  constructor(
    private floor: Container,
    private figures: Container,
  ) {
    floor.addChild(this.plate);
    this.plate.visible = false;
  }
  async load(palette: Palette) {
    this.palette = palette;
    const generation = ++this.generation;
    const texture = await art.load(`arena-${palette}-2560`);
    if (this.disposed || generation !== this.generation) return;
    if (!texture) {
      this.plate.visible = false;
      for (const p of this.props) p.root.visible = false;
      return;
    }
    for (const c of this.plate.removeChildren()) c.destroy({ children: true });
    this.groundTexture?.destroy(true);
    const canvas = document.createElement("canvas");
    const [sx, sy, sw, sh] = presentation.plate.groundCrop as [
      number,
      number,
      number,
      number,
    ];
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d")!;
    // This deterministic delivery derivation preserves painted pixels; no raw source.
    const source = texture.source.resource as ImageBitmap;
    const pixelRatio = texture.width / presentation.plate.size[0]!;
    ctx.drawImage(
      source,
      sx * pixelRatio,
      sy * pixelRatio,
      sw * pixelRatio,
      sh * pixelRatio,
      0,
      0,
      sw,
      sh,
    );
    const pixels = ctx.getImageData(0, 0, sw, sh),
      edge = presentation.plate.edgeBlendPx,
      tw = sw - edge,
      th = sh - edge;
    const seamless = document.createElement("canvas");
    seamless.width = tw;
    seamless.height = th;
    const target = seamless.getContext("2d")!,
      output = target.createImageData(tw, th);
    // Overlap opposite edges without reflecting the cracks or inventing grain.
    for (let y = 0; y < th; y++)
      for (let x = 0; x < tw; x++) {
        const ax = Math.min(1, x / edge),
          ay = Math.min(1, y / edge);
        for (let ch = 0; ch < 4; ch++) {
          const at = (sx: number, sy: number) =>
            pixels.data[(sy * sw + sx) * 4 + ch]!;
          output.data[(y * tw + x) * 4 + ch] =
            at(x, y) * ax * ay +
            (x < edge ? at(x + tw, y) * (1 - ax) * ay : 0) +
            (y < edge ? at(x, y + th) * ax * (1 - ay) : 0) +
            (x < edge && y < edge
              ? at(x + tw, y + th) * (1 - ax) * (1 - ay)
              : 0);
        }
      }
    target.putImageData(output, 0, 0);
    this.groundTexture = Texture.from(seamless);
    this.derivedBytes = tw * th * 4;
    const tile = new TilingSprite({
      texture: this.groundTexture,
      width: this.width * this.native.pxPerMetreX,
      height: this.height * this.native.pxPerMetreY,
    });
    tile.scale.set(1 / this.native.pxPerMetreX, 1 / this.native.pxPerMetreY);
    tile.position.set(
      arenaGeometry.centre.x - this.width / 2,
      arenaGeometry.centre.y - this.height / 2,
    );
    const mask = new Graphics()
      .ellipse(
        arenaGeometry.centre.x,
        arenaGeometry.centre.y,
        arenaGeometry.widthM / 2,
        arenaGeometry.heightM / 2,
      )
      .fill(0xffffff);
    this.plate.addChild(tile, mask);
    tile.mask = mask;
    this.plate.visible = true;
    for (const p of this.props)
      p.root.destroy({ children: true, texture: true });
    this.props.length = 0;
    for (const p of presentation.props)
      this.addProp(texture, p.foot, p.polygon);
    const stones = presentation.props.find((p) => p.id === "northwest-stones")!;
    for (let i = 0; i < presentation.plate.rimStoneGroups; i++)
      this.addProp(
        texture,
        stones.foot,
        stones.polygon,
        (i * Math.PI * 2) / presentation.plate.rimStoneGroups,
      );
  }
  private addProp(
    texture: Texture,
    foot: number[],
    polygon: number[],
    direction?: number,
  ) {
    const xs = polygon.filter((_, i) => i % 2 === 0),
      ys = polygon.filter((_, i) => i % 2 === 1);
    const left = Math.min(...xs),
      top = Math.min(...ys),
      width = Math.max(...xs) - left,
      height = Math.max(...ys) - top,
      ratio = texture.width / 1920;
    const crop = new Texture({
      source: texture.source,
      frame: new Rectangle(
        left * ratio,
        top * ratio,
        width * ratio,
        height * ratio,
      ),
    });
    const root = new Container(),
      sprite = new Sprite(crop),
      mask = new Graphics();
    root.label = `prop:${this.props.length}`;
    const angle =
      direction ?? Math.atan2(foot[1]! / 1080 - 0.5, foot[0]! / 1920 - 0.5);
    const worldFoot = {
      x:
        arenaGeometry.centre.x +
        Math.cos(angle) * (arenaGeometry.widthM / 2 - 1),
      y:
        arenaGeometry.centre.y +
        Math.sin(angle) * (arenaGeometry.heightM / 2 - 1),
    };
    sprite.width = width;
    sprite.height = height;
    sprite.position.set(left - foot[0]!, top - foot[1]!);
    mask.poly(polygon.map((v, i) => v - foot[i % 2]!)).fill(0xffffff);
    sprite.mask = mask;
    root.addChild(sprite, mask);
    this.figures.addChild(root);
    this.props.push({ root, foot: worldFoot, sprite, mask });
  }
  render(c: Camera) {
    const m = cameraMetrics(c);
    for (const p of this.props) {
      const q = groundToScreen(p.foot, c);
      p.root.position.set(q.x, q.y);
      p.root.scale.set(
        m.pxPerMetreX / this.native.pxPerMetreX,
        m.pxPerMetreY / this.native.pxPerMetreY,
      );
      p.root.zIndex = p.foot.y;
    }
  }
  dispose() {
    this.disposed = true;
    this.groundTexture?.destroy(true);
    for (const p of this.props)
      p.root.destroy({ children: true, texture: true });
    this.props.length = 0;
  }
}
