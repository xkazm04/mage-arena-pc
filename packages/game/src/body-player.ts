import { Rectangle, Texture, type Sprite } from "pixi.js";
import {
  tuningFor,
  combat,
  seconds,
  type Actor,
  type ArenaState,
} from "@mage/core/arena";
import { art } from "./art.ts";
import {
  bodyIdentity,
  mothContact,
  corpseForDeath,
  selectBodyClip,
  type BodySelection,
} from "./body-policy.ts";
import {
  bodyDrawSpec,
  facingFromVector,
  frameIndex,
  validateClips,
  type BodyManifest,
  type BodyState,
  type Direction,
} from "./animation-contract.ts";
import policy from "../data/animation.json" with { type: "json" };
interface Motion {
  entity: string;
  state: BodyState;
  direction: Direction;
  since: number;
  hitElapsed: number;
  hitDuration: number;
  hitState: "hit-light" | "hit-heavy";
  castUntil: number;
  selection?: BodySelection;
  frame: number;
  angle?: number;
  lastTick?: number;
  deathElapsed?: number;
  deathTick?: number;
  deathClip?: boolean;
}
export class BodyPlayer {
  manifest?: BodyManifest;
  readonly fallbacks = new Set<string>();
  private fallbackKeys = new Set<string>();
  readonly diagnostics: string[] = [];
  private frames = new Map<string, Texture>();
  private actors = new Map<number, Motion>();
  private requests = new Set<string>();
  private state?: ArenaState;
  private eventIndex = 0;
  private disposed = false;
  private tick = 0;
  private displayed: Record<string, unknown>[] = [];
  constructor() {
    void this.init();
  }
  private async init() {
    try {
      const m = (await art.json("a10.packed.manifest")) as BodyManifest;
      if (m.schemaVersion !== 1) throw Error("Unsupported characters");
      validateClips(
        m.pages,
        Object.values(m.entities).flatMap((b) =>
          Object.values(b.clips).flatMap((c) => Object.values(c)),
        ),
      );
      for (const b of Object.values(m.entities))
        if (
          b.anchor?.length !== 2 ||
          b.designSize1080?.length !== 2 ||
          !b.designSize1080.every((n) => Number.isFinite(n) && n > 0) ||
          !b.anchor.every((n) => n >= 0 && n <= 1)
        )
          throw Error("Invalid body contract");
      if (!this.disposed) this.manifest = m;
    } catch (e) {
      this.diagnostics.push(String(e));
    }
  }
  begin(state: ArenaState, alpha: number, dt = 1 / 60) {
    if (this.state !== state || state.events.length < this.eventIndex) {
      this.state = state;
      this.eventIndex = Math.max(
        0,
        state.events.findIndex((e) => e.tick >= state.tick - 1),
      );
      this.actors.clear();
    }
    this.tick = state.tick + alpha;
    this.displayed = [];
    for (const a of state.actors) {
      const entity = bodyIdentity(a);
      let motion = this.actors.get(a.id);
      if (!motion || motion.entity !== entity) {
        motion = {
          entity,
          state: "idle",
          direction: facingFromVector(a.facing.x, a.facing.y, "se"),
          since: state.tick,
          hitElapsed: 1e9,
          hitDuration: 0,
          hitState: "hit-light",
          castUntil: 0,
          frame: 0,
        };
        this.actors.set(a.id, motion);
      }
      motion.hitElapsed += Math.min(0.1, dt);
      if (a.tags.includes("DEFEATED")) {
        if (
          motion.deathElapsed === undefined ||
          motion.deathTick !== a.defeatedTick
        ) {
          motion.deathElapsed = Math.max(
            0,
            seconds(state.tick - (a.defeatedTick ?? state.tick)),
          );
          motion.deathTick = a.defeatedTick;
        } else motion.deathElapsed += Math.min(0.1, dt);
      } else {
        motion.deathElapsed = undefined;
        motion.deathTick = undefined;
      }
      const body = this.manifest?.entities[entity];
      if (body)
        for (const page of new Set(
          Object.values(body.clips).flatMap((c) =>
            Object.values(c).map((c) => c.page),
          ),
        )) {
          const key = `a10.packed.${page}`;
          if (!this.requests.has(key)) {
            this.requests.add(key);
            art.retain(key);
            void art.load(key);
          }
        }
    }
    for (const e of state.events.slice(this.eventIndex)) {
      const m = this.actors.get(e.actorId);
      if (!m || state.tick - e.tick > 60) continue;
      if (e.kind === "hit" && e.value > 0) {
        m.hitElapsed = Math.max(0, seconds(state.tick - e.tick));
        m.hitDuration = Math.max(
          tuningFor(state).hitRecoilS,
          seconds(
            (state.actors.find((a) => a.id === e.actorId)?.staggerUntil ??
              e.tick) - e.tick,
          ),
        );
        m.hitState =
          e.value >= policy.bodies.heavyHitDamage ? "hit-heavy" : "hit-light";
      }
      if (e.kind === "release")
        m.castUntil =
          e.tick + (policy.bodies.castHoldMs / 1000) * combat.simStepHz;
    }
    this.eventIndex = state.events.length;
    const live = new Set(state.actors.map((a) => a.id));
    for (const id of this.actors.keys())
      if (!live.has(id)) this.actors.delete(id);
  }
  apply(sprite: Sprite, a: Actor, height: number): boolean {
    const motion = this.actors.get(a.id)!;
    const vx = a.pos.x - a.previousPos.x,
      vy = a.pos.y - a.previousPos.y;
    const windup = this.state?.telegraphs.find(
      (t) => t.ownerId === a.id && !t.survivesOwner,
    );
    const castWindow =
      a.pending ??
      (windup && {
        startTick: windup.startTick,
        releaseTick: windup.resolveTick,
      });
    const state: BodyState = a.tags.includes("DEFEATED")
      ? "death"
      : motion.hitElapsed < motion.hitDuration
        ? motion.hitState
        : a.absorb
          ? "absorb"
          : castWindow ||
              this.tick < motion.castUntil ||
              (this.state && mothContact(a, this.state))
            ? "cast"
            : Math.abs(vx) + Math.abs(vy) > 1e-6
              ? "run"
              : "idle";
    const response = this.state ? tuningFor(this.state).turnResponse : 0;
    const tx = state === "run" ? vx : a.facing.x,
      ty = state === "run" ? vy : a.facing.y;
    const targetAngle = Math.atan2(ty, tx);
    let smoothed: Direction | undefined;
    if (response > 0 && Math.hypot(tx, ty) > 1e-6) {
      const previous = motion.angle ?? targetAngle;
      const delta = Math.atan2(
        Math.sin(targetAngle - previous),
        Math.cos(targetAngle - previous),
      );
      motion.angle =
        previous +
        delta *
          (1 -
            Math.exp(
              (-response *
                Math.max(0, this.tick - (motion.lastTick ?? this.tick))) /
                combat.simStepHz,
            ));
      smoothed = facingFromVector(
        Math.cos(motion.angle),
        Math.sin(motion.angle),
        motion.direction,
      );
    } else motion.angle = targetAngle;
    motion.lastTick = this.tick;
    const direction =
      state === "death"
        ? facingFromVector(a.facing.x, a.facing.y, motion.direction)
        : (smoothed ??
          (state === "run"
            ? facingFromVector(vx, vy, motion.direction)
            : state === "cast" || state === "absorb" || state.startsWith("hit")
              ? facingFromVector(a.facing.x, a.facing.y, motion.direction)
              : motion.direction));
    if (state !== motion.state) {
      motion.since = this.tick;
      motion.state = state;
    }
    motion.direction = direction;
    const body = this.manifest?.entities[motion.entity];
    let selected = selectBodyClip(body, state, direction, motion.selection);
    if (
      state === "death" &&
      selected?.state === "death" &&
      this.deathAge(a) * 1000 >=
        selected.clip.frames.reduce((n, f) => n + f.durationMs, 0)
    ) {
      selected = corpseForDeath(body, selected);
    }
    const key = `${motion.entity}:${state}:${direction}`;
    motion.deathClip = false;
    if (!selected || !body) {
      if (this.manifest) this.logFallback(key, "procedural (no entity clip)");
      this.displayed.push({
        id: a.id,
        entity: motion.entity,
        requested: state,
        direction,
        source: "procedural",
      });
      return false;
    }
    const page = art.get(`a10.packed.${selected.clip.page}`);
    if (!page) {
      if (art.snapshot().failed.includes(`a10.packed.${selected.clip.page}`))
        this.logFallback(key, "procedural (entity page failed)");
      return false;
    }
    if (
      (selected.state !== state &&
        !(state === "death" && selected.state === "corpse")) ||
      selected.direction !== direction
    )
      this.logFallback(
        `${motion.entity}:${selected.state === "corpse" ? "corpse" : state}:${direction}`,
        `${selected.state}:${selected.direction}${selected.held ? " (held)" : ""}`,
      );
    motion.deathClip =
      (selected.state === "death" || selected.state === "corpse") &&
      !selected.held;
    // A missing death holds the actual last displayed frame; other substituted
    // states hold a neutral key. All original action clips hold their last key.
    const durationMs = selected.clip.frames.reduce(
      (n, f) => n + f.durationMs,
      0,
    );
    const elapsedMs = state.startsWith("hit")
      ? Math.min(
          0.999,
          motion.hitElapsed / Math.max(0.001, motion.hitDuration),
        ) * durationMs
      : castWindow && state === "cast"
        ? Math.min(
            0.999,
            Math.max(
              0,
              (this.tick - castWindow.startTick) /
                Math.max(1, castWindow.releaseTick - castWindow.startTick),
            ),
          ) * durationMs
        : state === "cast" && this.tick < motion.castUntil
          ? durationMs
          : state === "death"
            ? (motion.deathElapsed ?? 0) * 1000
            : seconds(this.tick - motion.since) * 1000;
    const index = selected.held
      ? state === "death" && selected.clip === motion.selection?.clip
        ? motion.frame
        : 0
      : frameIndex(selected.clip, elapsedMs, true);
    const frame = selected.clip.frames[index] ?? selected.clip.frames[0]!;
    const frameKey = `${selected.clip.page}:${frame.rect.join()}`;
    let texture = this.frames.get(frameKey);
    if (!texture) {
      texture = new Texture({
        source: page.source,
        frame: new Rectangle(...frame.rect),
        orig: frame.orig ? new Rectangle(0, 0, ...frame.orig) : undefined,
        trim: frame.trim ? new Rectangle(...frame.trim) : undefined,
      });
      this.frames.set(frameKey, texture);
    }
    sprite.texture = texture;
    const draw = bodyDrawSpec(body, selected.clip, frame, height);
    sprite.anchor.set(...draw.anchor);
    sprite.rotation = 0;
    sprite.scale.set(
      ((selected.clip.mirrorX ? -1 : 1) * draw.width) /
        (frame.orig?.[0] ?? frame.rect[2]),
      draw.height / (frame.orig?.[1] ?? frame.rect[3]),
    );
    sprite.alpha = 1;
    motion.selection = selected;
    motion.frame = index;
    this.displayed.push({
      id: a.id,
      entity: motion.entity,
      requested: state,
      direction,
      selected: `${selected.state}:${selected.direction}`,
      mirrorX: selected.clip.mirrorX,
      held: selected.held,
      frame: index,
      source: "A10",
      fullFramePx: draw.height,
      anchor: draw.anchor,
      delivery: selected.clip.delivery ?? "A10",
      rotation: sprite.rotation,
      elapsedMs,
      durationMs,
      page: selected.clip.page,
    });
    return true;
  }
  deathAge(a: Actor) {
    return this.actors.get(a.id)?.deathElapsed ?? 0;
  }
  private logFallback(key: string, selected: string) {
    if (this.fallbackKeys.has(key)) return;
    this.fallbackKeys.add(key);
    this.fallbacks.add(`${key} → ${selected}`);
  }
  /** Apply after either atlas selection or the procedural figure fallback. */
  settle(sprite: Sprite, a: Actor, height: number, reduced: boolean) {
    if (!a.tags.includes("DEFEATED")) return;
    const motion = this.actors.get(a.id),
      tune = tuningFor(this.state!);
    if (!motion?.deathClip) {
      const t = reduced ? 1 : Math.min(1, this.deathAge(a) / tune.deathFallS);
      const eased = 1 - Math.pow(1 - t, 3),
        sign = (a.defeatDirection?.x ?? a.facing.x) < 0 ? -1 : 1;
      sprite.rotation = sign * Math.PI * 0.5 * eased;
      sprite.scale.y *= 1 - 0.38 * eased;
      sprite.y += height * 0.06 * eased;
    }
    sprite.alpha = 0.9;
    const shown = this.displayed.find((d) => d.id === a.id);
    if (shown)
      Object.assign(shown, {
        corpse: true,
        deathAge: this.deathAge(a),
        proceduralFall: !motion?.deathClip,
        rotation: sprite.rotation,
        settled: motion?.deathClip
          ? undefined
          : this.deathAge(a) >= tune.deathFallS,
      });
  }
  recordPose(a: Actor, sprite: Sprite) {
    const shown = this.displayed.find((d) => d.id === a.id);
    if (shown)
      Object.assign(shown, {
        offsetX: sprite.x,
        offsetY: sprite.y,
        rotation: sprite.rotation,
        scaleX: sprite.scale.x,
        scaleY: sprite.scale.y,
        alpha: sprite.alpha,
        flashing: !!sprite.filters?.length,
        groundDepth: sprite.parent?.zIndex,
        groundX: sprite.parent?.x,
        groundY: sprite.parent?.y,
      });
  }
  snapshot() {
    return {
      ready: !!this.manifest,
      displayed: this.displayed,
      fallbacks: [...this.fallbacks],
      diagnostics: [...this.diagnostics],
    };
  }
  dispose() {
    this.disposed = true;
    for (const f of this.frames.values()) f.destroy();
    this.actors.clear();
    for (const key of this.requests) art.release(key);
  }
}
