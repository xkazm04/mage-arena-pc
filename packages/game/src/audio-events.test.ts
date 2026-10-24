import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { audioData } from "./audio-policy.ts";

/** The sim's event kinds, read from the `ArenaEvent` union in core's source so a new kind fails this test. */
const types = readFileSync(
  new URL("../../core/src/arena/types.ts", import.meta.url),
  "utf8",
);
const union =
  /interface ArenaEvent \{[^}]*?kind: ((?:'[\w-]+'(?: \| )?)+)/.exec(
    types,
  )?.[1];
const kinds = [...(union ?? "").matchAll(/'([\w-]+)'/g)].map((m) => m[1]!);

/** Event kind to the cues `arena-entry.ts` consumeEvents plays for it. */
const cued: Record<string, string[]> = {
  perfect: ["perfect"],
  unlock: ["collar", "voice.collar"],
  release: ["impact", "cast.fire", "cast.water", "cast.earth", "cast.air"],
  hit: ["hit", "impact"],
  stagger: ["stagger"],
  roll: ["roll"],
};
/**
 * Event kinds with no cue yet. D2 section 4.5 fills them (death, interrupt, phase and cast-start cues).
 * A kind that gains a cue must leave this list, and an entry here that is not a sim kind fails too.
 */
const uncued = ["cast", "down", "interrupt", "phase"];

describe("every sim event kind against data/audio.json (D2 4.5)", () => {
  it("reads the kind list from core", () => {
    expect(kinds.length).toBeGreaterThanOrEqual(10);
    expect(kinds).toContain("stagger");
  });
  it("gives each kind a resolving cue or lists it as uncued", () => {
    for (const kind of kinds)
      expect(
        kind in cued || uncued.includes(kind),
        `event kind "${kind}" has neither a cue nor an uncued entry`,
      ).toBe(true);
    for (const kind of [...Object.keys(cued), ...uncued])
      expect(kinds, `"${kind}" is not a sim event kind`).toContain(kind);
    for (const kind of uncued) expect(kind in cued).toBe(false);
  });
  it("resolves every mapped cue to a cue with an existing sample", () => {
    const manifest = JSON.parse(
      readFileSync(
        new URL("../public/audio/manifest.json", import.meta.url),
        "utf8",
      ),
    ) as { assets: Record<string, unknown> };
    for (const [kind, cues] of Object.entries(cued))
      for (const cue of cues) {
        const c = (
          audioData.cues as Record<string, { assets: string[] } | undefined>
        )[cue];
        expect(c, `${kind} -> ${cue}`).toBeDefined();
        for (const asset of c!.assets)
          expect(manifest.assets).toHaveProperty(asset);
      }
  });
  it("only plays literal cue names that exist", () => {
    const dir = new URL("./", import.meta.url);
    const walk = (u: URL): URL[] =>
      readdirSync(u, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? walk(new URL(`${e.name}/`, u))
          : e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")
            ? [new URL(e.name, u)]
            : [],
      );
    const played = new Set<string>();
    for (const f of walk(dir))
      for (const m of readFileSync(f, "utf8").matchAll(
        /gameAudio\.play\(\s*"([\w.-]+)"/g,
      ))
        played.add(m[1]!);
    expect(played.has("stagger")).toBe(true);
    for (const cue of played) expect(audioData.cues).toHaveProperty(cue);
  });
});
