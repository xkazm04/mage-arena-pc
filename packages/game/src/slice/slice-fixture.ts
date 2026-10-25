import {
  addMage,
  createArena,
  type Actor,
  type ArenaState,
  type SchoolEffect,
  type Vec,
} from "@mage/core/arena";
import type { Element } from "../animation-contract.ts";
import { contract, type Camera, type Viewport } from "../camera.ts";
import { lightingDefaults } from "../lighting/lighting-math.ts";
import { slicePick, sliceStatus } from "./slice-pick.ts";

/**
 * Presentation constants of the D2 section 5 slice (provisional, Director default 2026-10-25, owner pick pending).
 * Nothing here reaches the sim, a save or a gameplay number: the slice is a harness fixture with its own arena state.
 *
 * - Camera: 40 degrees above the ground, T1-A's angle, inside the chosen 35-45 band (today's arena camera stays at 55).
 * - Bodies: 190 px tall at 1440p (142.5 px at 1080p), so inside 140-200 px whether the band is read at 1440p or 1080p.
 *   A body is drawn at true scale: its 1.8 m height is the 190 px, so the ground runs at 105.6 px/m at 1440p (the far
 *   camera's 1.5x figure multiplier is a distance crutch the closer camera drops).
 * - The duel sits where the verdigris floor plate paints its sand oval (60% down the frame).
 */
export const slicePresentation = {
  elevationDeg: 40,
  bodyPxAt1440: 190,
  figureHeightM: 1.8,
  duelScreen: [0.5, 0.6],
  separationM: 5.2,
  /** The ward drawn at the slice's scale; the far camera's 3.6 m visual radius would cover the duel. */
  wardRadiusM: 1.1,
  sway: { xM: 0.3, yM: 0.1, periodS: [9, 13] },
  parallax: { floor: 1, wall: 0.8, rim: 1.25 },
  plateOverscan: 1.06,
  cone: { rangeM: 4.6, degrees: 46, telegraphS: 1.2, streamS: 1.7, cycleS: 4 },
  meteor: {
    radiusM: 2,
    fallS: 3.4,
    cycleS: 5,
    flashS: 0.8,
    startLiftM: 9,
    offsetM: { x: -0.5, y: -1.2 },
  },
  beam: {
    fromM: { x: 16, y: -2.6 },
    toM: { x: -16, y: -1.7 },
    liftM: 1.1,
    flickerMs: 70,
  },
} as const;
/** What the slice draws; `d2-slice.test.ts` pins it. */
export const sliceScene = {
  bodies: ["water", "fire"],
  plates: ["floor", "wall", "rim"],
  telegraphs: ["threat.fire.cone"],
  procedural: { disc: 1, beam: 1 },
  lights: ["key", "flame", "meteor", "lightning"],
} as const;
/** Ground pixels per metre at a viewport height: the body's 190 px at 1440p over its 1.8 m. */
export const slicePxPerMetre = (height: number) =>
  (slicePresentation.bodyPxAt1440 * height) /
  1440 /
  slicePresentation.figureHeightM;
export const sliceBodyPx = (height: number) =>
  (slicePresentation.bodyPxAt1440 * height) / 1440;
/** The arena camera's zoom that gives `slicePxPerMetre` (outside the far camera's locked 0.75, so never via makeCamera). */
export const sliceZoom =
  slicePxPerMetre(contract.reference_viewport_px[1]!) /
  contract.camera.standard_ground_pixels_per_metre_at_1080p;
