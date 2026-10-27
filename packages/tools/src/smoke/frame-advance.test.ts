import { describe, expect, it } from "vitest";
import { frameHash, sampleAdvance, stallMessage } from "./frame-advance.ts";

const clock = () => {
  let t = 0;
  return { now: () => t, wait: async (ms: number) => void (t += ms) };
};

describe("sampleAdvance", () => {
  it("returns at the first sample that moved, not after the whole window", async () => {
    const c = clock();
    let reads = 0;
    const r = await sampleAdvance(
      [0, 1],
      async () => ({ frames: ++reads < 4 ? [0, 1] : [2, 1], state: reads }),
      c.wait,
      c.now,
    );
    expect(r.advanced).toBe(true);
    expect(r.samples.map((s) => s.atMs)).toEqual([0, 100, 200, 300, 400]);
    expect(r.state).toBe(4);
  });
  it("reports a stall with every sample's time and hash after the bounded window", async () => {
    const c = clock();
    const r = await sampleAdvance(
      [0, 1],
      async () => ({ frames: [0, 1], state: 0 }),
      c.wait,
      c.now,
      { windowMs: 500, stepMs: 100 },
    );
    expect(r.advanced).toBe(false);
    expect(r.samples).toHaveLength(6);
    const msg = stallMessage("A10 body", r);
    expect(msg).toContain("no frame advance in 500 ms over 6 samples");
    expect(msg).toContain(`500ms:${frameHash([0, 1])}`);
  });
  it("tells different frame vectors apart", () => {
    expect(frameHash([0, 1])).not.toBe(frameHash([1, 0]));
  });
});
