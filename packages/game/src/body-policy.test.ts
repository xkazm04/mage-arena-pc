import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  createGames,
  createLab,
  createTraining,
  defaultLabConfig,
  presets,
  runtime,
} from "@mage/core/arena";
import {
  createCampSession,
  createSeason,
  prepareBout,
  startBout,
} from "@mage/core";
import { loadTables } from "@mage/director";
import { bodyIdentity } from "./body-policy.ts";
import type { BodyManifest } from "./animation-contract.ts";

const painted = new Set(
  Object.keys(
    (
      JSON.parse(
        readFileSync(
          "assets/accepted/covenant/a14/packed/characters.json",
          "utf8",
        ),
      ) as BodyManifest
    ).entities,
  ),
);
const reference = presets.find(
  (p) => p.name === runtime.games.referencePreset,
)!;
describe("body identity", () => {
  it("paints every Tiro semifinal and final mage, never the procedural figure", () => {
    for (const wave of [2, 3]) {
      const g = createGames(7, reference, wave);
      const mages = g.state.actors.filter(
        (a) => a.team !== g.player.team && !a.enemy,
      );
      expect(mages.length).toBeGreaterThan(0);
      for (const a of mages) {
        expect(bodyIdentity(a)).toBe("cassia");
        expect(painted.has(bodyIdentity(a))).toBe(true);
      }
      for (const a of g.state.actors)
        expect(painted.has(bodyIdentity(a)), a.label).toBe(true);
    }
  });
  it("resolves a season entrant by camp character id, never by display name", () => {
    const t = loadTables();
    const bout = (entrant: string) => {
      const s = createCampSession(t),
        p = createSeason();
      s.camp.day = 7;
      s.hour = t.season.gamesHour;
      p.receipts.push({
        id: `trial:${entrant}`,
        day: 7 - t.season.trialOffsetBeforeGames,
        kind: "trial",
        entrant,
        hash: "",
        trace: [],
      });
      const b = prepareBout(t, s, p, reference);
      startBout(b);
      return b;
    };
    const own = bout("cassia");
    expect(own.spectator).toBe(false);
    expect(own.games!.player.label).toBe("Cassia of the Lighthouse");
    expect(bodyIdentity(own.games!.player, own.entrant.id)).toBe("cassia");
    // Without the character id the display name matches nothing.
    expect(bodyIdentity(own.games!.player)).toBe("mage.unknown");
    const watched = bout("nysa");
    expect(watched.spectator).toBe(true);
    // No Nysa body is delivered yet: she keeps her id on the explicit fallback.
    expect(bodyIdentity(watched.games!.player, watched.entrant.id)).toBe(
      "nysa",
    );
    expect(painted.has("nysa")).toBe(false);
  });
  it("paints the training player and Tiro's practice player by label", () => {
    expect(bodyIdentity(createTraining().player)).toBe("cassia");
    expect(bodyIdentity(createGames(7, reference).player)).toBe("cassia");
  });
  it("paints the Lab's mage opponent by its school", () => {
    for (const school of ["water", "fire", "earth", "air"] as const) {
      const lab = createLab({
        ...defaultLabConfig,
        opponent: "mage",
        opponentSchool: school,
      });
      const id = bodyIdentity(lab.training.dummy);
      expect(painted.has(id), `${school} -> ${id}`).toBe(true);
      expect(painted.has(bodyIdentity(lab.training.player))).toBe(true);
    }
  });
});
