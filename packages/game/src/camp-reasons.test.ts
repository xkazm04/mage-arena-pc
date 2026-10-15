import { describe, expect, it } from "vitest";
import { enterBlock, hoursNote } from "./camp-reasons.ts";
import type { SeasonView } from "./season-api.ts";

type Place = SeasonView["places"][number];
const pit = (isOpen: boolean) =>
  ({ id: "pit", name: "the Pit", openHour: 18, closeHour: 20, isOpen }) as Place;
const view = (over: Partial<Parameters<typeof enterBlock>[0]> = {}) => ({
  hour: 12,
  listening: null,
  nightFinished: false,
  player: { stocks: false },
  ...over,
});

describe("camp reasons", () => {
  it("names when a closed place opens or closed", () => {
    expect(hoursNote(pit(false), 12)).toBe("Opens 18:00");
    expect(hoursNote(pit(false), 21)).toBe("Closed at 20:00");
    expect(hoursNote(pit(true), 19)).toBe("");
    expect(enterBlock(view(), pit(false))).toBe(
      "The Pit opens at 18:00, in 6 hours.",
    );
    expect(enterBlock(view({ hour: 17 }), pit(false))).toBe(
      "The Pit opens at 18:00, in 1 hour.",
    );
    expect(enterBlock(view({ hour: 21 }), pit(false))).toBe(
      "The Pit closed at 20:00. It opens again at 18:00 tomorrow.",
    );
  });
  it("puts what holds the player before what holds the place", () => {
    expect(enterBlock(view({ player: { stocks: true } }), pit(false))).toBe(
      "The Vigil keeps you in the stocks until dawn.",
    );
    expect(enterBlock(view({ nightFinished: true }), pit(true))).toBe(
      "The night is spent. Meet the morning.",
    );
    expect(enterBlock(view(), pit(true))).toBe("");
  });
});
