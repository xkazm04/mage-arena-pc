import { describe, expect, it } from "vitest";
import {
  actions,
  conflicts,
  defaultBindings,
  hudHint,
  listenHint,
  listenKey,
  rebind,
  settingsLines,
  validBindings,
} from "./bindings.ts";
import { controlsReducer, initialControls } from "../screens/controls.ts";

const keyboardHint4 =
  "WASD move  /  Shift sprint  /  Space roll      LMB cast  /  RMB absorb  /  1-4 spells";
const padHint =
  "Left stick move  /  Right stick aim  /  RT cast  /  LT absorb  /  A roll  /  LB RB spells";

describe("binding table", () => {
  it("defaults are exactly today's codes", () => {
    expect(defaultBindings).toEqual({
      moveUp: "KeyW",
      moveDown: "KeyS",
      moveLeft: "KeyA",
      moveRight: "KeyD",
      roll: "Space",
      sprint: "ShiftLeft",
      slot1: "Digit1",
      slot2: "Digit2",
      slot3: "Digit3",
      slot4: "Digit4",
      slot5: "Digit5",
      listenHold: "Space",
    });
    expect(conflicts(defaultBindings)).toEqual([]);
  });
  it("case 3: a taken key swaps with the action that held it, leaving no duplicate", () => {
    const r = rebind(defaultBindings, "roll", "KeyW");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.swapped).toBe("moveUp");
    expect(r.table.moveUp).toBe("Space");
    expect(r.table.roll).toBe("KeyW");
    expect(conflicts(r.table)).toEqual([]);
    expect(defaultBindings.roll).toBe("Space");
  });
  it("case 4: reserved keys are refused with a reason and the table is unchanged", () => {
    const before = JSON.stringify(defaultBindings);
    for (const code of ["Escape", "Tab", "Enter", "F8", "KeyR"]) {
      const r = rebind(defaultBindings, "roll", code);
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.reason.length).toBeGreaterThan(0);
      if (code === "KeyR") expect(r.reason).toContain("Combat Feel Lab");
    }
    expect(JSON.stringify(defaultBindings)).toBe(before);
  });
  it("case 5: hints are derived from the table and the school's slot count", () => {
    expect(hudHint(defaultBindings, "keyboard", 5)).toContain("1-5 spells");
    expect(hudHint(defaultBindings, "keyboard", 4)).toBe(keyboardHint4);
    const f = rebind(defaultBindings, "roll", "KeyF");
    if (!f.ok) throw new Error(f.reason);
    expect(hudHint(f.table, "keyboard", 4)).toContain("F roll");
    expect(hudHint(defaultBindings, "gamepad", 5)).toBe(padHint);
  });
  it("default hint copy matches today's strings on the settings and listen screens", () => {
    expect(settingsLines(defaultBindings)).toEqual([
      ["MOVE", "W A S D  /  Left stick"],
      ["AIM & CAST", "Mouse + left button  /  Right stick + RT"],
      ["ABSORB", "Right button held  /  LT held"],
      ["ROLL & SPRINT", "Space + Shift  /  A + left stick press"],
      ["SPELL SLOTS", "1–5 or wheel  /  LB and RB"],
      ["MENUS", "Arrows + Enter  /  D-pad + A, B back"],
    ]);
    expect(listenHint(defaultBindings)).toEqual({
      footer: "SPACE held  Listen     A / D  Move     Release SPACE  Hide",
      cover: "A / D or 1–3 changes cover",
    });
  });
  it("case 8: the listen screen's cover keys follow the move bindings", () => {
    const r = rebind(defaultBindings, "moveLeft", "ArrowLeft");
    if (!r.ok) throw new Error(r.reason);
    expect(listenKey(r.table, "ArrowLeft", 1)).toEqual({ lane: 0 });
    expect(listenKey(r.table, "KeyA", 1)).toBeUndefined();
    expect(listenKey(r.table, "KeyD", 1)).toEqual({ lane: 2 });
    expect(listenKey(r.table, "Digit3", 0)).toEqual({ lane: 2 });
    expect(listenKey(r.table, "Space", 0)).toEqual({ hold: true });
    expect(listenKey(defaultBindings, "KeyA", 0)).toEqual({ lane: 0 });
  });
  it("rejects stored tables that repeat a code, name an unknown action or hold a non-string", () => {
    expect(validBindings({ roll: "KeyF" }).roll).toBe("KeyF");
    expect(validBindings({ roll: "KeyW" })).toEqual(defaultBindings);
    expect(validBindings({ dance: "KeyF" })).toEqual(defaultBindings);
    expect(validBindings({ roll: 7 })).toEqual(defaultBindings);
    expect(validBindings({ roll: "Escape" })).toEqual(defaultBindings);
    expect(validBindings(undefined)).toEqual(defaultBindings);
    expect(actions.length).toBe(Object.keys(defaultBindings).length);
  });
});

describe("controls screen reducer", () => {
  it("case 7: select, capture, cancel and reset", () => {
    let s = controlsReducer(initialControls(defaultBindings), {
      type: "select",
      action: "roll",
    });
    expect(s.awaiting).toBe("roll");
    s = controlsReducer(s, { type: "key", code: "KeyF" });
    expect(s.table.roll).toBe("KeyF");
    expect(s.awaiting).toBeUndefined();

    let c = controlsReducer(initialControls(defaultBindings), {
      type: "select",
      action: "roll",
    });
    c = controlsReducer(c, { type: "key", code: "Escape" });
    expect(c.awaiting).toBeUndefined();
    expect(c.table).toEqual(defaultBindings);

    expect(controlsReducer(s, { type: "reset" }).table).toEqual(defaultBindings);
  });
  it("names the swap and the refusal", () => {
    let s = controlsReducer(initialControls(defaultBindings), {
      type: "select",
      action: "roll",
    });
    s = controlsReducer(s, { type: "key", code: "KeyW" });
    expect(s.notice).toContain("Move up");
    let r = controlsReducer(initialControls(defaultBindings), {
      type: "select",
      action: "roll",
    });
    r = controlsReducer(r, { type: "key", code: "KeyR" });
    expect(r.notice).toContain("Combat Feel Lab");
    expect(r.table).toEqual(defaultBindings);
  });
});
