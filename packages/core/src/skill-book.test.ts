import { describe, expect, it } from "vitest";
// index.ts first: it loads kernel.ts before fire.ts/air.ts (the schools.ts import-order trap).
import { createGames, presets, stateHash, stepGames } from "./arena/index.ts";
import data from "./arena/data/skill-book.pc.json" with { type: "json" };
import { actCamp, createCampSession, decision, moveCamp, passSlot } from "./index.ts";
import {
  boutSpellRanks, buyRank, buyRankProblem, createSkillBook, earnSkillPoints, knownSpells, learnSignature, lessonProblem,
  nextRankCost, rankTier, schoolRankKeys, skillBookOn, skillBookProblems, teacherOf, type SkillBook,
} from "./skill-book.ts";
import { tables as t } from "../scripts/skill-census.ts";

const rich = (points: number): SkillBook => ({ ...createSkillBook(), points, earned: points });

describe("skill book (D1 4.3, owner ruling 2026-10-24)", () => {
  it("the file passes its load door; planted-bad controls are refused", () => {
    expect(skillBookProblems(data)).toEqual([]);
    const plant = (patch: (d: typeof data) => unknown) => skillBookProblems(patch(structuredClone(data)));
    expect(plant((d) => ({ ...d, extra: 1 }))).toEqual(["skill-book.pc.json: unknown key extra"]);
    expect(plant((d) => ({ ...d, award: { ...d.award, DANCE: 1 } }))).toEqual(["award: unknown key DANCE"]);
    expect(plant((d) => ({ ...d, award: { ...d.award, TRAIN: -1 } }))).toEqual(["award.TRAIN -1 must be a whole number >= 0"]);
    expect(plant((d) => ({ ...d, weekScale: [1, 2, 1, 4, 5, 5] }))).toEqual(["weekScale must be 6 whole multipliers >= 1, never falling"]);
    expect(plant((d) => ({ ...d, weekScale: [1, 2, 4] }))).toEqual(["weekScale must be 6 whole multipliers >= 1, never falling"]);
    // Each rank and each tier costs more (the owner's words), so a flat row or a flat column is refused.
    expect(plant((d) => ({ ...d, rankCost: d.rankCost.map((row, i) => (i === 0 ? [20, 20, 24, 26] : row)) }))).toEqual(["rankCost[0][1] 20 must rise with the rank"]);
    expect(plant((d) => ({ ...d, rankCost: d.rankCost.map((row, i) => (i === 1 ? d.rankCost[0] : row)) }))).toEqual([0, 1, 2, 3].map((i) => `rankCost[1][${i}] ${d0(i)} must rise with the tier`));
    expect(plant((d) => ({ ...d, rankCost: d.rankCost.slice(1) }))).toEqual(["rankCost must be 5 tiers x 4 rank steps of whole numbers >= 1"]);
    expect(plant((d) => ({ ...d, teaching: { ...d.teaching, signatures: { fire: "air_tempest" } } }))).toEqual(["teaching.signatures.fire: air_tempest is not a fire spell"]);
    expect(plant((d) => ({ ...d, teaching: { ...d.teaching, signatures: { mud: "fire_sunfall" } } }))).toEqual(["teaching.signatures: mud is not a school"]);
  });

  it("the PC flag is off by default, and while off nothing earns, nothing is taught and a bout carries no ranks", () => {
    expect(data.enabled).toBe(false);
    expect(skillBookOn).toBe(false);
    const book = createSkillBook();
    expect(earnSkillPoints(book, "TRAIN", 3)).toBe(book);
    expect(boutSpellRanks(buyRank(rich(100), "bolt:0", "water"))).toBeUndefined();
    const s = createCampSession(t, 73);
    expect(lessonProblem(t, s, book, "kesh")).toBe("No one teaches spells yet.");
    // A bout started with what the book gives while off is today's bout, hash for hash.
    const run = (spellRanks?: Record<string, number>) => {
      const g = createGames(40000, presets[0]!, 0, true, undefined, undefined, undefined, spellRanks ? { spellRanks } : {});
      for (let i = 0; i < 600; i++) stepGames(g);
      return stateHash(g.state);
    };
    expect(run(boutSpellRanks(rich(100)))).toBe(run());
  });

  it("training and non-combat activities earn points, training most, scaled by the week", () => {
    expect(earnSkillPoints(createSkillBook(), "TRAIN", 1, true)).toEqual({ points: 2, earned: 2, ranks: {}, taught: [] });
    expect(earnSkillPoints(createSkillBook(), "TRAIN", 3, true).points).toBe(2 * data.weekScale[2]!);
    expect(earnSkillPoints(createSkillBook(), "BEFRIEND", 1, true).points).toBe(1);
    expect(earnSkillPoints(createSkillBook(), "REST", 6, true).points).toBe(0);
    expect(Math.max(...Object.values(data.award))).toBe(data.award.TRAIN);
    expect(() => earnSkillPoints(createSkillBook(), "DANCE", 1, true)).toThrow("Unknown camp activity DANCE.");
    expect(() => earnSkillPoints(createSkillBook(), "TRAIN", 7, true)).toThrow("Week 7 is not a campaign week.");
  });

  it("points buy the next rank of any known spell, at a cost from the rank x tier table", () => {
    expect(rankTier("bolt:0")).toBe(0);
    expect(rankTier("mire:3")).toBe(3);
    expect(rankTier("fire_sunfall")).toBe(4);
    let book = rich(1000);
    expect(nextRankCost(book, "bolt:0")).toBe(data.rankCost[0]![0]);
    expect(nextRankCost(book, "lash:4")).toBe(data.rankCost[4]![0]);
    for (let rank = 1; rank < 5; rank++) {
      const cost = nextRankCost(book, "lash:2")!;
      expect(cost).toBe(data.rankCost[2]![rank - 1]);
      const before = book.points;
      book = buyRank(book, "lash:2", "water");
      expect(book.ranks["lash:2"]).toBe(rank + 1);
      expect(before - book.points).toBe(cost);
    }
    expect(nextRankCost(book, "lash:2")).toBeNull();
    expect(buyRankProblem(book, "lash:2", "water")).toBe("That spell is at its top rank.");
    expect(buyRankProblem(rich(1), "bolt:0", "water")).toBe("Not enough skill points.");
    // Any Water row is known to a Water player; a Fire row is not, until it is taught.
    expect(knownSpells(createSkillBook(), "water")).toEqual(schoolRankKeys("water"));
    expect(buyRankProblem(rich(1000), "fire_sunfall", "water")).toBe("You do not know that spell.");
    expect(buyRankProblem({ ...rich(1000), taught: ["fire_sunfall"] }, "fire_sunfall", "water")).toBeNull();
    // Bought ranks ride into a bout through createGames' existing spellRanks option.
    const ranks = boutSpellRanks(book, true)!;
    const g = createGames(40000, presets[0]!, 0, true, undefined, undefined, undefined, { spellRanks: ranks });
    expect(g.player.spellRanks).toEqual({ "lash:2": 5 });
  });

  it("an elder teaches their school's signature only when their camp trust in the player passes the check", () => {
    expect(teacherOf(t, "fire")).toEqual({ teacher: "sadruba", signature: "fire_sunfall" });
    expect(teacherOf(t, "air")).toEqual({ teacher: "kesh", signature: "air_tempest" });
    expect(teacherOf(t, "water")).toBeUndefined();
    expect(teacherOf(t, "earth")).toBeUndefined();
    // Kesh keeps the commons at dusk. Befriending there (the camp's own trust, 'kesh>cassia') is what opens the lesson.
    let s = passSlot(createCampSession(t, 73));
    s = moveCamp(t, s, "commons");
    const book = createSkillBook();
    expect(lessonProblem(t, s, book, "ophel", true)).toBe("They have no signature to teach.");
    expect(lessonProblem(t, s, book, "sadruba", true)).toBe("They are not here.");
    const key = "kesh>cassia", need = data.teaching.trustAtLeast;
    s.camp.trust[key] = need - 1;
    expect(lessonProblem(t, s, book, "kesh", true)).toBe("They do not trust you enough to teach you.");
    const befriended = actCamp(t, s, decision(t, s.camp, "cassia", "BEFRIEND", { target: "kesh" }));
    expect(befriended.camp.trust[key]).toBeGreaterThanOrEqual(need);
    // The lesson is taken at the same moment, before the hours pass, so presence is unchanged.
    const atDusk = { ...s, camp: befriended.camp };
    expect(lessonProblem(t, atDusk, book, "kesh", true)).toBeNull();
    const taught = learnSignature(t, atDusk, book, "kesh", true);
    expect(taught.taught).toEqual(["air_tempest"]);
    expect(knownSpells(taught, "water")).toContain("air_tempest");
    expect(lessonProblem(t, atDusk, taught, "kesh", true)).toBe("You already know their signature.");
  });
});
const d0 = (i: number): number => data.rankCost[0]![i]!;
