// The window hooks the browser suites drive (`?harness=1`), declared once. arena-entry.ts and
// ui/ui.ts assign their objects with `satisfies` against these types, and the suites read the page
// through HarnessWindow, so renaming or re-signing a fixture breaks tsc instead of a 20-minute run.
// Type-only: nothing here exists at runtime.
import type { SeasonBout } from "@mage/core";
import type { BotKind, InputFrame, TrainingKind } from "@mage/core/arena";
import type { ArenaGame } from "./arena-entry.ts";
import type { ArtFixture } from "./art-fixture.ts";
import type { Palette } from "./arena-art.ts";
import type { BodyState, Direction, Element } from "./animation-contract.ts";
import type { Quality } from "./quality.ts";
import type { CanvasUI } from "./ui/ui.ts";

type Point = { x: number; y: number };

export type UiSnapshot = ReturnType<CanvasUI["snapshot"]>;
export type ArenaSnapshot = ReturnType<ArenaGame["snapshot"]>;

/** `window.__ui`, set by CanvasUI on start. */
export interface UiHarness {
  snapshot(): UiSnapshot;
  performance(): { frames: number[]; cpu: number[]; phases: Record<string, number[]>; quality: Quality };
  resetPerformance(): void;
}

/** `window.__arena` in every arena. */
export interface ArenaHarnessBase {
  snapshot(): ArenaSnapshot;
  project(p: Point): Point;
  performance(): { frames: number[] };
  frameLog(): Record<string, unknown>[];
}

/** The fixtures `window.__arena` adds under `?harness=1` outside a season bout. */
export interface ArenaFixtures {
  artFixture(kind?: ArtFixture["kind"]): void;
  artPose(state: BodyState, direction: Direction): void;
  setPalette(palette: Palette): void;
  propFixture(front: boolean): void;
  reset(kind?: TrainingKind): void;
  setBot(bot?: BotKind): void;
  clearInput(): void;
  sigilFixture(
    kind: "ring" | "cone" | "line" | "ward" | "cast" | "status",
    element?: Element,
    progress?: number,
    angle?: number,
    unblockable?: boolean,
  ): void;
  startGames(seed?: number): void;
  startRoster(id: string): void;
  setReferencePlayer(enabled: boolean): void;
  runGamesTicks(count: number): void;
  stepInput(count: number): void;
  hitFixture(
    kind: "player" | "opponent" | "defeat-player" | "defeat-opponent",
    entity?: string,
    direction?: "ne" | "se" | "sw" | "nw",
    damage?: number,
  ): void;
  feedbackFixture(kind: "hit" | "perfect" | "held" | "cast" | "warning", flow?: number): void;
  visualFixture(kind: string, direction?: number): void;
  panPlayer(pos: Point): void;
}

/** What arena-entry.ts assigns: the fixtures exist only under `?harness=1`. */
export type ArenaHarnessHooks = ArenaHarnessBase & Partial<ArenaFixtures>;
/** What a suite sees: it always loads `?harness=1`. */
export type ArenaHarness = ArenaHarnessBase & ArenaFixtures;

/** `window.__seasonArena` in a season bout under `?harness=1`. */
export interface SeasonArenaHarness {
  snapshot(): SeasonBout;
  pause(paused: boolean): void;
  inputs(frames: InputFrame[]): Promise<void>;
}

export type HarnessWindow = Window & {
  __ui: UiHarness;
  __arena: ArenaHarness;
  __seasonArena?: SeasonArenaHarness;
};
