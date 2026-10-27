// The school-aware HUD's model (D3 4.2): what each slot, the school meter and the build readout show for the
// school the kernel actually plays. Pure (no Pixi), so a test per school can read it.
//
// Fire and Air rows come from the public spellbook (`labSpellbook`). `@mage/core/arena` does not export the seam's
// `slotSpell`, `balancedSpell` or `identityNumber` (arena/schools.ts), so `schoolSlotSpell`, `balancedRow` and
// `identityValue` below mirror them over the same two data files; school-hud.test.ts pins the mirror to the seam.
import {
  combat,
  labSpellbook,
  maxSpellRank,
  paced,
  seconds,
  spellFor,
  spellRank,
  ultimateFor,
  waterRankKey,
  type Actor,
  type ArenaState,
  type SlotSchool,
} from "@mage/core/arena";
import balance from "../../../core/src/arena/data/school-balance.pc.json" with { type: "json" };
import identity from "../../../../docs/design/reconciled/data/arena/schools-combat.json" with { type: "json" };
import { slotPrice } from "../combat-readout.ts";

export type HudSchool = "water" | SlotSchool;
export type SchoolRow = ReturnType<typeof labSpellbook>[number];

/** The school the kernel plays for this actor: a Fire/Air loadout makes it that school; otherwise Water (the default). */
export const hudSchool = (a: Actor): HudSchool =>
  a.schoolState?.school ?? "water";
/** Water keeps the bolt plus three lines; Fire and Air carry the bolt plus four free slots (W8 P1). */
export const slotCount = (school: HudSchool): number =>
  school === "water" ? 4 : 5;
/** The arena heading for a player of this school outside the Lab and the Games (W8 WP6 bodies). */
export const heroName: Record<HudSchool, string> = {
  water: "Cassia of the Tide",
  fire: "Brennic the Red",
  air: "Iskar Windborn",
};

const overrides: Record<string, number> = balance.overrides;
const usesOverlay = (state?: ArenaState) => state?.balance !== "canonical";
const balanceColumns = [
  "castS",
  "cooldownS",
  "mana",
  "damage",
  "telegraphS",
  "rangeM",
] as const;
/** A Fire/Air row as this state plays it: the PC overlay unless the state runs canonical (mirrors `balancedSpell`). */
export function balancedRow(row: SchoolRow, state?: ArenaState): SchoolRow {
  if (!usesOverlay(state)) return row;
  let out = row;
  for (const column of balanceColumns) {
    const value = overrides[`${row.id}.${column}`];
    if (value !== undefined) out = { ...out, [column]: value };
  }
  return out;
}
/** A numeric identity value under `schools-combat.json` `<school>`, overlay applied (mirrors `identityNumber`). */
export function identityValue(
  school: SlotSchool,
  path: string,
  state?: ArenaState,
): number {
  const override = usesOverlay(state)
    ? overrides[`${school}.identity.${path}`]
    : undefined;
  const value =
    override ??
    path
      .split(".")
      .reduce<unknown>(
        (at, key) =>
          at && typeof at === "object"
            ? (at as Record<string, unknown>)[key]
            : undefined,
        identity[school],
      );
  if (typeof value !== "number")
    throw Error(`schools-combat.json ${school}.${path} is not a number`);
  return value;
}
/** The canonical row on a Fire/Air slot, lit or not: slot 0 is the bolt (mirrors `slotSpell` before its tier gate). */
export function slotRow(a: Actor, slot: number): SchoolRow | undefined {
  const s = a.schoolState;
  if (!s) return undefined;
  const book = labSpellbook(s.school);
  if (s.catalogue) return book[slot];
  const id = slot === 0 ? s.loadout.bolt : s.loadout.slots[slot - 1];
  return book.find((row) => row.id === id);
}
/** The row a Fire/Air slot casts this tick, or undefined while the collar keeps it dark (mirrors `slotSpell`). */
export function schoolSlotSpell(
  a: Actor,
  slot: number,
  state?: ArenaState,
): SchoolRow | undefined {
  const row = slotRow(a, slot);
  return row && row.tier <= (row.tier === 0 ? 0 : a.tier)
    ? balancedRow(row, state)
    : undefined;
}

export interface SlotView {
  name: string;
  /** The glyph drawn on the slot (a Water line or the school). */
  icon: string;
  /** The collar has not unlocked this slot's tier yet. */
  dark: boolean;
  remainingS: number;
  /** The full recovery the remaining time counts down from. */
  cooldownS: number;
  price: string;
  crest: boolean;
  repeat: boolean;
  passive: boolean;
  tooltip: string;
  rank: number;
  /** The rank-5 ultimate form's name, when this slot carries one. */
  ultimate?: string;
}
const rune = ["", "I", "II", "III", "IV"];

