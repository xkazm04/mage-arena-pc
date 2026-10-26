import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { GameShell } from "../game-shell.ts";
import { calendar } from "./calendar.ts";

/** A calendar screen on a recording canvas: every ui call is logged with its arguments. */
function render(day = 9) {
  const log: string[] = [], texts: string[] = [];
  const record = (name: string) => (...args: unknown[]) => {
    log.push(`${name}(${JSON.stringify(args.map((a) => (typeof a === "function" ? "fn" : a)))})`);
    if (name === "text") texts.push(String(args[0]));
    return undefined;
  };
  const ui = new Proxy({} as Record<string, unknown>, { get: (_t, name: string) => record(name) });
  const week = Math.ceil(day / 7), weekday = ((day - 1) % 7) + 1;
  const s = {
    ui,
    view: { day: { day, week, weekday, trialHour: 19, gamesHour: 20, eve: weekday === 6, games: weekday === 7 } },
    campHeader: record("campHeader"),
    timeFooter: record("timeFooter"),
  } as unknown as GameShell;
  calendar(s);
  return { log, texts };
}

describe("calendar screen render pin (D3 4.3)", () => {
  it("the reference fixture renders to the pinned bytes", () => {
    const bytes = JSON.stringify(render().log);
    expect(Buffer.byteLength(bytes)).toBe(BYTES);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(HASH);
  });
});

describe("the living calendar (D3 4.3)", () => {
  it("marks today once, and moves the mark with the day", () => {
    expect(render(9).texts.filter((t) => t === "TODAY")).toHaveLength(1);
    expect(render(14).texts.filter((t) => t === "TODAY")).toHaveLength(1);
  });
  it("marks every Games day (7, 14 ... 42) and every Trial eve (6, 13 ... 41) with its own kicker", () => {
    const { texts } = render();
    expect(texts.filter((t) => t === "GAMES")).toHaveLength(6);
    expect(texts.filter((t) => t === "TRIAL")).toHaveLength(6);
  });
  it("shows each week's level on its WEEK row, past, current and future told apart", () => {
    const { texts } = render(9);
    const rows = [1, 2, 3, 4, 5, 6].map((w) => texts.find((t) => t.startsWith(`LEVEL ${w} `)));
    expect(rows).toEqual(["LEVEL 1 · PAST", "LEVEL 2 · NOW", "LEVEL 3 · AHEAD", "LEVEL 4 · AHEAD", "LEVEL 5 · AHEAD", "LEVEL 6 · AHEAD"]);
  });
  it("keeps the existing strings", () => {
    expect(render().texts).toContain("Later weeks await the next chapter.");
  });
});
/** Fixture: day 9 (week 2). Moved from 4346 bytes, sha256 c84cc0b57d87453e6f9b8fb5c7d0c4ae7472eb08da2d1c9d0d51a8e82fba527a
 * (main 955337b) by the living calendar. */
const BYTES = 5169, HASH = "1c50ae1532c0362f7652da51255d0cfb3a610c964db7ac2f0261899464061d97";
