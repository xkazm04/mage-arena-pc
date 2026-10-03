import { tuningFor } from "@mage/core/arena";
import {
  Container,
  Graphics,
  Matrix,
  Rectangle,
  Sprite,
  Texture,
} from "pixi.js";
import {
  combat,
  seconds,
  spells,
  type PendingCast,
  type Actor,
  type ArenaState,
  type Vec,
} from "@mage/core/arena";
import { art } from "./art.ts";
import {
  cameraMetrics,
  contract,
  groundToScreen,
  type Camera,
} from "./camera.ts";
import {
  frameIndex,
  validateClips,
  type EffectManifest,
  type Element,
} from "./animation-contract.ts";
import policy from "../data/animation.json" with { type: "json" };

interface Shot {
  clip: string;
  at: Vec;
  tick: number;
  actorId?: number;
  angle?: number;
  barrier?: boolean;
}
interface Slot {
  root: Container;
  sprite: Sprite;
  mask: Graphics;
}
/** Fixed-capacity sprite pool; animation time follows sim ticks, never mutates them. */
export class EffectPlayer {
  manifest?: EffectManifest;
  elementOverrides = new Map<number, Element>();
  readonly diagnostics: string[] = [];
  readonly behind = new Container();
  readonly front = new Container();
  private frames = new Map<string, Texture>();
  private slots: Slot[] = [];
  private used = 0;
  private shots: Shot[] = [];
  private state?: ArenaState;
  private eventIndex = 0;
  private blocks = new Map<number, number>();
  private arcDeg: number = combat.absorb.arcDeg;
  private pending = new Map<number, PendingCast>();
  private requests = new Set<string>();
  private disposed = false;
  private c!: Camera;
  private tick = 0;
  private budgetExceeded = false;
  readonly counts: Record<string, number> = {};
  dropped = 0;
  cpuMs = 0;
  constructor(private namespace: "a8" | "a13" = "a8") {
    void this.init();
  }
  private async init() {
    try {
      if (this.namespace === "a13" && !art.manifest?.entries["a13.manifest"])
        return;
      const m = (await art.json(
        `${this.namespace}.manifest`,
      )) as EffectManifest;
      if (m.schemaVersion !== 1) throw Error("Unsupported effects");
      validateClips(m.pages, Object.values(m.clips));
      if (this.disposed) return;
      this.manifest = m;
      if (this.namespace === "a8") await this.preload(["water"]);
    } catch (e) {
      this.diagnostics.push(String(e));
    }
  }
  private loadPage(key: string) {
    if (this.disposed) return Promise.resolve(undefined);
    if (!this.requests.has(key)) {
      this.requests.add(key);
      art.retain(key);
    }
    return art.load(key);
  }
  async preload(elements: Element[]) {
    await Promise.all(
      ["a8.page.barrier", ...elements.map((e) => `a8.page.${e}`)].map((k) =>
        this.loadPage(k),
      ),
    );
  }
  element(a?: Actor): Element {
    const override = a && this.elementOverrides.get(a.id);
    if (override) return override;
    if (a?.school) return a.school;
    return a?.enemy
      ? ((policy.enemyElements[
          a.enemy.id as keyof typeof policy.enemyElements
        ] ?? "water") as Element)
      : "water";
  }
  private shot(shot: Shot) {
    if (this.shots.length >= policy.effects.maxOneShots) {
      this.dropped++;
      return;
    }
    this.shots.push(shot);
    this.counts[shot.clip] = (this.counts[shot.clip] ?? 0) + 1;
  }
  begin(state: ArenaState, c: Camera, alpha: number) {
    const started = performance.now();
    this.budgetExceeded = false;
    this.used = 0;
    this.c = c;
    this.tick = state.tick + alpha;
    this.arcDeg = tuningFor(state).absorbArcDeg;
    for (const slot of this.slots) slot.root.visible = false;
    if (this.namespace === "a13") {
      this.cpuMs = performance.now() - started;
      return;
    }
    if (this.state !== state || state.events.length < this.eventIndex) {
      this.state = state;
      this.eventIndex = state.events.length;
      this.shots = [];
      this.blocks.clear();
      this.pending.clear();
    }
    // Expire independently of visibility and budgeting. No delayed bursts.
    this.shots = this.shots.filter((s) => {
      const clip = this.manifest?.clips[s.clip];
      return !clip
        ? state.tick - s.tick < combat.simStepHz
        : frameIndex(clip, seconds(this.tick - s.tick) * 1000) >= 0;
    });
    for (const event of state.events.slice(this.eventIndex)) {
      const a = state.actors.find((a) => a.id === event.actorId);
      if (!a || state.tick - event.tick > combat.simStepHz) continue;
      const source = state.actors.find((a) => a.id === event.targetId);
      if (event.kind === "cast")
        this.shot({
          clip: `${this.element(a)}.cast`,
          at: { ...a.pos },
          actorId: a.id,
          tick: event.tick,
        });
      if (event.kind === "hit") {
        if (event.value > 0)
          this.shot({
            clip: `${this.element(source)}.hit`,
            at: { ...a.pos },
            actorId: a.id,
            tick: event.tick,
          });
        this.shot({
          clip: `${this.element(source)}.impact`,
          at: { ...a.pos },
          tick: event.tick,
        });
      }
      if (event.kind === "perfect") {
        const angle = source
          ? Math.atan2(source.pos.y - a.pos.y, source.pos.x - a.pos.x)
          : Math.atan2(a.facing.y, a.facing.x);
        const r = contract.absorb.visual_radius_metres;
        this.shot({
          clip: "absorb.perfect",
          at: {
            x: a.pos.x + Math.cos(angle) * r,
            y: a.pos.y + Math.sin(angle) * r,
          },
          tick: event.tick,
          angle,
        });
        this.shot({
          clip: "absorb.contact",
          at: { ...a.pos },
          actorId: a.id,
          tick: event.tick,
          barrier: true,
        });
      }
    }
    this.eventIndex = state.events.length;
    for (const a of state.actors) {
      const pending = this.pending.get(a.id);
      if (
        pending &&
        pending.activationId !== a.pending?.activationId &&
        state.tick >= pending.releaseTick &&
        !a.down
      ) {
        const spell = spells.find((s) => s.id === pending.spellId);
        const interrupted = state.events
          .slice(-64)
          .some(
            (e) =>
              e.actorId === a.id &&
              e.kind === "interrupt" &&
              e.tick >= pending.startTick,
          );
        if (spell && spell.kind !== "projectile" && !interrupted) {
          const at =
            spell.kind === "zone" || spell.effect === "decoy"
              ? pending.aim
              : spell.kind === "target"
                ? (state.actors.find((t) => t.id === pending.targetId)?.pos ??
                  pending.aim)
                : a.pos;
          this.shot({
            clip: `${this.element(a)}.impact`,
            at: { ...at },
            tick: pending.releaseTick,
          });
        }
      }
      if (a.pending)
        this.pending.set(a.id, { ...a.pending, aim: { ...a.pending.aim } });
      else this.pending.delete(a.id);
      const old = this.blocks.get(a.id);
      if (old !== undefined && a.metrics.blocks > old && a.absorb)
        this.shot({
          clip: "absorb.contact",
          at: { ...a.pos },
          actorId: a.id,
          tick: state.tick,
          barrier: true,
        });
      this.blocks.set(a.id, a.metrics.blocks);
    }
    this.cpuMs = performance.now() - started;
  }
  draw(
    id: string,
    elapsedMs: number,
    at: Vec,
    options: {
      angle?: number;
      opacity?: number;
      behind?: boolean;
      lift?: number;
      barrier?: boolean;
      scale?: number;
      optional?: boolean;
      groundSize?: Vec;
    } = {},
  ): boolean {
    const clip = this.manifest?.clips[id];
    if (!clip) return false;
    const pageKey = `${this.namespace}.page.${clip.page}`,
      page = art.get(pageKey);
    if (!page) {
      if (!this.requests.has(pageKey)) {
        void this.loadPage(pageKey);
      }
      return false;
    }
    const index = frameIndex(clip, elapsedMs);
    if (index < 0) return true;
    if (
      this.used >= policy.effects.maxSprites ||
      (options.optional && this.budgetExceeded)
    ) {
      this.dropped++;
      return true;
    }
    if ((this.used & 15) === 15 && this.cpuMs > policy.effects.cpuBudgetMs)
      this.budgetExceeded = true;
    const started = performance.now();
    const frame = clip.frames[index]!,
      key = `${clip.page}:${frame.rect.join()}`;
    let texture = this.frames.get(key);
    if (!texture) {
      texture = new Texture({
        source: page.source,
        frame: new Rectangle(...frame.rect),
      });
      this.frames.set(key, texture);
    }
    let slot = this.slots[this.used++];
    if (!slot) {
      const root = new Container(),
        sprite = new Sprite(),
        mask = new Graphics();
      root.addChild(sprite, mask);
      slot = { root, sprite, mask };
      this.slots.push(slot);
    }
    const parent = options.behind ? this.behind : this.front;
    if (slot.root.parent !== parent) parent.addChild(slot.root);
    const { root, sprite, mask } = slot,
      m = cameraMetrics(this.c),
      q = groundToScreen(at, this.c);
    root.visible = true;
    root.setFromMatrix(new Matrix());
    root.position.set(q.x, q.y - (options.lift ?? 0));
    sprite.texture = texture;
    sprite.anchor.set(...clip.anchor!);
    const scale = (m.figureHeightPx / 40.5) * (options.scale ?? 1);
    sprite.width = clip.designSize1080![0] * scale;
    sprite.height = clip.designSize1080![1] * scale;
    if (options.groundSize) {
      sprite.width = options.groundSize.x * m.pxPerMetreX;
      sprite.height = options.groundSize.y * m.pxPerMetreY;
    }
    sprite.blendMode = clip.blend === "lighter" ? "add" : "normal";
    sprite.alpha = options.opacity ?? policy.effects.impactOpacity;
    sprite.mask = null;
    mask.clear();
    const angle = options.angle ?? 0,
      squash = m.pxPerMetreY / m.pxPerMetreX;
    if (options.angle !== undefined || options.barrier) {
      // S * R * inverse(S): rotate in unprojected ground, project exactly once.
      root.setFromMatrix(
        new Matrix(
          Math.cos(angle),
          Math.sin(angle) * squash,
          -Math.sin(angle) / squash,
          Math.cos(angle),
          q.x,
          q.y - (options.lift ?? 0),
        ),
      );
    }
    if (options.barrier) {
      const r = contract.absorb.visual_radius_metres * m.pxPerMetreX;
      // The painted centre of curvature lies at its metadata anchor. Clip the
      // membrane to the same open-rear sector as the data-owned ward outline.
      mask.moveTo(0, 0);
      for (let i = 0; i <= 36; i++) {
        const a = ((-this.arcDeg / 2 + (this.arcDeg * i) / 36) * Math.PI) / 180;
        mask.lineTo(Math.cos(a) * r * 1.14, Math.sin(a) * r * 1.14 * squash);
      }
      mask.closePath().fill(0xffffff);
      sprite.mask = mask;
      sprite.width = r * 2.7;
      sprite.height = r * 2.7;
    }
    this.cpuMs += performance.now() - started;
    return true;
  }
  finish(state: ArenaState) {
    for (const s of this.shots) {
      const actor =
        s.actorId === undefined
          ? undefined
          : state.actors.find((a) => a.id === s.actorId);
      if (s.barrier && !actor?.absorb) continue;
      this.draw(
        s.clip,
        seconds(this.tick - s.tick) * 1000,
        actor?.pos ?? s.at,
        {
          angle:
            s.barrier && actor
              ? Math.atan2(actor.facing.y, actor.facing.x)
              : s.angle,
          barrier: s.barrier,
          lift:
            s.clip.endsWith(".hit") || s.clip.endsWith(".cast")
              ? cameraMetrics(this.c).figureHeightPx * 0.5
              : 0,
          scale: s.clip === "absorb.perfect" ? 0.52 : 1,
        },
      );
    }
  }
  snapshot() {
    return {
      active: this.used,
      allocated: this.slots.length,
      oneShots: this.shots.length,
      dropped: this.dropped,
      cpuMs: this.cpuMs,
      budgetMs: policy.effects.cpuBudgetMs,
      counts: { ...this.counts },
      diagnostics: [...this.diagnostics],
    };
  }
  dispose() {
    this.disposed = true;
    this.behind.destroy({ children: true });
    this.front.destroy({ children: true });
    for (const t of this.frames.values()) t.destroy();
    for (const key of this.requests) art.release(key);
  }
}