/** What slot `slot` shows for this actor this tick. */
export function slotView(
  a: Actor,
  slot: number,
  state: ArenaState,
): SlotView | undefined {
  if (hudSchool(a) === "water") {
    const s = spellFor(a, slot, state);
    if (!s) return undefined;
    const remainingS = Math.max(
        0,
        seconds((a.water.cooldowns[s.line] ?? 0) - state.tick),
      ),
      price = slotPrice(a, s);
    return {
      name: s.name,
      icon: slot === 0 ? "water" : s.line,
      dark: false,
      remainingS,
      cooldownS: s.cooldownS,
      price: price.text,
      crest: price.crest && s.kind !== "passive",
      repeat: price.repeat,
      passive: s.kind === "passive",
      tooltip:
        a.tier < 4
          ? `${s.name}. Next tier awakens with collar rune ${rune[a.tier + 1]}.`
          : `${s.name}. All tiers unlocked.`,
      rank: spellRank(a, waterRankKey(s), state),
    };
  }
  const row = slotRow(a, slot);
  if (!row) return undefined;
  const lit = schoolSlotSpell(a, slot, state),
    spell = lit ?? balancedRow(row, state),
    rank = spellRank(a, row.id, state),
    ultimate = ultimateFor(row.id, rank),
    remainingS = Math.max(
      0,
      seconds((a.schoolState!.cooldowns[row.id] ?? 0) - state.tick),
    );
  return {
    name: spell.name,
    icon: a.schoolState!.school,
    dark: !lit,
    remainingS,
    cooldownS: paced(a, spell.cooldownS),
    price: lit ? `${spell.mana} mana` : `Rune ${rune[row.tier]}`,
    crest: false,
    repeat: false,
    passive: false,
    tooltip: [
      `${spell.name}. ${row.shape}; ${spell.mana} mana, ${spell.castS > 0 ? `${spell.castS}s cast` : "instant"}.`,
      ultimate
        ? `Rank ${rank} ultimate: ${ultimate.name}. ${ultimate.summary}`
        : "",
      lit ? "" : `Awakens with collar rune ${rune[row.tier]}.`,
    ]
      .filter(Boolean)
      .join(" "),
    rank,
    ...(ultimate ? { ultimate: ultimate.name } : {}),
  };
}

export interface MeterMark {
  at: number;
  name: string;
}
export interface MeterView {
  school: SlotSchool;
  label: string;
  value: number;
  min: number;
  max: number;
  marks: MeterMark[];
  /** The highest mark the value has reached, if any. */
  reached?: MeterMark;
}
/** How far `value` sits along a meter's range, 0..1: the one mapping the HUD meter and the feet meter both draw with. */
export const meterFraction = (
  view: Pick<MeterView, "min" | "max">,
  value: number,
): number =>
  Math.min(
    1,
    Math.max(0, (value - view.min) / Math.max(1, view.max - view.min)),
  );
/** The meter panel's size and where its two text lines sit inside it, relative to the panel's top-left. */
export const meterLayout = {
  panel: { w: 240, h: 160 },
  /** The panel art's frame eats about this much of each edge. */
  frame: 24,
  label: { y: 78, size: 22 },
  mark: { y: 102, size: 20 },
  /** BitmapText line height is `size * 1.22`. */
  lineHeight: 1.22,
};
/** A threshold's name: the authored one (Heat's Kindled, Blazing), else what it grants (Momentum's are unnamed). */
function markName(t: Record<string, unknown>): string {
  if (typeof t.name === "string") return t.name;
  if ("spellsPierce" in t) return "Piercing";
  if ("spellRangeMult" in t) return "Far-reaching";
  return "Surging";
}
/** Heat or Momentum for a Fire/Air actor (W8 A2: marks at 50/80 and 40/80, read from the identity); Water has none. */
export function resourceMeter(
  a: Actor,
  state?: ArenaState,
): MeterView | undefined {
  const s = a.schoolState;
  if (!s) return undefined;
  const school = s.school,
    thresholds = identity[school].thresholds as Record<string, unknown>[];
  const marks = thresholds
    .map((t, i) => ({
      at: identityValue(school, `thresholds.${i}.at`, state),
      name: markName(t),
    }))
    .sort((x, y) => x.at - y.at);
  const value = s.value;
  return {
    school,
    label: identity[school].resource.toUpperCase(),
    value,
    min: identityValue(school, "range.0", state),
    max: identityValue(school, "range.1", state),
    marks,
    reached: marks.filter((m) => value >= m.at).at(-1),
  };
}

/** The build readout: ranks shown only for a ranked actor, so today's unranked Water HUD reads as before. */
export const showsRanks = (a: Actor): boolean =>
  a.spellRanks !== undefined && Object.keys(a.spellRanks).length > 0;
export { maxSpellRank };
/** Water's Flow line, unchanged from the Water HUD. */
export const flowLine = (a: Actor): string =>
  `FLOW  ${a.water.flow} / ${combat.flow.max}`;