export function sliceSway(t: number): Vec {
  const s = slicePresentation.sway;
  return {
    x: s.xM * Math.sin((2 * Math.PI * t) / s.periodS[0]),
    y: s.yM * Math.sin((2 * Math.PI * t) / s.periodS[1]),
  };
}
/** The slice camera: a closer, lower view that frames the duel on the floor plate's sand oval. */
export function sliceCamera(viewport: Viewport, duel: Vec, t: number): Camera {
  const px = slicePxPerMetre(viewport.height),
    py = px * Math.sin((slicePresentation.elevationDeg * Math.PI) / 180),
    [sx, sy] = slicePresentation.duelScreen,
    sway = sliceSway(t);
  return {
    width: viewport.width,
    height: viewport.height,
    centre: {
      x: duel.x + sway.x - ((sx - 0.5) * viewport.width) / px,
      y: duel.y + sway.y - ((sy - 0.5) * viewport.height) / py,
    },
    zoom: sliceZoom,
    elevation: slicePresentation.elevationDeg,
  };
}
/** A spell light on the ground: a point, or a segment for the beam. `intensity` 0 is off. */
export interface SliceLight {
  id: "flame" | "meteor" | "lightning";
  at: Vec;
  to?: Vec;
  heightM: number;
  radiusM: number;
  color: [number, number, number];
  intensity: number;
}
const smooth = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
/** Deterministic 0..1 noise for flicker and jitter (presentation only, no RNG draw). */
export const sliceHash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
/**
 * Harness-only presentation state for the slice: one close duel (water mage warding, fire mage casting a flame cone),
 * a meteor whose filled-circle telegraph grows on the water mage, and a lightning beam from an air caster outside the
 * frame (the slice has two bodies). Never reaches a save, a core bout or the RNG.
 */
