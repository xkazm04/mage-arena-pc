import quality from "../../data/quality.json" with { type: "json" };
import { clampUiScale } from "../ui/layout.ts";

/** Graphics tiers the player picks; each maps onto a profile of `data/quality.json` (see `qualityProfile`). */
export const qualityTiers = ["high", "balanced", "low"] as const;
export type QualityTier = (typeof qualityTiers)[number];
export type WindowMode = "windowed" | "fullscreen";

export interface Settings {
  version: 1;
  /** Multiplies the layout scale; clamped to `uiScaleRange`. */
  uiScale: number;
  windowMode: WindowMode;
  quality: QualityTier;
  reducedMotion: boolean;
}

export const settingsKey = "mage-settings";
/** Read directly by arena-entry, arena-scene and the UI; the settings module keeps it in sync. */
export const motionKey = "mage-motion";
export const settingsVersion = 1;
export const defaultSettings: Settings = {
  version: settingsVersion,
  uiScale: 1,
  windowMode: "windowed",
  quality: "high",
  reducedMotion: false,
};

type Store = Pick<Storage, "getItem" | "setItem">;
const browserStore = (): Store | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

/** The quality.json profile a tier asks for; a tier whose profile does not exist falls back to `desktop`. */
export function qualityProfile(tier: QualityTier): string {
  const asked = { high: "desktop", balanced: "balanced", low: "low" }[tier];
  return asked in quality.profiles ? asked : "desktop";
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Turns any stored value into valid settings: unknown or out-of-range fields fall back to their defaults one by one,
 * and an older (or unversioned) record is migrated to the current version.
 */
export function validateSettings(raw: unknown): Settings {
  const d = defaultSettings;
  if (!isObject(raw)) return { ...d };
  // Version 0 is the unversioned record; it has the same fields, so migration is only re-stamping the version.
  const v = raw as Partial<Record<keyof Settings, unknown>>;
  return {
    version: settingsVersion,
    uiScale:
      typeof v.uiScale === "number" && Number.isFinite(v.uiScale)
        ? clampUiScale(v.uiScale)
        : d.uiScale,
    windowMode: v.windowMode === "fullscreen" ? "fullscreen" : d.windowMode,
    quality: qualityTiers.includes(v.quality as QualityTier)
      ? (v.quality as QualityTier)
      : d.quality,
    reducedMotion:
      typeof v.reducedMotion === "boolean" ? v.reducedMotion : d.reducedMotion,
  };
}

/** Loads the one settings key. A first run carries the legacy `mage-motion` choice over; later, that key wins for motion. */
export function loadSettings(store: Store | undefined = browserStore()) {
  let parsed: unknown;
  try {
    const text = store?.getItem(settingsKey);
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = undefined;
  }
  const loaded = validateSettings(parsed);
  const motion = store?.getItem(motionKey);
  if (motion === "reduced" || motion === "full")
    loaded.reducedMotion = motion === "reduced";
  return loaded;
}

export function saveSettings(
  value: Settings,
  store: Store | undefined = browserStore(),
) {
  try {
    store?.setItem(settingsKey, JSON.stringify(value));
    store?.setItem(motionKey, value.reducedMotion ? "reduced" : "full");
  } catch {
    // A full or blocked store only costs persistence; the in-memory value still applies.
  }
}

let current: Settings | undefined;
const listeners = new Set<(s: Settings) => void>();
/** The live settings, loaded on first use. */
export function settings(): Settings {
  return (current ??= loadSettings());
}
/** Applies a change, persists it and tells listeners. */
export function updateSettings(change: Partial<Omit<Settings, "version">>) {
  current = validateSettings({ ...settings(), ...change });
  saveSettings(current);
  for (const listener of listeners) listener(current);
  return current;
}
export function onSettings(listener: (s: Settings) => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
/** Test hook: forget the cached settings. */
export function resetSettingsCache() {
  current = undefined;
}
