import { newWaterState, presets, validateComposition } from "./catalog.ts";
import { attachMageAI, mageInput } from "./mage-ai.ts";
import { attachRivalPlan } from "./rival-plan.ts";
import { createTraining, scheduleTraining, type Training } from "./training.ts";
import { addMage, combat, createArena, seconds, stepArena, reviveActor } from "./kernel.ts";
import { rankRange } from "./data.generated.ts";
import { canonicalSpells, newSchoolState, schoolPresets, validateLoadout, type SchoolSpell } from "./schools.ts";
import { setSpellRanks, spellRanksProblems } from "./progression.ts";
import { buildLoadoutPrefix, rivalBuilds } from "./archetypes.ts";
import { createLedger, observeLedger, type ThreatLedger } from "./ledger.ts";
import { enemyInputs, queueDeathEffects } from "./enemies.ts";
import { flowMark, flowShift } from "./water.ts";
import {
  defaultDifficulty,
  makeTuning,
  schools,
  validDifficulty,
  validateTuning,
  type CombatTuning,
  type School,
} from "./tuning.ts";
import { slotSchools, type Actor, type ArenaState, type Composition, type Difficulty, type InputFrame, type Ranks, type SlotComposition, type SlotSchool, type SpellRanks } from "./types.ts";

/** One Lab side's build (spark combat-system-depth WP4, "Lab build pickers"): stats incl. agility, spell ranks and, for a Fire or
 * Air side, the bolt + 4 loadout that makes it a real school actor (absent: the CF1 practice profile over Water rows, as before).
 * `plan` names the rival build (rival-builds.json) whose loadout this is; that build's archetype plan then runs. Absent = today's side. */
export interface LabBuild { ranks?: Ranks; spellRanks?: SpellRanks; loadout?: SlotComposition; plan?: string }
/** The loadout name a Lab pick wears when it plays no plan (never the build prefix, so archetypes.ts leaves it alone). */
export const labLoadoutName = "lab pick";
/** The Lab pickers' read of a school's spellbook (schools.ts is not on the arena index): its rows (tier 0 = the bolt, tiers I-IV the
 * slot rows) and its first authored preset as a Lab loadout. */
export const labSpellbook = (school: SlotSchool): readonly SchoolSpell[] => canonicalSpells[school];
export const labDefaultLoadout = (school: SlotSchool): SlotComposition => ({ ...structuredClone(schoolPresets[school][0]!), name: labLoadoutName });

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
  /** Roster-creature targets only: "still" (absent = still) holds position; "live" runs the roster brain. */
  targetMotion?: "still" | "live";
  /** Mage opponents only: the rival's Water preset (absent = Rotation) and whether it plays its authored plan (absent = off). */
  rivalPreset?: string;
  rivalPlan?: boolean;
  /** Paces the opponent (dummy, creature or rival) like a bout at this difficulty; absent = the default. */
  difficulty?: Difficulty;
  /** The player's build (absent = today's practice mage). */
  playerBuild?: LabBuild;
  /** The mage opponent's build (absent = today's rival); ignored by dummy and creature targets. */
  opponentBuild?: LabBuild;
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
  staggersReceived: number;
  staggersDealt: number;
  castInterrupts: number;
  landed: number;
  taken: number;
  incomingMagic: number;
  absorbs: number;
  perfects: number;
  practiceDamage: number;
  manaSpent: number;
  /** Player casts that repeated a line and zeroed a standing Flow. */
  flowBreaks: number;
  timeToKillS: number | null;
  mixed: boolean;
}
export interface CombatLab {
  config: LabConfig;
  training: Training;
  tuningName: string;
  metrics: LabMetrics;
  /** Player threat answers and ward-age (lead) histogram; lives beside the state, never in it. */
  ledger: ThreatLedger;
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
    (c.targetMotion !== undefined && !["still", "live"].includes(c.targetMotion)) ||
    (c.rivalPreset !== undefined && !presets.some((p) => p.name === c.rivalPreset)) ||
    (c.rivalPlan !== undefined && typeof c.rivalPlan !== "boolean") ||
    (c.difficulty !== undefined && !validDifficulty(c.difficulty)) ||
    validateComposition(c.composition).length
  )
    throw Error("Invalid Lab setup.");
  const problems = [...labBuildProblems(c.playerBuild, c.playerSchool, "Your build"), ...labBuildProblems(c.opponentBuild, c.opponentSchool, "Opponent build")];
  if (problems.length) throw Error(`Invalid Lab setup. ${problems.join(" ")}`);
  return structuredClone(c);
}
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const statKeys = ["vigor", "focus", "nerve", "agility"] as const;
/** Problems with one side's build (empty = valid; absent = valid). The loadout must be the side's own Fire/Air school and pass
 * `validateLoadout`; a plan must name a rival build of that school whose bolt + 4 the loadout is, slot for slot. */
