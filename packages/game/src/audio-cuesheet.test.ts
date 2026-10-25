import { describe, expect, it } from "vitest";
import manifestData from "../public/audio/manifest.json" with { type: "json" };
import {
  admit,
  audioData,
  validateAudioManifest,
  type ActiveSound,
  type Cue,
  type OneShotBus,
} from "./audio-policy.ts";
import {
  boutCueSheet,
  cueSheet,
  formatCueSheet,
  type SheetRow,
} from "./audio-cuesheet.ts";

const manifest = validateAudioManifest(manifestData);
const sheet = (requests: { t: number; cue: string }[], events = []) =>
  cueSheet(requests, manifest, { events });

/** Most effects rows sounding at once, recomputed from the rows alone (start, then end or steal). */
function peakFromRows(rows: SheetRow[], bus: OneShotBus) {
  const edges = rows
    .filter((r) => r.outcome === "play" && r.bus === bus)
    .flatMap((r) => [
      { t: r.t, d: 1 },
      { t: Math.min(r.ends!, r.stolenAt ?? Infinity), d: -1 },
    ])
    .sort((a, b) => a.t - b.t || a.d - b.d);
  let n = 0,
    peak = 0;
  for (const e of edges) peak = Math.max(peak, (n += e.d));
  return peak;
}

describe("audio cue sheet", () => {
  it("case 1: a second hit inside its 120 ms cooldown drops as cooldown", () => {
    expect(audioData.cues.hit.cooldownMs).toBe(120);
    const { rows } = sheet([
      { t: 0, cue: "hit" },
      { t: 0.05, cue: "hit" },
    ]);
    expect(rows.map((r) => r.outcome)).toEqual(["play", "cooldown"]);
  });

  it("case 2: a fourth cast.fire while three still sound drops as concurrency", () => {
    // Spaced past the 100 ms cooldown so only the concurrency cap (3) can drop the fourth.
    const { rows } = sheet(
      [0, 0.15, 0.3, 0.5].map((t) => ({ t, cue: "cast.fire" })),
    );
    expect(rows.slice(0, 3).every((r) => r.ends! > 0.5)).toBe(true);
    expect(rows.map((r) => r.outcome)).toEqual([
      "play",
      "play",
      "play",
      "concurrency",
    ]);
  });

  it("case 3: a full effects bus gives 'perfect' the oldest priority-2 voice, as admit() does", () => {
    const fill: { t: number; cue: Cue }[] = [
      { t: 0, cue: "impact" },
      { t: 0.15, cue: "impact" },
      { t: 0.3, cue: "impact" },
      { t: 0.45, cue: "cast.fire" },
      { t: 0.6, cue: "cast.fire" },
      { t: 0.75, cue: "cast.fire" },
      { t: 0.9, cue: "hit" },
      { t: 1.05, cue: "hit" },
    ];
    // Spaced past every cooldown (and float drift) so each cue fills within its own concurrency.
    const { rows, summary } = sheet([...fill, { t: 1.2, cue: "perfect" }]);
    expect(rows.slice(0, 8).map((r) => r.outcome)).toEqual(
      Array(8).fill("play"),
    );
    expect(audioData.limits.buses.effects).toBe(8);
    expect(rows.slice(0, 8).every((r) => r.ends! > 1.2)).toBe(true);
    const active: ActiveSound[] = rows.slice(0, 8).map((r) => ({
      id: r.id,
      cue: r.cue as Cue,
      bus: "effects",
      priority: audioData.cues[r.cue as Cue].priority,
      started: r.t,
    }));
    const live = admit("perfect", 1.2, active);
    expect(live).toEqual({
      allowed: true,
      reason: "play",
      steal: [rows[0]!.id],
    });
    expect(rows[8]!.outcome).toBe("play");
    const stolen = rows.filter((r) => r.stolenBy);
    expect(stolen).toHaveLength(1);
    expect(stolen[0]).toMatchObject({
      id: live.steal[0],
      cue: "impact",
      t: 0,
      stolenBy: "perfect",
      stolenAt: 1.2,
    });
    expect(summary.cues.impact!.stolen).toBe(1);
  });

  it("case 4: a sound ends at start + asset duration / pitch and frees its slot", () => {
    const first = sheet([{ t: 0, cue: "hit" }]).rows[0]!;
    const duration = manifest.assets[first.asset!]!.duration;
    expect(first.ends).toBeCloseTo(duration / first.pitch!, 9);
    const at = (t: number) =>
      sheet([
        { t: 0, cue: "hit" },
        { t: 0.2, cue: "hit" },
        { t, cue: "hit" },
      ]).rows[2]!.outcome;
    expect(at(first.ends! - 0.001)).toBe("concurrency");
    expect(at(first.ends! + 0.001)).toBe("play");
  });

  it("case 5: sim event kinds with no route are counted as silent", () => {
    const events = [
      { kind: "down" },
      { kind: "interrupt" },
      { kind: "hit" },
      { kind: "down" },
      { kind: "interrupt" },
      { kind: "interrupt" },
    ];
    const { summary } = cueSheet([], manifest, { events });
    expect(summary.silentKinds).toEqual({ down: 2, interrupt: 3 });
  });

  it("case 6: peakBus.effects is the most effects rows sounding at once, never past the bus limit", () => {
    const flood = Array.from({ length: 60 }, (_, i) => ({
      t: i * 0.04,
      cue: ["impact", "cast.fire", "cast.water", "hit", "roll", "stagger"][
        i % 6
      ]!,
    }));
    for (const s of [sheet(flood), boutCueSheet(7, manifest).sheet]) {
      expect(s.summary.peakBus.effects).toBe(peakFromRows(s.rows, "effects"));
      expect(s.summary.peakBus.effects).toBeLessThanOrEqual(
        audioData.limits.buses.effects,
      );
    }
    expect(sheet(flood).summary.peakBus.effects).toBe(8);
  });

  it("case 7: one seed renders a byte-identical sheet twice", () => {
    const a = boutCueSheet(7, manifest),
      b = boutCueSheet(7, manifest);
    expect(a.sheet.rows.length).toBeGreaterThan(0);
    expect(formatCueSheet(a)).toBe(formatCueSheet(b));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(formatCueSheet(boutCueSheet(8, manifest))).not.toBe(
      formatCueSheet(a),
    );
  });
});
