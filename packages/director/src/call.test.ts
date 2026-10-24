import { describe, it, expect, vi } from "vitest";
import { createCampSession } from "@mage/core";
import { loadTables } from "./data.ts";
import { hash } from "./cache.ts";
import { groups, request } from "./input.ts";
import { plan } from "./planner.ts";
import { resolveCall } from "./call.ts";
import type { ProviderResult } from "./providers.ts";
const t = loadTables();
const state = createCampSession(t).camp;
const result = (raw: unknown, error: string | null = null): ProviderResult => ({
  raw,
  elapsedMs: 3,
  inputTokens: 1,
  outputTokens: 2,
  costUsd: null,
  error,
  metadata: {},
});
const { group, members } = groups(state)[0];
const req = request(t, state, group, members, "test", {}),
  key = hash(req);
function memoryCache(seed?: unknown) {
  const store = new Map<string, unknown>();
  if (seed !== undefined) store.set(key, seed);
  return {
    get: vi.fn((r: unknown) => store.get(hash(r))),
    put: vi.fn((r: unknown, output: unknown) => {
      // First write wins, as RequestCache does.
      if (store.has(hash(r))) return false;
      store.set(hash(r), output);
      return true;
    }),
  };
}
const guard = (ok = true) => ({ reserve: vi.fn(() => ok) });
const provider = (id: string, decide: () => Promise<ProviderResult>) => ({
  id,
  decide: vi.fn(decide),
});

describe("resolveCall", () => {
  it("case 1: planner plans with the caller's tables and state, records draws, never reserves or caches", async () => {
    const p = provider("planner", async () => result(null, "must not ask"));
    const cache = memoryCache(),
      g = guard();
    const call = await resolveCall({
      request: req,
      key,
      provider: p,
      cache,
      guard: g,
      cachePolicy: "raw",
      planner: { tables: t, state, group, members },
    });
    expect(call.source).toBe("planner");
    expect(p.decide).not.toHaveBeenCalled();
    expect(g.reserve).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
    expect(hash(call.result.raw)).toBe(
      hash({ group, decisions: members.map((id) => plan(t, state, id)) }),
    );
    expect(call.plannerDraws.length).toBeGreaterThan(0);
    expect(call.result.metadata.plannerDraws).toEqual(call.plannerDraws);
  });
  it("case 1b: a planner provider without caller state answers through decide and its draws surface", async () => {
    const draws = [{ character: "x" }];
    const p = provider("planner", async () => ({
      ...result({ group, decisions: [] }),
      metadata: { plannerDraws: draws },
    }));
    const g = guard();
    const call = await resolveCall({ request: req, key, provider: p, cache: memoryCache(), guard: g, cachePolicy: "raw" });
    expect(call.source).toBe("planner");
    expect(call.plannerDraws).toEqual(draws);
    expect(g.reserve).not.toHaveBeenCalled();
  });
  it("case 2: a cache hit answers without the provider or the budget", async () => {
    const cached = { group, decisions: ["cached"] };
    const p = provider("local-test", async () => result("fresh"));
    const g = guard();
    const call = await resolveCall({ request: req, key, provider: p, cache: memoryCache(cached), guard: g, cachePolicy: "raw" });
    expect(call.source).toBe("cache");
    expect(call.result.raw).toBe(cached);
    expect(p.decide).not.toHaveBeenCalled();
    expect(g.reserve).not.toHaveBeenCalled();
  });
  it("case 3: a denied reservation is a budget source and never asks the provider", async () => {
    const p = provider("local-test", async () => result("fresh"));
    const call = await resolveCall({ request: req, key, provider: p, cache: memoryCache(), guard: guard(false), cachePolicy: "raw" });
    expect(call.source).toBe("budget");
    expect(call.result.error).toBe("budget-denied");
    expect(p.decide).not.toHaveBeenCalled();
  });
  it("case 4: raw policy caches the fresh raw and returns the pinned record, flagging only a differing pin", async () => {
    const p = provider("local-test", async () => result({ fresh: 1 }));
    const cache = memoryCache();
    const first = await resolveCall({ request: req, key, provider: p, cache, guard: guard(), cachePolicy: "raw" });
    expect(first.source).toBe("live");
    expect(cache.put).toHaveBeenCalledTimes(1);
    expect(cache.put.mock.calls[0][1]).toEqual({ fresh: 1 });
    expect(first.result.metadata.uncachedRaw).toBeUndefined();
    // A racing writer pinned another record first: the pin wins and the fresh raw is kept aside.
    const raced = memoryCache({ pinned: 1 });
    raced.get.mockReturnValueOnce(undefined);
    const second = await resolveCall({ request: req, key, provider: p, cache: raced, guard: guard(), cachePolicy: "raw" });
    expect(second.result.raw).toEqual({ pinned: 1 });
    expect(second.result.metadata.uncachedRaw).toEqual({ fresh: 1 });
  });
  it("case 4b: forceLive neither reads nor writes the cache", async () => {
    const p = provider("local-test", async () => result({ fresh: 1 }));
    const cache = memoryCache({ old: 1 });
    const call = await resolveCall({ request: req, key, provider: p, cache, guard: guard(), cachePolicy: "raw", forceLive: true });
    expect(call.source).toBe("live");
    expect(call.result.raw).toEqual({ fresh: 1 });
    expect(cache.get).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });
  it("case 5: validated policy never caches an invalid reply; raw policy does", async () => {
    const p = provider("local-test", async () => result({ bad: 1 }));
    const cache = memoryCache();
    const validate = vi.fn(() => undefined);
    const options = { request: req, key, provider: p, cache, guard: guard(), cachePolicy: "validated" as const, validate };
    await resolveCall(options);
    await resolveCall(options);
    expect(cache.put).not.toHaveBeenCalled();
    expect(p.decide).toHaveBeenCalledTimes(2);
    const rawCache = memoryCache();
    await resolveCall({ ...options, cachePolicy: "raw", cache: rawCache });
    expect(rawCache.put).toHaveBeenCalledTimes(1);
  });
  it("case 5b: validated policy caches the record the validator returns", async () => {
    const p = provider("local-test", async () => result({ raw: 1 }));
    const cache = memoryCache();
    const call = await resolveCall({ request: req, key, provider: p, cache, guard: guard(), cachePolicy: "validated", validate: () => ({ checked: 1 }) });
    expect(cache.put).toHaveBeenCalledWith(req, { checked: 1 });
    expect(call.result.raw).toEqual({ checked: 1 });
  });
  it("case 6: an abort while the provider is pending wins over its late answer", async () => {
    let finish: (r: ProviderResult) => void = () => {};
    const p = provider("local-test", () => new Promise((resolve) => (finish = resolve)));
    const cache = memoryCache(),
      controller = new AbortController();
    const pending = resolveCall({ request: req, key, provider: p, cache, guard: guard(), cachePolicy: "raw", signal: controller.signal });
    await vi.waitFor(() => expect(p.decide).toHaveBeenCalled());
    controller.abort();
    finish(result({ late: 1 }));
    const call = await pending;
    expect(call.source).toBe("aborted");
    expect(cache.put).not.toHaveBeenCalled();
  });
  it("case 6b: a throwing provider becomes a live error and nothing is cached", async () => {
    const p = provider("local-test", async () => {
      throw new Error("boom");
    });
    const cache = memoryCache();
    const call = await resolveCall({ request: req, key, provider: p, cache, guard: guard(), cachePolicy: "raw" });
    expect(call.source).toBe("live");
    expect(call.result.error).toBe("boom");
    expect(cache.put).not.toHaveBeenCalled();
  });
});
