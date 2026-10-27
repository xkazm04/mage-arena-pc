import { describe, expect, it } from "vitest";
import manifestData from "../public/audio/manifest.json" with { type: "json" };
import type { ArenaEvent, School } from "@mage/core/arena";
import {
  audioData,
  audioDataProblems,
  validateAudioManifest,
} from "./audio-policy.ts";
import {
  routeCues,
  routeEvent,
  spatialMix,
  type RouteActor,
} from "./audio-routing.ts";

const listener = { id: 1, pos: { x: 10, y: 10 } };
const ev = (
  kind: ArenaEvent["kind"],
  actorId: number,
  value = 0,
  contactDamage?: number,
) => ({ kind, actorId, value, contactDamage });

/**
 * The audio half of arena-entry.ts consumeEvents as it stood at 13c8fc3, plus the down, interrupt and phase branches added with their routes (M3), verbatim except that
 * `gameAudio.play` records its call. The router must reproduce every call it makes.
 */
function legacy(
  e: ReturnType<typeof ev>,
  p: { id: number; pos: { x: number; y: number } },
  actor: RouteActor | undefined,
) {
  const calls: { cue: string; options?: { pan?: number; gain?: number } }[] =
    [];
  const gameAudio = {
    play: (cue: string, options?: { pan?: number; gain?: number }) =>
      calls.push(options ? { cue, options } : { cue }),
  };
  if (!actor) return calls;
  const dx = actor.pos.x - p.pos.x,
    dy = actor.pos.y - p.pos.y;
  const spatial = {
    pan: dx / audioData.spatial.rangeM,
    gain: Math.max(
      audioData.spatial.minGain,
      1 - Math.hypot(dx, dy) / audioData.spatial.rangeM,
    ),
  };
  if (e.kind === "perfect" && e.actorId === p.id) {
    void gameAudio.play("perfect");
  } else if (e.kind === "unlock" && e.actorId === p.id) {
    void gameAudio.play("collar");
    if (e.value === 2) {
      void gameAudio.play("voice.collar");
    }
  } else if (e.kind === "release")
    void gameAudio.play(
      actor.enemy ? "impact" : `cast.${actor.school ?? "water"}`,
      spatial,
    );
  else if (e.kind === "hit" && (e.contactDamage ?? e.value) > 0) {
    const damage = e.contactDamage ?? e.value;
    void gameAudio.play(e.actorId === p.id ? "hit" : "impact", {
      ...spatial,
      gain: spatial.gain * Math.min(1, 0.45 + damage / 25),
    });
  } else if (e.kind === "stagger") void gameAudio.play("stagger", spatial);
  else if (e.kind === "roll") void gameAudio.play("roll", spatial);
  else if (e.kind === "down") void gameAudio.play("down", spatial);
  else if (e.kind === "interrupt") void gameAudio.play("interrupt", spatial);
  else if (e.kind === "phase") void gameAudio.play("phase");
  return calls;
}

