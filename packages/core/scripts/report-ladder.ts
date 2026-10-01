import { mkdirSync, writeFileSync } from 'node:fs';
import { advanceGames, attachMageAI, competence, createGames, gamesResult, presets, runtime, seconds, stateHash, stepGames, ticks } from '../src/arena/index';
const destination = new URL('../../../docs/waves/W4-evidence/', import.meta.url); mkdirSync(destination, { recursive: true });
const rows = [];
for (const level of [1,2,3,4]) {
  let wins = 0, losses = 0, timeouts = 0, perfects = 0, hits = 0, reactionMin = Infinity, violations = 0, durations = 0;
  const startingStats = new Set<string>();
  for (let i = 0; i < runtime.games.ladderTrials; i++) {
    const g = createGames(runtime.games.censusSeedStart + i, presets.find(p => p.name === runtime.games.referencePreset), 2, true), opponent = g.state.actors[1]!;
    attachMageAI(opponent, level); startingStats.add(JSON.stringify({ hp: opponent.hp, mana: opponent.mana, stamina: opponent.stamina, ranks: opponent.ranks }));
    while (g.phase === 'active' && g.state.tick < ticks(runtime.games.fightTimeoutS)) stepGames(g);
    if (g.phase === 'active') timeouts++; else if (g.phase === 'lost') losses++; else wins++;
    perfects += opponent.metrics.perfects; hits += opponent.metrics.hits; durations += seconds(g.state.tick);
    for (const age of opponent.mageAI!.reactionAges) { reactionMin = Math.min(reactionMin, age); if (age < ticks(competence(level).reactionDelayS)) violations++; }
  }
  rows.push({ competence: level, profile: competence(level), trials: runtime.games.ladderTrials, referenceWins: wins, referenceLosses: losses, timeouts,
    meanDurationS: durations / runtime.games.ladderTrials, actualOpponentPerfectRate: perfects / Math.max(1,hits), minimumReactionTicks: Number.isFinite(reactionMin) ? reactionMin : null, reactionViolations: violations, startingStats: [...startingStats].map(s => JSON.parse(s)) });
}
// A reproducible integration run is found explicitly; it is not part of the unbiased wave census.
let completion;
for (let seed = 1; seed <= 100 && !completion; seed++) {
  const g = createGames(seed, presets.find(p => p.name === runtime.games.referencePreset), 0, true), checkpoints = [];
  while (g.phase === 'active' && g.state.tick < ticks(runtime.games.fightTimeoutS * 4)) {
    stepGames(g);
    if (g.phase === 'intermission') { checkpoints.push({ wave: g.wave + 1, hpBeforeRecovery: g.player.hp, tick: g.state.tick }); advanceGames(g); }
  }
  if (g.phase === 'complete') completion = { seed, label: 'simulated selected winning integration fixture; not an unbiased win-rate sample', checkpoints, result: gamesResult(g), durationS: seconds(g.state.tick), hash: stateHash(g.state) };
}
const report = { label: 'simulated', command: 'npm --prefix packages/core run report:w4:ladder', rows, completion,
  note: 'Same starting stats and Water composition at all four competence levels. Perfect probability is a decision probability conditional on observation/reaction; actual impacts may miss the timing or arc. The reference policy is unchanged. Completion seed search is explicitly separate from the 2,000-seed-per-wave census.' };
writeFileSync(new URL('competence-ladder.json', destination), JSON.stringify(report, null, 2) + '\n'); console.table(rows.map(({competence,referenceWins,referenceLosses,timeouts,actualOpponentPerfectRate,minimumReactionTicks}) => ({competence,referenceWins,referenceLosses,timeouts,actualOpponentPerfectRate,minimumReactionTicks})));
if (rows.some(r => r.reactionViolations || r.startingStats.length !== 1) || !completion) throw Error('Ladder/integration gate failed');
console.log(`Completion fixture: seed ${completion.seed}, ${completion.durationS.toFixed(2)} s, ${completion.hash}`);
