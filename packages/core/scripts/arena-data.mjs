// Pure compilation of reconciled arena canon into data.generated.ts source. compile-arena-data.mjs writes it;
// arena-data.test.mjs feeds it planted prose. `read` takes a repository-relative path and returns its text.
const arena = 'docs/design/reconciled/data/arena/';
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
// `+''` is 0 and `+'x'` is NaN: a blank or misspelt cell must stop the build, not become a number.
function num(value, label) {
  if (typeof value !== 'string' || value.trim() === '' || !Number.isFinite(Number(value))) throw Error(`Not a number: ${label} = ${JSON.stringify(value)}`);
  return Number(value);
}
export function compileArenaData(read) {
  const combat = JSON.parse(read(arena + 'combat.json'));
  const scaleContract = JSON.parse(read('art/scale-contract-v3.json'));
  if (combat.absorb.arcDeg !== scaleContract.absorb.angle_degrees) throw Error('Absorb contract contradiction');
  if (combat.tierClock.perfectAbsorbAdvanceS !== combat.absorb.perfect.tierClockAdvanceS) throw Error('Clock reward contradiction');
  const stats = csv(read(arena + 'stats.csv'));
  const campRules = JSON.parse(read('docs/design/reconciled/data/rules.json'));
  for (const name of campRules.stats.names) {
    const row = stats.find(row => row.stat === name);
    if (!row || JSON.stringify(row.points_for_rank_1_2_3_4_5.split(';').map(Number)) !== JSON.stringify(campRules.stats.rankThresholds)) throw Error('Camp/arena rank mapping contradiction');
  }
  const rankRange = { min: 1, max: campRules.stats.rankThresholds.length };
  const tierData = JSON.parse(read(arena + 'arena-tiers.json'));
  // The whole sentence, not a prefix: a fourth weighted term must fail here rather than be swallowed.
  const trialMatch = tierData.tentTrial.score.match(/^bout result (\d+)% \+ elder favour (\d+)% \(trust of elder\) \+ renown (\d+)%$/);
  if (!trialMatch) throw Error(`Unrecognized Trial score authority: ${tierData.tentTrial.score}`);
  const trialPercents = trialMatch.slice(1).map(Number);
  if (trialPercents.reduce((a, b) => a + b, 0) !== 100) throw Error(`Trial score weights sum to ${trialPercents.reduce((a, b) => a + b, 0)}%, not 100%`);
  const trialWeights = trialPercents.map(n => n / 100);
  function formula(stat, variable) {
    const source = stats.find(row => row.stat === stat)?.arena_effect;
    const match = source?.match(new RegExp(`(?:^|; )${variable} = ([\\d.]+) \\+ ([\\d.]+)\\*rank\\b`));
    if (!match) throw Error(`Missing stat formula ${stat}.${variable}`);
    return { base: num(match[1], `${stat}.${variable} base`), perRank: num(match[2], `${stat}.${variable} perRank`) };
  }
  const drain = combat.absorb.drainPerSecond.match(/^(\d+) - (\d+) \* nerveRank$/);
  const refund = combat.absorb.perfect.manaReturned.match(/^(\d+) \* incomingTier \* \(1 \+ ([\d.]+) \* nerveRank\); tier 0 returns (\d+)$/);
  if (!drain || !refund) throw Error('Unrecognized absorb formula');
  const nerve = stats.find(row => row.stat === 'nerve')?.arena_effect.replaceAll(' ', '');
  if (!nerve?.includes(`absorbDrain=${drain[1]}-${drain[2]}*rank`) || !nerve.includes(`perfectReturnMult=1+${refund[2]}*rank`)) throw Error('Nerve authority contradiction');
  const statRules = {
    hp: formula('vigor', 'maxHp'), stamina: formula('vigor', 'maxStamina'),
    mana: formula('focus', 'maxMana'), manaRegen: formula('focus', 'manaRegen'),
    drain: { base: +drain[1], perRank: -drain[2] },
    refund: { perTier: +refund[1], perRank: +refund[2], tierZero: +refund[3] }
  };
  const rows = csv(read(arena + 'spells-water.csv'));
  const boltRow = rows.find(row => row.line === 'bolt');
  if (!boltRow) throw Error('Missing bolt row in spells-water.csv');
  const boltSpeed = boltRow.shape.match(/^projectile ([\d.]+) m\/s$/);
  if (!boltSpeed) throw Error(`Unrecognized bolt shape: ${boltRow.shape}`);
  const bolt = { name: boltRow.name, castS: num(boltRow.cast_s, 'bolt cast_s'), cooldownS: num(boltRow.cooldown_s, 'bolt cooldown_s'),
    mana: num(boltRow.mana, 'bolt mana'), damage: num(boltRow.damage, 'bolt damage'), rangeM: num(boltRow.range_m, 'bolt range_m'),
    speedMps: num(boltSpeed[1], 'bolt speed') };
  // Fire and Air (W8): VR's pinned rows, checked for shape here and read by school in arena/schools.ts.
  const schoolIdentity = JSON.parse(read(arena + 'schools-combat.json'));
  const schoolRows = {};
  for (const [school, gain] of [['fire', 'heat_gain'], ['air', 'momentum_gain']]) {
    const header = `id,name,tier,shape,cast_s,cooldown_s,mana,damage,blockable,telegraph_s,range_m,${gain},notes`;
    const text = read(arena + `spells-${school}.csv`);
    if (text.trim().split(/\r?\n/)[0] !== header) throw Error(`Unrecognized spells-${school}.csv header`);
    // The notes column is unquoted prose that may hold commas: split the first twelve cells only.
    const parsed = text.trim().split(/\r?\n/).slice(1).map(line => {
      const cells = line.split(','), keys = header.split(',');
      if (cells.length < keys.length) throw Error(`Short ${school} row: ${line}`);
      return Object.fromEntries(keys.map((key, i) => [key, i < keys.length - 1 ? cells[i] : cells.slice(i).join(',')]));
    });
    for (const row of parsed) {
      if (!row.id.startsWith(`${school}_`)) throw Error(`${school} row id ${row.id} lacks the school prefix`);
      for (const key of ['tier', 'cast_s', 'cooldown_s', 'mana', 'telegraph_s', 'range_m']) num(row[key], `${row.id} ${key}`);
    }
    if (!parsed.some(row => row.id === `${school}_bolt` && row.tier === '0')) throw Error(`Missing ${school}_bolt tier 0 row`);
    if (schoolIdentity[school]?.resource !== (school === 'fire' ? 'heat' : 'momentum')) throw Error(`schools-combat.json ${school} identity is not its resource`);
    schoolRows[school] = parsed;
  }
  const enemyData = JSON.parse(read(arena + 'enemies.json'));
  // A committed body attack moves its owner; it must never quietly extend the authored reach or lane.
  for (const attack of [...enemyData.soldiers, ...enemyData.creatures].flatMap(e => e.attacks)) {
    if (attack.travelM === undefined && attack.travelS === undefined && attack.reachM === undefined) continue;
    if (!(attack.travelM > 0 && attack.travelS > 0)) throw Error(`${attack.id}: travel needs travelM and travelS`);
    const lane = attack.telegraph?.match(/x ([\d.]+) m/);
    if (lane ? attack.reachM !== undefined || attack.travelM !== Number(lane[1]) : Math.abs(attack.travelM + attack.reachM - attack.rangeM) > 1e-9) throw Error(`${attack.id}: travel and reach must split the authored range`);
  }
  return '// GENERATED by packages/core/scripts/compile-arena-data.mjs from reconciled arena data and art/scale-contract-v3.json.\n' +
    '// Edit the source data, never this file. Rebuild: npm --prefix packages/core run data (npm run build does it too).\n' +
    Object.entries({ scaleContract, combat, statRules, rankRange, trialWeights, bolt, waterRows: rows, fireRows: schoolRows.fire, airRows: schoolRows.air, schoolIdentity, enemyData, arenaTiers: tierData }).map(([key, value]) => `export const ${key} = ${JSON.stringify(value, null, 2)} as const;`).join('\n') + '\n';
}
