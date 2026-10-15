import { describe, expect, it } from "vitest";
import { causeOf, dawnLedger } from "./dawn-ledger.ts";

const names: Record<string, string> = { brennic: "Brennic", nysa: "Nysa" };
const nameOf = (id: string) => names[id] ?? id;

describe("dawn ledger", () => {
  it("speaks the player's own changes first, in the camp's words", () => {
    const { rows, more } = dawnLedger(
      [
        { path: "trust/brennic>cassia", before: 15, after: 19, rule: "rules/effects/BEFRIEND" },
        { path: "characters/cassia/hunger", before: 30, after: 35, rule: "rules/effects/daily" },
        { path: "characters/cassia/gold", before: 12, after: 18, rule: "rules/effects/WORK/gold" },
        { path: "characters/cassia/stocks", before: false, after: true, rule: "rules/effects/caught" },
        { path: "characters/cassia/mood", before: "calm", after: "wary", rule: "rules/effects/WATCH" },
      ],
      "cassia",
      nameOf,
    );
    expect(rows).toEqual([
      { text: "Gold +6 (now 18) · work", tone: "gain" },
      { text: "Hunger +5 (now 35) · the day's toll", tone: "loss" },
      { text: "The Vigil put you in the stocks · caught by the Vigil", tone: "loss" },
      { text: "Brennic's trust in you +4 (now 19) · befriended", tone: "gain" },
    ]);
    expect(more).toBe(0);
  });
  it("folds a mutual bond into one line and ranks bonds by how far they moved", () => {
    const { rows, more } = dawnLedger(
      [
        { path: "trust/nysa>cassia", before: -10, after: -5, rule: "rules/effects/daily/sameTentTrust" },
        { path: "trust/cassia>nysa", before: -10, after: -5, rule: "rules/effects/daily/sameTentTrust" },
        { path: "trust/brennic>cassia", before: 15, after: 24, rule: "rules/effects/BEFRIEND" },
        { path: "trust/cassia>brennic", before: 15, after: 19, rule: "rules/effects/BEFRIEND" },
      ],
      "cassia",
      nameOf,
      2,
    );
    expect(rows.map((r) => r.text)).toEqual([
      "Brennic's trust in you +9 (now 24) · befriended",
      "Nysa and you: trust +5 (now -5) · tent life",
    ]);
    expect(more).toBe(1);
  });
  it("names schemes, rumours and unknown rules plainly", () => {
    expect(causeOf("rules/schemes/steal/stores")).toBe("a steal scheme");
    expect(causeOf("rules/schemes/rumour/reactions/cowardice/trust")).toBe("a rumour");
    expect(causeOf("rules/stats/rankThresholds")).toBe("practice paid off");
    expect(causeOf("rules/factVisibility")).toBe("");
  });
});
