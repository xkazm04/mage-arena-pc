import { beforeEach, describe, expect, it } from "vitest";
import {
  defaultSettings,
  loadSettings,
  motionKey,
  qualityProfile,
  saveSettings,
  settingsKey,
  validateSettings,
} from "./settings.ts";

const memory = () => {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};

describe("settings", () => {
  let store: ReturnType<typeof memory>;
  beforeEach(() => {
    store = memory();
  });

  it("loads the defaults on a first run", () => {
    expect(loadSettings(store)).toEqual(defaultSettings);
    expect(defaultSettings.version).toBe(1);
  });
  it("round-trips through the one key and mirrors motion to mage-motion", () => {
    const s = {
      ...defaultSettings,
      uiScale: 1.25,
      windowMode: "fullscreen" as const,
      quality: "low" as const,
      reducedMotion: true,
    };
    saveSettings(s, store);
    expect(store.m.has(settingsKey)).toBe(true);
    expect(store.m.get(motionKey)).toBe("reduced");
    expect(loadSettings(store)).toEqual(s);
    saveSettings({ ...s, reducedMotion: false }, store);
    expect(store.m.get(motionKey)).toBe("full");
  });
  it("migrates an unversioned record and the legacy motion key", () => {
    store.m.set(settingsKey, JSON.stringify({ uiScale: 1.1 }));
    store.m.set(motionKey, "reduced");
    expect(loadSettings(store)).toEqual({
      ...defaultSettings,
      uiScale: 1.1,
      reducedMotion: true,
    });
    const legacyOnly = memory();
    legacyOnly.m.set(motionKey, "reduced");
    expect(loadSettings(legacyOnly).reducedMotion).toBe(true);
  });
  it("falls back field by field on corrupt values", () => {
    expect(
      validateSettings({
        version: 99,
        uiScale: "big",
        windowMode: "borderless",
        quality: "ultra",
        reducedMotion: "yes",
      }),
    ).toEqual(defaultSettings);
    expect(validateSettings({ uiScale: 9 }).uiScale).toBe(1.5);
    expect(validateSettings({ uiScale: 0.1 }).uiScale).toBe(0.75);
    expect(validateSettings({ uiScale: NaN }).uiScale).toBe(1);
    expect(validateSettings([1, 2])).toEqual(defaultSettings);
    expect(validateSettings(null)).toEqual(defaultSettings);
  });
  it("survives unparsable storage", () => {
    store.m.set(settingsKey, "{not json");
    expect(loadSettings(store)).toEqual(defaultSettings);
  });
  it("maps every tier onto an existing quality profile", () => {
    for (const tier of ["high", "balanced", "low"] as const)
      expect(qualityProfile(tier)).toBe("desktop");
  });
});
