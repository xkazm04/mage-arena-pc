import { describe, expect, it } from "vitest";
import {
  combat,
  createLab,
  createLedger,
  createTraining,
  defaultLabConfig,
  flowMark,
  idleInput,
  observeLedger,
  resolveHit,
  spellFor,
  stepLab,
  ticks,
  tuningFor,
  type Actor,
  type ArenaState,
  type Family,
} from "@mage/core/arena";
import {
  FlowBeforeContact,
  flowTipText,
  gradeFor,
  hitLabel,
  idleTip,
  nextFlowTip,
  perfectGain,
  slotPrice,
  wardWord,
  wordAllowed,
} from "./combat-readout.ts";
import policy from "../data/combat-feedback.json" with { type: "json" };

/** One scripted contact on the training player, graded by the real ledger and read the way CombatFeedback reads it. */
function contact(family: Family, setup: (p: Actor, s: ArenaState) => void) {
  const { state, player, dummy } = createTraining("magic");
  state.tick = 120;
  dummy.pos = { x: player.pos.x + 6, y: player.pos.y };
  player.facing = { x: 1, y: 0 };
  setup(player, state);
  const ledger = createLedger(state, player.id);
  observeLedger(ledger, state);
  resolveHit(state, player, { ownerId: dummy.id, activationId: state.nextId++, family, tier: 1, damage: 18, source: { ...dummy.pos } });
  observeLedger(ledger, state);
  const e = state.events.findLast((x) => x.kind === "hit" && x.actorId === player.id)!;
  const grade = gradeFor(ledger, e.tick, e.activationId), word = wardWord(grade);
  return { grade, word, label: hitLabel(word, e.contactDamage ?? e.value), age: state.tick - player.absorbFreshTick, window: ticks(tuningFor(state).absorbWindowS) };
}
const ward = (late = 0) => (p: Actor, s: ArenaState) => {
  p.absorb = true;
  p.absorbFreshTick = s.tick - ticks(tuningFor(s).absorbWindowS) - late;
};

describe("ward words on the frame", () => {
  it("names each committed ward mistake from the ledger grade", () => {
    const steel = contact("physical", ward());
    expect(steel.word?.text).toBe("STEEL");
    expect(steel.label).toMatch(/^STEEL {2}\d/);
    expect(contact("unblockable", ward()).word?.text).toBe("LEAVE");
    expect(contact("magic", (p, s) => { ward()(p, s); p.facing = { x: -1, y: 0 }; }).word?.text).toBe("BEHIND");
    const held = contact("magic", ward(7));
    expect(held.grade?.answer).toBe("held");
    expect(held.age - held.window).toBe(7);
    expect(held.word?.text).toBe(`HELD +${held.age - held.window}f`);
    const cast = contact("magic", (p, s) => {
      const spell = spellFor(p, 1, s)!;
      p.pending = { kind: "spell", spell, spellId: spell.id, startTick: s.tick, releaseTick: s.tick + 30, activationId: s.nextId++, aim: { x: p.pos.x + 6, y: p.pos.y } };
      p.lastInput = { ...idleInput(), absorb: true };
    });
    expect(cast.grade?.answer).toBe("cast-blocked");
    expect(cast.word?.text).toBe("CAST");
    const colour = (k: keyof typeof policy.wardWords.words) => parseInt(policy.wardWords.words[k].fill.slice(1), 16);
    expect([steel.word?.fill, held.word?.fill, cast.word?.fill]).toEqual([colour("steel"), colour("late"), colour("cast")]);
  });
  it("leaves a plain open hit and a perfect without a word", () => {
    const open = contact("magic", () => {});
    expect(open.grade?.answer).toBe("took");
    expect(open.word).toBeUndefined();
    expect(open.label).toBe("18");
    expect(contact("magic", ward(-1)).word).toBeUndefined();
  });
  it("caps words to one per minGapS", () => {
    expect(wordAllowed(0, policy.wardWords.minGapS - 0.01)).toBe(false);
    expect(wordAllowed(0, policy.wardWords.minGapS)).toBe(true);
  });
});

