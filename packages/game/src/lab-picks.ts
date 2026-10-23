import {
  labBuildProblems,
  labDefaultLoadout,
  labLoadoutName,
  labSpellbook,
  presets,
  rivalBuilds,
  rivalBuildIds,
  runtime,
  validateLabConfig,
  type Composition,
  type LabBuild,
  type LabConfig,
  type Ranks,
  type RivalBuild,
  type SlotSchool,
} from "@mage/core/arena";

// Lab build pickers (spark combat-system-depth WP4, owner: "both Lab sides pick school, archetype preset, stats incl. agility,
// spell ranks and the bolt + 4"). Pure edits of a LabConfig: the canvas UI (lab-ui.ts) draws them, tests drive them directly.
// Every number comes from core (rows, presets, rival builds, the shared rank mapping); a neutral build is dropped, so a Lab
// whose picks are all defaults stays the default Lab, key for key.

export type LabSide = "player" | "opponent";
export const labSides: readonly LabSide[] = ["player", "opponent"];
/** The schools a picker offers: Water composes its lines; Fire and Air play their real spellbooks. */
export const pickSchools = ["water", "fire", "air"] as const;
export type PickSchool = (typeof pickSchools)[number];
export const statKeys = ["vigor", "focus", "nerve", "agility"] as const;
export type StatKey = (typeof statKeys)[number];
export const rankChoices = [1, 2, 3, 4, 5] as const;

const schoolKey = (side: LabSide) => (side === "player" ? "playerSchool" : "opponentSchool");
const buildKey = (side: LabSide) => (side === "player" ? "playerBuild" : "opponentBuild");
const isSlotSchool = (s: string): s is SlotSchool => s === "fire" || s === "air";

export const sideSchool = (c: LabConfig, side: LabSide) => c[schoolKey(side)];
export const sideBuild = (c: LabConfig, side: LabSide): LabBuild => c[buildKey(side)] ?? {};
/** The stats a side plays: its build's, else the shared defaults (agility absent = rank 1). */
export function sideRanks(c: LabConfig, side: LabSide): Required<Ranks> {
  const r: Ranks = sideBuild(c, side).ranks ?? runtime.training.defaultRanks;
  return { vigor: r.vigor, focus: r.focus, nerve: r.nerve, agility: r.agility ?? 1 };
}
/** The Water composition a side plays: the player's own, the rival's preset (absent = Rotation, as createLab reads it). */
export const sideComposition = (c: LabConfig, side: LabSide): Composition =>
  side === "player" ? c.composition : (presets.find((p) => p.name === c.rivalPreset) ?? presets[2]!);

/** Drop every neutral part (default ranks, agility 1, rank-1 spells, no loadout), and the build when nothing is left. */
export function normalizeBuild(b: LabBuild): LabBuild | undefined {
  const out: LabBuild = {};
  if (b.ranks) {
    const d = runtime.training.defaultRanks,
      { agility, ...core } = b.ranks,
      ranks: Ranks = agility === undefined || agility === 1 ? core : { ...core, agility };
    if (ranks.vigor !== d.vigor || ranks.focus !== d.focus || ranks.nerve !== d.nerve || ranks.agility !== undefined) out.ranks = ranks;
  }
  const spellRanks = Object.fromEntries(Object.entries(b.spellRanks ?? {}).filter(([, r]) => r !== 1));
  if (Object.keys(spellRanks).length) out.spellRanks = spellRanks;
  if (b.loadout) out.loadout = structuredClone(b.loadout);
  if (b.plan !== undefined) out.plan = b.plan;
  return Object.keys(out).length ? out : undefined;
}
function withBuild<T extends LabConfig>(c: T, side: LabSide, b: LabBuild): T {
  const next = structuredClone(c),
    n = normalizeBuild(b);
  if (n) next[buildKey(side)] = n;
  else delete next[buildKey(side)];
  return next;
}
/** The rival build whose school and bolt + 4 this loadout is, slot for slot (its archetype plan then runs). */
export function planFor(b: LabBuild): string | undefined {
  const l = b.loadout;
  return l && rivalBuildIds.find((id) => {
    const r = rivalBuilds[id]!.loadout;
    return r.school === l.school && r.bolt === l.bolt && r.slots.every((s, i) => s === l.slots[i]);
  });
}

