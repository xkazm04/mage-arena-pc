import { describe, expect, it } from "vitest";
import { createLedger, createTraining, observeLedger, stepTraining, ticks, timingBot, type Grade } from "@mage/core/arena";
import { answerMark, boutAnswerLines, labAnswerLine } from "./answers.ts";

describe("threat answer lines", () => {
  it("reads the ledger into the Lab line and the results card", () => {
    const t = createTraining("magic"), ledger = createLedger(t.state, t.player.id);
    for (let i = 0; i < ticks(14); i++) {
      stepTraining(t, timingBot(t, i < ticks(7) ? "perfect" : "late"));
      observeLedger(ledger, t.state);
    }
    const { perfect, held } = ledger.counts.magic;
    expect(perfect).toBeGreaterThan(0); expect(held).toBeGreaterThan(0);
    expect(boutAnswerLines(ledger)).toEqual([
      `Magic absorbed ${perfect + held}/${perfect + held}, perfect ${perfect}, median held +${ledger.entries.find((e) => e.answer === "held")!.lateTicks}f`,
      "Steel: none came",
      "Unblockable: none came",
    ]);
    expect(labAnswerLine(ledger)).toContain(`Magic perfect ${perfect}  held ${held}`);
    expect(labAnswerLine(ledger)).toMatch(/Ward age (\d+f:\d+ ?)+$/);
  });
});

describe("answer marks", () => {
  const base = { wardUp: true, inArc: true, guarded: true, absorbHeld: true } as const;
  it("names every miss the timeline flags and leaves clean answers unflagged", () => {
    const cases: [Grade, string, boolean][] = [
      [{ ...base, family: "magic", answer: "perfect", ageTicks: 2 }, "PERFECT", false],
      [{ ...base, family: "magic", answer: "held", ageTicks: 9, lateTicks: 4, mistake: "late" }, "HELD +4f", true],
      [{ ...base, family: "magic", answer: "wrong-facing", inArc: false, guarded: false, mistake: "behind" }, "BEHIND", true],
      [{ ...base, family: "physical", answer: "guarded", mistake: "steel" }, "STEEL", true],
      [{ ...base, family: "unblockable", answer: "took", mistake: "leave" }, "LEAVE", true],
      [{ ...base, family: "magic", answer: "took", wardUp: false, guarded: false, absorbHeld: false }, "TOOK", true],
      [{ ...base, family: "magic", answer: "cast-blocked", wardUp: false, guarded: false, mistake: "cast" }, "MID-CAST", true],
      [{ ...base, family: "physical", answer: "rolled" }, "ROLLED", false],
      [{ ...base, family: "unblockable", answer: "avoided" }, "LEFT", false],
    ];
    for (const [grade, label, miss] of cases) expect(answerMark(grade)).toMatchObject({ label, miss });
    expect(answerMark(cases[3]![0]).family).toBe("Steel");
  });
});
