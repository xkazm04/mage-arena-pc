import { Container, Graphics, type BitmapText, type Sprite } from "pixi.js";
import type { CanvasUI } from "./ui.ts";
import { colours, type DailyClockContract } from "./kit.ts";
import policy from "../../data/animation.json" with { type: "json" };

type Phase = "dawn" | "midday" | "dusk" | "night";
export function dailyArtState(
  remaining: number,
  wakingHours: number,
  hour: number,
  slot: string,
) {
  const left = Math.max(0, Math.min(wakingHours, remaining));
  return {
    left,
    fraction: 1 - left / wakingHours,
    phase: (slot === "night"
      ? "night"
      : slot === "dusk"
        ? "dusk"
        : hour < policy.dailyClock.middayArtHour
          ? "dawn"
          : "midday") as Phase,
  };
}
/** Art follows the authoritative hours; easing never changes game time. */
export class DailyClock {
  private static previousPhase: Phase = "dawn";
  private root = new Container();
  private warning = new Graphics();
  private waterMask = new Graphics();
  private layers = new Map<string, Sprite>();
  private text: BitmapText;
  private contract?: DailyClockContract;
  private phaseFrom = DailyClock.previousPhase;
  private phaseTo = DailyClock.previousPhase;
  private phaseAt = 0;
  private status: Record<string, unknown> = {};
  constructor(
    ui: CanvasUI,
    private wakingHours: number,
    private x: number,
    private y: number,
  ) {
    this.contract = ui.kit.dailyClock;
    ui.content.addChild(this.root, this.warning);
    this.root.position.set(x, y - 10);
    if (this.contract) {
      const size = this.contract.headerSize[0];
      this.root.scale.set(size / 512);
      for (const name of [
        "face.dawn",
        "face.midday",
        "face.dusk",
        "face.night",
        "basin",
        "water",
        "meniscus",
        "mist",
        "glass",
        "rim",
        "ticks",
        "pointer",
      ]) {
        const s = ui.kit.sprite(this.contract.layers[name]!);
        if (!s) continue;
        s.anchor.set(0.5);
        s.width = s.height = 512;
        this.layers.set(name, s);
        this.root.addChild(s);
      }
      this.root.addChild(this.waterMask);
      const water = this.layers.get("water");
      if (water) water.mask = this.waterMask;
    }
    this.text = ui.text("", x + 55, y - 10, 24, colours.text, 76);
  }
  draw(remaining: number, now: number, hour = 8, slot = "day") {
    if (this.root.destroyed) return;
    const { left, fraction, phase } = dailyArtState(
      remaining,
      this.wakingHours,
      hour,
      slot,
    );
    const reduced = localStorage.getItem("mage-motion") === "reduced";
    if (phase !== this.phaseTo) {
      this.phaseFrom = this.phaseTo;
      this.phaseTo = phase;
      this.phaseAt = now;
      DailyClock.previousPhase = phase;
    }
    const mix = reduced
      ? 1
      : Math.min(1, (now - this.phaseAt) / policy.dailyClock.phaseFadeMs);
    if (this.contract) {
      for (const p of ["dawn", "midday", "dusk", "night"]) {
        const s = this.layers.get(`face.${p}`);
        if (s) {
          s.visible = p === this.phaseFrom || p === this.phaseTo;
          s.alpha =
            this.phaseFrom === this.phaseTo
              ? 1
              : p === this.phaseTo
                ? mix
                : 1 - mix;
        }
      }
      const [wx, wy, ww, wh] = this.contract.waterClipSource,
        cut = wy + fraction * wh;
      this.waterMask
        .clear()
        .rect(wx - 256, cut - 256, ww, Math.max(0, wy + wh - cut))
        .fill(0xffffff);
      const meniscus = this.layers.get("meniscus");
      if (meniscus) {
        meniscus.visible = fraction < 0.995;
        meniscus.y = cut - wy;
        meniscus.scale.x = Math.max(
          0.1,
          Math.sqrt(Math.max(0, 1 - fraction * fraction)),
        );
      }
      const pointer = this.layers.get("pointer");
      if (pointer) pointer.rotation = fraction * Math.PI * 2;
      const mist = this.layers.get("mist");
      if (mist) {
        mist.visible = !reduced;
        mist.alpha = 0.72 + Math.sin(now / 1300) * 0.15;
      }
      this.status = {
        source: "A11 Tideglass",
        fraction,
        phaseFrom: this.phaseFrom,
        phaseTo: this.phaseTo,
        phaseMix: mix,
        cut,
        waterHeight: wy + wh - cut,
        pointerRadians: fraction * Math.PI * 2,
        reducedMotion: reduced,
      };
    }
    const g = this.warning;
    g.clear();
    if (!this.contract) {
      g.circle(this.x, this.y - 10, 46)
        .fill(colours.ink)
        .stroke({ color: colours.edge, width: 2 });
      if (left > 0)
        g.moveTo(this.x, this.y - 56)
          .arc(
            this.x,
            this.y - 10,
            46,
            -Math.PI / 2,
            -Math.PI / 2 + (1 - fraction) * Math.PI * 2,
          )
          .stroke({ color: colours.water, width: 5 });
      this.status = { source: "procedural failure fallback", fraction };
    }
    if (left <= 2)
      g.circle(this.x, this.y - 10, 52).stroke({
        color: colours.danger,
        width: 2,
        alpha: reduced ? 0.5 : 0.35 + Math.sin(now / 450) * 0.15,
      });
    this.text.text = `${Math.ceil(left)}h`;
    this.text.x = this.x + 55;
  }
  snapshot() {
    return this.status;
  }
}
