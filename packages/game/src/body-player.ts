import { Rectangle, Texture, type Sprite } from "pixi.js";
import { combat, seconds, type Actor, type ArenaState } from "@mage/core/arena";
import { art } from "./art.ts";
import {
  bodyIdentity,
  selectBodyClip,
  type BodySelection,
} from "./body-policy.ts";
import {
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
  hitUntil: number;
  castUntil: number;
  selection?: BodySelection;
  frame: number;
}
export class BodyPlayer {
  manifest?: BodyManifest;
  readonly fallbacks = new Set<string>();
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
  begin(state: ArenaState, alpha: number) {
    if (this.state !== state || state.events.length < this.eventIndex) {
      this.state = state;
      this.eventIndex = state.events.length;
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
          direction: "se",
          since: state.tick,
          hitUntil: 0,
          castUntil: 0,
          frame: 0,
        };
        this.actors.set(a.id, motion);
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
      if (!m) continue;
      if (e.kind === "hit" && e.value > 0)
        m.hitUntil =
          e.tick + (policy.bodies.hitHoldMs / 1000) * combat.simStepHz;
      if (e.kind === "cast")
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
    const state: BodyState = a.down
      ? "death"
      : this.tick < motion.hitUntil
        ? "hit"
        : a.absorb
          ? "absorb"
          : a.pending ||
              this.tick < motion.castUntil ||
              this.state?.telegraphs.some(
                (t) => t.ownerId === a.id && !t.survivesOwner,
              )
            ? "cast"
            : Math.abs(vx) + Math.abs(vy) > 1e-6
              ? "run"
              : "idle";
    const direction =
      state === "run"
        ? facingFromVector(vx, vy, motion.direction)
        : state === "cast" || state === "absorb" || state === "hit"
          ? facingFromVector(a.facing.x, a.facing.y, motion.direction)
          : motion.direction;
    if (state !== motion.state) {
      motion.since = this.tick;
      motion.state = state;
    }
    motion.direction = direction;
    const body = this.manifest?.entities[motion.entity];
    const selected = selectBodyClip(body, state, direction, motion.selection);
    const key = `${motion.entity}:${state}:${direction}`;
    if (!selected || !body) {
      if (this.manifest)
        this.fallbacks.add(`${key} → procedural (no entity clip)`);
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
        this.fallbacks.add(`${key} → procedural (entity page failed)`);
      return false;
    }
    if (selected.state !== state || selected.direction !== direction)
      this.fallbacks.add(
        `${key} → ${selected.state}:${selected.direction}${selected.held ? " (held)" : ""}`,
      );
    // A missing death holds the actual last displayed frame; other substituted
    // states hold a neutral key. All original action clips hold their last key.
    const index = selected.held
      ? state === "death" && selected.clip === motion.selection?.clip
        ? motion.frame
        : 0
      : frameIndex(
          selected.clip,
          seconds(this.tick - motion.since) * 1000,
          true,
        );
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
    sprite.anchor.set(...body.anchor);
    sprite.rotation = 0;
    const scale = height / body.designBodyHeight1080;
    sprite.scale.set(
      ((selected.clip.mirrorX ? -1 : 1) * body.designSize1080[0] * scale) /
        (frame.orig?.[0] ?? frame.rect[2]),
      (body.designSize1080[1] * scale) / (frame.orig?.[1] ?? frame.rect[3]),
    );
    sprite.alpha = a.down ? policy.bodies.deathOpacity : 1;
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
      fullFramePx: body.designSize1080[1] * scale,
      rotation: sprite.rotation,
    });
    return true;
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
