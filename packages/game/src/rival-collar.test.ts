import { describe, expect, it } from "vitest";
import {
  combat,
  createGames,
  createLab,
  defaultLabConfig,
  idleInput,
  presets,
  resolveHit,
  runtime,
  stepGames,
  stepLab,
  ticks,
  tiro,
  type Actor,
  type Games,
} from "@mage/core/arena";
import {
  collarClock,
  rivalRune,
  rivalRunes,
  runeCrop,
  runeOffset,
  unlockPulse,
  rivalCollarPolicy,
} from "./rival-collar.ts";

const reference = presets.find(
  (p) => p.name === runtime.games.referencePreset,
)!;
const rivalsOf = (g: Games) =>
  g.state.actors.filter((a) => a.team !== g.player.team);
const advance = combat.tierClock.perfectAbsorbAdvanceS,
  gap = combat.tierClock.minimumSecondsBetweenUnlocks;

function perfect(g: Games, from: Actor) {
  const p = g.player;
  p.absorb = true;
  p.absorbFreshTick = g.state.tick;
  p.facing = { x: Math.sign(from.pos.x - p.pos.x) || 1, y: 0 };
  return resolveHit(g.state, p, {
    ownerId: from.id,
    activationId: 0,
    damage: 1,
    family: "magic",
    tier: 1,
    source: { x: p.pos.x + p.facing.x, y: p.pos.y },
  });
}

