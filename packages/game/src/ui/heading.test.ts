import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { colours } from "./kit.ts";
import { drawHeading, drawKicker, headingSpec, kickerText } from "./heading.ts";
import { campHeader, scene } from "../screens/chrome.ts";
import type { GameShell } from "../game-shell.ts";

vi.mock("../ui/backdrop.ts", () => ({ backdrop: () => undefined }));
vi.mock("../ui/artwork.ts", () => ({ sigil: () => ({ destroyed: false }) }));
vi.mock("../audio.ts", () => ({ gameAudio: { setScene: () => undefined, pauseWorld: () => undefined } }));

type Call = [name: string, ...args: unknown[]];
function recorder() {
  const calls: Call[] = [];
  const ui = new Proxy({ edges: { right: 1920 } } as Record<string, unknown>, {
    get: (t, name: string) =>
      name in t ? t[name] : (...args: unknown[]) => void calls.push([name, ...args]),
  });
  return { ui, calls, texts: () => calls.filter((c) => c[0] === "text") };
}
/** A shell stub whose scene() is the real chrome scene(), so campHeader reaches it the way the game does. */
function shell(view: Record<string, unknown> = {}) {
  const r = recorder();
  const s = { ui: r.ui, view, nav: {} } as unknown as GameShell;
  s.scene = (id: string, title: string, kicker: string[], kind?: string) => scene(s, id, title, kicker, kind);
  return { s, ...r };
}
const kickerOf = (texts: Call[]) => texts[0]![1];

describe("kicker and heading module (D3 4.5)", () => {
  it("joins segments with the one separator and upper-cases them by one rule", () => {
    expect(headingSpec.separator).toBe("  /  ");
    expect(kickerText(["Paused", "Settings"])).toBe("PAUSED  /  SETTINGS");
    expect(kickerText(["Paused", "Save & load"])).toBe("PAUSED  /  SAVE & LOAD");
    expect(kickerText(["The first chapter"])).toBe("THE FIRST CHAPTER");
    expect(kickerText([])).toBe("");
  });
  it("draws the screen heading at today's pixels: kicker 24 gold, title 58, rule at 183", () => {
    const { ui, calls } = recorder();
    drawHeading(ui as never, { title: "Your hands", kicker: ["Paused", "Settings"] });
    expect(calls).toEqual([
      ["text", "PAUSED  /  SETTINGS", 96, 57, 24, colours.gold],
      ["text", "Your hands", 96, 99, 58, colours.text, 1550, true],
      ["line", 96, 183, 1728],
    ]);
  });
  it("draws the tag variant at size 16 in the school colour the caller gives", () => {
    const { ui, calls } = recorder();
    drawKicker(ui as never, ["Games"], "tag", { x: 40, y: 80, colour: colours.water });
    drawKicker(ui as never, ["Trial"], "tag", { x: 40, y: 80, colour: colours.earth });
    expect(calls).toEqual([
      ["text", "GAMES", 40, 80, 16, colours.water],
      ["text", "TRIAL", 40, 80, 16, colours.earth],
    ]);
  });
});

describe("scene() kickers come out in the spec format (D3 4.5)", () => {
  it("pause / settings", () => {
    const { s, texts } = shell();
    scene(s, "settings", "Your hands. Your magic.", ["Paused", "Settings"]);
    expect(kickerOf(texts())).toBe("PAUSED  /  SETTINGS");
  });
  it("campHeader", () => {
    const { s, texts } = shell({ slot: "day", day: { week: 2, day: 9 }, player: {}, hour: 9, hoursRemaining: 5, location: "camp" });
    campHeader(s, "camp", "Within the wards");
    expect(kickerOf(texts())).toBe("CASTRA CLAUSA  /  WEEK 2  /  DAY 9");
  });
  it("parley", () => {
    const { s, texts } = shell();
    scene(s, "parley", "Speak with Cassia", ["A knowing moment", "9:00", "5 hours remain"]);
    expect(kickerOf(texts())).toBe("A KNOWING MOMENT  /  9:00  /  5 HOURS REMAIN");
  });
});

describe("no screen hand-writes a joined kicker (D3 4.5)", () => {
  const dir = join(import.meta.dirname, "..");
  const files = [
    ...readdirSync(join(dir, "screens")).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")).map((f) => join(dir, "screens", f)),
    join(dir, "game-shell.ts"),
    join(dir, "arena-entry.ts"),
  ];
  it("finds no all-caps literal with a ' / ' in screens/*.ts, game-shell.ts or arena-entry.ts", () => {
    const hits: string[] = [];
    for (const f of files)
      readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        if (/["'`][A-Z][A-Z0-9 &:]*\s+\/\s+/.test(line)) hits.push(`${f.slice(dir.length + 1)}:${i + 1}: ${line.trim()}`);
      });
    expect(hits).toEqual([]);
  });
});
