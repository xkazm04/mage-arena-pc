import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const base = new URL('../../../docs/design/baseline-fourteen-nights/design/data/', import.meta.url);
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
if (combat.tierClock.perfectAbsorbAdvanceS !== combat.absorb.perfect.tierClockAdvanceS) throw Error('Clock reward contradiction');
const stats = csv(read('stats.csv'));
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
const output = '// GENERATED from baseline data. Edit the source data, never this file.\n' +
  Object.entries({ combat, statRules, bolt, waterRows: rows, enemyData: JSON.parse(read('enemies.json')), arenaTiers: JSON.parse(read('arena-tiers.json')) }).map(([key, value]) => `export const ${key} = ${JSON.stringify(value, null, 2)} as const;`).join('\n');
writeFileSync(fileURLToPath(new URL('../src/arena/data.generated.ts', import.meta.url)), output + '\n');
console.log('Arena data compiled from baseline; duplicate clock and Nerve formulas agree.');
