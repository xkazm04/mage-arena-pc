import { describe, expect, it } from "vitest";
import { createLedger, createTraining, observeLedger, stepTraining, ticks, timingBot } from "@mage/core/arena";
import { boutAnswerLines, labAnswerLine } from "./answers.ts";

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
