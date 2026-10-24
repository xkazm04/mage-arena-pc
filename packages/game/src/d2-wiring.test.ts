import { describe, it, expect } from "vitest";
import { ArtFixture, barScene } from "./art-fixture.ts";
import { bodyIdentity } from "./body-policy.ts";
import { schoolEffectSigil, veeringArcSigil } from "./sigil-contract.ts";
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

describe("art fixture 'bar': the D2 section 7 scene without new assets", () => {
  const centre = { x: 30, y: 20 };
  const count = (xs: string[]) =>
    xs.reduce<Record<string, number>>(
      (n, k) => ({ ...n, [k]: (n[k] ?? 0) + 1 }),
      {},
    );
  it("pins its composition by kind", () => {
    const f = new ArtFixture("bar", centre);
    f.update(1 / 60);
    expect(f.state.actors.map((a) => bodyIdentity(a))).toEqual([
      ...barScene.bodies,
    ]);
    expect(barScene.bodies).toHaveLength(8);
    expect(barScene.bodies[0]).toBe("cassia");
    expect(count((f.state.schoolEffects ?? []).map((e) => e.kind))).toEqual({
      beam: 2,
      trail: 2,
      detonation: 2,
    });
    expect(f.state.projectiles).toHaveLength(24);
    expect(f.state.projectiles.filter((p) => p.arc)).toHaveLength(1);
    expect(new Set(f.elements.values())).toEqual(
      new Set(["water", "fire", "earth", "air"]),
    );
  });
  it("gives the sigil player two discs, four strips and one arc to draw", () => {
    const f = new ArtFixture("bar", centre);
    for (let i = 0; i < 30; i++) f.update(1 / 60);
    const shapes = [
      ...(f.state.schoolEffects ?? []).map(
        (e) => schoolEffectSigil(e, f.state.tick)?.shape.shape,
      ),
      ...f.state.projectiles.map((p) => veeringArcSigil(p)?.shape.shape),
    ].filter((s): s is "disc" | "beam" | "arc" => !!s);
    expect(count(shapes)).toEqual({ disc: 2, beam: 4, arc: 1 });
  });
  it("leaves the stress scene as it was (12 bodies, 100 projectiles, no school effects)", () => {
    const f = new ArtFixture("stress", centre);
    f.update(1 / 60);
    expect(f.state.actors).toHaveLength(12);
    expect(f.state.projectiles).toHaveLength(100);
    expect(f.state.schoolEffects ?? []).toHaveLength(0);
  });
});