describe("slot price and Flow tip", () => {
  const lab = () => {
    const l = createLab({ ...defaultLabConfig, dummyAttack: "still", distanceM: 8 });
    l.training.player.mana = l.training.player.maxMana;
    return l;
  };
  /** Hold cast on one slot until the kernel casts it; returns the price shown on the tick it cast and the mana it charged. */
  function cast(l: ReturnType<typeof lab>, slot: number) {
    const { state, player, dummy } = l.training;
    for (let i = 0; i < 180; i++) {
      const shown = slotPrice(player, spellFor(player, slot, state)!), casts = player.metrics.casts, before = player.metrics.manaCast ?? 0;
      stepLab(l, { ...idleInput(dummy.pos), slot, cast: true });
      if (player.metrics.casts > casts) return { shown, charged: (player.metrics.manaCast ?? 0) - before };
    }
    throw Error(`slot ${slot} never cast`);
  }
  it("reaches Flow max on cast six, prices cast seven as the kernel charges it, and names each weave", () => {
    const l = lab(), { player, state } = l.training;
    /** A legal alternate-line rotation: never the last line, a ready line first, the bolt as the filler. */
    const ready = () => [1, 2, 3, 0].find((i) => {
      const sp = spellFor(player, i, state)!;
      return sp.kind !== "passive" && sp.kind !== "target" && sp.line !== player.water.lastLine && state.tick >= (player.water.cooldowns[sp.line] ?? 0);
    });
    const next = () => {
      for (let i = 0; i < 120 && ready() === undefined; i++) stepLab(l, idleInput(l.training.dummy.pos));
      return ready()!;
    };
    let tip = idleTip();
    const flows: number[] = [], lines: string[] = [];
    for (let k = 0; k < 7; k++) {
      const before = flowMark(player.water), { shown, charged } = cast(l, next());
      expect(charged).toBe(shown.mana);
      tip = nextFlowTip(tip, before, flowMark(player.water), k);
      flows.push(player.water.flow);
      lines.push(player.water.lastLine);
      if (k === 6) {
        expect(shown.crest).toBe(true);
        expect(shown.mana).toBe(combat.flow.crest.manaCost);
        expect(shown.text).toBe(`0 MANA · x${combat.flow.crest.damageMult} CREST`);
        expect(shown.text).toContain("x1.5");
      } else expect(shown.crest).toBe(false);
      if (k >= 1 && k <= 5) expect(tip.text).toMatch(/^\w[\w ]* → \w[\w ]*$/);
      if (k === 5) expect([player.water.flow, flowTipText(tip, player.water.flow, k)]).toEqual([combat.flow.max, "FREE CREST"]);
    }
    expect(flows).toEqual([0, 1, 2, 3, 4, 5, 0]);
    expect(lines.every((line, i) => i === 0 || line !== lines[i - 1])).toBe(true);
    expect(player.water.crests).toBe(1);
  });
  it("marks the repeat slot and says Flow breaks on an immediate repeat", () => {
    const l = lab(), { player, state } = l.training;
    cast(l, 1);
    cast(l, 0);
    expect(player.water.flow).toBe(1);
    expect(slotPrice(player, spellFor(player, 0, state)!).repeat).toBe(true);
    expect(slotPrice(player, spellFor(player, 1, state)!).repeat).toBe(false);
    const before = flowMark(player.water), { shown, charged } = cast(l, 0);
    expect(charged).toBe(shown.mana);
    expect(player.water.flow).toBe(0);
    const tip = nextFlowTip(idleTip(), before, flowMark(player.water), 0);
    expect(flowTipText(tip, player.water.flow, 0)).toBe("Bolt twice: Flow breaks");
    expect(flowTipText(tip, player.water.flow, policy.flowTip.holdS + 1)).toBe(policy.flowTip.idle);
    expect(l.metrics.flowBreaks).toBe(1);
  });
});

describe("perfect gains", () => {
  function perfect(setup: (p: Actor, s: ArenaState) => void) {
    const { state, player, dummy } = createTraining("magic");
    state.tick = 1200;
    dummy.pos = { x: player.pos.x + 6, y: player.pos.y };
    player.facing = { x: 1, y: 0 };
    player.absorb = true;
    player.absorbFreshTick = state.tick;
    player.mana = 20;
    player.waveStartTick = player.lastUnlockTick = state.tick - ticks(5);
    setup(player, state);
    const tap = new FlowBeforeContact();
    tap.watch(state, player.id);
    resolveHit(state, player, { ownerId: dummy.id, activationId: state.nextId++, family: "magic", tier: 1, damage: 18, source: { ...dummy.pos } });
    const i = state.events.findIndex((e) => e.kind === "perfect" && e.actorId === player.id);
    expect(i).toBeGreaterThanOrEqual(0);
    const e = state.events[i]!;
    return perfectGain(state, player, e.value, tap.before(state, i)!, e.tick);
  }
  const interval = (s: ArenaState) => tuningFor(s).collarIntervalS;
  it("shows +0 mana at full mana and +0 Flow at max Flow", () => {
    const full = perfect((p) => { p.mana = p.maxMana; });
    expect(full.mana).toBe(0);
    expect(full.text).toContain("+0.0 MANA");
    expect(full.flow).toBe(combat.flow.perfectAbsorbGives);
    const max = perfect((p) => { p.water.flow = combat.flow.max; });
    expect(max.flow).toBe(0);
    expect(max.text).toContain("+0 FLOW");
    expect(max.mana).toBeGreaterThan(0);
    expect([full.banked, max.banked]).toEqual([false, false]);
  });
  it("calls the collar credit banked inside the minimum gap, immediate outside it", () => {
    const banked = perfect((p, s) => {
      p.waveStartTick = s.tick - ticks(interval(s) - 1);
      p.lastUnlockTick = s.tick - ticks(2);
    });
    expect(banked.collarS).toBe(combat.tierClock.perfectAbsorbAdvanceS);
    expect(banked.banked).toBe(true);
    expect(banked.text).toContain("+2.0s COLLAR BANKED");
    const open = perfect((p, s) => {
      p.waveStartTick = s.tick - ticks(5);
      p.lastUnlockTick = s.tick - ticks(10);
    });
    expect(open.banked).toBe(false);
    expect(open.text).toMatch(/\+2\.0s COLLAR$/);
    expect(perfect((p) => { p.tier = 4; }).text).not.toContain("COLLAR");
  });
});
