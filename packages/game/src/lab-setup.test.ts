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
  type InputFrame,
  type Vec,
} from "@mage/core/arena";
import {
  changeLabSetupTuning,
  createLabSetup,
  creatureTargets,
  type LabSession,
  type LabSetup,
} from "./lab-setup.ts";

describe("stationary creature Lab setup", () => {
  it("leaves the default Lab state byte-identical", () => {
    expect(createLabSetup(defaultLabConfig)).toEqual(
      createLab(defaultLabConfig),
    );
  });
  it("passes the rival preset and plan toggle through to the mage opponent", () => {
    const mage = { ...defaultLabConfig, opponent: "mage" as const };
    expect(createLabSetup(mage).training.dummy.mageAI!.rival).toBeUndefined();
    for (const rivalPreset of ["Undertow", "Mirror tide"]) {
      const off = createLabSetup({ ...mage, rivalPreset, rivalPlan: false }).training.dummy,
        on = createLabSetup({ ...mage, rivalPreset, rivalPlan: true }).training.dummy;
      expect(off.water.composition.name).toBe(rivalPreset);
      expect(off.mageAI!.rival).toBeUndefined();
      expect(on.mageAI!.rival!.preset).toBe(rivalPreset);
    }
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

describe("live creature Lab setup", () => {
  type Target = (typeof creatureTargets)[number];
  const live = (creature: Target, extra: Partial<LabSetup> = {}) =>
    createLabSetup({ ...defaultLabConfig, creature, targetMotion: "live", ...extra });
  const frame = (aim: Vec, patch: Partial<InputFrame> = {}): InputFrame => ({ ...idleInput(aim), ...patch });
  const hitsOn = (lab: LabSession, id: number, family?: string) =>
    lab.training.state.events.filter((e) => e.kind === "hit" && e.actorId === id && (!family || e.family === family));

  it("offers every roster target the Lab can stage, still by default", () => {
    expect([...creatureTargets]).toEqual(["cinder_hound", "mire_maw", "thornback", "hush_moth", "shieldman", "netter"]);
    expect(defaultLabConfig.targetMotion).toBeUndefined();
    expect(() => createLabSetup({ ...defaultLabConfig, creature: "thornback", targetMotion: "walk" as never })).toThrow();
  });
  it("a live thornback walks, its charge hits a player standing in the lane", () => {
    const lab = live("thornback", { distanceM: 16 }),
      { player, dummy: thorn } = lab.training,
      start = { ...thorn.pos };
    for (let i = 0; i < 600 && !hitsOn(lab, player.id, "unblockable").length; i++) stepLab(lab, frame(thorn.pos));
    const [hit] = hitsOn(lab, player.id, "unblockable");
    expect(hit?.value).toBeGreaterThan(0);
    expect(player.hp).toBeLessThan(player.maxHp);
    expect(thorn.pos).not.toEqual(start);
    expect(lab.ledger.counts.unblockable.took).toBe(1);
    expect(lab.metrics.taken).toBe(1);
  });
  it("a live thornback charge misses a scripted sidestep and the ledger grades it avoided", () => {
    const lab = live("thornback", { distanceM: 16 }),
      { state, player, dummy: thorn } = lab.training,
      start = { ...thorn.pos };
    let charge: number | undefined, resolved = 0;
    for (let i = 0; i < 600 && !resolved; i++) {
      const t = state.telegraphs.find((t) => t.ownerId === thorn.id && t.kind === "charge");
      charge ??= t?.activationId;
      stepLab(lab, frame(thorn.pos, charge !== undefined ? { move: { x: 0, y: 1 } } : {}));
      if (charge !== undefined && !state.telegraphs.some((t) => t.activationId === charge)) resolved = state.tick;
    }
    expect(charge).toBeDefined();
    expect(hitsOn(lab, player.id)).toHaveLength(0);
    expect(player.hp).toBe(player.maxHp);
    expect(thorn.pos).not.toEqual(start);
    expect(lab.ledger.counts.unblockable.avoided).toBe(1);
    expect(lab.ledger.entries.find((e) => e.activationId === charge)?.answer).toBe("avoided");
  });
  it("a live hush moth drains the player's mana while the ward is held in contact range", () => {
    const run = (targetMotion: "still" | "live") => {
      const lab = createLabSetup({ ...defaultLabConfig, creature: "hush_moth", distanceM: 2, targetMotion });
      const { player, dummy: moth } = lab.training;
      let contact = 0;
      for (let i = 0; i < 180; i++) {
        stepLab(lab, frame(moth.pos, { absorb: true }));
        if (Math.hypot(moth.pos.x - player.pos.x, moth.pos.y - player.pos.y) <= 0.8) contact++;
      }
      return { mana: player.mana, contact, ward: player.absorb };
    };
    const still = run("still"), moving = run("live");
    expect(still.contact).toBe(0);
    expect(moving.contact).toBeGreaterThan(60);
    expect(moving.ward).toBe(true);
    // The only difference is the moth's authored 6 mana/s sip for every tick in contact.
    expect(still.mana - moving.mana).toBeCloseTo((6 * moving.contact) / 60, 0);
  });
  it("a live shieldman blocks a frontal Rain Needle and takes a flank shot", () => {
    const front = live("shieldman", { distanceM: 10 }),
      shield = front.training.dummy;
    stepLab(front, frame(shield.pos, { cast: true }));
    for (let i = 0; i < 30; i++) stepLab(front, frame(shield.pos));
    expect(hitsOn(front, shield.id).map((e) => e.value)).toEqual([0]);
    expect(shield.hp).toBe(shield.maxHp);

    const flank = live("shieldman", { distanceM: 10 }),
      { state, player, dummy: s } = flank.training;
    let bash: number | undefined, moved = 0, fired = false;
    for (let i = 0; i < 600 && !hitsOn(flank, s.id).length; i++) {
      bash ??= state.telegraphs.find((t) => t.ownerId === s.id)?.activationId;
      if (bash === undefined) stepLab(flank, frame(s.pos));
      else if (moved < 30) { moved++; stepLab(flank, frame(s.pos, { move: { x: 0.7, y: 1 } })); }
      else { stepLab(flank, frame(s.pos, { cast: !fired })); fired = true; }
    }
    // The bash windup locked its shield toward where the player stood; the shot arrives from well outside that 120° front.
    const to = { x: player.pos.x - s.pos.x, y: player.pos.y - s.pos.y },
      off = Math.acos((to.x * s.facing.x + to.y * s.facing.y) / Math.hypot(to.x, to.y) / Math.hypot(s.facing.x, s.facing.y));
    expect(bash).toBeDefined();
    expect((off * 180) / Math.PI).toBeGreaterThan(60);
    expect(hitsOn(flank, s.id)[0]!.value).toBeGreaterThan(0);
    expect(s.hp).toBeLessThan(s.maxHp);
  });
  it("a live netter roots a player who stays in its throw", () => {
    const lab = live("netter", { distanceM: 10 }),
      { state, player, dummy: netter } = lab.training;
    for (let i = 0; i < 240 && state.tick >= player.water.rootUntil; i++) stepLab(lab, frame(netter.pos));
    expect(player.water.rootUntil).toBeGreaterThan(state.tick);
    const pos = { ...player.pos };
    stepLab(lab, frame(netter.pos, { move: { x: -1, y: 0 } }));
    expect(player.pos).toEqual(pos);
  });
  it("keeps Lab replay, metrics and determinism, and resolves a live hound's death burst", () => {
    const run = () => {
      const lab = live("cinder_hound", { distanceM: 4 }),
        { state, player, dummy: hound } = lab.training,
        start = { ...hound.pos };
      for (let i = 0; i < 240; i++) stepLab(lab, frame(hound.pos));
      expect(labReplay(lab).some((s) => s.actors[1]!.pos.x !== start.x)).toBe(true);
      expect(lab.metrics.taken).toBeGreaterThan(0);
      resolveHit(state, hound, { ownerId: player.id, activationId: state.nextId++, family: "unblockable", damage: 10000, tier: 1, source: player.pos });
      stepLab(lab, frame(hound.pos));
      expect(state.telegraphs.filter((t) => t.ownerId === hound.id && t.survivesOwner)).toHaveLength(1);
      for (let i = 0; i < 60; i++) stepLab(lab, frame(hound.pos));
      expect(state.telegraphs).toHaveLength(0);
      expect(hitsOn(lab, player.id, "magic").length).toBeGreaterThan(0);
      const dead = stateHash(state);
      for (let i = 0; i < 120; i++) stepLab(lab, frame(hound.pos));
      expect(stateHash(state)).toBe(dead);
      replenishLab(lab);
      expect(hound.enemy!.deathQueued).toBe(false);
      return dead;
    };
    expect(run()).toBe(run());
  });
  it("treats an explicit still exactly like the default", () => {
    for (const creature of creatureTargets) {
      const a = createLabSetup({ ...defaultLabConfig, creature }),
        b = createLabSetup({ ...defaultLabConfig, creature, targetMotion: "still" });
      for (let i = 0; i < 120; i++) { stepLab(a, idleInput(a.training.dummy.pos)); stepLab(b, idleInput(b.training.dummy.pos)); }
      expect(stateHash(b.training.state)).toBe(stateHash(a.training.state));
    }
  });
});
