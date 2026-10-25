// Exchange-window reach reading (D1 6.10, a reading only, nothing tuned from it): where the rival duels' damage lands.
// `npm --prefix packages/core run data && npx tsx packages/core/scripts/report-reach.ts [--count n] [--week w] [--profile p] [--arm a] [--builds id,id]`
// For each rival build in `week` under `profile` (and a week-census arm), it sums the damage each side's blows put through by the
// attacker-to-defender distance at contact: inside the exchange window's 5 m (closeRangeM), 5-8 m (the reference's chase band), and
// beyond. For the close blows that went through clean it names why no window guarded them: none open, opened by another attacker,
// expired (guardS over) or spent (guardHits used). A read-only verdict tap (kernel.ts tapVerdicts): every fight hashes as its census fight.
import { presets, runtime, seconds, tapVerdicts, type Actor } from '../src/arena/index.ts';
import { exchangeRule } from '../src/arena/exchange.ts';
import { buildGames, parseCensusArgs, refuseArgs, runCensus, outcomeOf, median } from './census-kit.ts';
import { armExtras, armOption, mageArms, profileSpellRanks, weekProfiles, type MageArm } from './week-census.ts';

const args = process.argv.slice(2), { count, arg } = parseCensusArgs(args);
const week = Number(arg('--week') ?? 4), profile = arg('--profile') ?? 'steady', arm = arg('--arm') as MageArm | undefined;
const builds = (arg('--builds') ?? 'fire_light,fire_heavy,air_close').split(',');
if (!weekProfiles[profile] || !Number.isInteger(week) || week < 1 || week > 6 || (arm !== undefined && !Object.hasOwn(mageArms, arm))) refuseArgs();
const reference = presets.find(p => p.name === runtime.games.referencePreset)!, closeM = exchangeRule.closeRangeM ?? 0, chaseM = 8;
const band = (d: number): 'close' | 'chase' | 'far' => d <= closeM ? 'close' : d <= chaseM ? 'chase' : 'far';

for (const id of builds) {
  const damage = { player: { close: 0, chase: 0, far: 0 }, rival: { close: 0, chase: 0, far: 0 } };
  const why: Record<string, number> = {}, durations: number[] = []; let wins = 0;
  for (let i = 0; i < count; i++) {
    const ranks = profileSpellRanks(reference, weekProfiles[profile]![week - 1]!), opponentMage = armOption(week, arm);
    const { g } = buildGames(runtime.games.censusSeedStart + i, id, undefined, { ...(week > 1 ? { enemyLevel: week } : {}), ...(Object.keys(ranks).length ? { spellRanks: ranks } : {}), ...(opponentMage ? { opponentMage } : {}), ...armExtras(arm) });
    tapVerdicts(g.state, (state, target, hit, outcome, verdict) => {
      const owner: Actor | undefined = state.actors.find(a => a.id === hit.ownerId);
      if (outcome !== 'resolved' || !verdict || !owner || owner === target) return;
      const at = band(Math.hypot(owner.pos.x - target.pos.x, owner.pos.y - target.pos.y)), side = owner === g.player ? 'player' : 'rival';
      damage[side][at] += verdict.damage;
      if (at === 'close' && !verdict.guard) {
        const w = target.exchange, reason = !w ? 'none open' : w.fromId !== owner.id ? 'other attacker' : state.tick >= w.guardUntil ? 'expired' : w.guardsLeft <= 0 ? 'spent' : 'unblockable or reach';
        why[reason] = (why[reason] ?? 0) + 1;
      }
    });
    runCensus(g); if (outcomeOf(g) === 'win') wins++; durations.push(seconds(g.state.tick - g.waveStartTick));
  }
  const shares = (d: { close: number; chase: number; far: number }) => { const t = d.close + d.chase + d.far || 1; return `<=${closeM} m ${(100 * d.close / t).toFixed(0)}% | ${closeM}-${chaseM} m ${(100 * d.chase / t).toFixed(0)}% | >${chaseM} m ${(100 * d.far / t).toFixed(0)}%`; };
  console.log(`${arm ? `${arm} ` : ''}${profile} week ${week} ${id}: reference wins ${(100 * wins / count).toFixed(1)}%, median ${median(durations)?.toFixed(1)} s`);
  console.log(`  damage the player puts through: ${shares(damage.player)}`);
  console.log(`  damage the rival puts through:  ${shares(damage.rival)}`);
  console.log(`  clean close blows per fight, why no window guarded them: ${Object.entries(why).map(([k, n]) => `${k} ${(n / count).toFixed(2)}`).join(', ') || 'none'}`);
}
