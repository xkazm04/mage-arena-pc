import { openingPosition, openingSeparationM } from './geometry.ts';
import { arenaTiers } from './data.generated.ts';
import { newWaterState, presets, validateComposition } from './catalog.ts';
import { addEnemy, enemyInputs, queueDeathEffects } from './enemies.ts';
import { addMage, combat, createArena, random, resetWave, runtime, seconds, stateHash, stepArena, ticks } from './kernel.ts';
import { attachMageAI, mageInput } from './mage-ai.ts';
import { type Actor, type ArenaState, type Composition, type InputFrame, type Ranks } from './types.ts';
export const tiro = arenaTiers.tiers[0];
export interface GamesResult { kind: 'missio' | 'champion'; wavesCleared: number; gold: number; renown: number; finalReached: boolean; finalWon: boolean }
export interface Games { state: ArenaState; player: Actor; wave: number; phase: 'active' | 'intermission' | 'lost' | 'complete'; wavesCleared: number; waveStartTick: number; result?: GamesResult; spawnLog: { wave: number; id: number; kind: string; x: number; y: number }[] }
export interface GamesPlayer { id: string; name: string; school: 'water'; ranks: Ranks; mastery: number; hpPenalty: number; staminaPenalty: number }
export function createGames(seed: number, composition: Composition = presets[0]!, startWave = 0, referencePlayer = false, snapshot?: GamesPlayer): Games {
  if (!Number.isInteger(startWave) || startWave < 0 || startWave >= tiro.waves.length) throw Error('Invalid Tiro wave');
  if (validateComposition(composition).length) throw Error('Invalid composition');
  if (snapshot && (snapshot.school !== 'water' || !snapshot.id || !snapshot.name || !Number.isInteger(snapshot.mastery) || snapshot.mastery < tiro.requiresMastery || ![snapshot.hpPenalty, snapshot.staminaPenalty].every(n => Number.isFinite(n) && n >= 0))) throw Error('Invalid Games player');
  const state = createArena(seed), player = addMage(state, 0, runtime.games.playerSpawn, snapshot?.name ?? 'Cassia', snapshot?.ranks); player.water = newWaterState(composition);
  if (snapshot) { player.hp = Math.max(1, player.hp - snapshot.hpPenalty); player.maxStamina = Math.max(1, player.maxStamina - snapshot.staminaPenalty); player.stamina = player.maxStamina; }
  if (referencePlayer) attachMageAI(player, runtime.games.referenceCompetence);
  const games: Games = { state, player, wave: startWave, phase: 'active', wavesCleared: 0, waveStartTick: state.tick, spawnLog: [] };
  spawnWave(games); return games;
}
function spawnWave(g: Games): void {
  const wave = tiro.waves[g.wave]!; let index = 0;
  const total = wave.spawns.reduce((n, spawn) => n + ('count' in spawn ? spawn.count : 1), 0);
  for (const spawn of wave.spawns) {
    const count = 'count' in spawn ? spawn.count : 1;
    for (let i = 0; i < count; i++) {
      const formationIndex = wave.kind === 'creatures' ? runtime.games.creatureOpeningOrder[index]! : wave.kind === 'soldiers' ? runtime.games.soldierOpeningOrder[index]! : index;
      const pos = openingPosition(formationIndex, total, { x: (random(g.state, `wave ${g.wave} spawn x`) * 2 - 1) * runtime.games.spawnJitterM,
        y: (random(g.state, `wave ${g.wave} spawn y`) * 2 - 1) * runtime.games.spawnJitterM }, wave.kind === 'soldiers'
          ? runtime.games.enemySpawn.x - runtime.games.playerSpawn.x - openingSeparationM - runtime.games.spawnJitterM
          : total > 1 ? runtime.games.multiEnemyApproachReductionM : 0);
      let actor: Actor;
      if ('enemy' in spawn) actor = addEnemy(g.state, spawn.enemy, pos);
      else {
        actor = addMage(g.state, 1, pos, 'Tiro entrant · Water proxy');
        const presetName = runtime.games.opponentPresets[g.wave - 2]!;
        actor.water = newWaterState(presets.find(p => p.name === presetName)!); attachMageAI(actor, spawn.competence, g.state.tick);
      }
      g.spawnLog.push({ wave: g.wave + 1, id: actor.id, kind: 'enemy' in spawn ? spawn.enemy : `Water proxy ${spawn.competence}`, ...pos }); index++;
    }
  }
}
export function gamesResult(g: Games): GamesResult {
  if (g.result) return g.result;
  if (g.phase !== 'lost' && g.phase !== 'complete') throw Error('Games still in progress');
  const index = g.wavesCleared - 1;
  g.result = { kind: g.phase === 'complete' ? 'champion' : 'missio', wavesCleared: g.wavesCleared, gold: index >= 0 ? tiro.payoutGold[index]! : 0, renown: index >= 0 ? tiro.renown[index]! : 0, finalReached: g.wave === tiro.waves.length - 1, finalWon: g.phase === 'complete' };
  return g.result;
}
export function stepGames(g: Games, playerInput?: InputFrame): void {
  if (g.phase !== 'active') return;
  const inputs = enemyInputs(g.state);
  for (const a of g.state.actors) if (a.mageAI && !a.down) inputs[a.id] = mageInput(g.state, a);
  if (playerInput) inputs[g.player.id] = playerInput;
  stepArena(g.state, inputs); queueDeathEffects(g.state);
  if (g.player.down) { g.phase = 'lost'; gamesResult(g); return; }
  const enemyAlive = g.state.actors.some(a => a.team !== g.player.team && !a.down);
  const enemyHazards = g.state.telegraphs.some(t => t.ownerId !== g.player.id) || g.state.projectiles.some(p => p.ownerId !== g.player.id);
  if (!enemyAlive && !enemyHazards) {
    g.wavesCleared = g.wave + 1; g.phase = g.wave === tiro.waves.length - 1 ? 'complete' : 'intermission';
    if (g.phase === 'complete') gamesResult(g);
  }
}
export function advanceGames(g: Games): void {
  if (g.phase !== 'intermission') throw Error('Only a cleared bout can advance');
  g.wave++; resetWave(g.state, g.player); g.player.pos = { ...runtime.games.playerSpawn }; g.player.previousPos = { ...g.player.pos };
  if (g.player.mageAI) attachMageAI(g.player, g.player.mageAI.competence, g.state.tick);
  g.state.actors = [g.player]; g.phase = 'active'; g.waveStartTick = g.state.tick; spawnWave(g);
}
export function runFight(seed: number, wave: number, maxSeconds = runtime.games.fightTimeoutS) {
  const composition = presets.find(p => p.name === runtime.games.referencePreset)!;
  const g = createGames(seed, composition, wave, true);
  const deadAirBuckets: boolean[] = []; let bucketActive = false;
  while (g.phase === 'active' && g.state.tick < ticks(maxSeconds)) {
    const eventsBefore = g.state.events.length; stepGames(g);
    if (g.state.events.slice(eventsBefore).some(e => e.kind === 'cast' || e.kind === 'hit') || g.state.projectiles.length || g.state.telegraphs.length || g.state.actors.some(a => a.pending)) bucketActive = true;
    if (g.state.tick % ticks(combat.pacingTargets.deadAirBucketS) === 0) { deadAirBuckets.push(!bucketActive); bucketActive = false; }
  }
  return { seed, wave: wave + 1, outcome: g.phase === 'active' ? 'timeout' : g.phase === 'lost' ? 'loss' : 'win', durationS: seconds(g.state.tick),
    hp: g.player.hp, mana: g.player.mana, stamina: g.player.stamina, perfects: g.player.metrics.perfects, incomingHits: g.player.metrics.hits,
    damageDealt: g.player.metrics.damageDealt, damageTaken: g.player.metrics.damageTaken, deadAirBuckets: deadAirBuckets.filter(Boolean).length, buckets: deadAirBuckets.length,
    hash: stateHash(g.state), finite: g.state.actors.every(a => [a.hp,a.mana,a.stamina,a.pos.x,a.pos.y].every(Number.isFinite) && a.hp >= 0 && a.hp <= a.maxHp && a.mana >= 0 && a.mana <= a.maxMana && a.stamina >= 0 && a.stamina <= a.maxStamina) };
}
