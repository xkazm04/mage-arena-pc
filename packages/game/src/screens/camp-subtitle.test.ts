import { describe, expect, it } from "vitest";
import { actionSubtitle } from "./camp.ts";

describe("camp action subtitle", () => {
  it("case 6: names the contest's chance before what it gains; no odds keeps today's string", () => {
    expect(actionSubtitle({ hours: 2, gains: "discover a fact", odds: { success: 0.55, caught: null } })).toBe("2 hours · 55% · discover a fact");
    expect(actionSubtitle({ hours: 2, gains: "failure risks the stocks", odds: { success: 0.5, caught: 0.35 } })).toBe(
      "2 hours · 50% · 35% stocks · failure risks the stocks",
    );
    expect(actionSubtitle({ hours: 2, gains: "+6 mutual trust", odds: null })).toBe("2 hours · +6 mutual trust");
    expect(actionSubtitle({ hours: 1, gains: "-2 fatigue", odds: null })).toBe("1 hour · -2 fatigue");
  });
});
