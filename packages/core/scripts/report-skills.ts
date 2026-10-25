// Skill-point week curve writer (D1 4.3): `npm --prefix packages/core run census:skills -- [--seed n] [--tag t] [--out-dir docs/...]`.
// Plays the six-week camp season per player policy and arm with the skill book on (skill-census.ts) and prints, per Games morning, the
// skill points earned and the average rank of the ranked rows against the 4.3 target. With --tag it writes `<tag>.json`.
import skillBook from '../src/arena/data/skill-book.pc.json' with { type: 'json' };
import { censusCommand, parseCensusArgs, refuseArgs, writeEvidence } from './census-kit.ts';
import { armRules, rankedKeys, runSkillSeason, type SkillArm, type SkillPolicy } from './skill-census.ts';

const args = process.argv.slice(2), { tag, outDir, arg } = parseCensusArgs(args, { outDir: 'docs/change-requests/evidence' }), seed = Number(arg('--seed') ?? 73);
if (!Number.isSafeInteger(seed)) refuseArgs();
const cells: [SkillPolicy, SkillArm][] = [['steady', 'committed'], ['worker', 'committed'], ['steady', 'flat']];
const runs = cells.map(([policy, arm]) => ({ policy, arm, weekScale: armRules(arm).weekScale, weeks: runSkillSeason(policy, arm, seed) }));
for (const { policy, arm, weeks } of runs) for (const w of weeks)
  console.log(`${policy.padEnd(6)} ${arm.padEnd(9)} week ${w.week} day ${String(w.day).padStart(2)} | ${String(w.activities).padStart(3)} activities, ${String(w.earned).padStart(3)} points (${w.unspent} unspent) | average rank ${w.averageRank.toFixed(2)} (target ${w.target}, ${w.averageRank - w.target >= 0 ? '+' : ''}${(w.averageRank - w.target).toFixed(2)})`);
// One camp season per cell, not census fight seeds: the file carries its seed, not the fight envelope's seed range.
if (tag) writeEvidence(outDir, `${tag}.json`, { label: 'simulated', reading: 'D1 4.3 skill-point week curve, skill book on',
  command: censusCommand('census:skills', args), seed, rankedKeys, award: skillBook.award, weekScale: skillBook.weekScale, rankCost: skillBook.rankCost, runs });
