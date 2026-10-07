import { describe, expect, it } from "vitest";
import {
  applyParley,
  authoredParley,
  campPlay,
  createCampSession,
  createState,
  decision,
  knowingsAbout,
  parleyCards,
  parleyMoments,
  parleyProblem,
  parleyRules,
  passSlot,
  safeFallback,
  seededUnit,
  settleCamp,
} from "@mage/core";
import { loadTables, plan, validateParley } from "@mage/director";
import { knowingFixture, parleyBounds } from "./parley-fixtures.ts";
import { injectionSuite, parleyAttacks } from "./parley-injections.ts";
const t = loadTables();
describe("Knowing-gated Parley", () => {
  it("requires real, true, held evidence about a present living speaker", () => {
    const s = knowingFixture(t);
    expect(parleyMoments(t, s).map((m) => m.target)).toEqual(["nysa"]);
    expect(knowingsAbout(s, "nysa").map((f) => f.id)).toEqual(["K-nysa-bread"]);
    for (const mutate of [
      (c: typeof s) => {
        c.camp.characters.cassia.knowledge = [];
      },
      (c: typeof s) => {
        c.camp.facts.find((f) => f.id === "K-nysa-bread")!.truth = false;
      },
      (c: typeof s) => {
        c.camp.facts.find((f) => f.id === "K-nysa-bread")!.target = "brennic";
      },
      (c: typeof s) => {
        c.camp.characters.nysa.life = "Dead";
      },
      (c: typeof s) => {
        c.camp.characters.nysa.stocks = true;
      },
      (c: typeof s) => {
        c.camp.characters.cassia.stocks = true;
      },
      (c: typeof s) => {
        c.location = "yard";
      },
      (c: typeof s) => {
        c.nightFinished = true;
      },
      (c: typeof s) => {
        c.camp.ended = true;
      },
      (c: typeof s) => {
        c.hour = 22;
      },
    ]) {
      const invalid = structuredClone(s);
      mutate(invalid);
      expect(parleyProblem(t, invalid, "nysa")).toBeTruthy();
      expect(() =>
        applyParley(t, invalid, "nysa", authoredParley(s, "nysa", "reveal")),
      ).toThrow();
    }
    expect(parleyMoments(t, createCampSession(t))).toHaveLength(0);
  });
  it("uses three authored approaches, the same roll for alternate wording, and one attempt per day", () => {
    const s = knowingFixture(t),
      cards = parleyCards(s, "nysa");
    expect(cards.map((c) => c.id)).toEqual(["reveal", "bargain", "ask"]);
    expect(
      cards.every((c) => c.text.includes(campPlay.discoveries[0].text)),
    ).toBe(true);
    const a = applyParley(t, s, "nysa", authoredParley(s, "nysa", "bargain"));
    const b = applyParley(t, s, "nysa", {
      ...authoredParley(s, "nysa", "bargain"),
      npcReply: "I will listen.",
    });
    expect(a.parleys[0].roll).toEqual(b.parleys[0].roll);
    expect(a.hour).toBe(s.hour + t.season.activityHours.PARLEY);
    const atTent = a;
    expect(() =>
      applyParley(t, atTent, "nysa", authoredParley(s, "nysa", "bargain")),
    ).toThrow(/already/);
    expect(parleyMoments(t, a)).toHaveLength(0);
  });
  it("has a strict greater-than contest, nerve for intimidation, and clamps trust", () => {
    for (let seed = 0; seed < 100; seed++) {
      const s = knowingFixture(t, seed);
      s.camp.trust["nysa>cassia"] = 95;
      const a = applyParley(t, s, "nysa", {
        stance: "intimidate",
        effect: "shift_trust_large",
        citedKnowings: ["K-nysa-bread"],
        npcReply: "I hear you.",
      });
      const r = a.parleys[0].roll!;
      expect(r.unit).toBe(seededUnit(seed, 2, "cassia", "parley:nysa:nerve"));
      expect(r.score).toBe(
        s.camp.characters.cassia.stats.nerve *
          t.rules.contests.guileMultiplier +
          r.value,
      );
      expect(r.success).toBe(r.score! > 15);
      expect(a.camp.trust["nysa>cassia"]).toBe(r.success ? 100 : 87);
    }
  });
  it("will not accept unheld or unrelated citations, model numbers, invented effects or names", () => {
    const s = knowingFixture(t);
    for (const raw of [
      {
        ...authoredParley(s, "nysa", "bargain"),
        citedKnowings: ["K-ford-betrayal"],
      },
      { ...authoredParley(s, "nysa", "bargain"), amount: 999 },
      { ...authoredParley(s, "nysa", "bargain"), effect: "kill" },
    ]) {
      const after = applyParley(t, s, "nysa", raw);
      expect(after.parleys[0].effect).toBe("refuse");
      expect(parleyBounds(s, after)).toEqual([]);
    }
    const fixed = validateParley(t, s, "nysa", {
      ...authoredParley(s, "nysa", "ask"),
      npcReply: "Napoleon gives you 999 gold.",
    });
    expect(fixed.replyReplaced).toBeTruthy();
    expect(fixed.proposal?.npcReply).toBe(parleyRules.replies.reveal_fact);
  });
  it("reveals only an existing unknown true fact held by the speaker", () => {
    let successes = 0;
    for (let seed = 0; seed < 30; seed++) {
      const s = knowingFixture(t, seed);
      s.camp.facts.push({
        id: "known-by-speaker",
        text: "A quiet fixture fact.",
        visibility: "secret",
        truth: true,
      });
      s.camp.characters.nysa.knowledge.push("known-by-speaker");
      const a = applyParley(t, s, "nysa", authoredParley(s, "nysa", "ask"));
      if (a.parleys[0].effect === "reveal_fact") {
        successes++;
        expect(a.parleys[0].revealedFact).toBe("K-quill-lantern");
        expect(a.camp.characters.cassia.knowledge).toContain("K-quill-lantern");
      }
      expect(a.camp.facts).toEqual(s.camp.facts);
    }
    expect(successes).toBeGreaterThan(0);
  });
  it("replaces only the promised next night intent with a legal friendly player-directed act", () => {
    let s = knowingFixture(t, 73);
    s.camp.characters.cassia.stats.guile = 5;
    s = applyParley(t, s, "nysa", authoredParley(s, "nysa", "reveal"));
    expect(s.intentPromises).toEqual([{ target: "nysa", day: 2 }]);
    while (!s.nightFinished) s = passSlot(s);
    const next = settleCamp(
      t,
      s,
      [decision(t, s.camp, "nysa", "REST")],
      (id) => safeFallback(t, s.camp, id),
      (id) =>
        plan(
          t,
          s.camp,
          id,
          true,
          undefined,
          (d) =>
            parleyRules.friendlyIntents.includes(d.intent) &&
            d.args.target === "cassia",
        ),
    );
    expect(
      next.lastResolution!.events.some(
        (f) => f.actor === "nysa" && f.target === "cassia",
      ),
    ).toBe(true);
    expect(next.intentPromises).toHaveLength(0);
    expect(next.camp.day).toBe(3);
  });
  it("never accepts a hostile callback as an intent promise", () => {
    const s = knowingFixture(t);
    s.intentPromises.push({ target: "nysa", day: 2 });
    const next = settleCamp(
      t,
      passSlot(passSlot(passSlot(s))),
      [],
      (id) => safeFallback(t, s.camp, id),
      (id) => decision(t, s.camp, id, "REPORT", { target: "cassia" }),
    );
    expect(next.camp.investigations).toHaveLength(0);
  });
  it("blocks Parley after a finished night even if a Knowing is held", () => {
    const s = knowingFixture(t);
    const night = passSlot(passSlot(passSlot(s)));
    expect(() =>
      applyParley(t, night, "nysa", authoredParley(s, "nysa", "ask")),
    ).toThrow(/passed/);
    expect(() => createCampSession(t, 1, createState(t, 1, 43))).toThrow();
  });
});
describe("injection and authored census", () => {
  it("contains 100 unique hostile texts across 20 families with no state-boundary escape", () => {
    const suite = injectionSuite();
    expect(suite.cases).toBe(100);
    expect(suite.uniqueTexts).toBe(100);
    expect(suite.families).toBe(20);
    expect(suite.violations).toBe(0);
    expect(
      parleyAttacks.every(
        (a) => Array.from(a.text).length <= parleyRules.maxTextChars,
      ),
    ).toBe(true);
  });
  it("300 seeded authored Parleys include both success and refusal and remain bounded", () => {
    const effects = new Map<string, number>();
    for (let seed = 0; seed < 100; seed++)
      for (const card of parleyRules.cards) {
        const s = knowingFixture(t, seed),
          a = applyParley(t, s, "nysa", authoredParley(s, "nysa", card.id));
        expect(parleyBounds(s, a)).toEqual([]);
        const effect = a.parleys[0].effect;
        effects.set(effect, (effects.get(effect) ?? 0) + 1);
      }
    expect(effects.get("flip_next_intent")).toBeGreaterThan(0);
    expect(effects.get("shift_trust_large")).toBeGreaterThan(0);
    expect(effects.get("reveal_fact")).toBeGreaterThan(0);
    expect(effects.get("refuse")).toBeGreaterThan(0);
    expect([...effects.values()].reduce((a, b) => a + b, 0)).toBe(300);
  });
});
