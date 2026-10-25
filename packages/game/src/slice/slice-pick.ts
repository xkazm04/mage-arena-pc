import data from "../../data/slice-d2s.json" with { type: "json" };
/**
 * The D2 section 5 mastery slice's asset pick, as data (`data/slice-d2s.json`).
 *
 * PROVISIONAL: Director default 2026-10-25, owner pick pending. Each slot names a candidate of
 * `art/delivery/d2s/candidates.json` (a body's `scene`, a plate set's `palette`): the builder's rank-1 body per slot
 * and verdigris, the only plate set that matches T2-A's 45-degree view. The owner's pick replaces the ids here and
 * `packages/tools/art/slice-assets.mts` copies the picked files into `public/`; candidates.json `ownerPick` stays the
 * owner's own field and is never written from code.
 */
export const sliceStatus: string = data.status;
export type SliceSlot = "water" | "fire" | "plates";
export const sliceSlots: readonly SliceSlot[] = ["water", "fire", "plates"];
export type SlicePick = Record<SliceSlot, string>;
export const slicePick: SlicePick = { ...data.pick };
/** The candidates.json `slot` each body slot draws from. */
export const candidateSlot = {
  water: "water mage",
  fire: "fire mage",
  plates: "arena plate set",
} as const satisfies Record<SliceSlot, string>;
export const bodyFiles = {
  color: "color.png",
  normalPainted: "normal-painted.png",
  normalDerived: "normal-derived.png",
} as const;
export const plateFiles = {
  floor: "floor.jpg",
  wall: "wall.png",
  rim: "rim.png",
} as const;
/** Served from `packages/game/public/`; only the picked candidates are copied there. */
export const slicePublicDir = "slice/d2s";
export interface SliceFile {
  slot: SliceSlot;
  role: string;
  /** Repo-relative delivery file. */
  source: string;
  /** Relative to `packages/game/public/`. */
  target: string;
}
const id = /^[a-z][a-z-]*[a-z]$/;
/** Every file the picked slice needs, where it comes from and where the game serves it. */
export function sliceFiles(pick: SlicePick = slicePick): SliceFile[] {
  for (const slot of sliceSlots)
    if (!id.test(pick[slot]) || pick[slot].includes("--"))
      throw Error(`Invalid slice pick ${slot}: ${pick[slot]}`);
  const body = (slot: "water" | "fire") =>
    Object.entries(bodyFiles).map(([role, file]) => ({
      slot,
      role,
      source: `art/delivery/d2s/bodies/${pick[slot]}/${file}`,
      target: `${slicePublicDir}/${pick[slot]}/${file}`,
    }));
  return [
    ...body("water"),
    ...body("fire"),
    ...Object.entries(plateFiles).map(([role, file]) => ({
      slot: "plates" as const,
      role,
      source: `art/delivery/d2s/plates/${pick.plates}/${file}`,
      target: `${slicePublicDir}/plates-${pick.plates}/${file}`,
    })),
  ];
}
export const sliceUrl = (slot: SliceSlot, role: string, pick = slicePick) =>
  `/${sliceFiles(pick).find((f) => f.slot === slot && f.role === role)!.target}`;
/** `?slice=d2s` opens the slice in place of the arena (outside a season bout); without it nothing changes. */
export function sliceRequested(search = globalThis.location?.search ?? "") {
  return new URLSearchParams(search).get("slice") === "d2s";
}
export interface SliceOptions {
  /** `?sliceNormals=derived` lights the bodies with the derived maps (0 calls) instead of the painted ones. */
  normals: "painted" | "derived";
  /** `?sliceGrade=off` drops the colour grade and vignette, to judge the plates as painted. */
  grade: boolean;
  /** `?sliceAt=<s>` holds the slice at one moment of its loop (screenshots); otherwise it plays. */
  freezeS?: number;
}
export function pickSliceOptions(
  search = globalThis.location?.search ?? "",
): SliceOptions {
  const p = new URLSearchParams(search),
    at = Number(p.get("sliceAt"));
  return {
    normals:
      p.get("sliceNormals") === "derived"
        ? "derived"
        : p.get("sliceNormals") === "painted"
          ? "painted"
          : data.normals === "derived"
            ? "derived"
            : "painted",
    grade: p.get("sliceGrade") !== "off",
    freezeS:
      p.has("sliceAt") && Number.isFinite(at) && at >= 0 ? at : undefined,
  };
}
