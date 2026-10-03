import { newWaterState, presets, validateComposition } from "./catalog.ts";
import { attachMageAI, mageInput } from "./mage-ai.ts";
import { createTraining, scheduleTraining, type Training } from "./training.ts";
import { combat, seconds, stepArena } from "./kernel.ts";
import {
  makeTuning,
  schools,
  validateTuning,
  type CombatTuning,
  type School,
} from "./tuning.ts";
import type { ArenaState, Composition, InputFrame } from "./types.ts";

export interface LabConfig {
  opponent: "dummy" | "mage";
  dummyAttack: "still" | "magic" | "physical" | "charge";
  playerSchool: School;
  opponentSchool: School;
  competence: number;
  aggression: number;
  distanceM: number;
  seed: number;
  randomSeed: boolean;
  composition: Composition;
}
export const defaultLabConfig: LabConfig = {
  opponent: "dummy",
  dummyAttack: "magic",
  playerSchool: "water",
  opponentSchool: "fire",
  competence: 2,
  aggression: 0.75,
  distanceM: 10,
  seed: 7331,
  randomSeed: false,
  composition: structuredClone(presets[2]!),
};
export interface LabMetrics {
  landed: number;
  taken: number;
  incomingMagic: number;
  absorbs: number;
  perfects: number;
  practiceDamage: number;
  manaSpent: number;
  timeToKillS: number | null;
  mixed: boolean;
}
export interface CombatLab {
  config: LabConfig;
  training: Training;
  tuningName: string;
  metrics: LabMetrics;
  history: ArenaState[];
  historyCursor: number;
  historyCount: number;
  changes: { tick: number; kind: string }[];
}
export const replayTicks = combat.simStepHz * 20;
export function validateLabConfig(c: LabConfig): LabConfig {
  if (
    !c ||
    !["dummy", "mage"].includes(c.opponent) ||
    !["still", "magic", "physical", "charge"].includes(c.dummyAttack) ||
    !schools.includes(c.playerSchool) ||
    !schools.includes(c.opponentSchool) ||
    !Number.isInteger(c.competence) ||
    c.competence < 1 ||
    c.competence > 4 ||
    !Number.isFinite(c.aggression) ||
    c.aggression < 0 ||
    c.aggression > 1 ||
    !Number.isFinite(c.distanceM) ||
    c.distanceM < 2 ||
    c.distanceM > 36 ||
    !Number.isInteger(c.seed) ||
    c.seed < 0 ||
    c.seed > 0xffffffff ||
    typeof c.randomSeed !== "boolean" ||
    validateComposition(c.composition).length
  )
    throw Error("Invalid Lab setup.");
  return structuredClone(c);
}
export function createLab(
  config: LabConfig = defaultLabConfig,
  tuning: CombatTuning = makeTuning(),
  tuningName = "Current",
): CombatLab {
  const c = validateLabConfig(config),
    training = createTraining(
      c.dummyAttack === "still" ? "magic" : c.dummyAttack,
      c.seed,
    );
  const { state, player, dummy } = training;
  state.tuning = validateTuning(tuning);
  state.lab = { damageEnabled: true };
  player.pos = { x: 16 - c.distanceM / 2, y: 10 };
  player.previousPos = { ...player.pos };
  dummy.pos = { x: 16 + c.distanceM / 2, y: 10 };
  dummy.previousPos = { ...dummy.pos };
  dummy.facing = { x: -1, y: 0 };
  player.school = c.playerSchool;
  player.label = `${c.playerSchool} practice mage`;
  player.water = newWaterState(c.composition);
  dummy.hp = dummy.maxHp = player.maxHp;
  dummy.school = c.opponentSchool;
  if (c.opponent === "mage") {
    dummy.dummy = false;
    dummy.label = `${c.opponentSchool} practice rival`;
    dummy.water = newWaterState(presets[2]!);
    attachMageAI(dummy, c.competence);
    dummy.mageAI!.aggression = c.aggression;
  }
  const lab: CombatLab = {
    config: c,
    training,
    tuningName,
    metrics: {
      landed: 0,
      taken: 0,
      incomingMagic: 0,
      absorbs: 0,
      perfects: 0,
      practiceDamage: 0,
      manaSpent: 0,
      timeToKillS: null,
      mixed: false,
    },
    history: [],
    historyCursor: 0,
    historyCount: 0,
    changes: [],
  };
  recordLab(lab);
  return lab;
}
/** Renderer history omits unbounded audit arrays; authoritative live state is never trimmed. */
function recordLab(lab: CombatLab) {
  const s = lab.training.state;
  const compact = structuredClone({
    ...s,
    events: s.events.filter((e) => e.tick >= s.tick - replayTicks),
    randomLog: [],
  });
  for (const a of compact.actors)
    if (a.mageAI) {
      a.mageAI.decisionTicks = [];
      a.mageAI.reactionAges = [];
    }
  lab.history[lab.historyCursor] = compact;
  lab.historyCursor = (lab.historyCursor + 1) % (replayTicks + 1);
  lab.historyCount = Math.min(replayTicks + 1, lab.historyCount + 1);
}
export function labReplay(lab: CombatLab): ArenaState[] {
  const start = lab.historyCount === replayTicks + 1 ? lab.historyCursor : 0;
  return Array.from(
    { length: lab.historyCount },
    (_, i) => lab.history[(start + i) % (replayTicks + 1)]!,
  );
}
export function stepLab(lab: CombatLab, input: InputFrame, record = true): void {
  const { state, player, dummy } = lab.training;
  if (player.down || dummy.down) return;
  const first = state.events.length;
  if (lab.config.opponent === "dummy" && lab.config.dummyAttack !== "still")
    scheduleTraining(lab.training);
  stepArena(state, {
    [player.id]: input,
    ...(dummy.mageAI ? { [dummy.id]: mageInput(state, dummy) } : {}),
  });
  for (const e of state.events.slice(first)) {
    if (e.kind === "hit") {
      if (e.actorId === dummy.id && (e.contactDamage ?? e.value) > 0) {
        lab.metrics.landed++;
        lab.metrics.practiceDamage += e.contactDamage ?? e.value;
      }
      if (e.actorId === player.id) {
        if ((e.contactDamage ?? e.value) > 0) lab.metrics.taken++;
        if (e.family === "magic") {
          lab.metrics.incomingMagic++;
          if (e.guarded) lab.metrics.absorbs++;
        }
      }
    }
    if (e.kind === "perfect" && e.actorId === player.id) lab.metrics.perfects++;
    if (e.kind === "down" && e.actorId === dummy.id && state.lab?.damageEnabled)
      lab.metrics.timeToKillS ??= seconds(state.tick);
  }
  lab.metrics.manaSpent =
    (player.metrics.manaCast ?? 0) +
    player.metrics.manaRaised +
    player.metrics.manaDrained;
  if (record) recordLab(lab);
}
export function changeLabTuning(
  lab: CombatLab,
  tuning: CombatTuning,
  name: string,
) {
  lab.training.state.tuning = validateTuning(tuning);
  lab.tuningName = name;
  lab.metrics.mixed ||= lab.training.state.tick > 0;
  lab.changes.push({ tick: lab.training.state.tick, kind: `tuning:${name}` });
}
export function replenishLab(lab: CombatLab) {
  for (const a of lab.training.state.actors) {
    a.hp = a.maxHp;
    a.mana = a.maxMana;
    a.stamina = a.maxStamina;
    a.down = false;
  }
  lab.metrics.mixed = true;
  lab.changes.push({ tick: lab.training.state.tick, kind: "replenish" });
}
export function toggleLabDamage(lab: CombatLab) {
  const mode = lab.training.state.lab!;
  mode.damageEnabled = !mode.damageEnabled;
  lab.metrics.mixed ||= lab.training.state.tick > 0;
  lab.changes.push({
    tick: lab.training.state.tick,
    kind: `damage:${mode.damageEnabled}`,
  });
}
