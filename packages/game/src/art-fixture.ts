import {
  addEnemy,
  addMage,
  createArena,
  spawnProjectile,
  type ArenaState,
  type Actor,
} from "@mage/core/arena";
import type { BodyState, Direction, Element } from "./animation-contract.ts";
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
    readonly kind: Element | "stress" | "fallbacks",
    private readonly centre: { x: number; y: number },
  ) {
    this.state = createArena(0);
    const ids =
      kind === "fallbacks"
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
        kind === "stress" || kind === "fallbacks"
          ? (["water", "fire", "earth", "air"] as Element[])[i % 4]!
          : kind,
      );
    });
    this.player = this.state.actors[0]!;
    for (let i = 0; i < (kind === "stress" ? 100 : 12); i++) {
      const owner = this.state.actors[i % 12]!;
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
        (this.kind === "stress"
          ? "run"
          : i === 0
            ? "absorb"
            : i === 1
              ? "cast"
              : "run");
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
      if (this.kind !== "stress")
        p.pos.y = this.state.actors[i % 12]!.pos.y + 2;
    }
    const cycle = Math.floor(this.elapsed);
    if (cycle !== this.cycle && this.kind !== "stress" && !this.pose) {
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
