import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { GameShell } from "../game-shell.ts";

vi.mock("../season-api.ts", () => ({ request: async () => ({}), seasonCommand: async () => ({}) }));
vi.mock("../audio.ts", () => ({ gameAudio: { play: async () => {} } }));

const { camp } = await import("./camp.ts");

const places = ["yard", "cistern", "pit", "exchange", "commons", "door", "tent", "edge"].map((id) => ({
  id, name: id.toUpperCase(), description: `The ${id}.`, isOpen: id !== "pit",
}));
/** A camp screen on a recording canvas: every ui call is logged with its arguments, buttons also by id. */
function render(skills?: object) {
  const log: string[] = [], buttons = new Map<string, { run: () => void; args: unknown[] }>();
  const record = (name: string) => (...args: unknown[]) => {
    log.push(`${name}(${JSON.stringify(args.map((a) => (typeof a === "function" ? "fn" : a)))})`);
    return undefined;
  };
  const ui = new Proxy({} as Record<string, unknown>, {
    get: (_t, name: string) => {
      if (name === "content") return { addChild: (g: { context?: { instructions?: unknown } }) => void log.push(`content.addChild(${JSON.stringify((g.context?.instructions ?? []).map((i: { action: string; data?: { path?: { shapePath?: unknown } } }) => [i.action, JSON.stringify(i.data, (k, v) => (k === "style" || k === "texture" || typeof v === "function" ? undefined : v))]))})`) };
      if (name === "button")
        return (id: string, ...args: unknown[]) => {
          record("button")(id, ...args);
          buttons.set(id, { run: args[5] as () => void, args });
        };
      return record(name);
    },
  });
  const opened: string[] = [];
  const s = {
    ui,
    selected: "yard",
    view: { season: { complete: false, ...(skills ? { skills } : {}) }, places, location: "yard", listening: false, nightFinished: false, player: { stocks: 0 } },
    campHeader: record("campHeader"),
    timeFooter: record("timeFooter"),
    camp: record("camp"),
    nav: { reset: record("nav.reset"), open: (id: string) => void opened.push(`open:${id}`), go: (id: string) => void opened.push(`go:${id}`) },
  } as unknown as GameShell;
  camp(s);
  return { log, buttons, opened };
}

describe("camp entry to the skill book (D3 8.7)", () => {
  it("with the flag off the camp render is byte-identical to main", () => {
    const { log, buttons } = render();
    const bytes = JSON.stringify(log);
    expect(buttons.has("skill-book")).toBe(false);
    expect(Buffer.byteLength(bytes)).toBe(BYTES);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(HASH);
  });
  it("with a book the camp screen has a button that opens the skills screen", () => {
    const { buttons, opened } = render({ spells: [], teachers: [] });
    const b = buttons.get("skill-book");
    expect(b).toBeDefined();
    b!.run();
    expect(opened).toEqual(["open:camp", "go:skills"]);
  });
});
/** Taken on main a5083fd, before the camp button existed. */
const BYTES = 3545, HASH = "b8ed3fd02b1e5f3fd716a89f4aa14368dc759a0a89eab6d2f99018a6f9132e95";
