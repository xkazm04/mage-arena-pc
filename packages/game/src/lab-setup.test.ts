import { describe, expect, it } from "vitest";
import {
  createLab,
  defaultLabConfig,
  enemyRoster,
  idleInput,
  labReplay,
  makeTuning,
  replenishLab,
  resolveHit,
  stateHash,
  stepLab,
} from "@mage/core/arena";
import {
  changeLabSetupTuning,
  createLabSetup,
  creatureTargets,
} from "./lab-setup.ts";

describe("stationary creature Lab setup", () => {
  it("leaves the default Lab state byte-identical", () => {
    expect(createLabSetup(defaultLabConfig)).toEqual(
      createLab(defaultLabConfig),
    );
  });
  it("uses roster bodies/stats, real damage, persistent defeat, replay, revive and reset for every facing", () => {
    for (const creature of creatureTargets)
      for (const creatureFacing of ["ne", "se", "sw", "nw"] as const) {
        const config = { ...defaultLabConfig, creature, creatureFacing };
        const lab = createLabSetup(config),
          spec = enemyRoster.find((s) => s.id === creature)!;
        const { state, dummy: target, player } = lab.training;
        expect(state.actors).toHaveLength(2);
        expect(target.enemy!.id).toBe(creature);
        expect(target.maxHp).toBe(spec.hp);
        expect(target.poise).toBe(spec.poise);
        expect(target.mageAI).toBeUndefined();
        expect(labReplay(lab)[0]!.actors[1]!.enemy!.id).toBe(creature);
        const facing = { ...target.facing },
          pos = { ...target.pos };
        for (let i = 0; i < 20; i++) stepLab(lab, idleInput(target.pos));
        expect(target.pos).toEqual(pos);
        expect(Math.sign(target.facing.x)).toBe(Math.sign(facing.x));
        expect(Math.sign(target.facing.y)).toBe(Math.sign(facing.y));
        const hit = (damage: number) =>
          resolveHit(state, target, {
            ownerId: player.id,
            activationId: state.nextId++,
            family: "unblockable",
            damage,
            tier: 1,
            source: player.pos,
          });
        hit(8);
        expect(target.hp).toBe(spec.hp - 8);
        expect(target.staggerUntil).toBeGreaterThan(state.tick);
        hit(10000);
        const dead = stateHash(state);
        for (let i = 0; i < 120; i++) stepLab(lab, idleInput(target.pos));
        expect(stateHash(state)).toBe(dead);
        expect(target.tags).toContain("DEFEATED");
        replenishLab(lab);
        expect(target.tags).not.toContain("DEFEATED");
        expect(target.hp).toBe(spec.hp);
        const tuning = makeTuning();
        tuning.opponentPoise = 2;
        changeLabSetupTuning(lab, tuning, "Custom");
        expect(target.poise).toBe(spec.poise * 2);
        const reset = createLabSetup(lab.config, tuning, "Custom");
        expect(reset.training.state.tick).toBe(0);
        expect(
          reset.training.state.actors.every(
            (a) => !a.tags.includes("DEFEATED"),
          ),
        ).toBe(true);
        expect(reset.training.dummy.enemy!.id).toBe(creature);
        expect(reset.training.dummy.facing).toEqual(facing);
      }
  });
});
