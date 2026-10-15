import type { BodyManifest, Element } from "./animation-contract.ts";
import type { SigilManifest } from "./sigil-contract.ts";
import policy from "../data/preload.json" with { type: "json" };

export { policy as preloadPolicy };
/** Sigil clips a bout can draw for these elements; threat shapes are not narrowed per attack. */
export function sigilClips(elements: Iterable<Element>): string[] {
  const clips = [
    "selection",
    "target",
    "warning.normal",
    "warning.unblockable",
    "ward.start",
    "ward.hold",
    "ward.release",
    "absorb.window",
    "absorb.perfect",
    "absorb.contact",
    "status.slowed",
    "status.rooted",
    "status.shielded",
    "inscription.collar",
  ];
  for (const e of new Set(elements))
    clips.push(
      ...["start", "hold", "release"].map((p) => `cast.${e}.${p}`),
      ...["ring", "cone", "line"].map((s) => `threat.${e}.${s}`),
    );
  return clips;
}
export function sigilPages(m: SigilManifest, clips: Iterable<string>) {
  const keys = new Set<string>();
  for (const id of clips) {
    const clip = m.clips[id];
    if (!clip) continue;
    keys.add(`a13.page.${clip.page}`);
    if (clip.progress)
      keys.add(`a13.mask.${clip.progress.mask.split("/").at(-1)}`);
  }
  return [...keys];
}
/** Every page of every clip, death and corpse included: a body never meets its first lazy page mid-bout. */
export function bodyPages(m: BodyManifest, entities: Iterable<string>) {
  const keys = new Set<string>();
  for (const id of entities)
    for (const clips of Object.values(m.entities[id]?.clips ?? {}))
      for (const clip of Object.values(clips))
        keys.add(`a10.packed.${clip.page}`);
  return [...keys];
}
/** The A8 pages EffectPlayer draws from: the element sheets and the shared barrier. */
export function effectPages(elements: Iterable<Element>) {
  return [
    "a8.page.barrier",
    ...[...new Set(elements)].map((e) => `a8.page.${e}`),
  ];
}
export interface ReadyReport {
  ms: number;
  timedOut: boolean;
  /** Art that failed or was still loading when the gate opened. */
  missing: string[];
}
/**
 * Holds a scene closed until its art settles or the data timeout passes, so a
 * missing or corrupt file only ever costs the timeout. A newer open supersedes
 * an older one; each open logs at most one line.
 */
export class ReadyGate {
  loading = false;
  last?: ReadyReport;
  opened = 0;
  private generation = 0;
  constructor(
    private log: (line: string) => void = (line) => console.warn(line),
    private clock = () => performance.now(),
  ) {}
  open(
    task: Promise<string[]>,
    timeoutMs = policy.timeoutS * 1000,
    pending: () => string[] = () => [],
  ): Promise<ReadyReport | undefined> {
    const generation = ++this.generation,
      started = this.clock();
    this.loading = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), timeoutMs);
    });
    return Promise.race([
      task.catch((e: unknown) => [String(e)]),
      timeout,
    ]).then((result) => {
      clearTimeout(timer);
      if (generation !== this.generation) return undefined;
      const timedOut = result === "timeout",
        missing = timedOut ? pending() : result;
      this.last = { ms: this.clock() - started, timedOut, missing };
      this.loading = false;
      this.opened++;
      if (timedOut)
        this.log(
          `Arena art not ready after ${(timeoutMs / 1000).toFixed(1)} s; starting with fallbacks for: ${missing.join(", ") || "unknown"}`,
        );
      else if (missing.length)
        this.log(
          `Arena art unavailable; starting with fallbacks for: ${missing.join(", ")}`,
        );
      return this.last;
    });
  }
  cancel() {
    this.generation++;
    this.loading = false;
  }
}
/** Resolves with the task, or after `ms` with one log line; never rejects. */
export function settleWithin(
  task: Promise<unknown>,
  ms: number,
  label: string,
  log: (line: string) => void = (line) => console.warn(line),
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    task.then(
      () => true,
      () => true,
    ),
    new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), ms);
    }),
  ]).then((settled) => {
    clearTimeout(timer);
    if (!settled)
      log(
        `${label} not ready after ${(ms / 1000).toFixed(1)} s; drawing with fallbacks`,
      );
  });
}
