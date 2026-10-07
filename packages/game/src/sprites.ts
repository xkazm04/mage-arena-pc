import {
  Assets,
  Graphics,
  Rectangle,
  Sprite,
  type Application,
  type Texture,
} from "pixi.js";
import type { Actor } from "@mage/core/arena";
import {
  facingKey,
  spritePlacement,
  validateManifest,
  type SpriteFrame,
} from "./sprite-contract.ts";
interface Entry {
  texture: Texture;
  frame: SpriteFrame;
}
/** Owns asset loading, never combat geometry. Failed/absent frames always use the same procedural body. */
export class FigureLibrary {
  private entries = new Map<string, Entry>();
  private fallback = new Map<string, Entry>();
  readonly diagnostics: string[] = [];
  constructor(private app: Application) {}
  async load(url: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const manifest = validateManifest(await response.json());
      await Promise.all(
        Object.entries(manifest.frames).map(async ([key, frame]) => {
          try {
            const texture = await Assets.load<Texture>(
              new URL(frame.url, new URL(url, location.href)).href,
            );
            if (
              texture.width !== frame.width ||
              texture.height !== frame.height
            )
              throw Error("Texture dimensions differ from manifest");
            this.entries.set(key, { texture, frame });
          } catch (e) {
            this.diagnostics.push(`${key}: ${String(e)}`);
          }
        }),
      );
    } catch (e) {
      this.diagnostics.push(`Manifest fallback: ${String(e)}`);
    }
  }
  dispose(): void {
    for (const entry of this.fallback.values()) entry.texture.destroy(true);
    this.fallback.clear();
    this.entries.clear();
  }
  get loadedFrames(): number {
    return this.entries.size;
  }
  key(a: Actor, playerTeam: number): string {
    return (
      a.enemy?.id ??
      (a.dummy ? "dummy" : a.team === playerTeam ? "mage.player" : "mage.enemy")
    );
  }
  apply(sprite: Sprite, a: Actor, playerTeam: number, height: number): void {
    const key = this.key(a, playerTeam),
      entry =
        this.entries.get(`${key}.${facingKey(a.facing)}`) ??
        this.entries.get(key) ??
        this.procedural(key);
    const placement = spritePlacement(entry.frame, height);
    sprite.texture = entry.texture;
    sprite.anchor.set(placement.anchorX, placement.anchorY);
    sprite.scale.set(placement.scale);
    sprite.alpha = a.tags.includes("DEFEATED") ? 0.4 : 1;
  }
  private procedural(key: string): Entry {
    const existing = this.fallback.get(key);
    if (existing) return existing;
    const g = new Graphics(),
      outline = 0x433c30;
    const mage = key.startsWith("mage.");
    const colour = mage
      ? 0xc7d9d0
      : key === "cinder_hound"
        ? 0x633e38
        : key === "mire_maw"
          ? 0x617e6f
          : key === "hush_moth"
            ? 0xa6b3d1
            : 0x8a8371;
    if (["cinder_hound", "mire_maw", "thornback", "hush_moth"].includes(key)) {
      if (key === "hush_moth") {
        g.poly([
          48, 28, 2, 0, 12, 65, 44, 80, 50, 100, 56, 80, 88, 65, 98, 0, 52, 28,
        ])
          .fill(colour)
          .stroke({ color: outline, width: 3 });
        g.ellipse(50, 53, 9, 38).fill(0xd9c9ab);
      } else {
        g.poly([
          8, 76, 16, 23, 33, 12, 75, 20, 94, 3, 98, 41, 83, 60, 89, 100, 76,
          100, 61, 74, 35, 75, 28, 100, 14, 100,
        ])
          .fill(colour)
          .stroke({ color: outline, width: 3 });
        if (key === "thornback")
          for (let i = 0; i < 4; i++)
            g.poly([20 + i * 15, 26, 26 + i * 15, 0, 37 + i * 15, 29])
              .fill(0xd5bc82)
              .stroke({ color: outline, width: 2 });
        g.circle(84, 31, 3).fill(0xf4d8ad);
      }
    } else {
      // Head (0) to soles (100) is explicit: no hat, weapon or shadow in height measurement.
      g.poly([33, 84, 46, 84, 44, 100, 30, 100, 30, 97]).fill(outline);
      g.poly([52, 84, 65, 84, 69, 100, 54, 100]).fill(outline);
      g.poly([34, 30, 60, 30, 67, 54, 75, 88, 52, 95, 26, 86, 31, 53])
        .fill(colour)
        .stroke({ color: outline, width: 3 });
      g.poly([34, 38, 46, 42, 40, 78, 29, 82]).fill({
        color: 0xe1d2a3,
        alpha: 0.55,
      });
      g.poly([60, 36, 73, 49, 87, 43, 89, 51, 73, 59, 57, 50])
        .fill(colour)
        .stroke({ color: outline, width: 3 });
      g.ellipse(48, 14, 11, 14)
        .fill(0xd5ac7e)
        .stroke({ color: outline, width: 2 });
      g.poly([37, 9, 40, 1, 51, 0, 58, 6, 59, 12, 48, 7]).fill(outline);
      g.moveTo(42, 17).lineTo(52, 17).stroke({ color: outline, width: 2 });
      g.moveTo(39, 30).lineTo(59, 30).stroke({ color: 0xe5c981, width: 3 });
      if (key === "shieldman")
        g.roundRect(64, 40, 26, 42, 8)
          .fill(0xd2b97e)
          .stroke({ color: outline, width: 4 });
      else if (key === "netter") {
        g.poly([77, 32, 97, 49, 78, 77, 67, 58]).stroke({
          color: 0xf0dcc0,
          width: 2,
        });
        g.moveTo(77, 32)
          .lineTo(78, 77)
          .moveTo(67, 58)
          .lineTo(97, 49)
          .stroke({ color: outline, width: 2 });
      } else if (key !== "dummy")
        g.moveTo(86, 26).lineTo(82, 95).stroke({ color: outline, width: 4 });
      if (mage) {
        // Pale split cloth, worn dark mantle, hood top, belt tools and a tall crescent staff.
        g.poly([31, 31, 43, 27, 60, 30, 68, 43, 58, 48, 48, 40, 36, 47, 28, 42])
          .fill(0x395966)
          .stroke({ color: 0x152934, width: 2 });
        g.poly([44, 43, 55, 45, 61, 90, 51, 94, 45, 65, 41, 90, 30, 86]).fill(
          0xe1e2cf,
        );
        g.poly([32, 52, 39, 54, 33, 78, 28, 81]).fill(0x708f9a);
        g.poly([56, 49, 61, 48, 69, 83, 62, 86]).fill(0x86b3b7);
        g.poly([
          35, 13, 37, 3, 48, -1, 61, 6, 63, 23, 55, 27, 56, 13, 46, 11, 40, 22,
        ])
          .fill(0x294953)
          .stroke({ color: 0x17313e, width: 2 });
        g.moveTo(37, 6)
          .lineTo(47, 2)
          .lineTo(57, 8)
          .stroke({ color: 0x83a9ad, width: 2 });
        g.poly([31, 60, 63, 60, 65, 65, 30, 65]).fill(0x5f5646);
        for (let i = 0; i < 4; i++)
          g.circle(37 + i * 7, 62, 1.5).fill(0xd7c69c);
        g.roundRect(31, 64, 8, 12, 2)
          .fill(0x3a4e50)
          .stroke({ color: 0xa8b7a3, width: 1 });
        g.moveTo(85, 93)
          .lineTo(88, 8)
          .stroke({ color: 0x273731, width: 5 })
          .stroke({ color: 0xb8a57e, width: 2 });
        g.arc(88, 5, 8, 0.2, Math.PI * 1.7).stroke({
          color: 0xc7dacf,
          width: 2,
        });
        g.circle(88, 4, 4).fill(0x8ae4dc);
        g.circle(87, 3, 1.5).fill(0xf7f9df);
      }
    }
    const texture = this.app.renderer.generateTexture({
      target: g,
      frame: new Rectangle(-4, -4, 108, 108),
      resolution: 2,
    });
    g.destroy();
    const entry = {
      texture,
      frame: {
        url: "",
        width: 108,
        height: 108,
        footX: 54,
        headY: 4,
        soleY: 104,
      },
    };
    this.fallback.set(key, entry);
    return entry;
  }
}
