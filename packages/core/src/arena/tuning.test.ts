import { describe, expect, it } from "vitest";
import { makeTuning, tuningDiff, tuningFields } from "./tuning.ts";

describe("tuningDiff (the Lab's changed-knobs readout)", () => {
  it("names nothing when the two tunings are the same", () => {
    expect(tuningDiff(makeTuning(), makeTuning())).toEqual([]);
  });
  it("names one changed knob with its label, unit and group, in tuningFields order", () => {
    const base = makeTuning();
    expect(tuningDiff(base, { ...base, walkMps: 5 })).toEqual([
      { key: "walkMps", label: "Walk speed", unit: "m/s", group: "Movement", from: base.walkMps, to: 5 },
    ]);
    const order = tuningFields.map((f) => f.key);
    const keys = tuningDiff(base, { ...base, absorbWindowS: 0.25, walkMps: 5 }).map((c) => c.key);
    expect(keys).toEqual([...keys].sort((a, b) => order.indexOf(a as never) - order.indexOf(b as never)));
    expect(keys).toEqual(["walkMps", "absorbWindowS"]);
  });
  it("reports an added spell override as from null and a removed one as to null", () => {
    const base = makeTuning(),
      spec = { castS: 0.4, cooldownS: 1.5, speedMps: 30 },
      added = { ...base, spells: { "bolt:0:base": spec } };
    expect(tuningDiff(base, added)).toEqual([expect.objectContaining({ key: "spells.bolt:0:base", from: null, to: spec })]);
    expect(tuningDiff(added, base)).toEqual([expect.objectContaining({ key: "spells.bolt:0:base", from: spec, to: null })]);
    expect(tuningDiff(added, structuredClone(added))).toEqual([]);
  });
});
