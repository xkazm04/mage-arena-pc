import { describe, expect, it } from "vitest";
import { buttonLook, wheelPager } from "./hover.ts";

const b = (kind: string, disabled = false) => ({ id: "x", kind, disabled });
describe("hover states", () => {
  it("every button kind shows the kit's hover region under the cursor", () => {
    expect(buttonLook(b("button"), undefined, "x").region).toBe("button.hover");
    expect(buttonLook(b("tab"), undefined, "x").region).toBe("tab.hover");
    expect(buttonLook(b("slot"), undefined, "x").region).toBe("slot.hover");
    expect(buttonLook(b("button"), undefined, "y").region).toBe("button.normal");
  });
  it("a hovered card, which the kit has no hover region for, is outlined; at rest it is not", () => {
    for (const kind of ["card.normal", "card.warning"]) {
      expect(buttonLook(b(kind), undefined, "x")).toEqual({ region: kind, outline: true });
      expect(buttonLook(b(kind), undefined, "")).toEqual({ region: kind, outline: false });
    }
  });
  it("disabled beats pressed beats hover", () => {
    expect(buttonLook(b("button", true), "x", "x").region).toBe("button.disabled");
    expect(buttonLook(b("slot", true), undefined, "x").region).toBe("slot.locked");
    expect(buttonLook(b("button"), "x", "x").region).toBe("button.pressed");
    expect(buttonLook(b("tab"), "x", "x").region).toBe("tab.hover");
    expect(buttonLook(b("card.normal", true), undefined, "x").outline).toBe(false);
  });
});

describe("wheel paging", () => {
  const pager = (nextOff = false, prevOff = false) => [
    { id: "cards-previous", disabled: prevOff }, { id: "cards-next", disabled: nextOff }, { id: "back", disabled: false },
  ];
  it("down turns to the next page, up to the previous", () => {
    expect(wheelPager(pager(), 100)).toBe("cards-next");
    expect(wheelPager(pager(), -100)).toBe("cards-previous");
  });
  it("does nothing at either end, with no pager, or on a zero delta", () => {
    expect(wheelPager(pager(true), 1)).toBeUndefined();
    expect(wheelPager(pager(false, true), -1)).toBeUndefined();
    expect(wheelPager([{ id: "back", disabled: false }], 1)).toBeUndefined();
    expect(wheelPager(pager(), 0)).toBeUndefined();
    expect(wheelPager([{ id: "load-previous", disabled: false }], -1)).toBeUndefined();
  });
});
