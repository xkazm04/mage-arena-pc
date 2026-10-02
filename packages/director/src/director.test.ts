import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createState,
  decision,
  goldenNights,
  legalProblem,
  lineProblem,
  reconcile,
  resolve,
} from "@mage/core";
import { loadTables, canonical } from "./data.ts";
import { plan } from "./planner.ts";
import { validateGroup } from "./validator.ts";
import { fuzz } from "./fuzz.ts";
import { hash, RequestCache } from "./cache.ts";
import { CostGuard } from "./budget.ts";
import { groups, request } from "./input.ts";
import {
  ClaudeProvider,
  PlannerProvider,
  OllamaProvider,
  claudeArgs,
  runChild,
  type Provider,
} from "./providers.ts";
import { night } from "./harness.ts";
import config from "./config.json" with { type: "json" };

const t = loadTables(),
  temporary = () => mkdtempSync(join(tmpdir(), "mage-director-"));
describe("Director trust boundary", () => {
  it("rejects invalid run initialization before any provider can be called", () => {
    expect(() => createState(t, Number.NaN)).toThrow();
    expect(() => createState(t, 1, 0)).toThrow();
    expect(() =>
      createState(t, 1, t.season.weeks * t.season.daysPerWeek + 1),
    ).toThrow();
    expect(() => createState(t, 1, 1, "venno")).toThrow();
    for (const c of t.characters.characters.filter((c) => c.role === "main")) {
      const state = createState(t, 1, 1, c.id);
      expect(groups(state).flatMap((g) => g.members)).not.toContain(c.id);
    }
  });
  it("replays the generated W0 golden oracle", () => {
    const stored = JSON.parse(
      readFileSync(
        new URL(
          "../../../docs/design/reconciled/fixtures/golden-nights.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as unknown;
    expect(canonical(goldenNights(t))).toBe(canonical(stored));
  });
  it("measures exactly the required hostile fuzz census, preserving valid siblings", () => {
    const result = fuzz(t);
    expect(result.cases).toBe(config.budget.w1.fuzzCases);
    expect(result.uniqueOutputs).toBe(result.cases);
    expect(result.escaped).toBe(0);
    expect(Object.keys(result.categories).length).toBeGreaterThan(20);
  });
  it("rejects malformed envelopes, duplicate actors and wrong groups; discards extra actors", () => {
    const s = createState(t, 5),
      n = decision(t, s, "nysa"),
      o = decision(t, s, "ophel");
    for (const raw of [
      "{",
      null,
      [],
      { group: "stone", decisions: [n, o] },
      { group: "tide", decisions: [n, n, o] },
    ]) {
      const result = validateGroup(t, s, "tide", ["nysa", "ophel"], raw);
      expect(result.verdicts.some((v) => v.rejected)).toBe(true);
      expect(result.items).toHaveLength(2);
    }
    const result = validateGroup(t, s, "tide", ["nysa", "ophel"], {
      group: "tide",
      decisions: [n, o, decision(t, s, "garran")],
    });
    expect(result.foreignItems).toBe(1);
    expect(result.items.map((d) => d.character)).toEqual(["nysa", "ophel"]);
    expect(result.verdicts.every((v) => !v.rejected)).toBe(true);
  });
  it("repairs unsafe lines without changing a legal intent", () => {
    const s = createState(t, 5),
      n = decision(t, s, "nysa", "WATCH", { target: "cassia" });
    for (const line of [
      "I killed Cassia.",
      "I bring three coins.",
      "Zorg will obey.",
      "I have ² coins.",
      "x".repeat(t.rules.line.maxLength + 1),
    ]) {
      const result = validateGroup(t, s, "tide", ["nysa"], {
        group: "tide",
        decisions: [{ ...n, line }],
      });
      expect(result.items[0].intent).toBe("WATCH");
      expect(result.verdicts[0].rejected).toBe(false);
      expect(result.verdicts[0].lineReplaced).toBeTruthy();
      expect(lineProblem(t, result.items[0].line)).toBeNull();
    }
  });
  it("resolves every closed verb and preserves secret fact provenance", () => {
    const actions = [
      ["nysa", "TRAIN", { stat: "focus" }],
      ["nysa", "WORK", {}],
      ["nysa", "BEFRIEND", { target: "garran" }],
      ["quill", "CONFIDE", { target: "cassia", factId: "K-wardstones-drink" }],
      ["garran", "PROTECT", { target: "cassia" }],
      ["ophel", "WATCH", { target: "cassia" }],
      [
        "nysa",
        "SCHEME",
        { target: "cassia", kind: "rumour", topic: "cowardice" },
      ],
      ["iskar", "RECRUIT", { target: "fenna" }],
      ["nysa", "DEFECT", { toTent: "stone" }],
      ["septima", "REPORT", { target: "nysa" }],
      ["garran", "PLOT", {}],
      ["nysa", "REST", {}],
      ["venno", "OFFER", { target: "nysa", terms: "back_entrant" }],
    ] as const;
    expect(actions.map((a) => a[1]).sort()).toEqual(
      Object.keys(t.intents).sort(),
    );
    for (const [actor, intent, args] of actions) {
      const state = createState(t, 73, 4);
      if (intent === "DEFECT") {
        state.characters.nysa.loyalty = t.rules.effects.DEFECT.loyaltyBelow - 1;
        state.trust["nysa>garran"] = t.rules.effects.DEFECT.trustAtLeast;
      }
      if (intent === "PLOT") state.bond = "first_watch";
      if (intent === "REST")
        state.characters.nysa.fatigue = t.rules.effects.daily.fatiguedAt;
      const d = decision(t, state, actor, intent, { ...args }),
        accepted = reconcile(t, state, [d]);
      expect(
        accepted.verdicts.find((v) => v.character === actor)?.rejected,
        intent,
      ).toBe(false);
      const result = resolve(t, state, accepted.items),
        after = result.state;
      expect(result.trace.length, intent).toBeGreaterThan(0);
      if (intent === "TRAIN")
        expect(
          after.characters.nysa.points.focus -
            state.characters.nysa.points.focus,
        ).toBe(
          t.rules.effects.TRAIN.points + t.rules.effects.daily.routinePoints,
        );
      if (intent === "WORK")
        expect(after.characters.nysa.gold - state.characters.nysa.gold).toBe(
          t.rules.effects.WORK.gold,
        );
      if (intent === "BEFRIEND")
        expect(after.trust["garran>nysa"] - state.trust["garran>nysa"]).toBe(
          t.rules.effects.BEFRIEND.trust *
            t.rules.effects.BEFRIEND.peerMultiplier,
        );
      if (intent === "CONFIDE") {
        expect(after.characters.cassia.knowledge).toContain(
          "K-wardstones-drink",
        );
        expect(after.characters.nysa.knowledge).not.toContain(
          "K-wardstones-drink",
        );
      }
      if (intent === "PROTECT")
        expect(after.characters.cassia.warned).toBe(true);
      if (intent === "WATCH" || intent === "RECRUIT")
        expect(
          result.rolls.some((r) => r.action.startsWith(intent + ":")),
        ).toBe(true);
      if (intent === "SCHEME")
        expect(
          after.characters.cassia.renown - state.characters.cassia.renown,
        ).toBe(0); // Authored minimum-roll failure, seed 73 rolls one.
      if (intent === "DEFECT") expect(after.characters.nysa.tent).toBe("stone");
      if (intent === "REPORT")
        expect(after.investigations.some((i) => i.actor === actor)).toBe(true);
      if (intent === "PLOT")
        expect(after.bondProgress).toBe(t.rules.effects.PLOT.progress);
      if (intent === "REST")
        expect(
          after.characters.nysa.fatigue - state.characters.nysa.fatigue,
        ).toBe(t.rules.effects.REST.fatigue);
      if (intent === "OFFER")
        expect(
          result.events.some(
            (f) => f.type === "offered" && f.visibility === "secret",
          ),
        ).toBe(true);
    }
  });
  it("caps a whole camp in stable priority order and never refills a scarce slot", () => {
    const s = createState(t, 5, 6);
    const items = ["nysa", "corvo", "sadruba", "kesh", "lio"].map((id) =>
      decision(t, s, id, "SCHEME", {
        target: "cassia",
        kind: "rumour",
        topic: "cowardice",
      }),
    );
    const a = reconcile(t, s, items, (id) => plan(t, s, id, true)),
      b = reconcile(t, s, items.toReversed(), (id) => plan(t, s, id, true));
    expect(a).toEqual(b);
    expect(a.items.filter((d) => d.intent === "SCHEME")).toHaveLength(
      t.rules.caps.SCHEME_eve,
    );
    expect(a.verdicts.find((v) => v.character === "lio")?.reason).toBe("cap");
  });
  it("replays full planner seasons deterministically and respects every invariant", () => {
    const play = (seed: number) => {
      let s = createState(t, seed);
      for (let i = 0; i < t.season.weeks * t.season.daysPerWeek; i++) {
        const accepted = reconcile(
          t,
          s,
          Object.keys(s.characters)
            .filter((id) => id !== s.player)
            .map((id) => plan(t, s, id)),
          (id) => plan(t, s, id, true),
        );
        for (const item of accepted.items)
          expect(legalProblem(t, s, item)).toBeNull();
        s = resolve(t, s, accepted.items).state;
        for (const c of Object.values(s.characters)) {
          expect(c.life).toBe("Alive");
          expect(c.gold).toBeGreaterThanOrEqual(0);
          expect(c.hunger).toBeLessThanOrEqual(100);
          for (const stat of Object.values(c.stats))
            expect(stat).toBeGreaterThanOrEqual(1);
        }
        expect(s.plots).toEqual([]);
      }
      expect(s.ended).toBe(true);
      return hash(s);
    };
    expect(play(71)).toBe(play(71));
    expect(play(72)).not.toBe(play(71));
  });
});
describe("request and budget boundaries", () => {
  it("omits numeric sheets, excludes the player, and keeps secrets per member", () => {
    const s = createState(t, 5),
      g = groups(s);
    expect(g.flatMap((x) => x.members)).toHaveLength(
      Object.keys(s.characters).length - 1,
    );
    const req = request(
      t,
      s,
      "margins",
      ["quill", "fenna", "venno", "septima"],
      "test",
      {},
    );
    const numerics = (x: unknown): number =>
      typeof x === "number"
        ? 1
        : Array.isArray(x)
          ? x.reduce((n, v) => n + numerics(v), 0)
          : x && typeof x === "object"
            ? Object.values(x).reduce<number>((n, v) => n + numerics(v), 0)
            : 0;
    expect(numerics(req.input)).toBe(0);
    expect(
      req.input.members
        .find((m) => m.id === "fenna")!
        .knowledge.some((f) => f.id === "K-wardstones-drink"),
    ).toBe(false);
    expect(
      req.input.members
        .find((m) => m.id === "quill")!
        .knowledge.some((f) => f.id === "K-wardstones-drink"),
    ).toBe(true);
  });
  it("hashes exactly the complete request and rejects corrupt cache content", () => {
    const s = createState(t, 8),
      req = request(t, s, "tide", ["nysa", "ophel"], "test", {}),
      cache = new RequestCache(temporary());
    cache.put(req, { group: "tide", decisions: [] });
    expect(
      cache.put(req, { group: "tide", decisions: ["a later response"] }),
    ).toBe(false);
    expect(cache.get(structuredClone(req))).toEqual({
      group: "tide",
      decisions: [],
    });
    expect(hash(req)).toBe(hash({ ...req, input: { ...req.input } }));
    for (const other of [
      { ...req, system: "different" },
      { ...req, model: "different" },
      { ...req, input: { ...req.input, bond: "different" } },
    ])
      expect(hash(other)).not.toBe(hash(req));
    writeFileSync(join(cache.directory, `${hash(req)}.json`), "{}");
    expect(cache.get(req)).toBeUndefined();
    expect(cache.put(req, { recovered: true })).toBe(true);
    expect(cache.get(req)).toEqual({ recovered: true });
  });
  it("counts failed calls durably and obeys both caps across runs and UTC days", () => {
    const path = join(temporary(), "budget.json");
    let day = "today";
    const guard = new CostGuard(path, "a", "mock", 2, 3, () => day);
    expect(guard.reserve("failed")).toBe(true);
    expect(
      new CostGuard(path, "a", "mock", 2, 3, () => day).reserve("second"),
    ).toBe(true);
    expect(guard.reserve("third")).toBe(false);
    const other = new CostGuard(path, "b", "mock", 2, 3, () => day);
    expect(other.reserve("another-run")).toBe(true);
    expect(other.reserve("exceeds-day")).toBe(false);
    day = "tomorrow";
    expect(guard.reserve("still-run-capped")).toBe(false);
    expect(other.reserve("new-day")).toBe(true);
    writeFileSync(`${path}.lock`, "");
    expect(other.reserve("locked")).toBe(false);
  });
  it("pins the same answer when identical requests race", async () => {
    const state = createState(t, 8),
      dir = temporary();
    const cache = new RequestCache(join(dir, "cache"));
    const guard = new CostGuard(
      join(dir, "budget.json"),
      "race",
      "mock",
      20,
      20,
    );
    let calls = 0;
    const provider: Provider = {
      id: "mock",
      model: "mock",
      options: {},
      decide: async (req) => {
        const alternative = ++calls % 2 === 0;
        return {
          raw: {
            group: req.input.group,
            decisions: req.input.members.map((m) =>
              m.id === "venno"
                ? decision(t, state, m.id, "WATCH", { target: "cassia" })
                : alternative
                  ? decision(t, state, m.id, "BEFRIEND", { target: "cassia" })
                  : decision(t, state, m.id),
            ),
          },
          elapsedMs: 0,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: null,
          error: null,
          metadata: {},
        };
      },
    };
    const [a, b] = await Promise.all([
      night(t, state, { provider, cache, guard }),
      night(t, state, { provider, cache, guard }),
    ]);
    expect(a.afterHash).toBe(b.afterHash);
    expect(
      [...a.groups, ...b.groups].some(
        (g) => g.metadata.uncachedRaw !== undefined,
      ),
    ).toBe(true);
  });
  it("uses cache without a call, revalidates hits, and falls back if a provider throws", async () => {
    const dir = temporary(),
      s = createState(t, 8),
      cache = new RequestCache(join(dir, "cache")),
      guard = new CostGuard(join(dir, "budget.json"), "test", "mock", 20, 20);
    let calls = 0;
    const provider: Provider = {
      id: "mock",
      model: "mock",
      options: {},
      decide: async (req) => {
        calls++;
        return {
          raw: {
            group: req.input.group,
            decisions: req.input.members.map((m) => plan(t, s, m.id)),
          },
          elapsedMs: 1,
          inputTokens: 1,
          outputTokens: 1,
          costUsd: null,
          error: null,
          metadata: {},
        };
      },
    };
    const first = await night(t, s, { provider, cache, guard }),
      second = await night(t, s, { provider, cache, guard });
    expect(calls).toBe(groups(s).length);
    expect(second.afterHash).toBe(first.afterHash);
    expect(second.groups.every((g) => g.source === "cache")).toBe(true);
    const bad = new RequestCache(join(dir, "bad"));
    for (const g of groups(s))
      bad.put(request(t, s, g.group, g.members, "mock", {}), {
        group: g.group,
        decisions: [],
      });
    expect(
      (await night(t, s, { provider, cache: bad, guard })).verdicts.every(
        (v) => v.rejected,
      ),
    ).toBe(true);
    provider.decide = async () => {
      throw new Error("offline");
    };
    expect(
      (
        await night(t, s, {
          provider,
          cache: new RequestCache(join(dir, "empty")),
          guard,
        })
      ).verdicts.every((v) => v.rejected),
    ).toBe(true);
  });
});
describe("providers", () => {
  it("runs the offline planner through the provider interface without spending a call", async () => {
    const state = createState(t, 4),
      dir = temporary();
    const provider = new PlannerProvider(t, () => state);
    const result = await night(t, state, {
      provider,
      cache: new RequestCache(join(dir, "cache")),
      guard: new CostGuard(
        join(dir, "budget.json"),
        "offline",
        "planner",
        0,
        0,
      ),
    });
    expect(result.groups.every((g) => g.source === "planner")).toBe(true);
    expect(result.groups.flatMap((g) => g.plannerDraws).length).toBeGreaterThan(
      0,
    );
    expect(result.items.every((d) => legalProblem(t, state, d) === null)).toBe(
      true,
    );
  });
  it("passes verified subscription-safe flags as argv with no shell", () => {
    const s = createState(t, 1),
      provider = new ClaudeProvider("."),
      args = claudeArgs(
        request(
          t,
          s,
          "tide",
          ["nysa", "ophel"],
          provider.model,
          provider.options,
        ),
      );
    expect(args).toContain("--json-schema");
    expect(args[args.indexOf("--tools") + 1]).toBe("");
    expect(args).toContain("--safe-mode");
    expect(args).not.toContain("--bare");
    expect(args[args.indexOf("--effort") + 1]).toBe("medium");
  });
  it("hard-times out a child and reports process errors", async () => {
    const result = await runChild(
      process.execPath,
      ["-e", "setInterval(()=>{},1000)"],
      "",
      100,
    );
    expect(result.timedOut).toBe(true);
    expect(
      (await runChild(process.execPath, ["-e", "process.exit(3)"], "", 1000))
        .code,
    ).toBe(3);
  });
  it("offline HTTP failure is a bounded provider failure", async () => {
    const s = createState(t, 1),
      provider = new OllamaProvider("test", "http://127.0.0.1:1", 100);
    const result = await provider.decide(
      request(t, s, "tide", ["nysa"], "test", provider.options),
    );
    expect(result.error).toBeTruthy();
    expect(result.raw).toBeNull();
  });
  it("requires structured output and rejects wrong-model or failed CLI envelopes", async () => {
    const s = createState(t, 1),
      d = decision(t, s, "nysa");
    for (const [envelope, error] of [
      [{ result: "plain prose" }, "missing-structured-output"],
      [
        {
          is_error: true,
          structured_output: { group: "tide", decisions: [d] },
        },
        "provider-error",
      ],
      [
        {
          structured_output: { group: "tide", decisions: [d] },
          modelUsage: { "wrong-model": {} },
        },
        "wrong-model",
      ],
      [
        {
          structured_output: { group: "tide", decisions: [d] },
          modelUsage: { [config.claude.model]: {} },
          usage: {
            input_tokens: 2,
            cache_read_input_tokens: 3,
            output_tokens: 4,
          },
        },
        null,
      ],
    ] as const) {
      const provider = new ClaudeProvider(".", "mock", 100, async () => ({
        stdout: JSON.stringify(envelope),
        stderr: "",
        code: 0,
        timedOut: false,
      }));
      const result = await provider.decide(
        request(t, s, "tide", ["nysa"], provider.model, provider.options),
      );
      expect(result.error).toBe(error);
      if (!error) {
        expect(result.inputTokens).toBe(5);
        expect(result.outputTokens).toBe(4);
      }
    }
  });
});