describe("rival collar rune", () => {
  for (const wave of [2, 3])
    for (const seed of [1, 8]) // seed 7's wave 3 rival falls before its second unlock at pace
      it(`tracks actor.tier and predicts every unlock over a full Tiro bout (wave ${wave + 1}, seed ${seed})`, () => {
        const g = createGames(seed, reference, wave, true);
        expect(tiro.waves[wave]!.kind).not.toMatch(/soldiers|creatures/);
        const rival = rivalsOf(g)[0]!;
        expect(rival.mageAI).toBeDefined();
        let prev = rivalRune(g.state, rival, g.player)!,
          prevAdvance = rival.clockAdvanceTicks,
          checked = 0,
          predicted = 0;
        const unlocks: number[] = [];
        while (
          g.phase === "active" &&
          g.state.tick < ticks(runtime.games.fightTimeoutS)
        ) {
          stepGames(g);
          // The reference player also runs a mage brain; its own collar never shows as a rival.
          expect(rivalRune(g.state, g.player, g.player)).toBeUndefined();
          const rune = rivalRune(g.state, rival, g.player);
          if (rival.tags.includes("DEFEATED")) {
            expect(rune).toBeUndefined();
            break;
          }
          expect(rune!.tier).toBe(rival.tier);
          expect(rune!.lit.filter(Boolean).length).toBe(rival.tier);
          expect(rune!.lit).toEqual([0, 1, 2, 3].map((i) => i < rival.tier));
          // Post-step, the kernel has already unlocked anything due, so a tier below IV is always still counting.
          if (rune!.tier < 4) expect(rune!.untilS).toBeGreaterThan(0);
          if (rune!.tier > prev.tier) {
            unlocks.push(g.state.tick);
            if (rival.clockAdvanceTicks === prevAdvance) {
              expect(prev.untilS).toBeLessThanOrEqual(1 / 60 + 1e-9);
              predicted++;
            }
          }
          prev = rune!;
          prevAdvance = rival.clockAdvanceTicks;
          checked++;
        }
        expect(unlocks.length).toBeGreaterThanOrEqual(2);
        expect(predicted).toBeGreaterThan(0);
        expect(checked).toBeGreaterThan(ticks(30));
        console.log(
          `wave ${wave + 1} seed ${seed}: ${checked} ticks, rival unlocks at ${unlocks.map((t) => (t / 60).toFixed(2)).join(", ")} s, final tier ${rival.tier}, outcome ${g.phase}`,
        );
      });

  it("a scripted player perfect moves only the player's countdown, by perfectAbsorbAdvanceS, floored by the 6 s gap", () => {
    const g = createGames(3, reference, 2, false),
      rival = rivalsOf(g)[0]!;
    for (let i = 0; i < 60; i++) stepGames(g);
    const rivalBefore = rivalRune(g.state, rival, g.player)!,
      before = collarClock(g.state, g.player);
    expect(before.untilS).toBeCloseTo(15 - 1, 9);
    expect(perfect(g, rival).perfect).toBe(true);
    const after = collarClock(g.state, g.player);
    expect(before.untilS - after.untilS).toBeCloseTo(advance, 9);
    expect(rivalRune(g.state, rival, g.player)).toEqual(rivalBefore);
    // Four more perfects would leave 2 s on the interval, but only 1 s has passed since the last unlock.
    for (let i = 0; i < 4; i++) expect(perfect(g, rival).perfect).toBe(true);
    const floored = collarClock(g.state, g.player);
    expect(15 - 1 - 5 * advance).toBeLessThan(gap - 1);
    expect(floored.untilS).toBeCloseTo(gap - 1, 9);
    expect(rivalRune(g.state, rival, g.player)).toEqual(rivalBefore);
    const due = g.state.tick + ticks(floored.untilS);
    while (g.player.tier === 1 && g.state.tick < due + 5) {
      stepGames(g, idleInput());
      if (g.player.tier === 1)
        expect(collarClock(g.state, g.player).untilS).toBeGreaterThan(0);
    }
    expect(g.player.tier).toBe(2);
    expect(g.player.lastUnlockTick).toBe(due);
    console.log(
      `player countdown ${before.untilS.toFixed(3)} -> ${after.untilS.toFixed(3)} after one perfect, ${floored.untilS.toFixed(3)} after five (gap floor), unlock at tick ${due}; rival countdown stayed ${rivalBefore.untilS.toFixed(3)}`,
    );
  });

  for (const wave of [0, 1])
    it(`draws no rival collar for a ${tiro.waves[wave]!.kind} wave`, () => {
      const g = createGames(5, reference, wave, true);
      let maxTier = 1,
        steps = 0;
      while (
        g.phase === "active" &&
        g.state.tick < ticks(runtime.games.fightTimeoutS)
      ) {
        stepGames(g);
        steps++;
        expect(rivalRunes(g.state, g.player)).toEqual([]);
        for (const a of rivalsOf(g)) maxTier = Math.max(maxTier, a.tier);
      }
      // Not vacuous: the enemies ran the collar clock, they just never show it.
      expect(rivalsOf(g).every((a) => a.enemy && !a.mageAI)).toBe(true);
      expect(maxTier).toBeGreaterThan(1);
      console.log(
        `${tiro.waves[wave]!.kind}: ${steps} ticks, enemy tier reached ${maxTier}, rival runes drawn 0`,
      );
    });

  it("shows a Lab mage rival but never a practice dummy", () => {
    const mage = createLab({ ...defaultLabConfig, opponent: "mage" }),
      dummy = createLab({ ...defaultLabConfig, dummyAttack: "still" });
    for (let i = 0; i < ticks(16); i++) {
      stepLab(mage, idleInput(), false);
      stepLab(dummy, idleInput(), false);
    }
    const t = mage.training;
    expect(rivalRune(t.state, t.dummy, t.player)?.tier).toBe(t.dummy.tier);
    expect(rivalRunes(dummy.training.state, dummy.training.player)).toEqual([]);
  });

  it("lays four runes on the front arc and crops the painted N/E/S/W runes", () => {
    const offsets = [0, 1, 2, 3].map(runeOffset);
    for (const o of offsets) {
      expect(Math.hypot(o.x, o.y)).toBeCloseTo(rivalCollarPolicy.radiusM, 9);
      expect(o.y).toBeGreaterThanOrEqual(0);
    }
    expect(offsets.map((o) => o.x)).toEqual(
      [...offsets.map((o) => o.x)].sort((a, b) => a - b),
    );
    for (const [u, v, w, h] of [0, 1, 2, 3].map(runeCrop)) {
      expect(u).toBeGreaterThanOrEqual(0);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(u + w).toBeLessThanOrEqual(1);
      expect(v + h).toBeLessThanOrEqual(1);
    }
    const rune = {
      tier: 2,
      untilS: 3,
      progress: 0.8,
      actorId: 1,
      lit: [true, true, false, false],
      unlockAgeS: 0,
    };
    expect(unlockPulse(rune, false)).toBe(1);
    expect(unlockPulse(rune, true)).toBe(0);
    expect(
      unlockPulse(
        { ...rune, unlockAgeS: rivalCollarPolicy.unlockPulseS },
        false,
      ),
    ).toBe(0);
  });
});
