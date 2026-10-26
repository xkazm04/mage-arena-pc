import { describe, expect, it } from "vitest";
import { Graphics } from "pixi.js";
import {
  createLab,
  defaultLabConfig,
  labDefaultLoadout,
} from "@mage/core/arena";
import { contract, groundToScreen, makeCamera, cameraMetrics } from "../camera.ts";
import {
  identityValue,
  meterFraction,
  resourceMeter,
  type HudSchool,
} from "./school-hud.ts";
import {
  drawFeetMeter,
  feetMeterShape,
  opponentMeter,
  targetRingM,
} from "./feet-rune-meter.ts";

/** A Lab bout against a Mage AI of `school` (the player plays Water, so only the opponent carries a rune meter). */
const bout = (school: HudSchool) =>
  createLab({
    ...defaultLabConfig,
    opponent: "mage",
    opponentSchool: school,
    ...(school === "water"
      ? {}
      : { opponentBuild: { loadout: labDefaultLoadout(school) } }),
  }).training;
const camera = (width = 1920, height = 1080) =>
  makeCamera({ width, height }, { x: 16, y: 10 });

describe("the opponent's rune meter at its feet", () => {
  for (const [school, resource] of [
    ["fire", "HEAT"],
    ["air", "MOMENTUM"],
  ] as const)
    it(`a ${school} opponent wears its ${resource} with the player meter's marks`, () => {
      const t = bout(school),
        view = opponentMeter(t.dummy, t.player, t.state)!;
      // The same MeterView the player HUD draws, so the two meters read one identity.
      expect(view).toEqual(resourceMeter(t.dummy, t.state));
      expect(view.label).toBe(resource);
      expect(view.marks.map((m) => m.at)).toEqual(
        [0, 1]
          .map((i) => identityValue(school, `thresholds.${i}.at`, t.state))
          .sort((a, b) => a - b),
      );
      const shape = feetMeterShape(view, false, t.dummy.pos, camera());
      expect(shape.school).toBe(school);
      // Each mark sits where the shared fraction puts it along the arc.
      for (const [i, mark] of shape.marks.entries())
        expect(mark.at).toEqual(
          shape.point(meterFraction(view, view.marks[i]!.at)),
        );
    });

  it("a Water opponent has none (Flow keeps its panel), and the player never wears one", () => {
    const water = bout("water");
    expect(opponentMeter(water.dummy, water.player, water.state)).toBeUndefined();
    const fire = createLab({
      ...defaultLabConfig,
      playerSchool: "fire",
      playerBuild: { loadout: labDefaultLoadout("fire") },
    }).training;
    expect(resourceMeter(fire.player, fire.state)).toBeDefined();
    expect(opponentMeter(fire.player, fire.player, fire.state)).toBeUndefined();
  });

  it("follows the opponent's ground position and value from frame to frame", () => {
    const t = bout("air"),
      c = camera();
    t.dummy.schoolState!.value = 10;
    const first = feetMeterShape(
      opponentMeter(t.dummy, t.player, t.state)!,
      false,
      t.dummy.pos,
      c,
    );
    const before = groundToScreen(t.dummy.pos, c);
    t.dummy.pos = { x: t.dummy.pos.x - 2, y: t.dummy.pos.y + 1.5 };
    t.dummy.schoolState!.value = 60;
    const view = opponentMeter(t.dummy, t.player, t.state)!,
      second = feetMeterShape(view, false, t.dummy.pos, c),
      after = groundToScreen(t.dummy.pos, c);
    for (const [i, p] of first.track.entries()) {
      expect(second.track[i]!.x - p.x).toBeCloseTo(after.x - before.x);
      expect(second.track[i]!.y - p.y).toBeCloseTo(after.y - before.y);
    }
    // The fill ends at the value: further along the arc after Momentum rose from 10 to 60.
    expect(first.fill.at(-1)).toEqual(first.point(meterFraction(view, 10)));
    expect(second.fill.at(-1)).toEqual(second.point(meterFraction(view, 60)));
    expect(meterFraction(view, 60)).toBeGreaterThan(meterFraction(view, 10));
    expect(second.marks.map((m) => m.reached)).toEqual(
      view.marks.map((m) => 60 >= m.at),
    );
  });

  it("stays clear of the target ring and the 1.5x body, at 1080p, 1440p and 21:9", () => {
    const t = bout("fire"),
      view = opponentMeter(t.dummy, t.player, t.state)!,
      body = t.dummy.radius * contract.character.draw_multiplier;
    for (const [w, h] of [
      [1920, 1080],
      [2560, 1440],
      [3440, 1440],
    ] as const) {
      const c = camera(w, h),
        m = cameraMetrics(c),
        q = groundToScreen(t.dummy.pos, c),
        shape = feetMeterShape(view, true, t.dummy.pos, c),
        // Ground metres from the feet, measured on the worse (foreshortened) axis for the stroke.
        metres = (p: { x: number; y: number }) =>
          Math.hypot((p.x - q.x) / m.pxPerMetreX, (p.y - q.y) / m.pxPerMetreY);
      const clear = Math.max(targetRingM, body);
      for (const p of shape.track)
        expect(metres(p) - shape.trackWidth / 2 / m.pxPerMetreY).toBeGreaterThan(clear);
      for (const mark of shape.marks)
        expect(metres(mark.at) - mark.size / m.pxPerMetreY).toBeGreaterThan(clear);
      // In front of the feet (below them on screen), so the figure never hides it.
      for (const p of shape.track) expect(p.y).toBeGreaterThan(q.y - 1e-6);
    }
  });

  it("is gone once the bout is over: a defeated opponent draws nothing on the next frame", () => {
    const t = bout("fire"),
      c = camera(),
      g = new Graphics();
    expect(drawFeetMeter(g, t.dummy, t.player, t.state, t.dummy.pos, c)).toBeDefined();
    expect(g.context.instructions.length).toBeGreaterThan(0);
    t.dummy.tags.push("DEFEATED");
    // The scene clears its ground layer at the start of every frame.
    g.clear();
    expect(drawFeetMeter(g, t.dummy, t.player, t.state, t.dummy.pos, c)).toBeUndefined();
    expect(g.context.instructions.length).toBe(0);
  });
});
