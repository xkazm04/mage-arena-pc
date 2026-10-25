import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArenaInput } from "./input.ts";
import type { Pad } from "./ui/gamepad.ts";
import { defaultBindings, rebind, type Bindings } from "./settings/bindings.ts";

type Handler = (e: unknown) => void;
const bus = () => {
  const map = new Map<string, Handler[]>();
  return {
    addEventListener: (t: string, h: Handler) =>
      map.set(t, [...(map.get(t) ?? []), h]),
    fire: (t: string, e: unknown) => map.get(t)?.forEach((h) => h(e)),
  };
};

let win: ReturnType<typeof bus>;
let canvas: ReturnType<typeof bus>;
beforeEach(() => {
  win = bus();
  canvas = bus();
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", { ...bus(), hidden: false });
  vi.stubGlobal("navigator", { getGamepads: () => [] });
});
afterEach(() => vi.unstubAllGlobals());

const make = (count?: number, bindings?: Bindings) => {
  const input = new ArenaInput(
    canvas as unknown as HTMLCanvasElement,
    () => {
      throw new Error("camera not needed");
    },
    undefined,
    undefined,
    undefined,
    bindings && (() => bindings),
  );
  if (count !== undefined) input.slotCount = count;
  return input;
};
const key = (code: string) => {
  const e = { code, repeat: false, defaultPrevented: false, prevented: false, preventDefault() {
    e.prevented = true;
  } };
  win.fire("keydown", e);
  return e;
};
const up = (code: string) => win.fire("keyup", { code });
const wheel = (deltaY: number) =>
  canvas.fire("wheel", { deltaY, preventDefault() {} });
const pad = (...down: number[]): Pad =>
  ({
    connected: true,
    mapping: "standard",
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: down.includes(i),
      touched: down.includes(i),
      value: down.includes(i) ? 1 : 0,
    })),
  }) as unknown as Pad;
const bump = (input: ArenaInput, button: number) => {
  input.updateGamepad(pad(button));
  input.updateGamepad(pad());
};

describe("ArenaInput spell slots", () => {
  it("Digit5 selects the fifth slot when the HUD offers five", () => {
    const input = make(5);
    key("Digit5");
    expect(input.slot).toBe(4);
  });
  it("Digit5 does nothing when there are four slots", () => {
    const input = make(4);
    key("Digit2");
    key("Digit5");
    expect(input.slot).toBe(1);
  });
  it("defaults to the Water four-slot behaviour", () => {
    const input = make();
    key("Digit5");
    expect(input.slot).toBe(0);
    wheel(1);
    wheel(-1);
    wheel(-1);
    expect(input.slot).toBe(3);
  });
  it("the wheel wraps across five slots", () => {
    const input = make(5);
    wheel(-1);
    expect(input.slot).toBe(4);
    wheel(1);
    expect(input.slot).toBe(0);
  });
  it("the wheel wraps across four slots", () => {
    const input = make(4);
    wheel(-1);
    expect(input.slot).toBe(3);
    wheel(1);
    expect(input.slot).toBe(0);
  });
  it("the bumpers wrap across five slots", () => {
    const input = make(5);
    bump(input, 4);
    expect(input.slot).toBe(4);
    bump(input, 5);
    expect(input.slot).toBe(0);
  });
  it("the bumpers wrap across four slots", () => {
    const input = make(4);
    bump(input, 4);
    expect(input.slot).toBe(3);
    bump(input, 5);
    expect(input.slot).toBe(0);
  });
});

describe("ArenaInput bindings", () => {
  it("case 1: the default table gives today's frames", () => {
    const input = make(5, defaultBindings);
    const held = (code: string) => {
      key(code);
      const f = input.frame();
      up(code);
      input.frame();
      return f;
    };
    expect(held("KeyW").move).toEqual({ x: 0, y: -1 });
    expect(held("KeyS").move).toEqual({ x: 0, y: 1 });
    expect(held("KeyA").move).toEqual({ x: -1, y: 0 });
    expect(held("KeyD").move).toEqual({ x: 1, y: 0 });
    expect(held("Space").roll).toBe(true);
    expect(input.frame().roll).toBe(false);
    expect(held("ShiftLeft").sprint).toBe(true);
    expect(held("ShiftRight").sprint).toBe(true);
    expect(held("KeyF").roll || held("KeyF").sprint).toBe(false);
    for (let i = 1; i <= 5; i++) {
      key(`Digit${i}`);
      expect(input.frame().slot).toBe(i - 1);
    }
    const four = make(4, defaultBindings);
    key("Digit5");
    expect(four.slot).toBe(0);
  });
  it("case 2: a rebound roll key rolls and the old one does not", () => {
    const r = rebind(defaultBindings, "roll", "KeyF");
    if (!r.ok) throw new Error(r.reason);
    const input = make(4, r.table);
    key("KeyF");
    expect(input.frame().roll).toBe(true);
    up("KeyF");
    input.frame();
    key("Space");
    expect(input.frame().roll).toBe(false);
  });
  it("keeps the page from scrolling on today's keys and on a rebound scroll key", () => {
    make(4, defaultBindings);
    expect(key("Space").prevented).toBe(true);
    expect(key("ArrowDown").prevented).toBe(true);
    expect(key("KeyW").prevented).toBe(false);
    vi.unstubAllGlobals();
    win = bus();
    canvas = bus();
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", { ...bus(), hidden: false });
    vi.stubGlobal("navigator", { getGamepads: () => [] });
    const r = rebind(defaultBindings, "roll", "PageDown");
    if (!r.ok) throw new Error(r.reason);
    const input = make(4, r.table);
    expect(key("PageDown").prevented).toBe(true);
    expect(input.frame().roll).toBe(true);
  });
});
