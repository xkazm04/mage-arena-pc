import { combat } from "./data.generated.ts";
import data from "./data/feel.json" with { type: "json" };
import schoolData from "./data/lab-schools.json" with { type: "json" };
import type { Actor, ArenaState } from "./types.ts";
import { spells, type Spell } from "./catalog.ts";

export type School = "fire" | "water" | "earth" | "air";
export const schools: School[] = ["fire", "water", "earth", "air"];
export const schoolProfiles = schoolData;
export const feelPolicy = data;
export const defaultTuning = {
  ...data.defaults,
  walkMps: combat.movement.walkMps as number,
  sprintMps: combat.movement.sprintMps as number,
  rollDistanceM: combat.roll.distanceM as number,
  rollDurationS: combat.roll.durationS as number,
  rollIFramesS: combat.roll.iFramesS as number,
  rollRecoveryS: combat.roll.recoveryS as number,
  absorbWindowS: combat.absorb.perfect.windowS as number,
  absorbArcDeg: combat.absorb.arcDeg as number,
  collarIntervalS: combat.tierClock.unlockAtSeconds[2] as number,
};
export type TuningKey = keyof typeof defaultTuning;
export interface SpellOverride {
  castS: number;
  cooldownS: number;
  speedMps: number;
}
export type CombatTuning = typeof defaultTuning & {
  spells: Record<string, SpellOverride>;
};
export interface TuningField {
  key: TuningKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  group: string;
}
const field = (
  key: TuningKey,
  label: string,
  unit: string,
  min: number,
  max: number,
  step: number,
  group: string,
): TuningField => ({ key, label, unit, min, max, step, group });
export const tuningFields: TuningField[] = [
  field("walkMps", "Walk speed", "m/s", 1, 10, 0.1, "Movement"),
  field("sprintMps", "Sprint speed", "m/s", 1, 14, 0.1, "Movement"),
  field(
    "accelerationMps2",
    "Acceleration (0 = instant)",
    "m/s²",
    0,
    150,
    5,
    "Movement",
  ),
  field(
    "decelerationMps2",
    "Braking (0 = instant)",
    "m/s²",
    0,
    150,
    5,
    "Movement",
  ),
  field(
    "turnResponse",
    "Body turn response (0 = instant)",
    "1/s",
    0,
    40,
    1,
    "Movement",
  ),
  field(
    "castMoveMultiplier",
    "Move speed while casting",
    "×",
    0,
    1,
    0.05,
    "Movement",
  ),
  field("rollDistanceM", "Roll distance", "m", 1, 8, 0.1, "Roll"),
  field("rollDurationS", "Roll duration", "s", 0.15, 0.8, 0.01, "Roll"),
  field("rollIFramesS", "Roll invulnerability", "s", 0, 0.8, 0.01, "Roll"),
  field("rollRecoveryS", "Roll recovery", "s", 0, 0.6, 0.01, "Roll"),
  field("castTimeScale", "Cast time multiplier", "×", 0.25, 2, 0.05, "Casting"),
  field("cooldownScale", "Cooldown multiplier", "×", 0.25, 2, 0.05, "Casting"),
  field(
    "projectileSpeedScale",
    "Projectile speed multiplier",
    "×",
    0.25,
    3,
    0.05,
    "Casting",
  ),
  field(
    "castCommitFraction",
    "Cast commit point",
    "fraction",
    0,
    1,
    0.05,
    "Casting",
  ),
  field("castRecoveryS", "Spell recovery", "s", 0, 0.5, 0.01, "Casting"),
  field("hitStunMaxS", "Maximum stun", "s", 0.01, 0.4, 0.01, "Hit"),
  field("hitStunPerDamageS", "Stun per damage", "s/HP", 0, 0.02, 0.001, "Hit"),
  field("poiseScale", "Poise multiplier", "x", 0.25, 4, 0.05, "Hit"),
  field("playerPoise", "Your poise", "x", 0.25, 4, 0.05, "Hit"),
  field("opponentPoise", "Opponent poise", "x", 0.25, 4, 0.05, "Hit"),
  field("hitRecoilM", "Visual recoil distance", "m", 0, 1, 0.05, "Hit"),
  field("hitRecoilS", "Recoil / flinch time", "s", 0.05, 0.5, 0.01, "Hit"),
  field("hitSquash", "Recoil squash", "fraction", 0, 0.4, 0.01, "Hit"),
  field("hitShakePx", "Sprite shake", "px", 0, 8, 0.5, "Hit"),
  field("hitFlashS", "White flash", "s", 0.02, 0.15, 0.005, "Hit"),
  field("playerHitCueS", "Player edge cue", "s", 0.05, 0.5, 0.01, "Hit"),
  field("deathFallS", "Fallback fall time", "s", 0.2, 1, 0.05, "Hit"),
  field("deathAuraFadeS", "Death aura fade", "s", 0.05, 0.8, 0.05, "Hit"),
  field("hitStunS", "Minimum stun", "s", 0, 0.3, 0.01, "Hit"),
  field("knockbackM", "Knockback at 10 damage", "m", 0, 2, 0.05, "Hit"),
  field(
    "absorbWindowS",
    "Perfect absorb window",
    "s",
    0.03,
    0.4,
    0.01,
    "Absorb",
  ),
  field("absorbArcDeg", "Absorb arc", "degrees", 60, 180, 5, "Absorb"),
  field(
    "absorbDrainScale",
    "Absorb drain multiplier",
    "×",
    0,
    3,
    0.05,
    "Absorb",
  ),
  field(
    "perfectRefundScale",
    "Perfect refund multiplier",
    "×",
    0,
    3,
    0.05,
    "Absorb",
  ),
  field(
    "manaRegenScale",
    "Mana regeneration multiplier",
    "×",
    0,
    3,
    0.05,
    "Resources",
  ),
  field(
    "collarIntervalS",
    "Time between collar tiers",
    "s",
    6,
    30,
    1,
    "Resources",
  ),
  field(
    "enemyReactionScale",
    "Enemy reaction delay multiplier",
    "×",
    0.5,
    3,
    0.05,
    "Opponent",
  ),
  field(
    "enemyAimErrorScale",
    "Enemy aim error multiplier",
    "×",
    0,
    3,
    0.05,
    "Opponent",
  ),
  field(
    "hitStunGraceS",
    "Stagger immunity after hit",
    "s",
    0,
    0.6,
    0.01,
    "Hit",
  ),
  field(
    "rollRecoveryMoveMultiplier",
    "Move speed in roll recovery",
    "x",
    0,
    1,
    0.05,
    "Roll",
  ),
];
const hitOrder: TuningKey[] = [
  "hitStunS",
  "hitStunMaxS",
  "hitStunPerDamageS",
  "hitStunGraceS",
  "poiseScale",
  "knockbackM",
  "playerPoise",
  "opponentPoise",
  "hitRecoilM",
  "hitRecoilS",
  "hitSquash",
  "hitShakePx",
  "hitFlashS",
  "playerHitCueS",
  "deathFallS",
  "deathAuraFadeS",
];
const hitFields = tuningFields
  .filter((f) => f.group === "Hit")
  .sort((a, b) => hitOrder.indexOf(a.key) - hitOrder.indexOf(b.key));
