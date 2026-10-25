// The one place the browser suites' frame and texture budgets live. Values are copied from the suites
// that hand-typed them; a budget change is one edit here. Suites migrate onto these one by one.

export const BUDGET_FILE = "packages/tools/src/smoke/budgets.ts";

export interface FrameBudget {
  /** Mean frames per second over the sample, at least. */
  fpsMin: number;
  /** 95th-percentile main-thread CPU per frame (ms), below. */
  cpuP95Max: number;
}

const FRAME = {
  /** HUD + 100 projectiles in the tour (u1/u2/u3/u6-tour). */
  stress: { fpsMin: 50, cpuP95Max: 8 },
  /** 60 fps target tolerance with the arena art resident (u4/u5). */
  steady: { fpsMin: 58, cpuP95Max: 8 },
  /** 60 fps +/-2% (u6, u6b-performance, u6c-performance). */
  strict: { fpsMin: 58.8, cpuP95Max: 8 },
} as const satisfies Record<string, FrameBudget>;

const TEXTURE_MIB = {
  /** Arena stress fixture: art + UI + fonts + derived textures (u5). */
  arena: 300,
  /** The camp-to-arena route at 1080p measures 387 MiB; 400 is the stopgap until the owner sets it (u4). */
  "camp-to-arena": 400,
} as const satisfies Record<string, number>;

export type FrameProfile = keyof typeof FRAME;
export type TextureProfile = keyof typeof TEXTURE_MIB;

export const frame = (profile: FrameProfile): FrameBudget => ({ ...FRAME[profile] });
export const textureMiB = (profile: TextureProfile): number => TEXTURE_MIB[profile];
/** Bytes under the profile's ceiling. */
export const textureBytes = (profile: TextureProfile): number => TEXTURE_MIB[profile] * 1024 * 1024;
