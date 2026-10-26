import { describe, expect, it } from "vitest";
import {
  defaultBindings,
  hudHint,
  menuHint,
  settingsLines,
} from "./bindings.ts";
import { padFamily } from "./pad-glyphs.ts";

describe("padFamily", () => {
  it("reads real Gamepad.id strings", () => {
    expect(
      padFamily(
        "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)",
      ),
    ).toBe("playstation");
    expect(
      padFamily(
        "Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)",
      ),
    ).toBe("playstation");
    expect(padFamily("054c-09cc-DualShock 4 Wireless Controller")).toBe(
      "playstation",
    );
    expect(
      padFamily(
        "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)",
      ),
    ).toBe("xbox");
    expect(padFamily("Xbox 360 Controller (XInput STANDARD GAMEPAD)")).toBe(
      "xbox",
    );
    expect(padFamily("Generic USB Gamepad (Vendor: 0079 Product: 0011)")).toBe(
      "generic",
    );
    expect(padFamily("")).toBe("generic");
  });
});

const xboxPad =
  "Left stick move  /  Right stick aim  /  RT cast  /  LT absorb  /  A roll  /  LB RB spells";
describe("per-family pad copy", () => {
  it("hudHint names PlayStation buttons and keeps Xbox and keyboard copy", () => {
    expect(hudHint(defaultBindings, "gamepad", 5, "playstation")).toBe(
      "Left stick move  /  Right stick aim  /  R2 cast  /  L2 absorb  /  Cross roll  /  L1 R1 spells",
    );
    expect(hudHint(defaultBindings, "gamepad", 5, "xbox")).toBe(xboxPad);
    expect(hudHint(defaultBindings, "gamepad", 5, "generic")).toBe(xboxPad);
    expect(hudHint(defaultBindings, "gamepad", 5)).toBe(xboxPad);
    expect(hudHint(defaultBindings, "keyboard", 5, "playstation")).toBe(
      hudHint(defaultBindings, "keyboard", 5),
    );
  });
  it("menuHint names PlayStation buttons and keeps Xbox and keyboard copy", () => {
    expect(menuHint("gamepad", "playstation")).toBe(
      "D-PAD  Navigate     CROSS  Choose     CIRCLE  Back",
    );
    expect(menuHint("gamepad", "xbox")).toBe(
      "D-PAD  Navigate     A  Choose     B  Back",
    );
    expect(menuHint("gamepad")).toBe(
      "D-PAD  Navigate     A  Choose     B  Back",
    );
    expect(menuHint("keyboard", "playstation")).toBe(
      "ARROWS / TAB  Navigate     ENTER  Choose     ESC  Back",
    );
  });
  it("settingsLines names PlayStation buttons and keeps Xbox copy", () => {
    const ps = settingsLines(defaultBindings, "playstation");
    expect(ps).toEqual([
      ["MOVE", "W A S D  /  Left stick"],
      ["AIM & CAST", "Mouse + left button  /  Right stick + R2"],
      ["ABSORB", "Right button held  /  L2 held"],
      ["ROLL & SPRINT", "Space + Shift  /  Cross + left stick press"],
      ["SPELL SLOTS", "1–5 or wheel  /  L1 and R1"],
      ["MENUS", "Arrows + Enter  /  D-pad + Cross, Circle back"],
    ]);
    expect(settingsLines(defaultBindings, "xbox")).toEqual(
      settingsLines(defaultBindings),
    );
  });
});
