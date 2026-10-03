import { describe, expect, it } from "vitest";
import {
  createLab,
  defaultLabConfig,
  makeTuning,
  stepArena,
  idleInput,
  ticks,
  resolveHit,
  stateHash,
  resetWave,
  attachMageAI,
  mageInput,
  importTuning,
  exportTuning,
} from "./index.ts";
const setup = () =>
  createLab({ ...defaultLabConfig, dummyAttack: "still" }).training;
describe("shipping combat commitments", () => {
  it("cancels before commit and releases exactly once at the announced tick after commit", () => {
    for (const early of [true, false]) {
      const { state, player, dummy } = setup();
      stepArena(state, {
        [player.id]: { ...idleInput(dummy.pos), cast: true, slot: 1 },
      });
      const pending = structuredClone(player.pending!);
      const commit =
        pending.startTick +
        Math.ceil(
          (pending.releaseTick - pending.startTick) *
            state.tuning!.castCommitFraction,
        );
      while (state.tick < (early ? pending.startTick : commit - 1))
        stepArena(state);
      stepArena(state, {
        [player.id]: {
          ...idleInput(dummy.pos),
          roll: true,
          move: { x: 0, y: 1 },
        },
      });
      for (let i = 0; i < 30; i++) stepArena(state);
      const releases = state.events.filter(
        (e) => e.kind === "release" && e.activationId === pending.activationId,
      );
      expect(releases).toHaveLength(early ? 0 : 1);
      expect(player.metrics.rolls).toBe(early ? 1 : 0);
      if (!early) {
        expect(releases[0]!.tick).toBe(pending.releaseTick);
        expect(releases[0]!.spellId).toBe(pending.spellId);
      }
    }
  });
  it("keeps spell recovery locked while allowing a new cast afterwards", () => {
    const { state, player, dummy } = setup();
    state.tuning!.castRecoveryS = 0.2;
    stepArena(state, {
      [player.id]: { ...idleInput(dummy.pos), cast: true, slot: 0 },
    });
    expect(player.recoveryUntil).toBe(state.tick + ticks(0.2));
    stepArena(state, {
      [player.id]: { ...idleInput(dummy.pos), cast: true, slot: 1 },
    });
    expect(player.pending).toBeUndefined();
    while (state.tick < player.recoveryUntil) stepArena(state);
    stepArena(state, {
      [player.id]: { ...idleInput(dummy.pos), cast: true, slot: 1 },
    });
    expect(player.pending).toBeDefined();
  });
  it("accelerates and brakes promptly, with immediate aim and bounded roll recovery", () => {
    const { state, player, dummy } = setup(),
      x = player.pos.x;
    stepArena(state, {
      [player.id]: { ...idleInput(dummy.pos), move: { x: 1, y: 0 } },
    });
    expect(player.pos.x - x).toBeCloseTo(60 / 3600);
    for (let i = 0; i < 5; i++)
      stepArena(state, {
        [player.id]: { ...idleInput(dummy.pos), move: { x: 1, y: 0 } },
      });
    expect(player.velocity!.x).toBe(makeTuning().walkMps);
    stepArena(state, {
      [player.id]: idleInput({ x: player.pos.x - 5, y: player.pos.y }),
    });
    expect(player.facing.x).toBe(-1);
    for (let i = 0; i < 3; i++) stepArena(state);
    expect(player.velocity).toEqual({ x: 0, y: 0 });
    stepArena(state, {
      [player.id]: {
        ...idleInput(dummy.pos),
        roll: true,
        move: { x: 1, y: 0 },
      },
    });
    while (state.tick < player.rollUntil)
      stepArena(state, {
        [player.id]: { ...idleInput(dummy.pos), move: { x: 1, y: 0 } },
      });
    expect(player.velocity!.x).toBeLessThanOrEqual(makeTuning().walkMps * 0.5);
    expect(player.recoveryUntil).toBeGreaterThan(state.tick);
  });
  it("resists fan stunlock, preserves guarding, and resets residual movement/stagger", () => {
    const { state, player, dummy } = setup();
    const hit = {
      ownerId: dummy.id,
      activationId: 111,
      family: "magic" as const,
      damage: 10,
      tier: 1,
      source: dummy.pos,
    };
    resolveHit(state, player, hit);
    const until = player.staggerUntil;
    state.tick++;
    resolveHit(state, player, { ...hit, activationId: 112 });
    expect(player.staggerUntil).toBe(until);
    state.tick = player.staggerImmuneUntil!;
    player.absorb = true;
    player.absorbFreshTick = -100;
    resolveHit(state, player, { ...hit, activationId: 113 });
    expect(player.staggerUntil).toBe(until);
    resetWave(state, player);
    expect(player.velocity).toEqual({ x: 0, y: 0 });
    expect(player.staggerUntil).toBe(state.tick);
  });
  it("serializes in-flight casts, velocity and AI decisions without changing continuation", () => {
    const { state, player, dummy } = setup();
    attachMageAI(dummy, 3);
    for (let i = 0; i < 15; i++)
      stepArena(state, {
        [dummy.id]: mageInput(state, dummy),
        [player.id]: {
          ...idleInput(dummy.pos),
          move: { x: 0, y: 1 },
          cast: i === 12,
          slot: 1,
        },
      });
    const copy = JSON.parse(JSON.stringify(state));
    for (let i = 0; i < 300; i++) {
      stepArena(state, { [dummy.id]: mageInput(state, dummy) });
      stepArena(copy, { [dummy.id]: mageInput(copy, copy.actors[1]) });
    }
    expect(stateHash(copy)).toBe(stateHash(state));
    expect(dummy.mageAI!.reactionAges.every((n) => n >= 15)).toBe(true);
  });
  it("imports v1 experiments with legacy values for newly introduced parameters", () => {
    const old = JSON.parse(exportTuning(makeTuning(), "legacy"));
    old.version = 1;
    delete old.tuning.hitStunGraceS;
    delete old.tuning.rollRecoveryMoveMultiplier;
    const imported = importTuning(JSON.stringify(old));
    expect(imported.tuning.hitStunGraceS).toBe(0);
    expect(imported.tuning.rollRecoveryMoveMultiplier).toBe(1);
  });
});
