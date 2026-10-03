import { describe, expect, it } from "vitest";
import {
  createLab,
  defaultLabConfig,
  stepLab,
  labReplay,
  toggleLabDamage,
  changeLabTuning,
} from "./lab.ts";
import { makeTuning, exportTuning, importTuning, schools } from "./tuning.ts";
import { idleInput } from "./types.ts";
import { stateHash, stepArena, resolveHit, ticks } from "./kernel.ts";
import { spellFor } from "./catalog.ts";
import { timingBot } from "./training.ts";

describe("Combat Feel Lab", () => {
  it("creates one honest mage at each school/competence without stat bonuses", () => {
    for (const school of schools)
      for (const competence of [1, 2, 3, 4]) {
        const l = createLab({
          ...defaultLabConfig,
          opponent: "mage",
          opponentSchool: school,
          competence,
          distanceM: 18,
        });
        const { state, player, dummy } = l.training;
        expect(state.actors).toHaveLength(2);
        expect(dummy.mageAI!.competence).toBe(competence);
        expect(dummy.maxHp).toBe(player.maxHp);
        expect(dummy.pos.x - player.pos.x).toBe(18);
        expect(spellFor(dummy, 0, state)!.speedMps).toBeGreaterThan(0);
      }
  });
  it("keeps tuning local, round-trips JSON and rejects invalid/unknown values", () => {
    const a = createLab(),
      b = createLab();
    const t = makeTuning("Snappier");
    changeLabTuning(a, t, "Snappier");
    expect(b.training.state.tuning!.castTimeScale).toBe(1);
    expect(importTuning(exportTuning(t, "test")).tuning).toEqual(t);
    for (const bad of [
      { ...t, walkMps: NaN },
      { ...t, unknown: 1 },
      { ...t, rollIFramesS: 1 },
      {
        ...t,
        spells: { "bolt:0:base": { castS: 0, cooldownS: 0, speedMps: 0 } },
      },
    ])
      expect(() => exportTuning(bad as typeof t, "bad")).toThrow();
  });
  it("replays identical fixed seeds and resumes serialized live state exactly", () => {
    const config = { ...defaultLabConfig, opponent: "mage" as const };
    const a = createLab(config),
      b = createLab(config);
    toggleLabDamage(a);
    toggleLabDamage(b);
    for (let i = 0; i < 360; i++) {
      stepLab(a, idleInput(a.training.dummy.pos));
      stepLab(b, idleInput(b.training.dummy.pos));
    }
    expect(stateHash(a.training.state)).toBe(stateHash(b.training.state));
    const copy = JSON.parse(JSON.stringify(a.training.state));
    for (let i = 0; i < 60; i++) {
      stepArena(copy);
      stepArena(a.training.state);
    }
    expect(stateHash(copy)).toBe(stateHash(a.training.state));
  });
  it("records damage-disabled contacts, perfect opportunities and bounded twenty-second history", () => {
    const l = createLab();
    toggleLabDamage(l);
    for (let i = 0; i < 1300; i++) stepLab(l, timingBot(l.training, "perfect"));
    expect(l.training.player.hp).toBe(l.training.player.maxHp);
    expect(l.metrics.incomingMagic).toBeGreaterThan(2);
    expect(l.metrics.perfects).toBeGreaterThan(2);
    expect(l.metrics.timeToKillS).toBeNull();
    expect(labReplay(l)).toHaveLength(1201);
    const history = labReplay(l),
      hash = stateHash(l.training.state);
    expect(history.at(-1)!.tick - history[0]!.tick).toBe(1200);
    history[0]!.actors[0]!.hp = 1;
    expect(stateHash(l.training.state)).toBe(hash);
  });
  it("applies acceleration, roll distance, stagger and knockback in the kernel", () => {
    const t = makeTuning();
    t.accelerationMps2 = 30;
    t.knockbackM = 0.5;
    t.hitStunS = 0.1;
    const l = createLab({ ...defaultLabConfig, dummyAttack: "still" }, t),
      { state, player, dummy } = l.training;
    const x = player.pos.x;
    stepLab(l, { ...idleInput(dummy.pos), move: { x: 1, y: 0 } });
    expect(player.pos.x - x).toBeCloseTo(30 / 3600);
    const start = player.pos.x;
    stepLab(l, { ...idleInput(dummy.pos), move: { x: 1, y: 0 }, roll: true });
    for (let i = 1; i < ticks(t.rollDurationS); i++)
      stepLab(l, idleInput(dummy.pos));
    expect(player.pos.x - start).toBeCloseTo(t.rollDistanceM);
    state.tick = player.immuneUntil + 1;
    const before = player.pos.x;
    resolveHit(state, player, {
      ownerId: dummy.id,
      activationId: 111,
      family: "physical",
      damage: 10,
      tier: 1,
      source: dummy.pos,
    });
    expect(player.pos.x).toBeLessThan(before);
    expect(player.staggerUntil).toBe(state.tick + ticks(0.1));
  });
  it("snapshots active spells while new casts use edited cast, cooldown and speed", () => {
    const l = createLab({ ...defaultLabConfig, dummyAttack: "still" }),
      { state, player, dummy } = l.training;
    stepLab(l, { ...idleInput(dummy.pos), cast: true, slot: 1 });
    const pending = structuredClone(player.pending!);
    const t = makeTuning();
    t.castTimeScale = 0.5;
    t.projectileSpeedScale = 2;
    t.cooldownScale = 0.5;
    changeLabTuning(l, t, "Custom");
    expect(player.pending).toEqual(pending);
    while (state.tick < pending.releaseTick) stepLab(l, idleInput(dummy.pos));
    expect(
      Math.hypot(
        state.projectiles[0]!.velocity.x,
        state.projectiles[0]!.velocity.y,
      ),
    ).toBe(pending.spell!.speedMps);
    expect(spellFor(player, 1, state)!.speedMps).toBe(
      pending.spell!.speedMps * 2,
    );
  });
});
