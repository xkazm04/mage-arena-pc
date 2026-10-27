import {
  BitmapText,
  ColorMatrixFilter,
  Container,
  Graphics,
  type Sprite,
} from "pixi.js";
import { frameGraphics } from "./pixi-fixes.ts";
import {
  tuningFor,
  seconds,
  type ArenaState,
  type Actor,
  type ThreatLedger,
} from "@mage/core/arena";
import { gradeFor, hitLabel, wardWord, wordAllowed } from "./combat-readout.ts";
import { CueWords, type AnswerCue } from "./answer-cue.ts";
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
/** Pixels a stacked number climbs per slot at 1080p: a 24 px number is 24 * 1.22 high, so one step clears it. */
export const numberStepPixels1080 = 30;
/** Where the `slot`-th concurrent number above one target sits, relative to the first: up a step, and a little sideways. */
export function numberSlotOffset(slot: number): { x: number; y: number } {
  const side = [0, 1, -1][slot % 3]!;
  return { x: side * 12, y: -slot * numberStepPixels1080 };
}
/** The lowest slot not held by a live number on the same target. */
export function freeNumberSlot(taken: Iterable<number>): number {
  const used = new Set(taken);
  let slot = 0;
  while (used.has(slot)) slot++;
  return slot;
}
interface NumberView {
  /** The actor the number floats over, and which stacking slot above it the number holds. */
  target: number;
  slot: number;
  text: BitmapText;
  bornS: number;
  at: { x: number; y: number };
  lifeS: number;
  /** Ward words stay put under reduced motion. */
  still: boolean;
}
export class CombatFeedback {
  readonly layer = new Container();
  readonly white = new ColorMatrixFilter();
  private clock = 0;
  private cue = new Graphics();
  private reactions = new Map<
    number,
    { bornS: number; direction: { x: number; y: number }; damage: number }
  >();
  private state?: ArenaState;
  private eventIndex = 0;
  private active: NumberView[] = [];
  private pool: BitmapText[] = [];
  private flashes = new Map<number, number>();
  private compressions = new Map<number, number>();
  private lastWordS = -1e9;
  /** The watched actor's threat ledger; hits it graded as a ward mistake carry a word (STEEL, LEAVE, BEHIND, HELD +nf, CAST). */
  ledger?: ThreatLedger;
  /** Answer cues for the player on screen (answer-cue.ts), set each frame; empty where the mode shows none. */
  cues: AnswerCue[] = [];
  private cueWords = new CueWords();
  private cueText = new BitmapText({
    text: "",
    style: { fontFamily: "CovenantBody", fontSize: 26, fill: 0xffffff },
  });
  reduced = false;
  constructor() {
    frameGraphics(this.cue);
    this.layer.addChild(this.cue);
    this.cueText.anchor.set(0.5, 1);
    this.cueText.visible = false;
    this.layer.addChild(this.cueText);
    this.white.matrix = [
      0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0,
    ];
  }
  begin(state: ArenaState, dt = 1 / 60) {
    this.clock += Math.min(0.1, dt);
    if (this.state !== state || state.events.length < this.eventIndex) {
      this.state = state;
      this.eventIndex = Math.max(
        0,
        state.events.findIndex((e) => e.tick >= state.tick - 1),
      );
      this.flashes.clear();
      this.reactions.clear();
      this.compressions.clear();
      for (const n of this.active) {
        n.text.visible = false;
        this.pool.push(n.text);
      }
      this.active = [];
      this.lastWordS = -1e9;
      this.cueWords.reset();
    }
    for (const e of state.events.slice(this.eventIndex)) {
      const actor = state.actors.find((a) => a.id === e.actorId);
      if (!actor || state.tick - e.tick > 60) continue;
      if (e.kind === "perfect")
        this.compressions.set(
          actor.id,
          this.clock - seconds(state.tick - e.tick),
        );
      const damage = e.contactDamage ?? e.value;
      if (e.kind === "hit" && e.value > 0) {
        const bornS = this.clock - seconds(state.tick - e.tick);
        this.flashes.set(actor.id, bornS);
        this.reactions.set(actor.id, {
          bornS,
          direction: e.direction ?? { x: -actor.facing.x, y: -actor.facing.y },
          damage: e.value,
        });
      }
      const bornS = this.clock - seconds(state.tick - e.tick);
      let word =
        e.kind === "hit" && e.actorId === this.ledger?.actorId
          ? wardWord(gradeFor(this.ledger, e.tick, e.activationId))
          : undefined;
      if (word && !wordAllowed(this.lastWordS, bornS)) word = undefined;
      const label = e.kind === "hit" ? hitLabel(word, damage) : undefined;
      if (e.kind !== "perfect" && !label) continue;
      if (this.active.length >= policy.maxNumbers) continue;
      if (word) this.lastWordS = bornS;
      const text =
        this.pool.pop() ??
        new BitmapText({
          text: "",
          style: { fontFamily: "CovenantBody", fontSize: 24, fill: 0xffffff },
        });
      if (!text.parent) this.layer.addChild(text);
      text.text = e.kind === "perfect" ? `+${e.value.toFixed(1)} mana` : label!;
      text.style.fill =
        e.kind === "perfect"
          ? 0x9affea
          : word
            ? word.fill
            : actor.team === 0
              ? 0xffb1a4
              : 0xfff4d0;
      text.anchor.set(0.5, 1);
      text.visible = true;
      this.active.push({
        target: actor.id,
        slot: freeNumberSlot(
          this.active.filter((n) => n.target === actor.id).map((n) => n.slot),
        ),
        text,
        bornS,
        at: e.at ?? { ...actor.pos },
        lifeS: word ? policy.wardWords.holdS : policy.numbersS,
        still: !!word && this.reduced,
      });
    }
    this.eventIndex = state.events.length;
  }
  flash(a: Actor) {
    return (
      !a.tags.includes("DEFEATED") &&
      this.clock - (this.flashes.get(a.id) ?? -1e9) <
        tuningFor(this.state!).hitFlashS
    );
  }
  compression(a: Actor) {
    const t =
      (this.clock - (this.compressions.get(a.id) ?? -1e9)) /
      policy.perfectCompressionS;
    return t >= 0 && t < 1
      ? 1 - (1 - policy.wardCompressionScale) * Math.sin(t * Math.PI)
      : 1;
  }
  draw(state: ArenaState, c: Camera, player: Actor) {
    const m = cameraMetrics(c);
    this.cue.clear();
    this.cue.position.set(
      -(this.layer.parent?.x ?? 0),
      -(this.layer.parent?.y ?? 0),
    );
    const reaction = this.reactions.get(player.id),
      duration = tuningFor(state).playerHitCueS;
    if (reaction && this.clock - reaction.bornS < duration) {
      const opacity = 0.5 * (1 - (this.clock - reaction.bornS) / duration);
      this.cue.rect(0, 0, c.width, c.height).stroke({
        color: 0xd45e46,
        alpha: opacity,
        width: 18 * m.resolutionScale,
      });
    }
    // The answer before the contact: one cue word over the player, held while its cue holds.
    const word = this.cueWords.pick(this.cues, this.clock);
    this.cueText.visible = !!word;
    if (word) {
      const p = groundToScreen(player.pos, c);
      this.cueText.text = word.text;
      this.cueText.style.fill = word.fill;
      this.cueText.position.set(
        p.x,
        p.y -
          m.figureHeightPx -
          (24 + policy.numberRisePixels1080) * m.resolutionScale,
      );
      this.cueText.scale.set(m.resolutionScale);
    }
    this.active = this.active.filter((n) => {
      const age = this.clock - n.bornS;
      if (age > n.lifeS) {
        n.text.visible = false;
        this.pool.push(n.text);
        return false;
      }
      const p = groundToScreen(n.at, c);
      const stack = numberSlotOffset(n.slot);
      n.text.position.set(
        p.x + stack.x * m.resolutionScale,
        p.y +
          stack.y * m.resolutionScale -
          m.figureHeightPx -
          14 * m.resolutionScale -
          (n.still ? 0 : Math.min(1, age / policy.numbersS)) *
            policy.numberRisePixels1080 *
            m.resolutionScale,
      );
      n.text.scale.set(m.resolutionScale);
      n.text.alpha = Math.min(1, (n.lifeS - age) * 4);
      return true;
    });
  }
  recoil(sprite: Sprite, a: Actor, c: Camera, reduced: boolean) {
    const r = this.reactions.get(a.id);
    if (!r || a.tags.includes("DEFEATED") || reduced) return;
    const tune = tuningFor(this.state!),
      age = this.clock - r.bornS;
    if (age < 0 || age >= tune.hitRecoilS) return;
    const t = age / tune.hitRecoilS,
      pulse = Math.sin(Math.PI * t),
      m = cameraMetrics(c);
    const distance =
      tune.hitRecoilM * Math.min(1.5, 0.6 + r.damage / 30) * pulse;
    sprite.x +=
      r.direction.x * distance * m.pxPerMetreX +
      Math.sin(age * 120) * tune.hitShakePx * m.resolutionScale * (1 - t);
    sprite.y += r.direction.y * distance * m.pxPerMetreY;
    sprite.scale.x *= 1 + tune.hitSquash * pulse;
    sprite.scale.y *= 1 - tune.hitSquash * pulse;
  }
  snapshot() {
    return {
      numbers: this.active.length,
      labels: this.active.map((n) => n.text.text),
      allocated: this.active.length + this.pool.length,
      flashes: this.flashes.size,
      cues: this.cues.map((c) => ({
        activationId: c.activationId,
        answer: c.answer,
        mistake: c.mistake,
        phase: c.phase,
        word: c.word?.text,
      })),
      cueWord: this.cueText.visible ? this.cueText.text : undefined,
      reactions: [...this.reactions].map(([id, r]) => ({
        id,
        age: this.clock - r.bornS,
        direction: r.direction,
      })),
    };
  }
  dispose() {
    this.layer.destroy({ children: true });
    this.white.destroy();
  }
}