/** Change a side's school: Fire and Air start from the school's first preset loadout, Water drops the loadout. Stats stay; spell
 * ranks go (their keys belong to the old spellbook); the plan is the preset's when it is a rival build's own loadout. */
export function withSchool<T extends LabConfig>(c: T, side: LabSide, school: PickSchool): T {
  const { ranks } = sideBuild(c, side),
    build: LabBuild = { ...(ranks ? { ranks } : {}), ...(isSlotSchool(school) ? { loadout: labDefaultLoadout(school) } : {}) },
    plan = planFor(build),
    next = withBuild(c, side, plan ? { ...build, plan } : build);
  next[schoolKey(side)] = school;
  return next;
}
/** The archetype presets a side may load: the authored rival builds of its school (none for Water). */
export const presetOptions = (c: LabConfig, side: LabSide): RivalBuild[] =>
  rivalBuildIds.map((id) => rivalBuilds[id]!).filter((b) => b.school === sideSchool(c, side));
/** Load a rival build as the starting point (stats, spell ranks, bolt + 4 and its plan); every part stays editable. */
export function withPreset<T extends LabConfig>(c: T, side: LabSide, id: string): T {
  const b = rivalBuilds[id];
  if (!b || b.school !== sideSchool(c, side)) throw Error(`${id} is not a ${sideSchool(c, side)} build.`);
  return withBuild(c, side, { ranks: { ...b.ranks }, spellRanks: { ...b.spellRanks }, loadout: { ...structuredClone(b.loadout), name: labLoadoutName }, plan: id });
}
export function withStat<T extends LabConfig>(c: T, side: LabSide, key: StatKey, rank: number): T {
  const b = sideBuild(c, side);
  return withBuild(c, side, { ...b, ranks: { ...sideRanks(c, side), [key]: rank } });
}
/** Put a spell from the school's rows into slot 1-4 (slot 0 is the fixed bolt). The plan follows the loadout: kept only while
 * the loadout is still a rival build's own. Spell ranks on the replaced row go with it. */
export function withSlot<T extends LabConfig>(c: T, side: LabSide, slot: number, spellId: string): T {
  const b = sideBuild(c, side);
  if (!b.loadout || slot < 1 || slot > 4) throw Error("Only a Fire or Air side has slots 1-4 to pick.");
  const old = b.loadout.slots[slot - 1]!,
    slots = [...b.loadout.slots] as [string, string, string, string];
  slots[slot - 1] = spellId;
  const spellRanks = { ...b.spellRanks };
  if (!slots.includes(old)) delete spellRanks[old];
  const next: LabBuild = { ...b, loadout: { ...b.loadout, slots }, spellRanks };
  const plan = planFor(next);
  if (plan) next.plan = plan;
  else delete next.plan;
  return withBuild(c, side, next);
}
/** The rows a slot may hold: the school's tier I-IV rows, in spellbook order. */
export const slotChoices = (school: SlotSchool): string[] => labSpellbook(school).filter((s) => s.tier > 0).map((s) => s.id);
/** The next pick for a slot, skipping rows the other slots already hold. */
export function nextSlotSpell(c: LabConfig, side: LabSide, slot: number): string {
  const school = sideSchool(c, side),
    b = sideBuild(c, side);
  if (!b.loadout || !isSlotSchool(school)) throw Error("Only a Fire or Air side has slots 1-4 to pick.");
  const choices = slotChoices(school),
    taken = b.loadout.slots.filter((_, i) => i !== slot - 1),
    from = choices.indexOf(b.loadout.slots[slot - 1]!);
  for (let i = 1; i <= choices.length; i++) {
    const id = choices[(from + i) % choices.length]!;
    if (!taken.includes(id)) return id;
  }
  return b.loadout.slots[slot - 1]!;
}

