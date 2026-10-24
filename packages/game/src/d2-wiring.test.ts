import { describe, it, expect } from "vitest";
import {
  keyLightAt,
  lightInQuad,
  litBodyChoice,
  normalMaps,
  pickLightingTier,
} from "./lighting/tier.ts";

describe("lit-body quality tier (D2 step 3)", () => {
  const ready = {
    tier: "lit" as const,
    page: "cassia",
    normalReady: true,
    flashing: false,
    anotherLit: false,
  };
  it("defaults to the lit tier and falls back to the painted sprite on ?lighting=unlit", () => {
    expect(pickLightingTier("")).toBe("lit");
    expect(pickLightingTier("?harness=1&lighting=lit")).toBe("lit");
    expect(pickLightingTier("?harness=1&lighting=unlit")).toBe("unlit");
    expect(litBodyChoice(ready)).toBe("lit");
    expect(litBodyChoice({ ...ready, tier: "unlit" })).toBe("tier-unlit");
  });
  it("lights only the cassia page, one body, once its normal map is in, and not mid-flash", () => {
    expect(Object.keys(normalMaps)).toEqual(["cassia"]);
    expect(litBodyChoice({ ...ready, page: "brennic" })).toBe("no-normal-map");
    expect(litBodyChoice({ ...ready, page: undefined })).toBe("no-normal-map");
    expect(litBodyChoice({ ...ready, normalReady: false })).toBe(
      "normal-map-loading",
    );
    expect(litBodyChoice({ ...ready, flashing: true })).toBe("flashing");
    expect(litBodyChoice({ ...ready, anotherLit: true })).toBe(
      "another-body-lit",
    );
  });
  it("maps the scene light into the quad's page pixels, mirrored with the body", () => {
    const light = keyLightAt({ x: 100, y: 200 }, 30, 24);
    expect(light.x).toBeLessThan(100);
    expect(light.y).toBeLessThan(200);
    // A 384 x 384 frame drawn at 64 px, top-left at (68, 136).
    const size: [number, number] = [384, 384],
      quad = { a: 64, b: 0, c: 0, d: 64, tx: 68, ty: 136 };
    const q = lightInQuad(quad, size, light);
    expect(q.x).toBeCloseTo(((light.x - 68) / 64) * 384);
    expect(q.y).toBeCloseTo(((light.y - 136) / 64) * 384);
    expect(q.z).toBeCloseTo(light.z * 6);
    expect(q.radius).toBeCloseTo(light.radius * 6);
    const mirrored = lightInQuad({ ...quad, a: -64, tx: 68 + 64 }, size, light);
    expect(mirrored.x).toBeCloseTo(384 - q.x);
    expect(mirrored.y).toBeCloseTo(q.y);
  });
});
