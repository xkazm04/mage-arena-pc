import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  attachMageAI, createLab, defaultLabConfig, makeTuning, mageInput, schools, seconds, stateHash, stepLab,
  type LabMetrics, type School,
} from '@mage/core/arena';

/** Optional per-bout columns; H1 reads all three, CF none. */
export type CensusExtra = 'staggers' | 'cancelledCasts' | 'hitsToDefeat';
export type CensusRow = LabMetrics & {
  school: School; seed: number; outcome: string; durationS: number;
  staggers?: number; cancelledCasts?: number; hitsToDefeat?: number | null; hash: string;
};
export const censusSeeds = Array.from({ length: 100 }, (_, i) => 7331 + i);
export const censusMethod =
  '100 fixed seeds 7331..7430 per opponent school. Water Rotation reference input AI level 3 vs level 2 practice profile, aggression .75, 10 m, Current tuning, damage ON, fresh resources, 120 s cap. Absorb opportunities = incoming magic contacts including guarded/perfect; misses and i-frame avoidance excluded. TTK only wins, durations include losses/timeouts.';

const median = (v: number[]) => v.toSorted((a, b) => a - b)[Math.floor(v.length / 2)] ?? null;

/** The Lab reference duel against every opponent school; extras only read state, never steer it. */
export function schoolCensus({ seeds = censusSeeds, extras = [] }: { seeds?: number[]; extras?: CensusExtra[] } = {}) {
  const x = new Set(extras), rows: CensusRow[] = [];
  for (const school of schools)
    for (const seed of seeds) {
      const l = createLab({ ...defaultLabConfig, opponent: 'mage', opponentSchool: school, seed }, makeTuning());
      const { state, player, dummy } = l.training;
      let staggers = 0;
      attachMageAI(player, 3);
      while (state.tick < 7200 && !player.tags.includes('DEFEATED') && !dummy.tags.includes('DEFEATED')) {
        const previous = x.has('staggers') ? state.actors.map((a) => a.staggerUntil ?? 0) : [];
        stepLab(l, mageInput(state, player), false);
        if (x.has('staggers')) staggers += state.actors.filter((a, i) => (a.staggerUntil ?? 0) > previous[i]!).length;
      }
      const won = dummy.tags.includes('DEFEATED'), lost = player.tags.includes('DEFEATED');
      rows.push({
        school,
        seed,
        outcome: won ? 'win' : lost ? 'loss' : 'timeout',
        durationS: seconds(state.tick),
        ...(x.has('staggers') ? { staggers } : {}),
        ...(x.has('cancelledCasts') ? { cancelledCasts: state.events.filter((e) => e.kind === 'interrupt').length } : {}),
        ...(x.has('hitsToDefeat') ? {
          hitsToDefeat: won || lost
            ? state.events.filter((e) => e.kind === 'hit' && e.value > 0 && e.actorId === (won ? dummy.id : player.id)).length
            : null,
        } : {}),
        ...l.metrics,
        hash: stateHash(state),
      });
    }
  const summary = schools.map((school) => {
    const r = rows.filter((r) => r.school === school);
    return {
      school,
      n: r.length,
      wins: r.filter((r) => r.outcome === 'win').length,
      timeouts: r.filter((r) => r.outcome === 'timeout').length,
      durationMedianS: median(r.map((r) => r.durationS)),
      ...(x.has('hitsToDefeat') ? { hitsToDefeatMedian: median(r.flatMap((r) => (r.hitsToDefeat == null ? [] : [r.hitsToDefeat]))) } : {}),
      ...(x.has('staggers') ? { staggersTotal: r.reduce((n, r) => n + r.staggers!, 0) } : {}),
      ...(x.has('cancelledCasts') ? { cancelledCastsTotal: r.reduce((n, r) => n + r.cancelledCasts!, 0) } : {}),
      winningTTKMedianS: median(r.flatMap((r) => (r.timeToKillS === null ? [] : [r.timeToKillS]))),
      hitsTakenMedian: median(r.map((r) => r.taken)),
      absorbOpportunitiesMedian: median(r.map((r) => r.incomingMagic)),
      absorbSuccessTotal: r.reduce((a, r) => a + r.absorbs, 0),
      perfectTotal: r.reduce((a, r) => a + r.perfects, 0),
    };
  });
  return { rows, summary };
}

/** Entry for the cf-report and h1-report shims: `<script> before|after` writes docs/waves/<wave>-evidence/<tag>.json. */
export function censusCli(wave: string, extras: CensusExtra[] = []) {
  const tag = process.argv[2] ?? 'before';
  if (!['before', 'after'].includes(tag)) throw Error('Expected before or after');
  const { rows, summary } = schoolCensus({ extras });
  const out = resolve(`docs/waves/${wave}-evidence`);
  mkdirSync(out, { recursive: true });
  const report = { label: 'headless simulation, not human play', tag, method: censusMethod, tuning: makeTuning(), summary, rows };
  writeFileSync(resolve(out, `${tag}.json`), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
}
