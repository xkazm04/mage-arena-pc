import { describe, expect, it } from "vitest";
import parley from "../../../docs/design/reconciled/data/parley.json" with { type: "json" };
import bridge from "../../../docs/design/reconciled/data/season-bridge.json" with { type: "json" };
import schools from "../../../docs/design/reconciled/data/schools.json" with { type: "json" };
import characters from "../../../docs/design/reconciled/data/characters.json" with { type: "json" };
import labSchools from "./arena/data/lab-schools.json" with { type: "json" };
import { presets, validateComposition } from "./arena/catalog.ts";
import { overlayProblems, schoolPresets, validateLoadout } from "./arena/schools.ts";
import balance from "./arena/data/school-balance.pc.json" with { type: "json" };
import { member } from "./arena/doors.ts";
import type { Composition } from "./arena/types.ts";
import { makeTuning, tuningPresets, validateTuning } from "./arena/tuning.ts";

// Authored data passes the same doors as user and model input. Each check is paired with a
// planted-bad control, so a validator that stopped refusing cannot pass this file.
describe("authored data meets the validators that guard runtime input", () => {
  it("every Water preset is a legal composition", () => {
    for (const p of presets) expect(validateComposition(p), p.name).toEqual([]);
    const planted: Composition = { ...presets[0]!, lines: [presets[0]!.lines[0]!, presets[0]!.lines[0]!, presets[0]!.lines[1]!] };
    expect(validateComposition(planted)).not.toEqual([]);
  });
  it("every Fire/Air preset is a legal bolt + four loadout, and the PC balance overlay names only real keys", () => {
    for (const school of ["fire", "air"] as const) for (const p of schoolPresets[school]) expect(validateLoadout(p), p.name).toEqual([]);
    expect(validateLoadout({ ...schoolPresets.fire[0]!, slots: ["fire_flick", "fire_flick", "fire_kindle", "fire_ring"] })).not.toEqual([]);
    expect(overlayProblems(balance.overrides)).toEqual([]);
    expect(overlayProblems({ "fire_lance.reach": 1 })).not.toEqual([]);
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

  it("lab-schools mirrors canon: school ids, a body of that school, and the tent's name as prefix", () => {
    const problems = (profiles: Record<string, unknown>) =>
      Object.entries(profiles).filter(([key]) => key !== "scope").flatMap(([key, value]) => {
        const p = value as { body: string; prefix: string };
        const school = schools.find((s) => s.id === key), body = characters.characters.find((c) => c.id === p.body);
        return [
          !school && `unknown school ${key}`,
          body?.school !== key && `body ${p.body} is not of school ${key}`,
          school && p.prefix !== school.tent[0]!.toUpperCase() + school.tent.slice(1) && `prefix ${p.prefix} is not tent ${school.tent}`,
        ].filter(Boolean);
      });
    expect(problems(labSchools)).toEqual([]);
    expect(problems({ ...labSchools, fire: { ...labSchools.fire, body: "cassia" } })).toEqual(["body cassia is not of school fire"]);
  });

  it("the load-time door narrows a known value and refuses a drifted one by name", () => {
    expect(member("press", ["press", "brace"], "trial stance")).toBe("press");
    expect(() => member("threaten", ["reveal", "bargain"], "parley card x stance")).toThrow(/Authored parley card x stance "threaten" is not one of reveal, bargain/);
  });

  it("the trial's stances are exactly the stances its beats table ranks", () => {
    expect([...bridge.trial.stances].sort()).toEqual(Object.keys(bridge.trial.beats).sort());
    for (const s of bridge.trial.stances) expect(bridge.trial.stances).toContain(bridge.trial.beats[s as keyof typeof bridge.trial.beats]);
  });
});