export function labBuildProblems(build: unknown, school: string, at = "Build"): string[] {
  if (build === undefined) return [];
  if (!isRecord(build)) return [`${at} is not an object.`];
  const out = Object.keys(build).filter((k) => !["ranks", "spellRanks", "loadout", "plan"].includes(k)).map((k) => `${at}: unknown key ${k}.`);
  const { ranks, spellRanks, loadout, plan } = build;
  if (ranks !== undefined) {
    if (!isRecord(ranks)) out.push(`${at}: ranks is not an object.`);
    else {
      out.push(...Object.keys(ranks).filter((k) => !(statKeys as readonly string[]).includes(k)).map((k) => `${at}: unknown stat ${k}.`));
      for (const key of statKeys) {
        const r = ranks[key];
        if (key === "agility" && r === undefined) continue;
        if (!Number.isInteger(r) || (r as number) < rankRange.min || (r as number) > rankRange.max) out.push(`${at}: ${key} ${String(r)} is not an integer ${rankRange.min}..${rankRange.max}.`);
      }
    }
  }
  if (spellRanks !== undefined) out.push(...spellRanksProblems(spellRanks).map((p) => `${at}: ${p}`));
  let own: SlotComposition | undefined;
  if (loadout !== undefined) {
    if (!isRecord(loadout) || typeof loadout.school !== "string" || typeof loadout.name !== "string" || typeof loadout.bolt !== "string" || !Array.isArray(loadout.slots) || loadout.slots.length !== 4 || loadout.slots.some((s) => typeof s !== "string"))
      out.push(`${at}: a loadout needs a school, a name, a bolt and four slot ids.`);
    else if (!(slotSchools as readonly string[]).includes(loadout.school) || loadout.school !== school)
      out.push(`${at}: a ${loadout.school} loadout cannot play on a ${school} side.`);
    else {
      own = loadout as unknown as SlotComposition;
      out.push(...validateLoadout(own).map((p) => `${at}: ${p}`));
    }
  }
  if (plan !== undefined) {
    const rival = typeof plan === "string" ? rivalBuilds[plan] : undefined;
    if (!rival) out.push(`${at}: plan ${String(plan)} is not a rival build.`);
    else if (!own || own.school !== rival.school || own.bolt !== rival.loadout.bolt || own.slots.some((id, i) => id !== rival.loadout.slots[i]))
      out.push(`${at}: plan ${plan} needs its own bolt + 4 loadout.`);
  }
  return out;
}
/** Apply a validated build to a Lab actor: the ranks size HP, mana and stamina exactly as `addMage` does; a loadout makes it a
 * real Fire/Air actor (named for its plan, else `labLoadoutName`); spell ranks ride on the actor. No build, no change. */
