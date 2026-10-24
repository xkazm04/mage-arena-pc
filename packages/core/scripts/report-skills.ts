// Skill-point week curve writer (D1 4.3): `npm --prefix packages/core run census:skills -- [--seed n] [--tag t] [--out-dir docs/...]`.
// Plays the six-week camp season per player policy and arm with the skill book on (skill-census.ts) and prints, per Games morning, the
// skill points earned and the average rank of the ranked rows against the 4.3 target. With --tag it writes `<tag>.json`.
import { mkdirSync, writeFileSync } from 'node:fs';
import skillBook from '../src/arena/data/skill-book.pc.json' with { type: 'json' };
import { evidenceDir } from './builds-census.ts';
import { armRules, rankedKeys, runSkillSeason, type SkillArm, type SkillPolicy } from './skill-census.ts';

const args = process.argv.slice(2), arg = (name: string): string | undefined => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const seed = Number(arg('--seed') ?? 73), tag = arg('--tag'), outDir = arg('--out-dir') ?? 'docs/change-requests/evidence';
if (!Number.isSafeInteger(seed) || (tag !== undefined && !/^[a-z0-9-]+$/.test(tag)) || !evidenceDir.test(outDir)) throw Error('Invalid report arguments');
const cells: [SkillPolicy, SkillArm][] = [['steady', 'committed'], ['worker', 'committed'], ['steady', 'flat']];
const runs = cells.map(([policy, arm]) => ({ policy, arm, weekScale: armRules(arm).weekScale, weeks: runSkillSeason(policy, arm, seed) }));
for (const { policy, arm, weeks } of runs) for (const w of weeks)
  console.log(`${policy.padEnd(6)} ${arm.padEnd(9)} week ${w.week} day ${String(w.day).padStart(2)} | ${String(w.activities).padStart(3)} activities, ${String(w.earned).padStart(3)} points (${w.unspent} unspent) | average rank ${w.averageRank.toFixed(2)} (target ${w.target}, ${w.averageRank - w.target >= 0 ? '+' : ''}${(w.averageRank - w.target).toFixed(2)})`);
if (tag) {
  const destination = new URL(`../../../${outDir}/`, import.meta.url); mkdirSync(destination, { recursive: true });
  writeFileSync(new URL(`${tag}.json`, destination), JSON.stringify({ label: 'simulated', reading: 'D1 4.3 skill-point week curve, skill book on',
    command: `npm --prefix packages/core run census:skills -- ${args.join(' ')}`, seed, rankedKeys, award: skillBook.award, weekScale: skillBook.weekScale, rankCost: skillBook.rankCost, runs }, null, 2) + '\n');
}
