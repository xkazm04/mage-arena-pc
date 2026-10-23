import { describe, expect, it } from "vitest";
import parley from "../../../docs/design/reconciled/data/parley.json" with { type: "json" };
import bridge from "../../../docs/design/reconciled/data/season-bridge.json" with { type: "json" };
import schools from "../../../docs/design/reconciled/data/schools.json" with { type: "json" };
import characters from "../../../docs/design/reconciled/data/characters.json" with { type: "json" };
import labSchools from "./arena/data/lab-schools.json" with { type: "json" };
import { presets, validateComposition } from "./arena/catalog.ts";
import { overlayProblems, schoolPresets, validateLoadout } from "./arena/schools.ts";
import balance from "./arena/data/school-balance.pc.json" with { type: "json" };
import rivalData from "./arena/data/rivals.json" with { type: "json" };
import { rivalProblems } from "./arena/rival-phases.ts";
import progressionData from "./arena/data/progression.pc.json" with { type: "json" };
import season from "../../../docs/design/reconciled/data/season.json" with { type: "json" };
import { progressionProblems } from "./arena/progression.ts";
import { readFileSync } from "node:fs";
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

  it("the named-rival phases bind a real wave and school, fall in HP order and open with a spell of the rival's school", () => {
    expect(rivalProblems(rivalData)).toEqual([]);
    const brennic = rivalData.rivals.brennic;
    const plant = (patch: Record<string, unknown>) => rivalProblems({ ...rivalData, rivals: { ...rivalData.rivals, brennic: { ...brennic, ...patch } } });
    expect(plant({ phases: [brennic.phases[0], { ...brennic.phases[1], opensWith: "air_tempest" }] })).toEqual(["rivals.json brennic phase 1: opensWith air_tempest is not one of the fire spells"]);
    expect(plant({ phases: [brennic.phases[1], brennic.phases[0]] })).toEqual(["rivals.json brennic phase 1: atHpFraction 0.66 is not in (0, 0.33)"]);
    expect(plant({ school: "air" })).toEqual(["rivals.json brennic: the named bracket spawns fire on wave 2, not air", "rivals.json brennic phase 1: opensWith fire_sunfall is not one of the air spells"]);
    expect(plant({ wave: 1 })).toEqual(["rivals.json brennic: wave 1 is not a Tiro mage wave"]);
    expect(plant({ surgeTiers: 4 })).toEqual(["rivals.json brennic: surgeTiers 4 is not an integer 0..3"]);
    expect(plant({ phase: [] })).toEqual(["rivals.json brennic: unknown key phase"]);
    expect(plant({ maxHp: 125 })).toEqual([]);
    expect(plant({ maxHp: 0 })).toEqual(["rivals.json brennic: maxHp 0 is not a positive number"]);
  });

  it("the PC progression file (agility, spell ranks, enemy levels) passes its load door; planted-bad controls are refused", () => {
    expect(progressionProblems(progressionData)).toEqual([]);
    // Agility trains on the same points curve as the other arena stats (stats.csv, read here rather than copied).
    const stats = readFileSync(new URL("../../../docs/design/reconciled/data/arena/stats.csv", import.meta.url), "utf8").replace(/\r\n/g, "\n");
    const vigor = stats.split("\n").find((line) => line.startsWith("vigor,"))!.split(",")[2]!;
    expect(progressionData.agility.pointsForRank.join(";")).toBe(vigor);
    // One enemy level per campaign week.
    expect(progressionData.enemyLevels.hpMult).toHaveLength(season.weeks);
    const plant = (patch: (d: typeof progressionData) => unknown) => progressionProblems(patch(structuredClone(progressionData)));
    expect(plant((d) => ({ ...d, extra: 1 }))).toEqual(["progression.pc.json: unknown key extra"]);
    expect(plant((d) => ({ ...d, agility: { ...d.agility, castMultPerRank: 0.04 } }))).toEqual(["agility.castMultPerRank 0.04 must be <= 0 and keep rank 5 above 0"]);
    expect(plant((d) => ({ ...d, agility: { ...d.agility, drainMultPerRank: -0.3 } }))).toEqual(["agility.drainMultPerRank -0.3 must be <= 0 and keep rank 5 above 0"]);
    expect(plant((d) => ({ ...d, agility: { ...d.agility, perfectWindowAddSPerRank: -0.01 } }))).toEqual(["agility.perfectWindowAddSPerRank -0.01 must be >= 0"]);
    expect(plant((d) => ({ ...d, agility: { ...d.agility, pointsForRank: [0, 6, 14, 24] } }))).toEqual(["agility.pointsForRank must be 5 rising integers from 0"]);
    expect(plant((d) => ({ ...d, agility: { ...d.agility, speedMult: 1 } }))).toEqual(["agility: unknown key speedMult"]);
    expect(plant((d) => ({ ...d, spellRanks: { ...d.spellRanks, power: [1.1, 1.2, 1.3, 1.4] } }))).toEqual(["spellRanks.power must be 4 non-falling multipliers starting at 1"]);
    expect(plant((d) => ({ ...d, spellRanks: { ...d.spellRanks, power: [1, 1.2, 1.1, 1.3] } }))).toEqual(["spellRanks.power must be 4 non-falling multipliers starting at 1"]);
    expect(plant((d) => ({ ...d, spellRanks: { ...d.spellRanks, maxRank: 6 } }))).toContain("spellRanks.maxRank 6 must be 5 (ranks 1-4 power, rank 5 the ultimate form)");
    expect(plant((d) => ({ ...d, spellRanks: { ...d.spellRanks, ultimates: { fire_lancer: { summary: "x" } } } }))).toEqual(["spellRanks.ultimates: fire_lancer is not a Fire/Air spell id"]);
    expect(plant((d) => ({ ...d, spellRanks: { ...d.spellRanks, ultimates: { fire_lance: { summary: "x", damage: 9 } } } }))).toEqual(["spellRanks.ultimates.fire_lance: unknown key damage"]);
    expect(plant((d) => ({ ...d, spellRanks: { ...d.spellRanks, ultimates: { fire_lance: { summary: "x" } } } }))).toEqual([]);
    expect(plant((d) => ({ ...d, enemyLevels: { hpMult: [1.1, 1.2] } }))).toEqual(["enemyLevels.hpMult must start at 1 and never fall"]);
    expect(plant((d) => ({ ...d, enemyLevels: { hpMult: [1, 1.2, 1.1] } }))).toEqual(["enemyLevels.hpMult must start at 1 and never fall"]);
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