describe("event-to-cue router (audio.json routes)", () => {
  it("case 1: a player Fire release at the listener plays cast.fire centred at full gain", () => {
    const actor = { id: 1, pos: listener.pos, school: "fire" as School };
    expect(routeEvent(ev("release", 1), { listener, actor })).toEqual([
      { cue: "cast.fire", pan: 0, gain: 1 },
    ]);
  });
  it("case 2: an enemy release half the range to the right pans 0.5 at half gain", () => {
    const actor = { id: 7, pos: { x: 28, y: 10 }, enemy: true };
    expect(audioData.spatial.rangeM).toBe(36);
    expect(routeEvent(ev("release", 7), { listener, actor })).toEqual([
      { cue: "impact", pan: 0.5, gain: 0.5 },
    ]);
  });
  it("case 3: a mage with no school falls back to cast.water", () => {
    const actor = { id: 1, pos: listener.pos };
    expect(routeEvent(ev("release", 1), { listener, actor })).toEqual([
      { cue: "cast.water", pan: 0, gain: 1 },
    ]);
  });
  it("case 4: a zero hit is silent; a far contact hit sits on the gain floor scaled by damage", () => {
    const near = { id: 7, pos: listener.pos, enemy: true };
    expect(routeEvent(ev("hit", 7, 0), { listener, actor: near })).toEqual([]);
    const far = { id: 7, pos: { x: 50, y: 10 }, enemy: true };
    const [r, ...rest] = routeEvent(ev("hit", 7, 0, 11), {
      listener,
      actor: far,
    });
    expect(rest).toEqual([]);
    expect(r!.cue).toBe("impact");
    expect(r!.gain).toBeCloseTo(0.15 * 0.89, 12);
  });
  it("case 5: the player's collar unlock adds the voice line only at value 2; a rival's is silent", () => {
    const me = { id: 1, pos: listener.pos },
      rival = { id: 9, pos: listener.pos };
    const cues = (actorId: number, value: number, actor: RouteActor) =>
      routeEvent(ev("unlock", actorId, value), { listener, actor }).map(
        (r) => r.cue,
      );
    expect(cues(1, 2, me)).toEqual(["collar", "voice.collar"]);
    expect(cues(1, 1, me)).toEqual(["collar"]);
    expect(cues(9, 2, rival)).toEqual([]);
  });
  it("case 6: audioDataProblems names a route whose cue does not exist", () => {
    const manifest = validateAudioManifest(structuredClone(manifestData));
    const broken = structuredClone(audioData);
    broken.routes.stagger[0]!.cue = "stagger.missing";
    expect(audioDataProblems(manifest, broken)).toContain("routes:stagger");
    expect(audioDataProblems(manifest)).toEqual([]);
  });
  it("case 8: every cue the router can emit, templates expanded, has a cue with manifest assets", () => {
    const manifest = validateAudioManifest(structuredClone(manifestData));
    const emitted = Object.values(audioData.routes).flatMap((rs) =>
      rs.flatMap(routeCues),
    );
    for (const s of ["water", "fire", "earth", "air"])
      expect(emitted).toContain(`cast.${s}`);
    for (const cue of emitted) {
      const c = (
        audioData.cues as Record<string, { assets: string[] } | undefined>
      )[cue];
      expect(c, cue).toBeDefined();
      for (const a of c!.assets) expect(manifest.assets).toHaveProperty(a);
    }
  });
  it("case 9: down and interrupt play their cut cues spatially for any actor", () => {
    const actor = { id: 7, pos: { x: 28, y: 10 }, enemy: true };
    for (const kind of ["down", "interrupt"] as const)
      expect(routeEvent(ev(kind, 7), { listener, actor })).toEqual([
        { cue: kind, pan: 0.5, gain: 0.5 },
      ]);
    const me = { id: 1, pos: listener.pos };
    expect(routeEvent(ev("down", 1), { listener, actor: me })).toEqual([
      { cue: "down", pan: 0, gain: 1 },
    ]);
  });
  it("case 10: a rival phase shift plays the unpanned phase cue at default gain", () => {
    const actor = { id: 7, pos: { x: 28, y: 10 }, enemy: true };
    expect(routeEvent(ev("phase", 7, 2), { listener, actor })).toEqual([
      { cue: "phase" },
    ]);
  });
  it("keeps today's unclamped pan (audio.ts applies maxPan, not the router)", () => {
    expect(spatialMix(36, 0).pan).toBe(1);
    expect(spatialMix(-72, 0).pan).toBe(-2);
    expect(audioData.spatial.maxPan).toBeLessThan(1);
  });
  it("reproduces every call of the old arena-entry switch (table over its cases)", () => {
    const kinds: ArenaEvent["kind"][] = [
      "perfect",
      "hit",
      "cast",
      "release",
      "down",
      "unlock",
      "interrupt",
      "roll",
      "stagger",
      "phase",
    ];
    const positions = [
      listener.pos,
      { x: 28, y: 10 },
      { x: -40, y: 3 },
      { x: 13.7, y: -22.1 },
    ];
    const actors: (Omit<RouteActor, "pos"> | undefined)[] = [
      undefined,
      { id: 1 },
      { id: 1, school: "fire" },
      { id: 2, school: "earth" },
      { id: 2, school: "air" },
      { id: 2, school: "water" },
      { id: 2 },
      { id: 7, enemy: true },
      { id: 7, enemy: true, school: "fire" },
      { id: 1, enemy: true },
    ];
    let cases = 0,
      played = 0;
    for (const kind of kinds)
      for (const a of actors)
        for (const pos of positions)
          for (const [value, contact] of [
            [0, undefined],
            [1, undefined],
            [2, undefined],
            [11, undefined],
            [40, undefined],
            [0, 11],
            [5, 0],
            [0, 0],
          ] as const) {
            const actor = a && { ...a, pos };
            const e = ev(kind, a?.id ?? 1, value, contact);
            const want = legacy(e, listener, actor).map((c) =>
              c.options ? { cue: c.cue, ...c.options } : { cue: c.cue },
            );
            expect(
              routeEvent(e, { listener, actor }),
              JSON.stringify({ e, actor }),
            ).toEqual(want);
            cases++;
            played += want.length;
          }
    expect(cases).toBe(3200);
    expect(played).toBeGreaterThan(400);
  });
});
