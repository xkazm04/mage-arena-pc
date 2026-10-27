import { describe, expect, it } from "vitest";
import {
  createLab,
  defaultLabConfig,
  labDefaultLoadout,
  labSpellbook,
  paced,
  spellFor,
  ticks,
  type SlotSchool,
} from "@mage/core/arena";
import {
  balancedRow,
  heroName,
  hudSchool,
  identityValue,
  meterLayout,
  schoolSlotSpell,
  resourceMeter,
  showsRanks,
  slotCount,
  slotView,
} from "./school-hud.ts";

const lab = (school: "water" | SlotSchool, tier = 4) => {
  const l = createLab({
    ...defaultLabConfig,
    playerSchool: school,
    dummyAttack: "still",
    ...(school === "water"
      ? {}
      : { playerBuild: { loadout: labDefaultLoadout(school) } }),
  });
  l.training.player.tier = tier;
  return l.training;
};
const names = (t: ReturnType<typeof lab>, school: "water" | SlotSchool) =>
  Array.from(
    { length: slotCount(school) },
    (_, i) => slotView(t.player, i, t.state)!.name,
  );

describe("school-aware HUD", () => {
  it("Water keeps its four lines, its line cooldowns and no school meter", () => {
    const t = lab("water");
    expect(hudSchool(t.player)).toBe("water");
    expect(heroName.water).toBe("Cassia of the Tide");
    expect(names(t, "water")).toEqual(
      [0, 1, 2, 3].map((i) => spellFor(t.player, i, t.state)!.name),
    );
    expect(slotView(t.player, 0, t.state)!.icon).toBe("water");
    const lash = spellFor(t.player, 1, t.state)!;
    t.player.water.cooldowns[lash.line] = t.state.tick + ticks(1.5);
    const view = slotView(t.player, 1, t.state)!;
    expect(view.remainingS).toBeCloseTo(1.5, 1);
    expect(view.cooldownS).toBe(lash.cooldownS);
    expect(view.price).toMatch(/mana/);
    expect(resourceMeter(t.player, t.state)).toBeUndefined();
  });

  it("Fire shows the bolt + 4 loadout, Fire cooldowns and Heat marked at 50 and 80", () => {
    const t = lab("fire");
    expect(hudSchool(t.player)).toBe("fire");
    expect(slotCount("fire")).toBe(5);
    // labDefaultLoadout("fire") is the Pit-dog preset (school-presets.json).
    expect(names(t, "fire")).toEqual([
      "Ember Dart",
      "Flick Flame",
      "Cinder Step",
      "Kindle",
      "Ring of Cinders",
    ]);
    expect(names(t, "fire")).not.toContain("Rain Needle");
    expect(slotView(t.player, 1, t.state)!.icon).toBe("fire");
    t.player.schoolState!.cooldowns.fire_flick = t.state.tick + ticks(2);
    const flick = slotView(t.player, 1, t.state)!;
    expect(flick.remainingS).toBeCloseTo(2, 1);
    // Flick Flame recovers 3 s on the sheet, run at the player's own pace.
    expect(flick.cooldownS).toBe(paced(t.player, 3));
    expect(flick.cooldownS).toBeLessThan(3);
    expect(flick.price).toBe("12 mana");
    expect(flick.tooltip).toMatch(/0.15s cast/);
    // The PC overlay reaches the HUD: Ember Dart costs 2 mana here, 4 in VR's sheet.
    expect(slotView(t.player, 0, t.state)!.price).toBe("2 mana");
    t.player.schoolState!.value = 63;
    const heat = resourceMeter(t.player, t.state)!;
    expect(heat.label).toBe("HEAT");
    expect([heat.min, heat.max]).toEqual([0, 100]);
    expect(heat.marks).toEqual([
      { at: 50, name: "Kindled" },
      { at: 80, name: "Blazing" },
    ]);
    expect(heat.reached?.name).toBe("Kindled");
    // Build readout: a ranked spell reads its rank; at rank 5 a registered row carries its ultimate form.
    expect(showsRanks(t.player)).toBe(false);
    t.player.spellRanks = { fire_flick: 5, fire_cinderstep: 3 };
    expect(showsRanks(t.player)).toBe(true);
    expect(slotView(t.player, 1, t.state)).toMatchObject({
      rank: 5,
      ultimate: "Searing Hold",
    });
    expect(slotView(t.player, 2, t.state)!.rank).toBe(3);
    expect(slotView(t.player, 2, t.state)!.ultimate).toBeUndefined();
  });

  it("Air shows its loadout, dark slots before their rune, and Momentum marked at 40 and 80", () => {
    const t = lab("air", 1);
    expect(hudSchool(t.player)).toBe("air");
    expect(heroName.air).toBe("Iskar Windborn");
    const shear = slotView(t.player, 1, t.state)!,
      downdraft = slotView(t.player, 4, t.state)!;
    expect(shear.dark).toBe(false);
    expect(downdraft.dark).toBe(true);
    expect(downdraft.price).toMatch(/^Rune II/);
    t.player.tier = 4;
    expect(names(t, "air")).toEqual(
      ["air_bolt", ...labDefaultLoadout("air").slots].map(
        (id) => labSpellbook("air").find((row) => row.id === id)!.name,
      ),
    );
    expect(slotView(t.player, 4, t.state)!.dark).toBe(false);
    // The PC overlay makes Air Form quick and free; the HUD counts down the overlay's 3 s, not VR's sheet.
    expect(
      balancedRow(labSpellbook("air").find((r) => r.id === "air_form")!)
        .cooldownS,
    ).toBe(3);
    t.player.schoolState!.value = 85;
    const momentum = resourceMeter(t.player, t.state)!;
    expect(momentum.label).toBe("MOMENTUM");
    expect(momentum.marks.map((m) => m.at)).toEqual([40, 80]);
    expect(momentum.reached?.at).toBe(80);
  });
});

describe("the HUD's mirror of the school seam", () => {
  it("reads the same slot rows and identity numbers as arena/schools.ts", async () => {
    // The seam is not exported from @mage/core/arena; load it by path (kernel first: the schools.ts import-order trap).
    await import("../../../core/src/arena/kernel.ts");
    const seam = await import("../../../core/src/arena/schools.ts");
    for (const school of ["fire", "air"] as const)
      for (const tier of [0, 1, 2, 3, 4]) {
        const t = lab(school, tier);
        for (let slot = 0; slot < 5; slot++)
          expect(schoolSlotSpell(t.player, slot, t.state)).toEqual(
            seam.slotSpell(t.player, slot, t.state),
          );
        for (const path of [
          "range.0",
          "range.1",
          "thresholds.0.at",
          "thresholds.1.at",
        ])
          expect(identityValue(school, path, t.state)).toBe(
            seam.identityNumber(school, path, t.state),
          );
      }
    for (const row of [...labSpellbook("fire"), ...labSpellbook("air")])
      expect(balancedRow(row)).toEqual(seam.balancedSpell(row));
  });
});

describe("school meter text sits inside its panel", () => {
  for (const school of ["fire", "air"] as const)
    it(`${school}: label and mark clear the panel frame`, () => {
      const t = lab(school),
        view = resourceMeter(t.player, t.state)!,
        { panel, frame, lineHeight } = meterLayout;
      expect(view.marks.length).toBeGreaterThan(0);
      for (const line of [meterLayout.label, meterLayout.mark]) {
        expect(line.y).toBeGreaterThanOrEqual(frame);
        expect(line.y + line.size * lineHeight).toBeLessThanOrEqual(
          panel.h - frame,
        );
      }
    });
});
