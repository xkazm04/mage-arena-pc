import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  createGames,
  createLab,
  defaultLabConfig,
  presets,
  runtime,
  tiro,
  type GamesPlayer,
} from "@mage/core/arena";
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
const entrant = (id: string, name: string): GamesPlayer => ({
  id,
  name,
  school: "water",
  ranks: { vigor: 3, focus: 3, nerve: 3 },
  mastery: tiro.requiresMastery,
  hpPenalty: 0,
  staminaPenalty: 0,
});

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
  it("paints the season entrant, who carries the character's name, and a spectated tent-mate", () => {
    for (const [id, name] of [
      ["cassia", "Cassia of the Lighthouse"],
      ["nysa", "Nysa"],
    ]) {
      const g = createGames(7, reference, 3, false, entrant(id!, name!));
      expect(g.player.label).toBe(name);
      expect(bodyIdentity(g.player)).toBe("cassia");
    }
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
