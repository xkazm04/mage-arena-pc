import { describe, expect, it } from "vitest";
import { pinTexts } from "./pin-texts.ts";

describe("pinTexts", () => {
  it("masks the hours-left chip so 7h and 6h pin the same", () => {
    const at = (text: string) => [{ text, x: 239, y: 949 }];
    expect(pinTexts(at("7h"))).toEqual(pinTexts(at("6h")));
    expect(pinTexts(at("7h"))[0]).toEqual({ text: "Nh", x: 239, y: 949 });
  });
  it("leaves other texts, including +2/+9 chips and prose with an h, alone", () => {
    const texts = [
      { text: "+2" },
      { text: "4 waking hours remain" },
      { text: "the Door" },
      { text: "18:00  /  Dusk" },
    ];
    expect(pinTexts(texts)).toEqual(texts);
  });
});