const hitIndex = tuningFields.findIndex((f) => f.group === "Hit");
tuningFields.splice(
  0,
  tuningFields.length,
  ...tuningFields.filter((f) => f.group !== "Hit"),
);
tuningFields.splice(hitIndex, 0, ...hitFields);
export const tuningPresets = Object.keys(
  data.presets,
) as (keyof typeof data.presets)[];
export function makeTuning(
  preset: keyof typeof data.presets = "Current",
): CombatTuning {
  return { ...defaultTuning, ...data.presets[preset], spells: {} };
}
const defaults = makeTuning();
export function tuningFor(state: ArenaState): CombatTuning {
  return state.tuning ?? defaults;
}
export function profileFor(a: Actor) {
  return schoolData[a.school ?? "water"];
}
export function adjustedSpell(s: Spell, a: Actor, state?: ArenaState): Spell {
  const t = state ? tuningFor(state) : defaults,
    p = profileFor(a),
    override = t.spells[s.id];
  if (
    !state?.tuning &&
    !a.school &&
    t.castTimeScale === 1 &&
    t.cooldownScale === 1 &&
    t.projectileSpeedScale === 1
  )
    return s;
  return {
    ...s,
    name:
      a.school && a.school !== "water"
        ? `${p.prefix} ${s.line === "bolt" ? "Needle" : s.line === "tide_orb" ? "Orb" : s.line === "lash" ? "Lash" : s.line === "mire" ? "Field" : s.line === "mend" ? "Renewal" : "Mirror"} ${s.tier || ""}`.trim()
        : s.name,
    castS: override?.castS ?? s.castS * t.castTimeScale * p.cast,
    telegraphS: Math.max(
      s.family === "unblockable"
        ? combat.reactionBands.minimumTelegraphUnblockableS
        : s.kind === "zone"
          ? combat.reactionBands.minimumTelegraphPositionalS
          : 0,
      override?.castS ?? s.telegraphS * t.castTimeScale * p.cast,
    ),
    cooldownS: override?.cooldownS ?? s.cooldownS * t.cooldownScale,
    speedMps:
      override?.speedMps ?? s.speedMps * t.projectileSpeedScale * p.projectile,
    damage: s.damage * p.damage,
    durationS: s.durationS * p.control,
  };
}
export function validateTuning(value: unknown): CombatTuning {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Tuning must be an object.");
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).some(
      (k) => k !== "spells" && !tuningFields.some((f) => f.key === k),
    )
  )
    throw Error("Unknown tuning parameter.");
  for (const f of tuningFields)
    if (
      typeof v[f.key] !== "number" ||
      !Number.isFinite(v[f.key]) ||
      (v[f.key] as number) < f.min ||
      (v[f.key] as number) > f.max
    )
      throw Error(`${f.key}: expected ${f.min}–${f.max} ${f.unit}.`);
  if ((v.hitStunS as number) > (v.hitStunMaxS as number))
    throw Error("Minimum stun cannot exceed maximum stun.");
  if ((v.rollIFramesS as number) > (v.rollDurationS as number))
    throw Error("rollIFramesS cannot exceed rollDurationS.");
  if (
    !v.spells ||
    typeof v.spells !== "object" ||
    Array.isArray(v.spells) ||
    Object.keys(v.spells).length > 32
  )
    throw Error("Invalid spell overrides.");
  for (const [id, spec] of Object.entries(v.spells)) {
    if (
      !/^(bolt:0:base|(?:tide_orb|lash|mire|mend|mirror):[1-4]:(?:base|A|B))$/.test(
        id,
      ) ||
      !spec ||
      typeof spec !== "object"
    )
      throw Error("Invalid spell override id.");
    const source = spells.find((s) => s.id === id);
    if (!source) throw Error(`Unknown spell ${id}.`);
    const s = spec as SpellOverride;
    if (source.kind === "projectile" && s.speedMps <= 0)
      throw Error("Projectile speed must be positive.");
    if (
      Object.keys(s).sort().join() !== "castS,cooldownS,speedMps" ||
      ![s.castS, s.cooldownS, s.speedMps].every(Number.isFinite) ||
      s.castS < 0 ||
      s.castS > 3 ||
      s.cooldownS < 0 ||
      s.cooldownS > 60 ||
      s.speedMps < 0 ||
      s.speedMps > 100
    )
      throw Error(`Invalid override for ${id}.`);
  }
  return structuredClone(value) as CombatTuning;
}
export function exportTuning(tuning: CombatTuning, name: string): string {
  return JSON.stringify(
    {
      format: "mage-arena-tuning",
      version: 3,
      name,
      tuning: validateTuning(tuning),
    },
    null,
    2,
  );
}
export function importTuning(text: string): {
  name: string;
  tuning: CombatTuning;
} {
  if (text.length > 64000) throw Error("Tuning JSON is too large.");
  const v = JSON.parse(text);
  if (
    v?.format !== "mage-arena-tuning" ||
    ![1, 2, 3].includes(v.version) ||
    typeof v.name !== "string" ||
    v.name.length > 80 ||
    Object.keys(v).sort().join() !== "format,name,tuning,version"
  )
    throw Error("Expected a version 1, 2 or 3 Mage Arena tuning export.");
  if (v.version === 1 && v.tuning && typeof v.tuning === "object")
    v.tuning = { hitStunGraceS: 0, rollRecoveryMoveMultiplier: 1, ...v.tuning };
  if (v.version < 3 && v.tuning && typeof v.tuning === "object") {
    v.tuning = {
      ...defaultTuning,
      ...v.tuning,
      hitStunMaxS: v.tuning.hitStunS,
      hitStunPerDamageS: 0,
    };
    // Old zero-stun experiments use a zero floor and one-tick ceiling, with zero slope.
    v.tuning.hitStunMaxS = Math.max(0.01, v.tuning.hitStunMaxS);
  }
  return { name: v.name, tuning: validateTuning(v.tuning) };
}
