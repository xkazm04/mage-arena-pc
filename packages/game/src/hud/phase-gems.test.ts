import { describe, expect, it } from "vitest";
import {
  createGames,
  presets,
  rivalRuntime,
  runtime,
  stepArena,
} from "@mage/core/arena";
import { phaseGems } from "./phase-gems.ts";

const reference = presets.find((p) => p.name === runtime.games.referencePreset)!;
const named = (wave: number) =>
  createGames(51000, reference, wave, false, undefined, undefined, undefined, {
    schoolRivals: "named",
  });

describe("phase gems", () => {
  it("is undefined with no runtime or no bound rival", () => {
    expect(phaseGems(createGames(51000, reference, 2).state)).toBeUndefined();
    expect(phaseGems(named(0).state)).toBeUndefined();
  });

  it("shows one lit gem per phase for the named rival", () => {
    const view = phaseGems(named(2).state)!;
    expect(view).toMatchObject({ rivalId: "brennic", school: "fire", nextAtHpFraction: 0.66 });
    expect(view.broken).toEqual([false, false]);
  });

  it("breaks one gem after the first phase", () => {
    const g = named(3),
      rival = g.state.actors.find((a) => a.team === 1)!;
    rival.hp = rival.maxHp * 0.6;
    stepArena(g.state);
    expect(rivalRuntime(g.state)!.phasesBroken).toBe(1);
    const view = phaseGems(g.state)!;
    expect(view.broken).toEqual([true, false]);
    expect(view.nextAtHpFraction).toBe(0.33);
  });
});
