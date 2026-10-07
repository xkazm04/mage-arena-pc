import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { validateArt } from "./art.ts";

describe("Covenant delivery boundary", () => {
  const manifest = JSON.parse(
    readFileSync("assets/accepted/covenant/manifest.json", "utf8"),
  );
  it("binds every copied byte to current delivery hashes, with complete cast and places", () => {
    const m = validateArt(manifest);
    expect(m.places).toHaveLength(8);
    expect(m.characters).toHaveLength(16);
    expect(m.portraits).toHaveLength(112);
    for (const entry of Object.values(m.entries)) {
      const bytes = readFileSync(`assets/accepted/covenant/${entry.file}`);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        entry.sha256,
      );
    }
  });
  it("rejects historical identities, raw sources and traversal before loading", () => {
    for (const file of [
      "a3/atlases/cassia.png",
      "../a2/portrait.png",
      "art/raw/image.png",
      "a3c/../a3/cassia.png",
    ]) {
      expect(() =>
        validateArt({
          ...manifest,
          entries: { forbidden: { file, sha256: "a".repeat(64) } },
        }),
      ).toThrow();
    }
  });
  it("rejects bad portrait crops and landmarks before creating a scene", () => {
    const badCrop = structuredClone(manifest);
    badCrop.portraits[0].rect = [1000, 620, 256, 320];
    expect(() => validateArt(badCrop)).toThrow("Invalid portrait crop");
    const badLandmark = structuredClone(manifest);
    badLandmark.places[0].anchor = [Infinity, 0.5];
    expect(() => validateArt(badLandmark)).toThrow("Invalid camp landmark");
  });
});
