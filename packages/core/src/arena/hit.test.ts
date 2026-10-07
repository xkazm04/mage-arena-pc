import { describe, expect, it } from "vitest";
import {
  addMage,
  addEnemy,
  attachMageAI,
  createArena,
  createLab,
  defaultLabConfig,
  makeTuning,
  resolveHit,
  stepArena,
  idleInput,
  enemyInputs,
  mageInput,
  ticks,
  stateHash,
  defeatActor,
  reviveActor,
  trySpellCast,
  releaseSpell,
  updateWater,
  spawnProjectile,
  replenishLab,
  stepLab,
  exportTuning,
  importTuning,
} from "./index.ts";
import type { Actor, ArenaState } from "./types.ts";
function fixture() {
  const s = createArena(73);
  s.tuning = makeTuning();
  s.tuning.knockbackM = 0;
  const a = addMage(s, 0, { x: 12, y: 10 }),
    b = addMage(s, 1, { x: 18, y: 10 });
  return { s, a, b };
}
function hit(s: ArenaState, a: Actor, b: Actor, damage = 10) {
  return resolveHit(s, a, {
    ownerId: b.id,
    activationId: s.nextId++,
    damage,
    family: "magic",
    tier: 1,
    source: b.pos,
  });
}
describe("H1 damage and defeat authority", () => {
  it("damage scales short stun between the authored floor/ceiling and heavy poise reduces it", () => {
    const durations: number[] = [];
    for (const damage of [1, 10, 50]) {
      const { s, a, b } = fixture();
      hit(s, a, b, damage);
      durations.push(a.staggerUntil! - s.tick);
    }
    expect(durations).toEqual([7, 8, 12]);
    const { s, a, b } = fixture(),
      heavy = addEnemy(s, "thornback", { x: 14, y: 10 });
    hit(s, a, b, 20);
    hit(s, heavy, b, 20);
    expect(heavy.staggerUntil).toBeLessThan(a.staggerUntil!);
    expect(heavy.staggerUntil! - s.tick).toBeGreaterThanOrEqual(ticks(0.1));
  });
  it("cancels a paid committed cast and freezes movement without refunding its mana or cooldown", () => {
    const { s, a, b } = fixture();
    stepArena(s, {
      [a.id]: {
        ...idleInput(b.pos),
        cast: true,
        slot: 1,
        move: { x: 1, y: 0 },
      },
    });
    expect(a.pending).toBeDefined();
    const activation = a.pending!.activationId,
      mana = a.mana,
      cooldown = structuredClone(a.water.cooldowns);
    hit(s, a, b);
    const pos = { ...a.pos };
    expect(a.pending).toBeUndefined();
    expect(a.mana).toBe(mana);
    expect(a.water.cooldowns).toEqual(cooldown);
    expect(a.velocity).toEqual({ x: 0, y: 0 });
    while (s.tick + 1 < a.staggerUntil!) {
      stepArena(s, {
        [a.id]: { ...idleInput(b.pos), cast: true, move: { x: 1, y: 0 } },
      });
      expect(a.pos).toEqual(pos);
    }
    for (let i = 0; i < 60; i++) stepArena(s);
    expect(
      s.events.filter(
        (e) => e.kind === "release" && e.activationId === activation,
      ),
    ).toHaveLength(0);
  });
  it("a sustained fan cannot extend stun or prevent the movement opportunity in the immunity tail", () => {
    const { s, a, b } = fixture();
    a.hp = a.maxHp = 10000;
    hit(s, a, b);
    const until = a.staggerUntil!,
      immune = a.staggerImmuneUntil!,
      x = a.pos.x;
    while (s.tick < immune - 1) {
      hit(s, a, b, 1);
      stepArena(s, { [a.id]: { ...idleInput(b.pos), move: { x: 1, y: 0 } } });
      expect(a.staggerUntil).toBe(until);
    }
    expect(a.pos.x).toBeGreaterThan(x);
    expect(s.events.filter((e) => e.kind === "stagger")).toHaveLength(1);
    stepArena(s);
    hit(s, a, b);
    expect(s.events.filter((e) => e.kind === "stagger")).toHaveLength(2);
  });
  it("roll i-frames, perfect absorb and zero HP delta do not flinch or interrupt", () => {
    for (const kind of ["roll", "perfect", "zero", "practice"]) {
      const { s, a, b } = fixture();
      if (kind === "roll") a.immuneUntil = 100;
      if (kind === "perfect") {
        a.absorb = true;
        a.facing = { x: 1, y: 0 };
        a.absorbFreshTick = s.tick;
      }
      if (kind === "practice") s.lab = { damageEnabled: false };
      hit(s, a, b, kind === "zero" ? 0 : 10);
      expect(a.tags).not.toContain("STAGGERED");
      expect(s.events.filter((e) => e.kind === "stagger")).toHaveLength(0);
    }
  });
  it("guarded chip interrupts movement while a held ward retains its original perfect-window age", () => {
    const { s, a, b } = fixture();
    a.absorb = true;
    a.facing = { x: 1, y: 0 };
    a.absorbFreshTick = -100;
    hit(s, a, b);
    expect(a.tags).toContain("STAGGERED");
    const mana = a.mana;
    stepArena(s, { [a.id]: { ...idleInput(b.pos), absorb: true } });
    expect(a.absorb).toBe(true);
    expect(a.absorbFreshTick).toBe(-100);
    expect(a.mana).toBeLessThan(mana);
  });
  it("interrupts the Mage AI and enemy tells, including same-tick due attacks", () => {
    const { s, a, b } = fixture();
    attachMageAI(b, 3);
    stepArena(s, { [b.id]: { ...idleInput(a.pos), cast: true, slot: 1 } });
    expect(b.pending).toBeDefined();
    hit(s, b, a);
    expect(b.pending).toBeUndefined();
    const e = addEnemy(s, "conscript", { x: 13, y: 10 });
    enemyInputs(s);
    expect(s.telegraphs.some((t) => t.ownerId === e.id)).toBe(true);
    hit(s, e, a);
    expect(s.telegraphs.some((t) => t.ownerId === e.id)).toBe(false);
    for (let i = 0; i < 4; i++) {
      const pos = { ...b.pos };
      stepArena(s, { [b.id]: mageInput(s, b), ...enemyInputs(s) });
      expect(b.pos).toEqual(pos);
    }
  });
  it("fatal damage atomically tags defeat, cancels casting, and keeps an untargetable non-colliding corpse", () => {
    const { s, a, b } = fixture();
    attachMageAI(a, 3);
    stepArena(s, { [a.id]: { ...idleInput(b.pos), cast: true, slot: 1 } });
    hit(s, a, b, 10000);
    expect(a.tags).toEqual(["DEFEATED"]);
    expect(a.pending).toBeUndefined();
    expect(a.defeatedTick).toBe(s.tick);
    expect(a.hp).toBe(0);
    const events = s.events.length,
      pos = { ...a.pos },
      mana = a.mana,
      brain = structuredClone(a.mageAI);
    hit(s, a, b);
    expect(s.events).toHaveLength(events);
    expect(mageInput(s, a).cast).toBe(false);
    expect(a.mageAI).toEqual(brain);
    expect(
      trySpellCast(s, a, { ...idleInput(b.pos), cast: true, slot: 1 }),
    ).toBe(false);
    releaseSpell(s, a);
    a.water.hotUntil = 1000;
    a.water.hotPerTick = 10;
    updateWater(s, a);
    expect(a.hp).toBe(0);
    const p = spawnProjectile(
      s,
      {
        ownerId: b.id,
        activationId: 55,
        damage: 10,
        family: "magic",
        tier: 0,
        source: b.pos,
      },
      b.pos,
      { x: -1, y: 0 },
      20,
      30,
    );
    for (let i = 0; i < 90; i++)
      stepArena(s, {
        [a.id]: {
          ...idleInput(b.pos),
          cast: true,
          move: { x: 1, y: 1 },
          roll: true,
        },
      });
    expect(a.pos).toEqual(pos);
    expect(a.mana).toBe(mana);
    expect(s.actors).toContain(a);
    expect(p.hitIds).not.toContain(a.id);
    expect(s.events.filter((e) => e.kind === "down")).toHaveLength(1);
  });
  it("serialized stun/tail, cancelled commitments and corpse state continue with identical hashes", () => {
    const { s, a, b } = fixture();
    hit(s, a, b);
    const c = JSON.parse(JSON.stringify(s)) as ArenaState;
    for (let i = 0; i < 160; i++) {
      if (i === 15) {
        hit(s, b, a, 10000);
        hit(c, c.actors[1]!, c.actors[0]!, 10000);
      }
      stepArena(s);
      stepArena(c);
    }
    expect(stateHash(c)).toBe(stateHash(s));
    expect(c.actors[1]!.tags).toContain("DEFEATED");
    const corpse = JSON.parse(JSON.stringify(s)) as ArenaState;
    stepArena(corpse);
    stepArena(s);
    expect(stateHash(corpse)).toBe(stateHash(s));
  });
  it("G refills and explicitly revives while ordinary healing never revives; metrics record stagger/cancel", () => {
    const l = createLab({ ...defaultLabConfig, dummyAttack: "still" }),
      { state, player, dummy } = l.training;
    defeatActor(state, player);
    stepLab(l, idleInput());
    expect(state.tick).toBe(0);
    replenishLab(l);
    expect(player.tags).toEqual([]);
    expect(player.hp).toBe(player.maxHp);
    expect(player.defeatedTick).toBeUndefined();
    stepLab(l, idleInput());
    expect(state.tick).toBe(1);
    defeatActor(state, dummy);
    reviveActor(state, dummy);
    expect(dummy.tags).toEqual([]);
  });
  it("version 3 tuning round trips and old exports retain their constant stun timing", () => {
    expect(importTuning(exportTuning(makeTuning(), "H1")).tuning).toEqual(
      makeTuning(),
    );
    const old = JSON.parse(exportTuning(makeTuning(), "old"));
    old.version = 2;
    old.tuning.hitStunS = 0.05;
    const imported = importTuning(JSON.stringify(old)).tuning;
    expect(imported.hitStunMaxS).toBe(0.05);
    expect(imported.hitStunPerDamageS).toBe(0);
  });
});
