import { BitmapText, ColorMatrixFilter, Container } from "pixi.js";
import { seconds, type ArenaState, type Actor } from "@mage/core/arena";
import { groundToScreen, cameraMetrics, type Camera } from "./camera.ts";
import policy from "../data/combat-feedback.json" with { type: "json" };
export { policy as feedbackPolicy };
/** Pure presentation clock. Never writes combat state or consumes simulation RNG. */
export class ImpactClock {
  stopS = 0;
  compressionS = 0;
  shakeS = 0;
  shakePixels = 0;
  phase = 0;
  reset() {
    this.stopS = 0;
    this.compressionS = 0;
    this.shakeS = 0;
    this.shakePixels = 0;
    this.phase = 0;
  }
  hit(damage: number, perfect = false) {
    if (perfect) this.compressionS = policy.perfectCompressionS;
    else if (damage >= policy.hitStopDamageThreshold)
      this.stopS = Math.max(
        this.stopS,
        Math.min(
          policy.hitStopMaxFrames,
          policy.hitStopMinFrames + Math.floor(damage / 20),
        ) / 60,
      );
    if (damage > 0) {
      this.shakeS = policy.shakeS;
      this.shakePixels = Math.min(
        policy.shakeMaxPixels1080,
        damage * policy.shakePixelsPerDamage1080,
      );
    }
  }
  advance(dt: number, reduced = false) {
    if (reduced) {
      this.reset();
      return dt;
    }
    const held = Math.min(dt, this.stopS);
    this.stopS = Math.max(0, this.stopS - dt);
    const moving = dt - held,
      slow = Math.min(moving, this.compressionS);
    this.compressionS = Math.max(0, this.compressionS - moving);
    this.shakeS = Math.max(0, this.shakeS - dt);
    this.phase += dt;
    return moving - slow + slow * policy.perfectTimeScale;
  }
  offset(scale: number) {
    const strength = this.shakePixels * (this.shakeS / policy.shakeS) * scale;
    return {
      x: Math.sin(this.phase * 131) * strength,
      y: Math.sin(this.phase * 173) * strength * 0.65,
    };
  }
}
interface NumberView {
  text: BitmapText;
  tick: number;
  at: { x: number; y: number };
}
export class CombatFeedback {
  readonly layer = new Container();
  readonly white = new ColorMatrixFilter();
  private state?: ArenaState;
  private eventIndex = 0;
  private active: NumberView[] = [];
  private pool: BitmapText[] = [];
  private flashes = new Map<number, number>();
  private compressions = new Map<number, number>();
  constructor() {
    this.white.matrix = [
      0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0,
    ];
  }
  begin(state: ArenaState) {
    if (this.state !== state || state.events.length < this.eventIndex) {
      this.state = state;
      this.eventIndex = Math.max(
        0,
        state.events.findIndex((e) => e.tick >= state.tick - 1),
      );
      this.flashes.clear();
      this.compressions.clear();
      for (const n of this.active) {
        n.text.visible = false;
        this.pool.push(n.text);
      }
      this.active = [];
    }
    for (const e of state.events.slice(this.eventIndex)) {
      const actor = state.actors.find((a) => a.id === e.actorId);
      if (!actor || state.tick - e.tick > 60) continue;
      if (e.kind === "perfect") this.compressions.set(actor.id, e.tick);
      const damage = e.contactDamage ?? e.value;
      if (e.kind === "hit" && damage > 0 && !e.guarded)
        this.flashes.set(actor.id, e.tick);
      if (
        e.kind !== "perfect" &&
        (e.kind !== "hit" || damage < policy.minimumNumberDamage)
      )
        continue;
      if (this.active.length >= policy.maxNumbers) continue;
      const text =
        this.pool.pop() ??
        new BitmapText({
          text: "",
          style: { fontFamily: "CovenantBody", fontSize: 24, fill: 0xffffff },
        });
      if (!text.parent) this.layer.addChild(text);
      text.text =
        e.kind === "perfect"
          ? `+${e.value.toFixed(1)} mana`
          : String(Math.round(damage * 10) / 10);
      text.style.fill =
        e.kind === "perfect"
          ? 0x9affea
          : actor.team === 0
            ? 0xffb1a4
            : 0xfff4d0;
      text.anchor.set(0.5, 1);
      text.visible = true;
      this.active.push({ text, tick: e.tick, at: e.at ?? { ...actor.pos } });
    }
    this.eventIndex = state.events.length;
  }
  flash(a: Actor, tick: number) {
    return (
      seconds(tick - (this.flashes.get(a.id) ?? -1e9)) < policy.whiteFlashS
    );
  }
  compression(a: Actor, tick: number) {
    const t =
      seconds(tick - (this.compressions.get(a.id) ?? -1e9)) /
      policy.perfectCompressionS;
    return t >= 0 && t < 1
      ? 1 - (1 - policy.wardCompressionScale) * Math.sin(t * Math.PI)
      : 1;
  }
  draw(state: ArenaState, c: Camera, alpha: number) {
    const m = cameraMetrics(c);
    this.active = this.active.filter((n) => {
      const age = seconds(state.tick + alpha - n.tick);
      if (age > policy.numbersS) {
        n.text.visible = false;
        this.pool.push(n.text);
        return false;
      }
      const p = groundToScreen(n.at, c);
      n.text.position.set(
        p.x,
        p.y -
          m.figureHeightPx -
          14 * m.resolutionScale -
          (age / policy.numbersS) *
            policy.numberRisePixels1080 *
            m.resolutionScale,
      );
      n.text.scale.set(m.resolutionScale);
      n.text.alpha = Math.min(1, (policy.numbersS - age) * 4);
      return true;
    });
  }
  snapshot() {
    return {
      numbers: this.active.length,
      allocated: this.active.length + this.pool.length,
      flashes: this.flashes.size,
    };
  }
  dispose() {
    this.layer.destroy({ children: true });
    this.white.destroy();
  }
}
