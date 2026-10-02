import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import { arenaGeometry } from "@mage/core/arena";
import { art } from "./art.ts";
import { cameraMetrics, groundToScreen, type Camera } from "./camera.ts";
import presentation from "../data/covenant.json" with { type: "json" };

export type Palette = "verdigris" | "rust-sand" | "moonlit";
export function paletteForGames(index?: number): Palette {
  return (presentation.palettes[
    String(index) as keyof typeof presentation.palettes
  ] ?? presentation.palettes.training) as Palette;
}
/** The source is already oblique. Map source pixels to the projected world once.
 * Masked replicas have the exact plate transform, but sort at each prop's foot.
 * Thus foreground figures cover the prop and background figures pass behind it.
 */
export class ArenaArt {
  readonly plate = new Sprite();
  readonly props: {
    root: Container;
    foot: { x: number; y: number };
    sprite: Sprite;
    mask: Graphics;
  }[] = [];
  palette: Palette = "verdigris";
  private generation = 0;
  private disposed = false;
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
    if (!texture || this.disposed || generation !== this.generation) return;
    this.plate.texture = texture;
    this.plate.position.set(
      arenaGeometry.centre.x - this.width / 2,
      arenaGeometry.centre.y - this.height / 2,
    );
    this.plate.width = this.width;
    this.plate.height = this.height;
    this.plate.visible = true;
    for (const p of this.props) p.root.destroy({ children: true });
    this.props.length = 0;
    for (const p of presentation.props)
      this.addProp(texture, p.foot, p.polygon);
  }
  private addProp(texture: Texture, foot: number[], polygon: number[]) {
    const root = new Container(),
      sprite = new Sprite(texture),
      mask = new Graphics();
    const worldFoot = {
      x: arenaGeometry.centre.x + (foot[0]! / 1920 - 0.5) * this.width,
      y: arenaGeometry.centre.y + (foot[1]! / 1080 - 0.5) * this.height,
    };
    sprite.width = 1920;
    sprite.height = 1080;
    sprite.position.set(-foot[0]!, -foot[1]!);
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
        (this.width / 1920) * m.pxPerMetreX,
        (this.height / 1080) * m.pxPerMetreY,
      );
      p.root.zIndex = p.foot.y;
    }
  }
  dispose() {
    this.disposed = true;
  }
}
