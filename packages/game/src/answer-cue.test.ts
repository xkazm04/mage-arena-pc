import { describe, expect, it } from "vitest";
import {
  agilityPerfectWindowAddS,
  createLedger,
  createTraining,
  gradeContact,
  idleInput,
  observeLedger,
  spawnProjectile,
  stateHash,
  stepArena,
  stepTraining,
  ticks,
  timingBot,
  tuningFor,
  type Actor,
  type ArenaState,
  type Family,
  type InputFrame,
  type Telegraph,
} from "@mage/core/arena";
import { answerCues, CueWords, cuesEnabled, emphasis } from "./answer-cue.ts";
import policy from "../data/combat-feedback.json" with { type: "json" };

/** A training bout: the player at its spawn facing +x, the dummy 6 m in front of it, ward down. */
function bout() {
  const t = createTraining("magic");
  t.state.tick = 200;
  t.dummy.pos = { x: t.player.pos.x + 6, y: t.player.pos.y };
  t.player.facing = { x: 1, y: 0 };
  return t;
}
let nextActivation = 9000;
function tell(state: ArenaState, owner: Actor, player: Actor, family: Family, kind: Telegraph["kind"], inTicks: number, at = owner.pos): Telegraph {
  const t: Telegraph = { id: state.nextId++, ownerId: owner.id, activationId: nextActivation++, damage: 8, family, tier: 1, source: { ...at },
    kind, origin: { ...at }, target: { ...player.pos }, resolveTick: state.tick + inTicks, startTick: state.tick, speedMps: 0, rangeM: 12, widthM: kind === "melee" ? 70 : 1.2 };
  state.telegraphs.push(t);
  return t;
}
function wardUp(p: Actor, state: ArenaState, age = 0) {
  p.absorb = true;
  p.absorbFreshTick = state.tick - age;
  p.lastInput = { ...p.lastInput, absorb: true };
}
const holding = (p: Actor, absorb: boolean): InputFrame => ({ ...idleInput({ x: p.pos.x + p.facing.x * 5, y: p.pos.y + p.facing.y * 5 }), absorb });
/** Step the bout until the ledger grades a contact on the player: the post-hoc grade the cue predicted. */
function contact(state: ArenaState, p: Actor, absorb: boolean, id: number) {
  const l = createLedger(state, p.id);
  observeLedger(l, state);
  for (let i = 0; i < 120 && !l.entries.some((e) => e.activationId === id); i++) {
    stepArena(state, { [p.id]: holding(p, absorb) });
    observeLedger(l, state);
  }
  return l.entries.find((e) => e.activationId === id);
}
const windowTicks = (p: Actor, s: ArenaState) => ticks(tuningFor(s).absorbWindowS + agilityPerfectWindowAddS(p, s));