export class SliceFixture {
  readonly kind = "slice" as const;
  readonly state: ArenaState;
  readonly water: Actor;
  readonly fire: Actor;
  /** The beam's owner: off frame, no body. */
  readonly caster: Actor;
  readonly elements = new Map<number, Element>();
  private elapsed = 0;
  constructor(
    readonly duel: Vec,
    readonly freezeS?: number,
  ) {
    const p = slicePresentation,
      half = p.separationM / 2;
    this.state = createArena(0);
    this.water = addMage(
      this.state,
      0,
      { x: duel.x - half, y: duel.y + 0.15 },
      "Water mage",
    );
    this.fire = addMage(
      this.state,
      1,
      { x: duel.x + half, y: duel.y },
      "Fire mage",
    );
    this.caster = addMage(
      this.state,
      1,
      { x: duel.x + p.beam.fromM.x, y: duel.y + p.beam.fromM.y },
      "Air caster",
    );
    for (const [a, e] of [
      [this.water, "water"],
      [this.fire, "fire"],
      [this.caster, "air"],
    ] as const)
      this.elements.set(a.id, e);
    this.water.facing = { x: 1, y: 0 };
    this.fire.facing = { x: -1, y: 0 };
    this.water.absorb = true;
    this.water.absorbFreshTick = -600;
    this.state.schoolEffects = [
      this.effect(this.caster, "beam", {
        origin: { ...this.caster.pos },
        target: { x: duel.x + p.beam.toM.x, y: duel.y + p.beam.toM.y },
        lengthM: Math.hypot(
          p.beam.toM.x - p.beam.fromM.x,
          p.beam.toM.y - p.beam.fromM.y,
        ),
      }),
    ];
    this.update(0);
  }
  private effect(
    owner: Actor,
    kind: SchoolEffect["kind"],
    extra: Partial<SchoolEffect> & { origin: Vec; target: Vec },
  ): SchoolEffect {
    return {
      id: this.state.nextId++,
      ownerId: owner.id,
      activationId: this.state.nextId++,
      spellId: "slice",
      kind,
      startTick: 0,
      nextTick: 1e9,
      endTick: 1e9,
      damage: 0,
      family: "magic",
      tier: 1,
      hitLog: [],
      ...extra,
    };
  }
  /** Seconds into the slice's loop. */
  get timeS() {
    return this.elapsed;
  }
  /** The meteor's ground target: behind the water mage's left shoulder, so her body does not hide the disc. */
  get meteorAt(): Vec {
    const o = slicePresentation.meteor.offsetM;
    return { x: this.water.pos.x + o.x, y: this.water.pos.y + o.y };
  }
  /** The flame cone: its telegraph fills, then the flame streams at the ward; `stream` is the flame's 0..1 envelope. */
  cone() {
    const c = slicePresentation.cone,
      t = this.elapsed % c.cycleS,
      streamAge = t - c.telegraphS;
    return {
      telegraph: t < c.telegraphS,
      progress: Math.min(1, t / c.telegraphS),
      streamAge,
      stream:
        streamAge < 0
          ? 0
          : smooth(streamAge / 0.15) *
            (1 - smooth((streamAge - c.streamS) / 0.3)),
    };
  }
  /** The meteor: the disc fills while it falls (`fill` undefined once it has landed), then an impact flash. */
  meteor() {
    const m = slicePresentation.meteor,
      t = this.elapsed % m.cycleS;
    const falling = t < m.fallS,
      fill = falling ? t / m.fallS : undefined;
    return {
      fill,
      liftM: falling ? m.startLiftM * (1 - (fill ?? 1)) ** 1.6 : 0,
      flash: falling ? 0 : Math.max(0, 1 - (t - m.fallS) / m.flashS),
      sinceImpactS: falling ? undefined : t - m.fallS,
    };
  }
  /** 0.55..1, re-rolled every `flickerMs`. */
  flicker() {
    const step = Math.floor(
      (this.elapsed * 1000) / slicePresentation.beam.flickerMs,
    );
    return 0.55 + 0.45 * sliceHash(step);
  }
  /** The spell lights this frame, in ground metres (the scene adds a key light per body). */
  lights(): SliceLight[] {
    const p = slicePresentation,
      cone = this.cone(),
      meteor = this.meteor(),
      beam = this.state.schoolEffects!.find((e) => e.kind === "beam")!;
    return [
      {
        id: "flame",
        at: { x: this.fire.pos.x - 0.7, y: this.fire.pos.y + 0.1 },
        heightM: 1.25,
        radiusM: 5.5,
        color: [1, 0.55, 0.2],
        intensity: cone.stream,
      },
      {
        id: "meteor",
        at: this.meteorAt,
        heightM: Math.max(0.4, meteor.liftM),
        radiusM: 7,
        color: [1, 0.5, 0.18],
        intensity:
          meteor.fill !== undefined
            ? 0.2 + 0.8 * meteor.fill ** 2
            : 1.4 * meteor.flash,
      },
      {
        id: "lightning",
        at: beam.origin,
        to: beam.target,
        heightM: p.beam.liftM,
        radiusM: 4.5,
        color: [0.62, 0.8, 1],
        intensity: this.flicker(),
      },
    ];
  }
  update(dt: number) {
    const p = slicePresentation;
    this.elapsed =
      this.freezeS ?? this.elapsed + Math.max(0, Math.min(dt, 0.05));
    const tick = Math.floor(this.elapsed * 60);
    this.state.tick = tick;
    const meteor = this.meteor(),
      effects = this.state.schoolEffects!.filter(
        (e) => e.kind !== "detonation",
      );
    if (meteor.fill !== undefined) {
      const start = tick - Math.floor(meteor.fill * p.meteor.fallS * 60);
      effects.push(
        this.effect(this.fire, "detonation", {
          origin: { ...this.fire.pos },
          target: this.meteorAt,
          radiusM: p.meteor.radiusM,
          startTick: start,
          endTick: start + Math.round(p.meteor.fallS * 60),
        }),
      );
    }
    this.state.schoolEffects = effects;
    const cone = this.cone();
    this.state.telegraphs = cone.telegraph
      ? [
          {
            id: 1,
            activationId: 1,
            ownerId: this.fire.id,
            source: { ...this.fire.pos },
            origin: { ...this.fire.pos },
            target: { ...this.water.pos },
            kind: "melee",
            startTick:
              tick - Math.floor(cone.progress * p.cone.telegraphS * 60),
            resolveTick:
              tick -
              Math.floor(cone.progress * p.cone.telegraphS * 60) +
              Math.round(p.cone.telegraphS * 60),
            speedMps: 0,
            rangeM: p.cone.rangeM,
            widthM: p.cone.degrees,
            family: "magic",
            tier: 1,
            damage: 0,
          },
        ]
      : [];
  }
  snapshot() {
    return {
      kind: this.kind,
      status: sliceStatus,
      pick: { ...slicePick },
      presentation: {
        elevationDeg: slicePresentation.elevationDeg,
        bodyPxAt1440: slicePresentation.bodyPxAt1440,
      },
      timeS: this.elapsed,
      frozen: this.freezeS !== undefined,
      cone: this.cone(),
      meteor: this.meteor(),
      lights: this.lights().map((l) => ({
        id: l.id,
        intensity: l.intensity,
      })),
      keyLight: { color: lightingDefaults.color },
    };
  }
}
