import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createLab,
  defaultLabConfig,
  stepLab,
  attachMageAI,
  mageInput,
  stateHash,
  schools,
  seconds,
  makeTuning,
  type LabMetrics,
  type School,
} from "@mage/core/arena";
const tag = process.argv[2] ?? "before";
if (!["before", "after"].includes(tag)) throw Error("Expected before or after");
const rows: (LabMetrics & {
  school: School;
  seed: number;
  outcome: string;
  durationS: number;
  staggers: number;
  cancelledCasts: number;
  hitsToDefeat: number | null;
  hash: string;
})[] = [];
for (const school of schools)
  for (let seed = 7331; seed < 7431; seed++) {
    const l = createLab(
      { ...defaultLabConfig, opponent: "mage", opponentSchool: school, seed },
      makeTuning(),
    );
    const { state, player, dummy } = l.training;
    let staggers = 0;
    attachMageAI(player, 3);
    while (
      state.tick < 7200 &&
      !player.tags.includes("DEFEATED") &&
      !dummy.tags.includes("DEFEATED")
    ) {
      const previous = state.actors.map((a) => a.staggerUntil ?? 0);
      stepLab(l, mageInput(state, player), false);
      staggers += state.actors.filter(
        (a, i) => (a.staggerUntil ?? 0) > previous[i]!,
      ).length;
    }
    rows.push({
      school,
      seed,
      outcome: dummy.tags.includes("DEFEATED")
        ? "win"
        : player.tags.includes("DEFEATED")
          ? "loss"
          : "timeout",
      durationS: seconds(state.tick),
      staggers,
      cancelledCasts: state.events.filter((e) => e.kind === "interrupt").length,
      hitsToDefeat:
        player.tags.includes("DEFEATED") || dummy.tags.includes("DEFEATED")
          ? state.events.filter(
              (e) =>
                e.kind === "hit" &&
                e.value > 0 &&
                e.actorId ===
                  (dummy.tags.includes("DEFEATED") ? dummy.id : player.id),
            ).length
          : null,
      ...l.metrics,
      hash: stateHash(state),
    });
  }
const median = (v: number[]) =>
  v.toSorted((a, b) => a - b)[Math.floor(v.length / 2)] ?? null;
const summary = schools.map((school) => {
  const r = rows.filter((r) => r.school === school);
  return {
    school,
    n: r.length,
    wins: r.filter((r) => r.outcome === "win").length,
    timeouts: r.filter((r) => r.outcome === "timeout").length,
    durationMedianS: median(r.map((r) => r.durationS)),
    hitsToDefeatMedian: median(
      r.flatMap((r) => (r.hitsToDefeat === null ? [] : [r.hitsToDefeat])),
    ),
    staggersTotal: r.reduce((n, r) => n + r.staggers, 0),
    cancelledCastsTotal: r.reduce((n, r) => n + r.cancelledCasts, 0),
    winningTTKMedianS: median(
      r.flatMap((r) => (r.timeToKillS === null ? [] : [r.timeToKillS])),
    ),
    hitsTakenMedian: median(r.map((r) => r.taken)),
    absorbOpportunitiesMedian: median(r.map((r) => r.incomingMagic)),
    absorbSuccessTotal: r.reduce((a, r) => a + r.absorbs, 0),
    perfectTotal: r.reduce((a, r) => a + r.perfects, 0),
  };
});
const out = resolve("docs/waves/H1-evidence");
mkdirSync(out, { recursive: true });
const report = {
  label: "headless simulation, not human play",
  tag,
  method:
    "100 fixed seeds 7331..7430 per opponent school. Water Rotation reference input AI level 3 vs level 2 practice profile, aggression .75, 10 m, Current tuning, damage ON, fresh resources, 120 s cap. Absorb opportunities = incoming magic contacts including guarded/perfect; misses and i-frame avoidance excluded. TTK only wins, durations include losses/timeouts.",
  tuning: makeTuning(),
  summary,
  rows,
};
writeFileSync(
  resolve(out, `${tag}.json`),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(summary, null, 2));
