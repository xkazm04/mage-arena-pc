import { Container, Sprite, Texture, Rectangle } from "pixi.js";
import type { SigilManifest } from "./sigil-contract.ts";
import { art } from "./art.ts";
import {
  cameraMetrics,
  groundToScreen,
  contract,
  type Camera,
} from "./camera.ts";
import { TiledArenaArt } from "./arena-art-fallback.ts";
import presentation from "../data/covenant.json" with { type: "json" };

export type Palette = "verdigris" | "rust-sand" | "moonlit";
export function paletteForGames(index?: number): Palette {
  return (presentation.palettes[
    String(index) as keyof typeof presentation.palettes
  ] ?? presentation.palettes.training) as Palette;
}
interface Overlay {
  id: string;
  size: [number, number];
  anchorPx: [number, number];
  baseWorldMetres: [number, number];
}
interface Plate {
  size: [number, number];
  offsetWorldMetres: [number, number];
  worldSizeMetres: [number, number];
  occluders: Overlay[];
}
interface Manifest {
  schemaVersion: number;
  palettes: Record<Palette, Plate>;
}
/** A12 is one preprojected painting. Occluders share its transform and sort at their base. */
export class ArenaArt {
  readonly plate = new Container();
  readonly props: {
    root: Container;
    foot: { x: number; y: number };
    sprite: Sprite;
  }[] = [];
  palette: Palette = "verdigris";
  source = "loading";
  diagnostics: string[] = [];
  private generation = 0;
  private disposed = false;
  private leases: string[] = [];
  private fallback?: TiledArenaArt;
  private spec?: Plate;
  private decalFrames: Texture[] = [];
  derivedBytes = 0;
  constructor(
    private floor: Container,
    private figures: Container,
  ) {
    floor.addChild(this.plate);
  }
  private clear() {
    for (const p of this.props) p.root.destroy({ children: true });
    this.props.length = 0;
    for (const child of this.plate.removeChildren()) child.destroy();
    for (const texture of this.decalFrames) texture.destroy();
    this.decalFrames = [];
    for (const key of this.leases) art.release(key);
    this.leases = [];
    this.fallback?.dispose();
    this.fallback?.plate.destroy({ children: true });
    this.fallback = undefined;
  }
  async load(palette: Palette) {
    this.palette = palette;
    const generation = ++this.generation;
    this.clear();
    this.source = "loading";
    try {
      const manifest = (await art.json("a12.manifest")) as Manifest;
      if (this.disposed || generation !== this.generation) return;
      const p = manifest.palettes[palette];
      if (
        manifest.schemaVersion !== 1 ||
        !p ||
        p.size.join() !== "3072,1728" ||
        p.occluders.some((o) => !o.baseWorldMetres.every(Number.isFinite))
      )
        throw Error("Invalid A12 contract");
      const keys = [
        `a12.plate.${palette}`,
        ...p.occluders.map((o) => `a12.occluder.${palette}.${o.id}`),
      ];
      this.leases = keys;
      keys.forEach((k) => art.retain(k));
      const textures = await Promise.all(keys.map((k) => art.load(k)));
      if (this.disposed || generation !== this.generation) return;
      if (textures.some((t) => !t))
        throw Error("Incomplete A12 palette; using tiled fallback");
      this.spec = p;
      const sprite = new Sprite(textures[0]);
      sprite.position.set(
        p.offsetWorldMetres[0] + contract.plate.delivery_offset[0]!,
        p.offsetWorldMetres[1] + contract.plate.delivery_offset[1]!,
      );
      sprite.width = p.worldSizeMetres[0];
      sprite.height = p.worldSizeMetres[1];
      this.plate.addChild(sprite);
      // A13 placements are registered in the already-projected A12 plate UVs.
      // This container's world transform supplies the projection; do not squash twice.
      try {
        const [floor, sigils] = await Promise.all([
          art.json("a13.floor") as Promise<{
            palettes: Record<
              Palette,
              {
                decals: {
                  clip: string;
                  centreUV: [number, number];
                  frameSizeMasterPx: [number, number];
                  opacity: number;
                }[];
              }
            >;
          }>,
          art.json("a13.manifest") as Promise<SigilManifest>,
        ]);
        if (this.disposed || generation !== this.generation) return;
        const decals = floor.palettes[palette].decals;
        const floorKeys = [
          `a13.cleanup.${palette}`,
          `a13.page.floor.${palette}`,
        ];
        floorKeys.forEach((k) => {
          this.leases.push(k);
          art.retain(k);
        });
        const [cleanup, page] = await Promise.all(
          floorKeys.map((k) => art.load(k)),
        );
        if (this.disposed || generation !== this.generation) return;
        if (cleanup) {
          const overlay = new Sprite(cleanup);
          overlay.position.copyFrom(sprite.position);
          overlay.width = sprite.width;
          overlay.height = sprite.height;
          this.plate.addChild(overlay);
        }
        if (page)
          for (const decal of decals) {
            const frame = new Texture({
              source: page.source,
              frame: new Rectangle(
                ...sigils.clips[decal.clip]!.frames[0]!.rect,
              ),
            });
            this.decalFrames.push(frame);
            const mark = new Sprite(frame);
            mark.anchor.set(0.5);
            mark.position.set(
              sprite.x + decal.centreUV[0] * sprite.width,
              sprite.y + decal.centreUV[1] * sprite.height,
            );
            mark.width =
              (decal.frameSizeMasterPx[0] / p.size[0]) * sprite.width;
            mark.height =
              (decal.frameSizeMasterPx[1] / p.size[1]) * sprite.height;
            mark.alpha = decal.opacity;
            this.plate.addChild(mark);
          }
      } catch (error) {
        this.diagnostics.push(`Optional floor sigils: ${String(error)}`);
      }
      for (const [i, o] of p.occluders.entries()) {
        const root = new Container(),
          sprite = new Sprite(textures[i + 1]);
        root.label = `prop:${palette}:${o.id}`;
        sprite.anchor.set(o.anchorPx[0] / o.size[0], o.anchorPx[1] / o.size[1]);
        root.addChild(sprite);
        this.figures.addChild(root);
        this.props.push({
          root,
          sprite,
          foot: {
            x: o.baseWorldMetres[0] + contract.plate.delivery_offset[0]!,
            y: o.baseWorldMetres[1] + contract.plate.delivery_offset[1]!,
          },
        });
      }
      this.source = "A12";
    } catch (error) {
      if (this.disposed || generation !== this.generation) return;
      this.diagnostics.push(String(error));
      this.clear();
      this.fallback = new TiledArenaArt(this.floor, this.figures);
      await this.fallback.load(palette);
      if (this.disposed || generation !== this.generation) return;
      this.source = "tiled-fallback";
      this.derivedBytes = this.fallback.derivedBytes;
    }
  }
  render(c: Camera) {
    this.fallback?.render(c);
    const m = cameraMetrics(c);
    for (const p of this.props) {
      const q = groundToScreen(p.foot, c);
      p.root.position.set(q.x, q.y);
      // Master pixels already contain the oblique projection: uniform scale only.
      p.root.scale.set(
        (m.pxPerMetreX * this.spec!.worldSizeMetres[0]) / this.spec!.size[0],
      );
      p.root.zIndex = p.foot.y;
    }
  }
  dispose() {
    this.disposed = true;
    this.generation++;
    this.clear();
  }
}
