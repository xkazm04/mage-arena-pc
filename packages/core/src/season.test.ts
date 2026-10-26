import { describe, expect, it } from "vitest";
// index.ts first: it loads kernel.ts before fire.ts/air.ts (the schools.ts import-order trap).
import { idleInput, presets } from "./arena/index.ts";
import { applyBoutInput, boutHash, bridgeRules, createCampSession, createSeason, prepareBout, replayBout, startBout, type BoutInput, type SeasonProgress } from "./index.ts";
import { rivalProfiles, seasonRival, weekProfileProblems } from "./arena/week-profiles.ts";
import profileData from "./arena/data/progression-weeks.pc.json" with { type: "json" };
import { armExtras, armOption } from "../scripts/week-census.ts";
import { tables as t } from "../scripts/skill-census.ts";

/** A Games morning of campaign week `week` with the Trial settled the evening before, as prepareBout wants it. */
function gamesMorning(week: number, flagOn: boolean, entrantIsPlayer = true) {
  const s = createCampSession(t, 73), p: SeasonProgress = createSeason(flagOn);
  s.camp.day = week * t.season.daysPerWeek; s.hour = t.season.gamesHour;
  const entrant = entrantIsPlayer ? s.camp.player : Object.keys(s.camp.characters).find((id) => id !== s.camp.player && s.camp.characters[id]!.school === "water")!;
  p.receipts.push({ id: `trial:${week}`, day: s.camp.day - t.season.trialOffsetBeforeGames, kind: "trial", entrant, hash: "", trace: [] });
  return { s, p };
}
// The chapter plays two weeks (season-bridge weeksPlayable); the levers answer all six, so open them for the test.
const withSixWeeks = <T,>(fn: () => T): T => { const was = bridgeRules.weeksPlayable; bridgeRules.weeksPlayable = 6; try { return fn(); } finally { bridgeRules.weeksPlayable = was; } };

describe("D1 6.12: lag plus rank defence 0.05 behind the skill-book flag", () => {
  it("the data is checked at load and planted-bad controls are refused", () => {
    expect(weekProfileProblems(profileData)).toEqual([]);
    expect(seasonRival).toEqual({ profile: "lag", rankDefence: { hpPerRankStep: 0.05 } });
    const plant = (seasonRivalPatch: unknown) => weekProfileProblems({ ...structuredClone(profileData), seasonRival: seasonRivalPatch });
    expect(plant({ profile: "lag", hpPerRankStep: 0 })).toHaveLength(1);
    expect(plant({ profile: "lag", hpPerRankStep: 1.5 })).toHaveLength(1);
    expect(plant({ profile: "nope", hpPerRankStep: 0.05 })).toEqual(["progression-weeks.pc.json seasonRival: profile nope is not a rivalProfiles entry"]);
    expect(plant({ profile: "lag", hpPerRankStep: 0.05, extra: 1 })).toHaveLength(1);
    expect(plant("lag")).toEqual(["progression-weeks.pc.json: seasonRival is not an object"]);
  });

  it("a flag-on bout records the week's lag rank and rank defence, weeks 1-6, and replays them", () => withSixWeeks(() => {
    for (let week = 1; week <= 6; week++) {
      const { s, p } = gamesMorning(week, true);
      const bout = prepareBout(t, s, p, presets[2]!);
      expect(bout.opponentMage).toEqual({ averageRank: rivalProfiles.lag![week - 1] });
      expect(bout.rankDefence).toEqual({ hpPerRankStep: 0.05 });
      expect(bout.enemyLevel).toBe(week > 1 ? week : undefined);
      // The same createGames options the 6.10 lag-def1 census arm passes for that week.
      expect(bout.opponentMage).toEqual(armOption(week, "lag-def1"));
      expect(bout.rankDefence).toEqual(armExtras("lag-def1").rankDefence);
      startBout(bout);
      expect(bout.games!.opponentMage).toEqual(bout.opponentMage);
      expect(bout.games!.rankDefence).toEqual(bout.rankDefence);
      const log: BoutInput[] = [];
      for (let i = 0; i < 40; i++) { const entry: BoutInput = { type: "tick", tick: i, input: idleInput() }; applyBoutInput(bout, entry); log.push(entry); }
      const replay = replayBout(JSON.parse(JSON.stringify(bout)));
      expect(replay.opponentMage).toEqual(bout.opponentMage);
      expect(replay.rankDefence).toEqual(bout.rankDefence);
      expect(boutHash(replay)).toBe(boutHash(bout));
    }
  }));

  it("flag off and a spectator's bout carry none", () => withSixWeeks(() => {
    const on = gamesMorning(4, true), off = gamesMorning(4, false);
    const lever = prepareBout(t, on.s, on.p, presets[2]!), plain = prepareBout(t, off.s, off.p, presets[2]!);
    expect("opponentMage" in plain).toBe(false);
    expect("rankDefence" in plain).toBe(false);
    expect(JSON.stringify(plain)).not.toContain("opponentMage");
    expect(JSON.stringify(plain)).not.toContain("rankDefence");
    // A spectator watches an AI mage: no player ranks for the rival to lag behind.
    const spec = gamesMorning(4, true, false), watched = prepareBout(t, spec.s, spec.p, presets[2]!);
    expect(watched.spectator).toBe(true);
    expect("opponentMage" in watched).toBe(false);
    expect("rankDefence" in watched).toBe(false);
    startBout(lever); startBout(plain);
    expect(lever.games!.opponentMage).toBeDefined();
    expect(plain.games!.opponentMage).toBeUndefined();
    expect(plain.games!.rankDefence).toBeUndefined();
  }));
});
