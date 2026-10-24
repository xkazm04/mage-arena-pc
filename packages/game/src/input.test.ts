import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArenaInput } from "./input.ts";
import type { Pad } from "./ui/gamepad.ts";

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

const make = (count?: number) => {
  const input = new ArenaInput(
    canvas as unknown as HTMLCanvasElement,
    () => {
      throw new Error("camera not needed");
    },
  );
  if (count !== undefined) input.slotCount = count;
  return input;
};
const key = (code: string) =>
  win.fire("keydown", { code, repeat: false, defaultPrevented: false, preventDefault() {} });
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
