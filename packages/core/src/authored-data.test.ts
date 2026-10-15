import { describe, expect, it } from "vitest";
import parley from "../../../docs/design/reconciled/data/parley.json" with { type: "json" };
import bridge from "../../../docs/design/reconciled/data/season-bridge.json" with { type: "json" };
import { presets, validateComposition, type Composition } from "./arena/catalog.ts";
import { makeTuning, tuningPresets, validateTuning } from "./arena/tuning.ts";

// Authored data passes the same doors as user and model input. Each check is paired with a
// planted-bad control, so a validator that stopped refusing cannot pass this file.
describe("authored data meets the validators that guard runtime input", () => {
  it("every Water preset is a legal composition", () => {
    for (const p of presets) expect(validateComposition(p), p.name).toEqual([]);
    const planted: Composition = { ...presets[0]!, lines: [presets[0]!.lines[0]!, presets[0]!.lines[0]!, presets[0]!.lines[1]!] };
    expect(validateComposition(planted)).not.toEqual([]);
  });

  it("every tuning preset passes validateTuning", () => {
    for (const name of tuningPresets) expect(() => validateTuning(makeTuning(name)), name).not.toThrow();
    expect(() => validateTuning({ ...makeTuning("Current"), hitFlashS: 99 })).toThrow();
  });

  it("every authored parley card uses a stance and effect the proposal door accepts", () => {
    const problem = (c: { stance: string; effect: string }) =>
      !parley.stances.includes(c.stance) || !parley.effects.includes(c.effect);
    for (const card of parley.cards) expect(problem(card), card.id).toBe(false);
    expect(problem({ stance: "threaten", effect: parley.effects[0]! })).toBe(true);
  });

  it("the trial's stances are exactly the stances its beats table ranks", () => {
    expect([...bridge.trial.stances].sort()).toEqual(Object.keys(bridge.trial.beats).sort());
    for (const s of bridge.trial.stances) expect(bridge.trial.stances).toContain(bridge.trial.beats[s as keyof typeof bridge.trial.beats]);
  });
});
