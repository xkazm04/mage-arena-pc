import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import manifestData from "../public/audio/manifest.json" with { type: "json" };
import {
  admit,
  audioData,
  audioDataProblems,
  dbGain,
  nextTrackDelay,
  playlistFor,
  settingsFrom,
  validateAudioManifest,
  variation,
  type ActiveSound,
  type Cue,
} from "./audio-policy.ts";
describe("AU4 owner-kept audio contract", () => {
  it("pins every imported file and requires trims, durations and all cue/playlist assets", () => {
    const manifest = validateAudioManifest(manifestData);
    expect(audioDataProblems(manifest)).toEqual([]);
    expect(Object.keys(manifest.assets)).toHaveLength(22);
    for (const a of Object.values(manifest.assets)) {
      const bytes = readFileSync(
        new URL(`../public/audio/${a.file}`, import.meta.url),
      );
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(a.sha256);
      expect(a.trimDb).toBeLessThanOrEqual(-3);
    }
    expect(manifest.assets["roll-step"]!.duration).toBe(0.45);
    expect(
      Object.keys(manifest.assets).some((k) => /absorb|crowd|title/.test(k)),
    ).toBe(false);
    expect(audioData.cues.perfect.assets).toEqual(["collar-b"]);
  });
  it("rejects unsafe, amplified, invalid and excessive-duration manifest entries", () => {
    for (const patch of [
      { file: "../secret.mp3" },
      { sha256: "wrong" },
      { trimDb: 6 },
      { trimDb: NaN },
      { duration: 300 },
      { kind: "stem" },
    ]) {
      const m = structuredClone(manifestData);
      Object.assign(m.assets["hit-a"], patch);
      expect(() => validateAudioManifest(m)).toThrow();
    }
    expect(() => validateAudioManifest({ version: 2, assets: {} })).toThrow();
    const missing = validateAudioManifest(structuredClone(manifestData));
    delete missing.assets["water-b"];
    expect(audioDataProblems(missing)).toContain("assets:cast.water");
  });
  it("bounds pitch and volume variation independently of gameplay RNG", () => {
    for (const cue of Object.keys(audioData.cues) as Cue[])
      for (const r of [0, 0.5, 1]) {
        const v = variation(cue, () => r),
          c = audioData.cues[cue];
        expect(c.assets).toContain(v.asset);
        expect(v.pitch).toBeGreaterThanOrEqual(c.pitch[0]!);
        expect(v.pitch).toBeLessThanOrEqual(c.pitch[1]!);
        expect(v.gain).toBeLessThanOrEqual(
          dbGain(c.gainDb + c.volumeVariationDb) + 1e-8,
        );
        expect(v.gain).toBeGreaterThanOrEqual(
          dbGain(c.gainDb - c.volumeVariationDb) - 1e-8,
        );
      }
  });
  it("drops cooldown and class floods, steals lower priority effects for a perfect, never steals criticals", () => {
    expect(admit("hit", 1, [], 0.99).reason).toBe("cooldown");
    const hit: ActiveSound = {
      id: 1,
      cue: "hit",
      bus: "effects",
      priority: 1,
      started: 0,
    };
    expect(admit("hit", 1, [hit, { ...hit, id: 2 }]).reason).toBe(
      "concurrency",
    );
    const full = Array.from(
      { length: audioData.limits.buses.effects },
      (_, id): ActiveSound => ({
        id,
        cue: "impact",
        bus: "effects",
        priority: 2,
        started: id / 10,
      }),
    );
    expect(admit("perfect", 2, full)).toEqual({
      allowed: true,
      reason: "play",
      steal: [0],
    });
    expect(
      admit(
        "perfect",
        2,
        full.map((x) => ({ ...x, priority: 0, cue: "collar" })),
      ).reason,
    ).toBe("priority");
    expect(admit("ui.confirm", 2, full).allowed).toBe(true);
  });
  it("global saturation honors priority across buses without consuming another budget on rejection", () => {
    const full = Array.from(
      { length: audioData.limits.oneShots },
      (_, id): ActiveSound => ({
        id,
        cue: "ui.click",
        bus: "ui",
        priority: 2,
        started: 0,
      }),
    );
    expect(admit("voice.collar", 10, full).steal).toEqual([0]);
    expect(full).toHaveLength(audioData.limits.oneShots);
  });
  it("maps confirmed tiers and camp phases, schedules short loops and full tracks by duration", () => {
    expect([1, 2, 3, 4].map((t) => playlistFor(`arena:${t}`)[0])).toEqual([
      "arena-a",
      "arena-c",
      "arena-d",
      "arena-a",
    ]);
    expect(playlistFor("arena:4")).toHaveLength(3);
    expect(playlistFor("camp:night")).toEqual(["camp-night"]);
    expect(playlistFor("silent")).toEqual([]);
    for (const duration of [12, 20, 120, 150, 180])
      expect(nextTrackDelay(duration)).toBe(
        duration - audioData.music.crossfadeSeconds,
      );
    expect(nextTrackDelay(150, 37)).toBe(111);
  });
  it("keeps stored settings bounded and isolated from game saves", () => {
    expect(
      settingsFrom({ master: 5, music: -1, voice: NaN, muted: true }),
    ).toMatchObject({
      master: 1,
      music: 0,
      voice: audioData.defaults.voice,
      muted: true,
    });
    expect(settingsFrom(null)).toEqual(audioData.defaults);
  });
});
