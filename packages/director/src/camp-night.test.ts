import { describe, it, expect, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCampSession, decision, safeFallback } from "@mage/core";
import { loadTables } from "./data.ts";
import { CampNight } from "./camp-night.ts";
import { CampService } from "./camp-service.ts";
import { CostGuard } from "./budget.ts";
import { RequestCache } from "./cache.ts";
import { groups, request } from "./input.ts";
import type { Provider, ProviderResult } from "./providers.ts";
const t = loadTables();
const state = createCampSession(t).camp;
const result = (raw: unknown): ProviderResult => ({
  raw,
  elapsedMs: 0,
  inputTokens: 0,
  outputTokens: 0,
  costUsd: null,
  error: null,
  metadata: {},
});
function options(provider: Provider, cap = 40) {
  const dir = mkdtempSync(join(tmpdir(), "mage-camp-"));
  return {
    provider,
    cache: new RequestCache(join(dir, "cache")),
    guard: new CostGuard(
      join(dir, "ledger.json"),
      "test",
      provider.id,
      cap,
      cap,
    ),
  };
}
function provider(): Provider {
  return {
    id: "local-test",
    model: "test",
    options: {},
    async decide(req) {
      return result({
        group: req.input.group,
        decisions: req.input.members.map((m) =>
          decision(t, state, m.id, "REST"),
        ),
      });
    },
  };
}
describe("camp night lifecycle", () => {
  it("preserves a valid sibling while replacing a hostile item", async () => {
    const p = provider();
    p.decide = async (req) =>
      result({
        group: req.input.group,
        decisions: req.input.members.map((m, i) =>
          i
            ? safeFallback(t, state, m.id)
            : { ...decision(t, state, m.id), intent: "KILL" },
        ),
      });
    const job = new CampNight(t, state, options(p));
    await job.done;
    const items = await job.finish(0);
    expect(items).toHaveLength(15);
    expect(items.some((d) => d.intent === "REST")).toBe(true);
    expect(items.every((d) => d.intent !== ("KILL" as string))).toBe(true);
    expect(job.audit.every((a) => a.rejected === 1)).toBe(true);
  });
  it("seals partial groups, aborts transport and ignores late cache writes", async () => {
    const p = provider();
    let calls = 0,
      finishLate: (v: ProviderResult) => void = () => {},
      signal: AbortSignal | undefined;
    p.decide = async (req, abort) => {
      calls++;
      signal = abort;
      if (calls === 1)
        return result({
          group: req.input.group,
          decisions: req.input.members.map((m) =>
            decision(t, state, m.id, "REST"),
          ),
        });
      return new Promise((resolve) => {
        finishLate = resolve;
      });
    };
    const opts = options(p),
      job = new CampNight(t, state, opts);
    await vi.waitFor(() => expect(calls).toBe(2));
    const partial = await job.finish(1);
    expect(partial.length).toBe(groups(state)[0].members.length);
    expect(signal?.aborted).toBe(true);
    const next = groups(state)[1],
      req = request(t, state, next.group, next.members, p.model, p.options);
    finishLate(
      result({
        group: next.group,
        decisions: next.members.map((id) => decision(t, state, id)),
      }),
    );
    await job.done;
    expect(opts.cache.get(req)).toBeUndefined();
    expect(await job.finish(0)).toEqual(partial);
    expect(calls).toBe(2);
  });
  it("a spent budget makes no transport calls and still fills every actor", async () => {
    const p = provider();
    p.decide = vi.fn(p.decide);
    const job = new CampNight(t, state, options(p, 0));
    await job.done;
    expect(await job.finish(0)).toHaveLength(15);
    expect(p.decide).not.toHaveBeenCalled();
    expect(job.audit.every((a) => a.source === "budget")).toBe(true);
  });
  it("reuses validated cache records without a new budget reservation", async () => {
    const p = provider();
    p.decide = vi.fn(p.decide);
    const opts = options(p);
    const first = new CampNight(t, state, opts);
    await first.done;
    await first.finish(0);
    const second = new CampNight(t, state, opts);
    await second.done;
    expect(await second.finish(0)).toEqual(await first.finish(0));
    expect(p.decide).toHaveBeenCalledTimes(groups(state).length);
    expect(second.audit.every((a) => a.source === "cache")).toBe(true);
  });
  it("starts only on dusk commit, rejects stale actions and commits dawn once", async () => {
    const p = provider(),
      service = new CampService(t, options(p));
    await service.command({ type: "wait" }, 0);
    expect(service.job).toBeNull();
    await expect(service.command({ type: "wait" }, 0)).rejects.toThrow(/moved/);
    await service.command({ type: "wait" }, service.session.revision);
    expect(service.job).not.toBeNull();
    await service.job!.done;
    await service.command({ type: "wait" }, service.session.revision);
    const revision = service.session.revision;
    const first = service.command({ type: "dawn" }, revision);
    await expect(service.command({ type: "dawn" }, revision)).rejects.toThrow();
    await first;
    expect(service.session.camp.day).toBe(2);
    expect(service.session.history).toHaveLength(1);
    await expect(
      service.command({ type: "dawn" }, service.session.revision),
    ).rejects.toThrow(/Finish/);
    service.close();
  });
  it("accepts lane/hold input only for the active night and ignores client tick counts", async () => {
    const service = new CampService(t, options(provider()));
    await service.command({ type: "wait" }, 0);
    await service.command({ type: "wait" }, 1);
    await service.command({ type: "listen" }, 2);
    expect(() => service.control(1, true, 2)).toThrow();
    service.control(1, true, 1);
    service.tick();
    expect(service.session.listening?.tick).toBe(1);
    expect(service.session.listening?.lane).toBe(1);
    service.close();
  });
});