describe("answer cues", () => {
  it("case 1: an unblockable aimed at a raised ward says LEAVE, and the ledger grades the contact the same", () => {
    const { state, player, dummy } = bout();
    wardUp(player, state, 2);
    const t = tell(state, dummy, player, "unblockable", "lane", 10);
    const [cue, ...rest] = answerCues(state, player);
    expect(rest).toHaveLength(0);
    expect(cue).toMatchObject({ activationId: t.activationId, mistake: "leave", word: { text: "LEAVE" } });
    expect(gradeContact({ family: "unblockable", wardUp: true, inArc: true, ageTicks: 12, windowTicks: windowTicks(player, state), absorbHeld: true, castBlocked: false }).mistake).toBe("leave");
    expect(contact(state, player, true, t.activationId)).toMatchObject({ answer: cue!.answer, mistake: "leave" });
  });

  it("case 2: magic from behind a raised ward says BEHIND; facing it inside the window predicts the perfect", () => {
    const { state, player, dummy } = bout();
    wardUp(player, state, 0);
    const from = { x: player.pos.x - 3, y: player.pos.y };
    const p = spawnProjectile(state, { ownerId: dummy.id, activationId: nextActivation++, damage: 8, family: "magic", tier: 1, source: from }, from, { x: 1, y: 0 }, 24, 10);
    const [cue] = answerCues(state, player);
    expect(cue).toMatchObject({ activationId: p.activationId, answer: "wrong-facing", mistake: "behind", word: { text: "BEHIND" } });
    player.facing = { x: -1, y: 0 };
    const [facing] = answerCues(state, player);
    expect(facing!.impactTick - state.tick).toBeLessThanOrEqual(windowTicks(player, state));
    expect(facing).toMatchObject({ answer: "perfect" });
    expect(facing!.mistake).toBeUndefined();
    expect(facing!.word).toBeUndefined();
    expect(contact(state, player, true, p.activationId)).toMatchObject({ answer: "perfect" });
  });

  it("case 3: magic at a lowered ward waits, then says RAISE once the perfect window would cover the contact", () => {
    const { state, player, dummy } = bout();
    const w = windowTicks(player, state);
    const t = tell(state, dummy, player, "magic", "lane", w + 9);
    const [cue] = answerCues(state, player);
    expect(cue).toMatchObject({ activationId: t.activationId, answer: "took", phase: "wait", raiseInTicks: t.resolveTick - w - state.tick });
    expect(cue!.word).toBeUndefined();
    state.tick = t.resolveTick - w;
    const [now] = answerCues(state, player);
    expect(now).toMatchObject({ phase: "raise", word: { text: policy.answerCues.raise.text } });
    expect(now!.raiseInTicks).toBeUndefined();
  });

  it("case 4: a staff strike or lunge met with the ward held says STEEL", () => {
    const { state, player, dummy } = bout();
    wardUp(player, state, 1);
    const t = tell(state, dummy, player, "physical", "melee", 6);
    const [cue] = answerCues(state, player);
    expect(cue).toMatchObject({ activationId: t.activationId, mistake: "steel", word: { text: "STEEL" } });
    expect(contact(state, player, true, t.activationId)).toMatchObject({ answer: cue!.answer, mistake: "steel" });
  });

  it("case 5: a threat that misses, or one hidden in fog, gets no cue and no emphasis", () => {
    const { state, player, dummy } = bout();
    wardUp(player, state, 1);
    const miss = tell(state, dummy, player, "unblockable", "lane", 10);
    miss.target = { x: dummy.pos.x, y: dummy.pos.y + 8 };
    expect(answerCues(state, player)).toEqual([]);
    const hidden = tell(state, dummy, player, "unblockable", "lane", 10);
    state.zones.push({ id: state.nextId++, ownerId: dummy.id, kind: "fog", pos: { x: player.pos.x + 3, y: player.pos.y }, radiusM: 1.5, until: state.tick + 100, slowMult: 1 });
    const cues = answerCues(state, player);
    expect(cues).toEqual([]);
    expect(emphasis(cues).has(hidden.activationId)).toBe(false);
    expect(emphasis(cues).has(miss.activationId)).toBe(false);
  });

  it("case 6: three aimed threats are ordered by contact, only the first carries a word, and words keep their gap", () => {
    const { state, player, dummy } = bout();
    wardUp(player, state, 1);
    const late = tell(state, dummy, player, "unblockable", "lane", 30);
    const first = tell(state, dummy, player, "unblockable", "lane", 8);
    const mid = tell(state, dummy, player, "physical", "melee", 16);
    const cues = answerCues(state, player);
    expect(cues.map((c) => c.activationId)).toEqual([first.activationId, mid.activationId, late.activationId]);
    expect(cues.map((c) => c.word?.text)).toEqual(["LEAVE", undefined, undefined]);
    expect([...emphasis(cues)].sort()).toEqual([first.activationId, mid.activationId, late.activationId].sort());
    const words = new CueWords();
    expect(words.pick(cues, 0)?.text).toBe("LEAVE");
    expect(words.pick(cues, 0.1)?.text).toBe("LEAVE");
    const next = [{ ...cues[1]!, word: { text: "STEEL", fill: 0 } }];
    expect(words.pick(next, policy.wardWords.minGapS / 2)).toBeUndefined();
    expect(words.pick(next, policy.wardWords.minGapS)?.text).toBe("STEEL");
  });

  it("case 7: reading the cues never moves the simulation", () => {
    const t = createTraining("magic");
    for (let i = 0; i < 300; i++) {
      const before = stateHash(t.state);
      answerCues(t.state, t.player);
      expect(stateHash(t.state)).toBe(before);
      stepTraining(t, timingBot(t, "perfect"));
    }
    const twin = createTraining("magic");
    for (let i = 0; i < 300; i++) stepTraining(twin, timingBot(twin, "perfect"));
    expect(stateHash(t.state)).toBe(stateHash(twin.state));
  });

  it("case 8: cues show in Training, Roster and the Lab; the season and Tiro stay off until the owner opts in", () => {
    expect(policy.answerCues.modes).toEqual(["training", "roster", "lab"]);
    expect(["training", "roster", "lab"].map(cuesEnabled)).toEqual([true, true, true]);
    expect(["tiro", "season", "practice"].map(cuesEnabled)).toEqual([false, false, false]);
  });

  it("case 9: a contact the ledger would not grade as a ward answer (exchange window, Air Form) carries no word and no RAISE", () => {
    const { state, player, dummy } = bout();
    const w = windowTicks(player, state);
    // An exchange window the player holds against the dummy: the window takes the blow, not the ward.
    dummy.pos = { x: player.pos.x + 1.5, y: player.pos.y };
    player.exchange = { fromId: dummy.id, guardUntil: state.tick + 200, guardsLeft: 2 };
    const t = tell(state, dummy, player, "magic", "lane", w - 1);
    const [held] = answerCues(state, player);
    expect(held).toMatchObject({ activationId: t.activationId, answer: "window" });
    expect(held!.word).toBeUndefined();
    expect(held!.phase).toBeUndefined();
    // Air Form: the evade is a draw at contact, so the cue stands down rather than guess.
    delete player.exchange;
    player.schoolState = { school: "air", loadout: { school: "air", name: "t", bolt: "b", slots: ["a", "b", "c", "d"] }, value: 0, lastGainTick: 0, lockedUntil: 0, gained: false, cooldowns: {}, formUntil: state.tick + 300 };
    const [formed] = answerCues(state, player);
    expect(formed).toMatchObject({ activationId: t.activationId, answer: "evaded" });
    expect(formed!.word).toBeUndefined();
    expect(formed!.phase).toBeUndefined();
    wardUp(player, state, 1);
    tell(state, dummy, player, "physical", "melee", 2);
    expect(answerCues(state, player).every((c) => !c.word && !c.phase)).toBe(true);
  });
});
