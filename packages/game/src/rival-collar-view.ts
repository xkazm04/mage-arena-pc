import { Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import type { Vec } from "@mage/core/arena";
import { art } from "./art.ts";
import { cameraMetrics, groundToScreen, type Camera } from "./camera.ts";
import type { SigilManifest } from "./sigil-contract.ts";
import {
  rivalCollarPolicy as policy,
  runeCrop,
  runeOffset,
  unlockPulse,
  type RivalRune,
} from "./rival-collar.ts";

const tint = Number.parseInt(policy.tint.slice(1), 16);
/** The rival's collar runes at its feet: the HUD's painted collar inscription cut into its four runes, dim gold. */
export class RivalCollarView {
  readonly layer = new Container();
  private sprites: Sprite[] = [];
  private used = 0;
  private runes?: Texture[];
  private source?: Texture["source"];
  /** The page this view holds a lease on; released with the view. */
  private lease?: string;
  begin() {
    this.used = 0;
  }
  /** Hides the runes this frame left unused. */
  end() {
    for (let i = this.used; i < this.sprites.length; i++)
      this.sprites[i]!.visible = false;
  }
  /** Shares the page the HUD clock inscription decodes, under its own lease: another holder's release never destroys it here. */
  private textures(manifest?: SigilManifest) {
    const clip = manifest?.clips["inscription.collar"];
    if (!clip) return;
    const key = `a13.page.${clip.page}`;
    if (this.lease !== key) {
      art.retain(key);
      if (this.lease) art.release(this.lease);
      this.lease = key;
    }
    const page = art.get(key);
    if (!page) {
      void art.load(key);
      return;
    }
    if (this.source !== page.source || !this.runes) {
      for (const t of this.runes ?? []) t.destroy(false);
      const [x, y, w, h] = clip.frames[0]!.rect as [
        number,
        number,
        number,
        number,
      ];
      this.runes = [0, 1, 2, 3].map((i) => {
        const [u, v, cw, ch] = runeCrop(i);
        return new Texture({
          source: page.source,
          frame: new Rectangle(x + u * w, y + v * h, cw * w, ch * h),
        });
      });
      this.source = page.source;
    }
    return this.runes;
  }
  draw(
    rune: RivalRune,
    foot: Vec,
    c: Camera,
    g: Graphics,
    manifest: SigilManifest | undefined,
    reduced: boolean,
  ) {
    const m = cameraMetrics(c),
      runes = this.textures(manifest),
      pulse = unlockPulse(rune, reduced),
      at = (i: number) => {
        const o = runeOffset(i);
        return groundToScreen({ x: foot.x + o.x, y: foot.y + o.y }, c);
      };
    if (rune.tier < 4) {
      const p = Math.max(0, Math.min(1, rune.progress)),
        a = rune.tier - 1,
        steps = 12;
      for (let s = 0; s <= steps; s++) {
        const q = at(a + (p * s) / steps);
        if (!s) g.moveTo(q.x, q.y);
        else g.lineTo(q.x, q.y);
      }
      g.stroke({
        color: tint,
        width: policy.progressWidthPx1080 * m.resolutionScale,
        alpha: policy.progressAlpha,
      });
    }
    for (let i = 0; i < 4; i++) {
      const q = at(i),
        newest = i === rune.tier - 1,
        alpha = rune.lit[i]
          ? policy.litAlpha + (newest ? pulse * (1 - policy.litAlpha) : 0)
          : policy.dimAlpha,
        scale = 1 + (newest ? pulse * policy.unlockPulseScale : 0);
      if (!runes) {
        const r = policy.fallbackRunePx1080 * m.resolutionScale * scale;
        g.poly([q.x, q.y - r, q.x + r, q.y, q.x, q.y + r, q.x - r, q.y]);
        if (rune.lit[i]) g.fill({ color: tint, alpha });
        else g.stroke({ color: tint, width: m.outlinePx, alpha });
        continue;
      }
      let s = this.sprites[this.used];
      if (!s) {
        s = new Sprite();
        s.anchor.set(0.5);
        this.sprites.push(s);
        this.layer.addChild(s);
      }
      this.used++;
      s.texture = runes[i]!;
      s.visible = true;
      s.tint = tint;
      s.alpha = alpha;
      s.position.set(q.x, q.y);
      const px =
        Math.max(
          policy.runeSizeM * m.pxPerMetreX,
          policy.minimumRunePx1080 * m.resolutionScale,
        ) * scale;
      s.width = px;
      s.height = (px * m.pxPerMetreY) / m.pxPerMetreX;
    }
  }
  snapshot() {
    return {
      art: !!this.runes,
      sprites: this.sprites
        .filter((s) => s.visible)
        .map((s) => ({
          x: Math.round(s.x),
          y: Math.round(s.y),
          alpha: +s.alpha.toFixed(2),
          w: Math.round(s.width),
        })),
    };
  }
  dispose() {
    for (const t of this.runes ?? []) t.destroy(false);
    if (this.lease) art.release(this.lease);
    this.lease = undefined;
    this.layer.destroy({ children: true });
  }
}