function applyLabBuild(a: Actor, build: LabBuild | undefined) {
  if (!build) return;
  if (build.ranks) {
    const sized = addMage(createArena(), a.team, a.pos, a.label, build.ranks);
    a.ranks = sized.ranks;
    a.hp = a.maxHp = sized.maxHp;
    a.mana = a.maxMana = sized.maxMana;
    a.stamina = a.maxStamina = sized.maxStamina;
  }
  if (build.loadout) {
    a.school = build.loadout.school;
    a.schoolState = newSchoolState({ ...build.loadout, name: build.plan ? `${buildLoadoutPrefix}${build.plan}` : labLoadoutName });
  }
  setSpellRanks(a, build.spellRanks);
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
      c.difficulty ?? defaultDifficulty,
    );
  const { state, player, dummy } = training;
  state.tuning = validateTuning(tuning);
  state.lab = { damageEnabled: true };
  player.pos = { x: 16 - c.distanceM / 2, y: 10 };
  player.previousPos = { ...player.pos };
  dummy.pos = { x: 16 + c.distanceM / 2, y: 10 };
  dummy.previousPos = { ...dummy.pos };
  dummy.facing = { x: -1, y: 0 };
  player.poise = tuning.playerPoise; dummy.poise = tuning.opponentPoise;
  player.school = c.playerSchool;
  player.label = `${c.playerSchool} practice mage`;
  player.water = newWaterState(c.composition);
  dummy.hp = dummy.maxHp = player.maxHp;
  dummy.school = c.opponentSchool;
  if (c.opponent === "mage") {
    dummy.dummy = false;
    dummy.label = `${c.opponentSchool} practice rival`;
    dummy.water = newWaterState(presets.find((p) => p.name === c.rivalPreset) ?? presets[2]!);
    attachMageAI(dummy, c.competence);
    dummy.mageAI!.aggression = c.aggression;
    if (c.rivalPlan) attachRivalPlan(dummy);
    applyLabBuild(dummy, c.opponentBuild);
  }
  applyLabBuild(player, c.playerBuild);
  const lab: CombatLab = {
    config: c,
    training,
    tuningName,
    metrics: {
      staggersReceived: 0, staggersDealt: 0, castInterrupts: 0,
      landed: 0,
      taken: 0,
      incomingMagic: 0,
      absorbs: 0,
      perfects: 0,
      practiceDamage: 0,
      manaSpent: 0,
      flowBreaks: 0,
      timeToKillS: null,
      mixed: false,
    },
    ledger: createLedger(state, player.id),
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
    actors: s.actors.map((a) => ({
      ...a,
      ...(a.mageAI
        ? { mageAI: { ...a.mageAI, decisionTicks: [], reactionAges: [] } }
        : {}),
    })),
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
export function stepLab(
  lab: CombatLab,
  input: InputFrame,
  record = true,
): void {
  const { state, player, dummy } = lab.training;
  const live = lab.config.targetMotion === "live" && !!dummy.enemy;
  // A fallen live creature keeps the clock running until its death effect (ember burst) is queued and resolved.
  const dying = live && (!dummy.enemy!.deathQueued || state.telegraphs.length > 0);
  if (player.tags.includes("DEFEATED") || (dummy.tags.includes("DEFEATED") && !dying)) return;
  const first = state.events.length;
  if (lab.config.opponent === "dummy" && lab.config.dummyAttack !== "still")
    scheduleTraining(lab.training);
  const flow = flowMark(player.water);
  // Live pairing matches roster mode: the creature brain reads the tick first, then the player's frame applies.
  stepArena(state, {
    ...(live ? enemyInputs(state) : {}),
    [player.id]: input,
    ...(dummy.mageAI ? { [dummy.id]: mageInput(state, dummy) } : {}),
  });
  if (live) queueDeathEffects(state);
  observeLedger(lab.ledger, state);
  if (flowShift(flow, player.water)?.kind === "break") lab.metrics.flowBreaks++;
  for (const e of state.events.slice(first)) {
    if (e.kind === "stagger") { if (e.actorId === player.id) lab.metrics.staggersReceived++; else lab.metrics.staggersDealt++; }
    if (e.kind === "interrupt" && e.actorId === player.id) lab.metrics.castInterrupts++;
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
  lab.training.player.poise = tuning.playerPoise; lab.training.dummy.poise = tuning.opponentPoise;
  lab.tuningName = name;
  lab.metrics.mixed ||= lab.training.state.tick > 0;
  lab.changes.push({ tick: lab.training.state.tick, kind: `tuning:${name}` });
}
export function replenishLab(lab: CombatLab) {
  for (const a of lab.training.state.actors) {
    a.hp = a.maxHp;
    a.mana = a.maxMana;
    a.stamina = a.maxStamina;
    reviveActor(lab.training.state, a);
    // A revived live creature owes its death effect again; still targets never queue one.
    if (a.enemy) a.enemy.deathQueued = false;
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
