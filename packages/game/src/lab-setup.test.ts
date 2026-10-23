import { describe, expect, it } from "vitest";
import {
  createLab,
  defaultLabConfig,
  drain,
  duelForecast,
  labDefaultLoadout,
  labLoadoutName,
  rivalBuildOf,
  rivalBuilds,
  validateLabConfig,
  enemyRoster,
  idleInput,
  labReplay,
  makeTuning,
  paceOf,
  replenishLab,
  resolveHit,
  stateHash,
  stepLab,
  ticks,
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
import { forecastPolicy, labConfigOf } from "./forecast-job.ts";
import {
  loadPicks,
  nextSlotSpell,
  pickStorageKey,
  presetOptions,
  rankRows,
  savePicks,
  sideBuild,
  sideProblems,
  withPreset,
  withRivalPreset,
  withSchool,
  withSlot,
  withSpellRank,
  withStat,
} from "./lab-picks.ts";

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
    expect([...creatureTargets]).toEqual(["cinder_hound", "mire_maw", "thornback", "hush_moth", "shieldman", "netter", "conscript"]);
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
  it("a live thornback runs its lane: the body travels after the warning and meets the player mid-run", () => {
    const lab = live("thornback", { distanceM: 10 }),
      { state, player, dummy: thorn } = lab.training;
    let charge: (typeof state.telegraphs)[number] | undefined, travelled = 0;
    for (let i = 0; i < 600 && !hitsOn(lab, player.id).length; i++) {
      stepLab(lab, frame(thorn.pos));
      charge ??= state.telegraphs.find((t) => t.ownerId === thorn.id);
      if (charge?.contacted && state.telegraphs.includes(charge)) travelled++;
    }
    const [hit] = hitsOn(lab, player.id, "unblockable");
    // The authored 0.6 s run at the thornback's pace (Normal by default).
    expect(charge?.travelTicks).toBe(ticks(0.6 / paceOf(thorn)));
    expect(hit!.tick).toBeGreaterThan(charge!.resolveTick);
    expect(travelled).toBeGreaterThan(1);
  });
  it("a live conscript lunges its body forward and lands the spear on a ward as guarded steel", () => {
    const lab = live("conscript", { distanceM: 6 }),
      { state, player, dummy: conscript } = lab.training;
    let lunge: (typeof state.telegraphs)[number] | undefined, origin = { ...conscript.pos };
    for (let i = 0; i < 600 && !hitsOn(lab, player.id).length; i++) {
      stepLab(lab, frame(conscript.pos, { absorb: true }));
      if (!lunge && (lunge = state.telegraphs.find((t) => t.ownerId === conscript.id))) origin = { ...lunge.origin };
    }
    expect(lunge?.travelM).toBe(1.2);
    expect(Math.hypot(conscript.pos.x - origin.x, conscript.pos.y - origin.y)).toBeGreaterThan(0.5);
    expect(lab.ledger.counts.physical.guarded).toBe(1);
    expect(hitsOn(lab, player.id, "physical")[0]!.guarded).toBe(true);
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
      // 30 authored ticks of sidestep, covered in fewer at the player's pace, so the shot lands inside the bash warning.
      else if (moved < 30 / paceOf(player)) { moved++; stepLab(flank, frame(s.pos, { move: { x: 0.7, y: 1 } })); }
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

// Lab build pickers (spark combat-system-depth WP4): both sides pick school, archetype preset, stats incl. agility, spell ranks and
// the bolt + 4; the Lab and its forecast duel play the pick; the last pick per side persists; a neutral pick is the default Lab.
describe("Lab build pickers", () => {
  const memoryStore = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
  };
  /** Player: Air, custom bolt + 4, agility 4, a rank-3 slot. Opponent: Fire heavy preset, nerve raised (plan kept). */
  const picked = (): LabSetup => {
    let c: LabSetup = { ...structuredClone(defaultLabConfig), opponent: "mage" };
    c = withSchool(c, "player", "air");
    c = withSlot(c, "player", 1, "air_form");
    c = withStat(c, "player", "agility", 4);
    c = withStat(c, "player", "vigor", 3);
    c = withSpellRank(c, "player", 1, 3);
    c = withSchool(c, "opponent", "fire");
    c = withPreset(c, "opponent", "fire_heavy");
    c = withStat(c, "opponent", "nerve", 2);
    return c;
  };
  it("keeps the default Lab unchanged: no build keys, a neutral pick normalises away, empty storage seeds nothing", () => {
    expect(defaultLabConfig.playerBuild).toBeUndefined();
    expect(defaultLabConfig.opponentBuild).toBeUndefined();
    expect(Object.keys(labConfigOf(defaultLabConfig))).not.toContain("playerBuild");
    let c: LabSetup = structuredClone(defaultLabConfig);
    c = withStat(c, "player", "agility", 3);
    c = withSpellRank(c, "player", 1, 2);
    c = withStat(c, "player", "agility", 1);
    c = withSpellRank(c, "player", 1, 1);
    expect(c).toEqual(defaultLabConfig);
    expect(loadPicks(defaultLabConfig, memoryStore())).toEqual(defaultLabConfig);
    expect(loadPicks(defaultLabConfig, undefined)).toEqual(defaultLabConfig);
    expect(createLabSetup(c)).toEqual(createLab(defaultLabConfig));
    const a = createLabSetup({ ...c, opponent: "mage" }),
      b = createLab({ ...defaultLabConfig, opponent: "mage" });
    for (let i = 0; i < 240; i++) { stepLab(a, idleInput(a.training.dummy.pos)); stepLab(b, idleInput(b.training.dummy.pos)); }
    expect(stateHash(a.training.state)).toBe(stateHash(b.training.state));
  });
  it("a picked build round-trips into the forecast config and the duel's actors play it", () => {
    const c = picked(),
      forecastLab = labConfigOf(c);
    expect(forecastLab.playerBuild).toEqual(c.playerBuild);
    expect(forecastLab.opponentBuild).toEqual(c.opponentBuild);
    expect(c.playerBuild).toEqual({
      ranks: { vigor: 3, focus: 1, nerve: 1, agility: 4 },
      spellRanks: { air_form: 3 },
      loadout: { school: "air", name: labLoadoutName, bolt: "air_bolt", slots: ["air_form", ...labDefaultLoadout("air").slots.slice(1)] },
    });
    expect(c.opponentBuild!.plan).toBe("fire_heavy");
    // duelForecast builds each duel with createLab over this config, always against the mage rival.
    const { player, dummy } = createLab({ ...forecastLab, opponent: "mage", randomSeed: false }).training;
    expect(player.school).toBe("air");
    expect(player.schoolState!.loadout.slots[0]).toBe("air_form");
    expect(rivalBuildOf(player)).toBeUndefined();
    expect(player.ranks).toEqual({ vigor: 3, focus: 1, nerve: 1, agility: 4 });
    expect(player.spellRanks).toEqual({ air_form: 3 });
    expect(player.maxHp).toBeGreaterThan(createLab().training.player.maxHp);
    expect(dummy.school).toBe("fire");
    expect(rivalBuildOf(dummy)?.id).toBe("fire_heavy");
    expect(dummy.ranks).toEqual({ vigor: rivalBuilds.fire_heavy!.ranks.vigor, focus: rivalBuilds.fire_heavy!.ranks.focus, nerve: 2 });
    expect(dummy.spellRanks).toEqual(rivalBuilds.fire_heavy!.spellRanks);
    const plan = { duels: 2, competence: forecastPolicy.duelPlayerCompetence, capS: 60 };
    const mine = drain(duelForecast(makeTuning(), { ...plan, lab: forecastLab })),
      base = drain(duelForecast(makeTuning(), { ...plan, lab: labConfigOf(defaultLabConfig) }));
    expect(mine.duels).toBe(2);
    expect(mine).not.toEqual(base);
  }, 60000);
  it("the plan follows the loadout, slots skip taken rows, and an invalid loadout reports validateLoadout's reason", () => {
    let c = withPreset(withSchool(structuredClone(defaultLabConfig), "opponent", "air"), "opponent", "air_close");
    expect(presetOptions(c, "opponent").map((b) => b.id)).toEqual(["air_light", "air_close", "air_heavy"]);
    expect(sideBuild(c, "opponent").plan).toBe("air_close");
    const original = sideBuild(c, "opponent").loadout!.slots[3]!,
      next = nextSlotSpell(c, "opponent", 4);
    expect(sideBuild(c, "opponent").loadout!.slots).not.toContain(next);
    c = withSlot(c, "opponent", 4, next);
    expect(sideBuild(c, "opponent").plan).toBeUndefined();
    expect(sideProblems(c, "opponent")).toEqual([]);
    c = withSlot(c, "opponent", 4, original);
    expect(sideBuild(c, "opponent").plan).toBe("air_close");
    const dup = withSlot(c, "opponent", 4, sideBuild(c, "opponent").loadout!.slots[0]!);
    expect(sideProblems(dup, "opponent").join(" ")).toContain("Choose four distinct spells.");
    expect(() => validateLabConfig(dup)).toThrow(/Choose four distinct spells/);
    const wrongSide = { ...structuredClone(c), opponentSchool: "water" as const };
    expect(sideProblems(wrongSide, "opponent").join(" ")).toContain("cannot play on a water side");
    expect(() => withPreset(c, "opponent", "fire_close")).toThrow();
    // Planted-bad builds: each is refused by core's check with its reason.
    const bad = (opponentBuild: unknown) => sideProblems({ ...structuredClone(c), opponentBuild } as typeof c, "opponent").join(" ");
    expect(bad({ ...sideBuild(c, "opponent"), colour: "red" })).toContain("unknown key colour");
    expect(bad({ ranks: { vigor: 6, focus: 1, nerve: 1 } })).toContain("vigor 6");
    expect(bad({ ranks: { vigor: 1, focus: 1, nerve: 1, agility: 0 } })).toContain("agility 0");
    expect(bad({ spellRanks: { air_shear: 6 } })).toContain("air_shear=6");
    expect(bad({ loadout: labDefaultLoadout("air"), plan: "air_heavy" })).toContain("plan air_heavy needs its own bolt + 4");
    expect(bad({ loadout: { ...labDefaultLoadout("air"), bolt: "fire_bolt" } })).toContain("The bolt slot holds air_bolt.");
    // Back to Water: the loadout and the old spellbook's ranks go, the stats stay.
    const water = withSchool(c, "opponent", "water");
    const { agility: _one, ...stats } = rivalBuilds.air_close!.ranks;
    expect(_one).toBe(1);
    expect(sideBuild(water, "opponent")).toEqual({ ranks: stats });
  });
  it("a school's first preset that is a rival build's own loadout plays that build's plan", () => {
    const air = withSchool(structuredClone(defaultLabConfig), "player", "air");
    expect(sideBuild(air, "player").plan).toBe("air_light");
    expect(sideBuild(withSchool(air, "player", "fire"), "player").plan).toBeUndefined();
  });
  it("Water sides rank the bolt and each line across its four collar tiers", () => {
    let c = withSpellRank(structuredClone(defaultLabConfig), "player", 2, 4);
    const lines = defaultLabConfig.composition.lines;
    expect(rankRows(c, "player").map((r) => r.label)).toHaveLength(4);
    expect(c.playerBuild!.spellRanks).toEqual(Object.fromEntries([1, 2, 3, 4].map((t) => [`${lines[1]}:${t}`, 4])));
    c = withRivalPreset({ ...c, opponent: "mage" }, "Undertow");
    c = withSpellRank(c, "opponent", 0, 2);
    const { player, dummy } = createLabSetup(c).training;
    expect(player.spellRanks![`${lines[1]}:3`]).toBe(4);
    expect(dummy.water.composition.name).toBe("Undertow");
    expect(dummy.spellRanks).toEqual({ "bolt:0": 2 });
  });
  it("persists the last pick per side and ignores unreadable, invalid or failing storage", () => {
    const store = memoryStore(),
      c = picked();
    savePicks(c, store);
    expect([...store.m.keys()].sort()).toEqual([pickStorageKey("opponent"), pickStorageKey("player")]);
    const restored = loadPicks(structuredClone(defaultLabConfig), store);
    expect(restored.playerBuild).toEqual(c.playerBuild);
    expect(restored.opponentBuild).toEqual(c.opponentBuild);
    expect(restored.playerSchool).toBe("air");
    expect(restored.opponentSchool).toBe("fire");
    store.m.set(pickStorageKey("player"), "{not json");
    store.m.set(pickStorageKey("opponent"), JSON.stringify({ school: "water", build: { loadout: labDefaultLoadout("fire") } }));
    expect(loadPicks(defaultLabConfig, store)).toEqual(defaultLabConfig);
    const failing = { getItem: () => { throw Error("blocked"); }, setItem: () => { throw Error("full"); } };
    expect(() => savePicks(c, failing)).not.toThrow();
    expect(loadPicks(defaultLabConfig, failing)).toEqual(defaultLabConfig);
  });
});