/** One picker row: the bolt and the four slots (Fire/Air: spell ids; Water: the bolt and its three lines, ranked per line). */
export interface RankRow { slot: number; label: string; keys: string[]; rank: number; spellId?: string }
const title = (s: string) => s[0]!.toUpperCase() + s.slice(1).replace(/_/g, " ");
export function rankRows(c: LabConfig, side: LabSide): RankRow[] {
  const school = sideSchool(c, side),
    b = sideBuild(c, side),
    rank = (keys: string[]) => Math.max(1, ...keys.map((k) => b.spellRanks?.[k] ?? 1));
  if (isSlotSchool(school) && b.loadout) {
    const book = labSpellbook(school);
    return [b.loadout.bolt, ...b.loadout.slots].map((id, slot) => ({
      slot, label: book.find((s) => s.id === id)?.name ?? id, keys: [id], rank: rank([id]), spellId: id,
    }));
  }
  // Water ranks follow the line row `<line>:<tier>`; one picker rank covers the line's four collar tiers.
  return [
    { slot: 0, label: "Bolt", keys: ["bolt:0"], rank: rank(["bolt:0"]) },
    ...sideComposition(c, side).lines.map((line, i) => {
      const keys = [1, 2, 3, 4].map((t) => `${line}:${t}`);
      return { slot: i + 1, label: title(line), keys, rank: rank(keys) };
    }),
  ];
}
export function withSpellRank<T extends LabConfig>(c: T, side: LabSide, slot: number, rank: number): T {
  const row = rankRows(c, side).find((r) => r.slot === slot);
  if (!row) throw Error(`No slot ${slot} on this side.`);
  const b = sideBuild(c, side);
  return withBuild(c, side, { ...b, spellRanks: { ...b.spellRanks, ...Object.fromEntries(row.keys.map((k) => [k, rank])) } });
}
/** Cycle a Water rival's composition (the opponent side's Water "loadout"); the player's Water side composes on its own screen. */
export function withRivalPreset<T extends LabConfig>(c: T, name: string): T {
  const next = structuredClone(c);
  next.rivalPreset = name;
  return withBuild(next, "opponent", { ...sideBuild(next, "opponent"), spellRanks: {} });
}
/** Every problem with a side's pick (the loadout through `validateLoadout`, via core's build check). Empty = playable. */
export const sideProblems = (c: LabConfig, side: LabSide): string[] =>
  labBuildProblems(c[buildKey(side)], sideSchool(c, side), side === "player" ? "Your build" : "Opponent build");

// Last pick per side (owner: "by default set from last battle"). Storage is a convenience: any failure or invalid record is ignored.
export const pickStorageKey = (side: LabSide) => `mage-arena.lab-pick.v1.${side}`;
export interface StoredPick { school: string; build?: LabBuild; composition?: Composition; rivalPreset?: string }
type PickStore = Pick<Storage, "getItem" | "setItem">;
const defaultStore = (): PickStore | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};
export function pickOf(c: LabConfig, side: LabSide): StoredPick {
  const build = c[buildKey(side)];
  return {
    school: sideSchool(c, side),
    ...(build ? { build: structuredClone(build) } : {}),
    ...(side === "player" ? { composition: structuredClone(c.composition) } : c.rivalPreset !== undefined ? { rivalPreset: c.rivalPreset } : {}),
  };
}
export function savePicks(c: LabConfig, store = defaultStore()): void {
  for (const side of labSides)
    try {
      store?.setItem(pickStorageKey(side), JSON.stringify(pickOf(c, side)));
    } catch {
      /* storage full or blocked: the Lab works without it */
    }
}
/** Apply one stored pick to a side; undefined when it does not make a valid Lab setup. */
export function applyPick<T extends LabConfig>(c: T, side: LabSide, pick: StoredPick): T | undefined {
  try {
    const next = structuredClone(c);
    next[schoolKey(side)] = pick.school as LabConfig["playerSchool"];
    if (pick.build) next[buildKey(side)] = structuredClone(pick.build);
    else delete next[buildKey(side)];
    if (side === "player" && pick.composition) next.composition = structuredClone(pick.composition);
    if (side === "opponent") {
      if (pick.rivalPreset !== undefined) next.rivalPreset = pick.rivalPreset;
      else delete next.rivalPreset;
    }
    validateLabConfig(next);
    return next;
  } catch {
    return undefined;
  }
}
/** The setup with each side's last stored pick applied; a side with no (or an unreadable) record keeps its setup. */
export function loadPicks<T extends LabConfig>(c: T, store = defaultStore()): T {
  let out = c;
  for (const side of labSides)
    try {
      const raw = store?.getItem(pickStorageKey(side));
      if (!raw) continue;
      out = applyPick(out, side, JSON.parse(raw) as StoredPick) ?? out;
    } catch {
      /* unreadable record: keep the side as it is */
    }
  return out;
}
