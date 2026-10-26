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
/** Taken on main 955337b, before the calendar was made living. Fixture: day 9 (week 2). */
const BYTES = 4346, HASH = "c84cc0b57d87453e6f9b8fb5c7d0c4ae7472eb08da2d1c9d0d51a8e82fba527a";
