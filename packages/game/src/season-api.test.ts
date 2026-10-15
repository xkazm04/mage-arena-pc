import { afterEach, describe, expect, it, vi } from "vitest";
import { connection, request } from "./season-api.ts";

afterEach(() => vi.unstubAllGlobals());
describe("season connection", () => {
  it("counts unreachable requests and forgets them on the next reply", async () => {
    connection.failures = 0;
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
    await expect(request("session")).rejects.toThrow(
      "The camp could not be reached. Try again in a moment.",
    );
    await expect(request("session")).rejects.toThrow();
    expect(connection.failures).toBe(2);
    const before = connection.lastHeard;
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response(JSON.stringify({ revision: 1 }))),
    );
    await expect(request("session")).resolves.toEqual({ revision: 1 });
    expect(connection.failures).toBe(0);
    expect(connection.lastHeard).toBeGreaterThanOrEqual(before);
  });
  it("keeps a server refusal distinct from an unreachable server", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "Not enough hours remain." }), {
          status: 409,
        }),
      ),
    );
    await expect(request("command", {})).rejects.toThrow(
      "Not enough hours remain.",
    );
    expect(connection.failures).toBe(0);
  });
});
