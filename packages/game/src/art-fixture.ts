import {
  addEnemy,
  addMage,
  createArena,
  spawnProjectile,
  type ArenaState,
  type Actor,
  type SchoolEffect,
} from "@mage/core/arena";
import type { BodyState, Direction, Element } from "./animation-contract.ts";
/**
 * The D2 section 7 bar scene, from what exists without new assets: eight painted bodies (the lit cassia among them),
 * two channelled beams, dash trails (procedural strips; a8 has no trail clip, so projectile travel clips stand in for
 * spell trails), two filling detonation discs and a Veering Bolt arc.
 */
export const barScene = {
  bodies: [
    "cassia",
    "brennic",
    "garran",
    "iskar",
    "conscript",
    "shieldman",
    "slinger",
    "netter",
  ],
  beams: 2,
  trails: 2,
  detonations: 2,
  arcs: 1,
  projectiles: 24,
} as const;
/** Harness-only presentation state. Never reaches a save, core bout or RNG. */
export class ArtFixture {
  readonly state: ArenaState;
  readonly player: Actor;
  readonly elements = new Map<number, Element>();
  private elapsed = 0;
  private cycle = -1;
  private hitCycle = -1;
  private poseSince = 0;
  private previousPose?: BodyState;
  pose?: { state: BodyState; direction: Direction };
  constructor(
    readonly kind: Element | "stress" | "fallbacks" | "bar",
    private readonly centre: { x: number; y: number },
  ) {
    this.state = createArena(0);
    const ids: readonly string[] =
      kind === "bar"
        ? barScene.bodies
        : kind === "fallbacks"
          ? [
              "cassia",
              "brennic",
              "garran",
              "iskar",
              "shieldman",
              "slinger",
              "netter",
              "mire_maw",
              "thornback",
              "hush_moth",
              "cinder_hound",
              "conscript",
            ]
          : [
              "cassia",
              "brennic",
              "garran",
              "iskar",
              "conscript",
              "shieldman",
              "slinger",
              "netter",
              "mire_maw",
              "thornback",
              "hush_moth",
              "cinder_hound",
            ];
    ids.forEach((id, i) => {
      const pos = {
        x: centre.x + ((i % 4) - 1.5) * 12,
        y: centre.y + (Math.floor(i / 4) - 1) * 10,
      };
      const a =
        i < 4 ? addMage(this.state, 0, pos, id) : addEnemy(this.state, id, pos);
      this.elements.set(
        a.id,
        kind === "stress" || kind === "fallbacks" || kind === "bar"
          ? (["water", "fire", "earth", "air"] as Element[])[i % 4]!
          : kind,
      );
    });
    this.player = this.state.actors[0]!;
    const bodies = this.state.actors.length;
    for (
      let i = 0;
      i <
      (kind === "stress" ? 100 : kind === "bar" ? barScene.projectiles : 12);
      i++
    ) {
      const owner = this.state.actors[i % bodies]!;
      const pos = {
        x: centre.x + ((i % 10) - 4.5) * 6,
        y: centre.y + (Math.floor(i / 10) - 4.5) * 2.5,
      };
      spawnProjectile(
        this.state,
        {
          ownerId: owner.id,
          activationId: i,
          damage: 0,
          family: "magic",
          tier: 1,
          source: pos,
        },
        pos,
        { x: 1, y: 0.2 },
        5,
        1000,
      );
    }
    if (kind === "bar") this.addBarShapes();
  }
  /** True for the load scenes, whose bodies all run and whose projectiles sweep the field. */
  private get load() {
    return this.kind === "stress" || this.kind === "bar";
  }
  private addBarShapes() {
    const s = this.state,
      [, fire, , air] = s.actors,
      effect = (
        owner: Actor,
        kind: SchoolEffect["kind"],
        origin: { x: number; y: number },
        target: { x: number; y: number },
        extra: Partial<SchoolEffect> = {},
      ) =>
        (s.schoolEffects ??= []).push({
          id: s.nextId++,
          ownerId: owner.id,
          activationId: s.nextId++,
          spellId: "fixture",
          kind,
          startTick: 0,
          nextTick: 1e9,
          endTick: 1e9,
          origin,
          target,
          damage: 0,
          family: "magic",
          tier: 1,
          hitLog: [],
          ...extra,
        });
    for (const owner of [fire!, air!])
      effect(
        owner,
        "beam",
        { ...owner.pos },
        { ...owner.pos },
        {
          lengthM: 9,
        },
      );
    const c = this.centre;
    for (let i = 0; i < barScene.trails; i++)
      effect(
        fire!,
        "trail",
        { x: c.x - 8, y: c.y - 3 + i * 6 },
        { x: c.x - 2, y: c.y - 1 + i * 6 },
      );
    for (let i = 0; i < barScene.detonations; i++)
      effect(
        i ? air! : fire!,
        "detonation",
        { x: c.x, y: c.y },
        { x: c.x + (i ? 6 : -6), y: c.y + 4 },
        { radiusM: 2.5, endTick: 90 },
      );
    const bolt = s.projectiles[0]!;
    bolt.ownerId = air!.id;
    bolt.arc = {
      centre: { x: c.x + 4, y: c.y - 6 },
      radiusM: 5,
      angle: 0,
      sign: 1,
      leftM: 7,
    };
  }
  /** Beams follow their owner's facing, detonations refill every 1.5 s, the bolt's arc runs down (fixture only). */
  private updateBarShapes() {
    const tick = this.state.tick;
    for (const e of this.state.schoolEffects ?? []) {
      const owner = this.state.actors.find((a) => a.id === e.ownerId)!;
      if (e.kind === "beam") {
        const l = e.lengthM! / Math.hypot(owner.facing.x, owner.facing.y);
        e.origin = { ...owner.pos };
        e.target = {
          x: owner.pos.x + owner.facing.x * l,
          y: owner.pos.y + owner.facing.y * l,
        };
      }
      if (e.kind === "detonation" && tick >= e.endTick) {
        e.startTick = tick;
        e.endTick = tick + 90;
      }
    }
    const arc = this.state.projectiles[0]?.arc;
    if (arc) {
      const f = (this.elapsed % 2) / 2;
      arc.angle = f * (7 / 5);
      arc.leftM = 7 * (1 - f) + 0.5;
    }
  }
  update(dt: number) {
    this.elapsed += Math.min(dt, 0.05);
    const nextTick = Math.floor(this.elapsed * 60),
      previousTick = this.state.tick;
    this.state.tick = nextTick;
    const directions = { ne: [1, -1], se: [1, 1], sw: [-1, 1], nw: [-1, -1] };
    if (this.pose?.state !== this.previousPose) {
      this.previousPose = this.pose?.state;
      this.poseSince = nextTick;
    }
    for (const [i, a] of this.state.actors.entries()) {
      const direction =
        this.pose?.direction ??
        (["ne", "se", "sw", "nw"] as Direction[])[
          Math.floor(this.elapsed / 2 + i) % 4
        ]!;
      const [dx, dy] = directions[direction]!;
      a.facing = { x: dx!, y: dy! };
      a.previousPos = { ...a.pos };
      const state =
        this.pose?.state ??
        (this.load ? "run" : i === 0 ? "absorb" : i === 1 ? "cast" : "run");
      if (state === "run" && nextTick > previousTick) {
        a.pos.x += ((dx! * (nextTick - previousTick)) / 60) * 0.7;
        a.pos.y += ((dy! * (nextTick - previousTick)) / 60) * 0.7;
      }
      if (state === "death") {
        if (!a.tags.includes("DEFEATED")) a.defeatedTick = this.state.tick;
        a.tags = ["DEFEATED"];
      } else {
        a.tags = [];
        delete a.defeatedTick;
      }
      a.absorb = state === "absorb";
      a.absorbFreshTick = 0;
      a.pending =
        state === "cast"
          ? {
              kind: "spell",
              startTick: this.poseSince,
              releaseTick: this.poseSince + 60,
              aim: { x: a.pos.x + dx! * 5, y: a.pos.y + dy! * 5 },
              activationId: a.id,
              spellId: "lash:1:base",
            }
          : undefined;
      if (state === "hit" && Math.floor(this.elapsed * 5) !== this.hitCycle)
        this.state.events.push({
          tick: nextTick,
          kind: "hit",
          actorId: a.id,
          targetId: this.player.id,
          value: 1,
        });
    }
    this.hitCycle = Math.floor(this.elapsed * 5);
    for (const [i, p] of this.state.projectiles.entries()) {
      p.previousPos = { ...p.pos };
      p.pos.x += dt * p.velocity.x;
      if (p.pos.x > this.centre.x + 35) {
        p.pos.x = this.centre.x - 35;
        p.previousPos = { ...p.pos };
      }
      if (!this.load) p.pos.y = this.state.actors[i % 12]!.pos.y + 2;
    }
    const cycle = Math.floor(this.elapsed);
    if (this.kind === "bar") this.updateBarShapes();
    if (cycle !== this.cycle && !this.load && !this.pose) {
      this.cycle = cycle;
      for (const a of this.state.actors.slice(0, 4))
        this.state.events.push({
          tick: nextTick,
          kind: "cast",
          actorId: a.id,
          value: 1,
        });
      const target = this.state.actors[2]!;
      this.state.events.push({
        tick: nextTick,
        kind: "hit",
        actorId: target.id,
        targetId: this.player.id,
        value: 1,
      });
      this.player.metrics.blocks++;
      if (cycle % 2)
        this.state.events.push({
          tick: nextTick,
          kind: "perfect",
          actorId: this.player.id,
          targetId: this.state.actors[1]!.id,
          value: 1,
        });
    }
  }
}
