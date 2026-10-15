import { describe, expect, it } from "vitest";
import { mentions, shortName } from "./cast-names.ts";

describe("cast names", () => {
  it("drops camp titles before taking the first name", () => {
    expect(shortName("Brennic the Red")).toBe("Brennic");
    expect(shortName("Elder Sadruba")).toBe("Sadruba");
    expect(shortName("Lanista Aulus Venno")).toBe("Aulus");
    expect(shortName("Corvo")).toBe("Corvo");
  });
  it("does not file one Elder's deeds under every Elder", () => {
    const fact = "Elder Ophel was seen at the cistern after dark.";
    expect(mentions(fact, "Elder Ophel")).toBe(true);
    expect(mentions(fact, "Elder Sadruba")).toBe(false);
    expect(mentions("Lio shared a loaf with Nysa.", "Lio")).toBe(true);
    expect(mentions("Lions do not live here.", "Lio")).toBe(false);
  });
});
