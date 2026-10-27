export type FrameSample = { atMs: number; hash: string; frames: number[] };
export type Advance = { advanced: boolean; samples: FrameSample[] };
/** Short stable hash of a frame vector, enough to tell two samples apart in a failure message. */
export const frameHash = (frames: readonly number[]) => {
  let h = 2166136261;
  for (const f of [frames.length, ...frames])
    h = Math.imul(h ^ (f | 0), 16777619) >>> 0;
  return h.toString(16).padStart(8, "0");
};
/**
 * Samples the displayed frames every `stepMs` for at most `windowMs`, stopping at the first sample that differs from
 * `first`. A window that ends with every sample equal is a real stall and keeps all samples as its evidence.
 */
export async function sampleAdvance<S>(
  first: readonly number[],
  read: () => Promise<{ frames: number[]; state: S }>,
  wait: (ms: number) => Promise<void>,
  now: () => number,
  { windowMs = 2000, stepMs = 100 } = {},
): Promise<Advance & { state?: S }> {
  const start = now();
  const samples: FrameSample[] = [
    { atMs: 0, hash: frameHash(first), frames: [...first] },
  ];
  for (;;) {
    await wait(stepMs);
    const { frames, state } = await read();
    const atMs = Math.round(now() - start);
    samples.push({ atMs, hash: frameHash(frames), frames });
    if (frames.join() !== first.join())
      return { advanced: true, samples, state };
    if (atMs >= windowMs) return { advanced: false, samples };
  }
}
/** The failure text: how long was watched, and every sample's time and hash, so a stall is read from the log. */
export const stallMessage = (label: string, { samples }: Advance) =>
  `${label}: no frame advance in ${samples.at(-1)!.atMs} ms over ${samples.length} samples [${samples
    .map((s) => `${s.atMs}ms:${s.hash}`)
    .join(" ")}] frames=${JSON.stringify(samples[0]!.frames)}`;
