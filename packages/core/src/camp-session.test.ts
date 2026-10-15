import { describe, expect, it } from "vitest";
import { playerChanges } from "./camp-session.ts";

describe("player changes", () => {
  it("keeps one entry per path from the first before to the last after", () => {
    expect(
      playerChanges(
        [
          { path: "characters/cassia/gold", before: 8, after: 12, rule: "rules/effects/WORK/gold" },
          { path: "characters/cassia/gold", before: 12, after: 10, rule: "rules/effects/PROTECT/costGold" },
          { path: "characters/cassia/fatigue", before: 1, after: 2, rule: "rules/effects/WORK/fatigue" },
          { path: "characters/cassia/fatigue", before: 2, after: 1, rule: "rules/effects/REST/fatigue" },
          { path: "characters/cassia/knowledge", before: [], after: ["f1"], rule: "rules/factVisibility" },
          { path: "characters/brennic/gold", before: 3, after: 9, rule: "rules/effects/WORK/gold" },
          { path: "trust/brennic>cassia", before: 15, after: 19, rule: "rules/effects/BEFRIEND" },
          { path: "trust/brennic>nysa", before: 0, after: 4, rule: "rules/effects/BEFRIEND" },
        ],
        "cassia",
      ),
    ).toEqual([
      { path: "characters/cassia/gold", before: 8, after: 10, rule: "" },
      { path: "trust/brennic>cassia", before: 15, after: 19, rule: "rules/effects/BEFRIEND" },
    ]);
  });
});
