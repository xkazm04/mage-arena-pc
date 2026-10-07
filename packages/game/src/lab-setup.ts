import {
  addEnemy,
  createLab,
  changeLabTuning,
  enemyRoster,
  type LabConfig,
  type CombatLab,
  type CombatTuning,
} from "@mage/core/arena";
import type { Direction } from "./animation-contract.ts";

export const creatureTargets = [
  "cinder_hound",
  "mire_maw",
  "thornback",
  "hush_moth",
] as const;
export type CreatureTarget = (typeof creatureTargets)[number];
export type LabSetup = LabConfig & {
  creature?: CreatureTarget;
  creatureFacing?: Direction;
};
export type LabSession = Omit<CombatLab, "config"> & { config: LabSetup };
export const creatureName = (id: CreatureTarget) =>
  enemyRoster.find((s) => s.id === id)!.name;

/** Stationary roster targets for art/feel inspection. Season rules stay in core. */
export function createLabSetup(
  config: LabSetup,
  tuning?: CombatTuning,
  name?: string,
): LabSession {
  if (config.creature && !creatureTargets.includes(config.creature))
    throw Error("Unknown creature target");
  const c = config.creature
    ? { ...config, opponent: "dummy" as const, dummyAttack: "still" as const }
    : config;
  const lab: LabSession = createLab(c, tuning, name);
  if (c.creature) {
    const { state, player, dummy } = lab.training;
    const target = addEnemy(state, c.creature, { ...dummy.pos });
    const facing = c.creatureFacing ?? "se";
    target.facing = {
      x: facing[1] === "e" ? 1 : -1,
      y: facing[0] === "s" ? 1 : -1,
    };
    target.poise *= state.tuning!.opponentPoise;
    state.actors = [player, target];
    lab.training.dummy = target;
    // The core records the first replay frame before replacing this scratch target.
    lab.history[0] = structuredClone({ ...state, events: [], randomLog: [] });
  }
  return lab;
}

export function changeLabSetupTuning(
  lab: LabSession,
  tuning: CombatTuning,
  name: string,
) {
  changeLabTuning(lab, tuning, name);
  if (lab.config.creature)
    lab.training.dummy.poise =
      enemyRoster.find((s) => s.id === lab.config.creature)!.poise *
      tuning.opponentPoise;
}
