import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const base = new URL('../../../docs/design/reconciled/data/arena/', import.meta.url);
const read = name => readFileSync(new URL(name, base), 'utf8');
// The baseline CSV deliberately contains no quoted commas. Refuse ambiguity instead of guessing.
function csv(text) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const keys = header.split(',');
  return lines.map(line => {
    const values = line.split(',');
    if (values.length !== keys.length) throw Error(`Ambiguous CSV row: ${line}`);
    return Object.fromEntries(keys.map((key, i) => [key, values[i]]));
  });
}
const combat = JSON.parse(read('combat.json'));
const scaleContract = JSON.parse(readFileSync(new URL('../../../art/scale-contract-v3.json', import.meta.url), 'utf8'));
if (combat.absorb.arcDeg !== scaleContract.absorb.angle_degrees) throw Error('Absorb contract contradiction');
if (combat.tierClock.perfectAbsorbAdvanceS !== combat.absorb.perfect.tierClockAdvanceS) throw Error('Clock reward contradiction');
const stats = csv(read('stats.csv'));
const campRules = JSON.parse(readFileSync(new URL('../../../docs/design/reconciled/data/rules.json', import.meta.url), 'utf8'));
for (const name of campRules.stats.names) {
  const row = stats.find(row => row.stat === name);
  if (!row || JSON.stringify(row.points_for_rank_1_2_3_4_5.split(';').map(Number)) !== JSON.stringify(campRules.stats.rankThresholds)) throw Error('Camp/arena rank mapping contradiction');
}
const rankRange = { min: 1, max: campRules.stats.rankThresholds.length };
const tierData = JSON.parse(read('arena-tiers.json'));
const trialMatch = tierData.tentTrial.score.match(/bout result (\d+)% \+ elder favour (\d+)%.*renown (\d+)%/);
if (!trialMatch) throw Error('Unrecognized Trial score authority');
const trialWeights = trialMatch.slice(1).map(Number).map(n => n / 100);
function formula(stat, variable) {
  const source = stats.find(row => row.stat === stat).arena_effect;
  const match = source.match(new RegExp(`${variable} = ([\\d.]+) \\+ ([\\d.]+)\\*rank`));
  if (!match) throw Error(`Missing stat formula ${variable}`);
  return { base: Number(match[1]), perRank: Number(match[2]) };
}
const drain = combat.absorb.drainPerSecond.match(/^(\d+) - (\d+) \* nerveRank$/);
const refund = combat.absorb.perfect.manaReturned.match(/^(\d+) \* incomingTier \* \(1 \+ ([\d.]+) \* nerveRank\); tier 0 returns (\d+)$/);
if (!drain || !refund) throw Error('Unrecognized absorb formula');
const nerve = stats.find(row => row.stat === 'nerve').arena_effect.replaceAll(' ', '');
if (!nerve.includes(`absorbDrain=${drain[1]}-${drain[2]}*rank`) || !nerve.includes(`perfectReturnMult=1+${refund[2]}*rank`)) throw Error('Nerve authority contradiction');
const statRules = {
  hp: formula('vigor', 'maxHp'), stamina: formula('vigor', 'maxStamina'),
  mana: formula('focus', 'maxMana'), manaRegen: formula('focus', 'manaRegen'),
  drain: { base: +drain[1], perRank: -drain[2] },
  refund: { perTier: +refund[1], perRank: +refund[2], tierZero: +refund[3] }
};
const rows = csv(read('spells-water.csv'));
const boltRow = rows.find(row => row.line === 'bolt');
const bolt = { name: boltRow.name, castS: +boltRow.cast_s, cooldownS: +boltRow.cooldown_s,
  mana: +boltRow.mana, damage: +boltRow.damage, rangeM: +boltRow.range_m,
  speedMps: Number(boltRow.shape.match(/([\d.]+) m\/s/)[1]) };
const output = '// GENERATED from reconciled arena data and art/scale-contract-v3.json. Edit the source data, never this file.\n' +
  Object.entries({ scaleContract, combat, statRules, rankRange, trialWeights, bolt, waterRows: rows, enemyData: JSON.parse(read('enemies.json')), arenaTiers: tierData }).map(([key, value]) => `export const ${key} = ${JSON.stringify(value, null, 2)} as const;`).join('\n');
writeFileSync(fileURLToPath(new URL('../src/arena/data.generated.ts', import.meta.url)), output + '\n');
console.log('Arena data compiled from reconciled arena and scale contract; clock, Nerve and absorb authorities agree.');
