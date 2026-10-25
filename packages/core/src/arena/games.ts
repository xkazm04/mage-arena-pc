import { openingPosition, openingSeparationM } from './geometry.ts';
import { arenaTiers } from './data.generated.ts';
import { newWaterState, presets, validateComposition } from './catalog.ts';
import { addEnemy, enemyInputs, queueDeathEffects } from './enemies.ts';
import { addMage, combat, createArena, random, resetWave, runtime, seconds, stateHash, stepArena, ticks } from './kernel.ts';
import { attachMageAI, mageInput } from './mage-ai.ts';
import { attachRivalPlan } from './rival-plan.ts';
import { createLedger, observeLedger } from './ledger.ts';
import { buildRivalLabel, makeBuildRival, makeSchoolRival, type SchoolRivals } from './school-rivals.ts';
import { referenceRangeProblems, rivalBuilds, setReferenceRange, type ReferenceRange, type RivalBuild } from './archetypes.ts';
import { applyRivalHp, beginRivalWave, bindRival, enableRivalPhases, rivals } from './rival-phases.ts';
import { type Actor, type ArenaState, type Composition, type Difficulty, type InputFrame, type Ranks, type SpellRanks } from './types.ts';
import { enemyHpMult, rankSteps, setSpellRanks, validEnemyLevel } from './progression.ts';
import { exchangeReachProblems, setExchangeReach, setReachSteps, type ExchangeReach } from './exchange.ts';
import { defaultDifficulty, validateTuning, type CombatTuning } from './tuning.ts';
import { applyOpponentMage, opponentMageProblems, type OpponentMage } from './mage-build.ts';
export const tiro = arenaTiers.tiers[0];
/** Anonymous Tiro mage entrants; presentation matches this label, so it lives here once. */
export const tiroEntrantLabel = 'Tiro entrant · Water proxy';
export interface GamesResult { kind: 'missio' | 'champion'; wavesCleared: number; gold: number; renown: number; finalReached: boolean; finalWon: boolean }
export interface Games { schoolRivals?: SchoolRivals; /** The authored rival build on its wave (archetypes.ts); present only when set. */ rivalBuild?: string; /** Regular enemies' level (progression.ts); present only when set. */ enemyLevel?: number; /** The opponent-mage lever (mage-build.ts); present only when set. */ opponentMage?: OpponentMage; /** The D1 6.10 rank-defence lever; present only when set. */ rankDefence?: RankDefence; state: ArenaState; player: Actor; wave: number; phase: 'active' | 'intermission' | 'lost' | 'complete'; wavesCleared: number; waveStartTick: number; result?: GamesResult; spawnLog: { wave: number; id: number; kind: string; x: number; y: number }[] }
export interface GamesPlayer { id: string; name: string; school: 'water'; ranks: Ranks; mastery: number; hpPenalty: number; staminaPenalty: number }
/** `tuning` is a Lab what-if: omitted, the state carries no tuning. `difficulty` paces the opponents for the whole Games (the player's pace is fixed).
 * `options.schoolRivals` turns the mage duelists into Fire/Air rivals (school-rivals.ts); omitted, the Water proxies.
 * In 'named' mode Brennic and Lio fight in HP-gated phases (rival-phases.ts, VR CR-005); `rivalPhases: false` turns them off (measurement).
 * `enemyLevel` (1..6, the campaign week; progression.ts) scales regular enemies' HP; named rivals and mage entrants keep theirs.
 * `spellRanks` ranks the player's spells for this Games (a what-if like `tuning`; the save carries none yet). Both omitted:
 * level 1 and rank 1, exactly today's Games.
 * `rivalBuild` (a rival-builds.json id) spawns that authored build in place of the rival on the build's wave; in 'named' mode
 * Brennic and Lio play the builds rivals.json names, and the named phases bind a build of the named rival's school and wave.
 * `opponentMage` (D1 4.3/6.8 lever, mage-build.ts) levels every opponent mage at spawn: `level` its HP as enemyLevel does a regular
 * enemy's, `averageRank` its rows' spell ranks, never below its own. Omitted, opponent mages spawn exactly as today.
 * Two D1 6.10 levers (a reading: only the week census sets them; omitted, the Games plays exactly as today), each read off the rank
 * steps a mage gained above its authored build (gainedRanks): `exchangeReach` grows the exchange window's reach with the defender's
 * steps (exchange.ts), `rankDefence` grows every mage's HP with its own steps (rankDefenceHpMult).
 * `referenceRange` (D1 6.11, 4.1 E, a reading: only the week census sets it) has the reference player hold the band of the build it
 * faces (archetypes.ts referenceBand) instead of the authored 5-8 m. Omitted, the Games plays exactly as today. */
export function createGames(seed: number, composition: Composition = presets[0]!, startWave = 0, referencePlayer = false, snapshot?: GamesPlayer, tuning?: CombatTuning, difficulty: Difficulty = defaultDifficulty, options: { schoolRivals?: SchoolRivals; balance?: 'canonical'; unpaced?: true; rivalPhases?: false; enemyLevel?: number; spellRanks?: SpellRanks; rivalBuild?: string; opponentMage?: OpponentMage; exchangeReach?: ExchangeReach; rankDefence?: RankDefence; referenceRange?: ReferenceRange } = {}): Games {
  if (!Number.isInteger(startWave) || startWave < 0 || startWave >= tiro.waves.length) throw Error('Invalid Tiro wave');
  if (validateComposition(composition).length) throw Error('Invalid composition');
  if (snapshot && (snapshot.school !== 'water' || !snapshot.id || !snapshot.name || !Number.isInteger(snapshot.mastery) || snapshot.mastery < tiro.requiresMastery || ![snapshot.hpPenalty, snapshot.staminaPenalty].every(n => Number.isFinite(n) && n >= 0))) throw Error('Invalid Games player');
  if (options.enemyLevel !== undefined && !validEnemyLevel(options.enemyLevel)) throw Error('Invalid enemy level');
  if (options.rivalBuild !== undefined && !rivalBuilds[options.rivalBuild]) throw Error('Invalid rival build');
  if (options.opponentMage !== undefined) {
    if (options.opponentMage.level !== undefined && !validEnemyLevel(options.opponentMage.level)) throw Error('Invalid enemy level');
    if (opponentMageProblems(options.opponentMage).length) throw Error('Invalid opponent mage');
  }
  if (options.exchangeReach !== undefined && exchangeReachProblems(options.exchangeReach).length) throw Error('Invalid exchange reach');
  if (options.rankDefence !== undefined && rankDefenceProblems(options.rankDefence).length) throw Error('Invalid rank defence');
  if (options.referenceRange !== undefined && referenceRangeProblems(options.referenceRange).length) throw Error('Invalid reference range');
  const state = createArena(seed, options.unpaced ? undefined : difficulty), player = addMage(state, 0, runtime.games.playerSpawn, snapshot?.name ?? 'Cassia', snapshot?.ranks); player.water = newWaterState(composition);
  if (options.balance) state.balance = options.balance;
  if (options.exchangeReach) setExchangeReach(state, options.exchangeReach);
  setSpellRanks(player, options.spellRanks);
  gainedRanks(state, player, 0, options.rankDefence);
  if (tuning) { state.tuning = validateTuning(tuning); player.poise *= state.tuning.playerPoise; }
  if (snapshot) { player.hp = Math.max(1, player.hp - snapshot.hpPenalty); player.maxStamina = Math.max(1, player.maxStamina - snapshot.staminaPenalty); player.stamina = player.maxStamina; }
  if (referencePlayer) attachMageAI(player, runtime.games.referenceCompetence);
  if (options.referenceRange) setReferenceRange(state, player, options.referenceRange);
  const games: Games = { state, player, wave: startWave, phase: 'active', wavesCleared: 0, waveStartTick: state.tick, spawnLog: [] };
  if (options.schoolRivals) games.schoolRivals = options.schoolRivals;
  if (options.enemyLevel !== undefined) games.enemyLevel = options.enemyLevel;
  if (options.rivalBuild !== undefined) games.rivalBuild = options.rivalBuild;
  if (options.opponentMage !== undefined) games.opponentMage = { ...options.opponentMage };
  if (options.rankDefence !== undefined) games.rankDefence = { ...options.rankDefence };
  if (options.schoolRivals === 'named' && options.rivalPhases !== false) enableRivalPhases(state);
  spawnWave(games); return games;
}
function spawnWave(g: Games): void {
  const wave = tiro.waves[g.wave]!; let index = 0;
  beginRivalWave(g.state);
  const total = wave.spawns.reduce((n, spawn) => n + ('count' in spawn ? spawn.count : 1), 0);
  for (const spawn of wave.spawns) {
    const count = 'count' in spawn ? spawn.count : 1;
    for (let i = 0; i < count; i++) {
      const formationIndex = wave.kind === 'creatures' ? runtime.games.creatureOpeningOrder[index]! : wave.kind === 'soldiers' ? runtime.games.soldierOpeningOrder[index]! : index;
      const pos = openingPosition(formationIndex, total, { x: (random(g.state, `wave ${g.wave} spawn x`) * 2 - 1) * runtime.games.spawnJitterM,
        y: (random(g.state, `wave ${g.wave} spawn y`) * 2 - 1) * runtime.games.spawnJitterM }, wave.kind === 'soldiers'
          ? runtime.games.enemySpawn.x - runtime.games.playerSpawn.x - openingSeparationM - runtime.games.spawnJitterM
          : total > 1 ? runtime.games.multiEnemyApproachReductionM : 0);
      let actor: Actor, kind = 'enemy' in spawn ? spawn.enemy : `Water proxy ${spawn.competence}`;
      if ('enemy' in spawn) {
        actor = addEnemy(g.state, spawn.enemy, pos);
        const hpMult = enemyHpMult(g.enemyLevel ?? 1, g.state);
        if (hpMult !== 1) actor.hp = actor.maxHp = actor.maxHp * hpMult;
      }
      else {
        // The wave's first mage may be an authored build (archetypes.ts): it spawns with the build's ranks (HP, mana, stamina follow).
        const build = index === 0 ? waveBuild(g) : undefined;
        actor = addMage(g.state, 1, pos, tiroEntrantLabel, build?.ranks);
        const presetName = runtime.games.opponentPresets[g.wave - 2]!;
        actor.water = newWaterState(presets.find(p => p.name === presetName)!); attachMageAI(actor, spawn.competence, g.state.tick);
        if (runtime.games.rivalPlans) attachRivalPlan(actor);
        if (build) { kind = `${makeBuildRival(actor, build, buildRivalLabel(build, g.schoolRivals === 'named' && rivals.some(r => r.wave === g.wave && r.build === build.id)))} ${spawn.competence}`; if (g.schoolRivals === 'named') applyRivalHp(actor, g.wave); bindRival(g.state, actor, g.wave); }
        else if (g.schoolRivals) { kind = `${makeSchoolRival(actor, g.schoolRivals, g.wave)} ${spawn.competence}`; if (g.schoolRivals === 'named') applyRivalHp(actor, g.wave); bindRival(g.state, actor, g.wave); }
        const authoredSteps = rankSteps(actor, g.state);
        if (g.opponentMage) applyOpponentMage(actor, g.opponentMage, g.state);
        gainedRanks(g.state, actor, authoredSteps, g.rankDefence);
      }
      if (g.state.tuning) actor.poise *= g.state.tuning.opponentPoise;
      g.spawnLog.push({ wave: g.wave + 1, id: actor.id, kind, ...pos }); index++;
    }
  }
}
/** The rank-defence lever (D1 6.10, a reading only): rank power grows a mage's defence as well as its damage. Each rank step it
 * gained (gainedRanks) adds `hpPerRankStep` to its HP, so 0.1 mirrors the rank power table's +0.1 a rank: two mages that gained the
 * same ranks then take as long to fell each other as at rank 1. An HP step, not an incoming-damage cut: it is set at spawn and
 * leaves the shared hit path (contact.ts, kernel.ts) untouched. */
export interface RankDefence { hpPerRankStep: number }
export function rankDefenceProblems(candidate: unknown): string[] {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return ['Rank defence is not an object.'];
  const c = candidate as Record<string, unknown>;
  return [...Object.keys(c).filter(k => k !== 'hpPerRankStep').map(k => `Rank defence: unknown key ${k}.`),
    ...(typeof c.hpPerRankStep === 'number' && c.hpPerRankStep > 0 && c.hpPerRankStep <= 1 ? [] : [`Rank defence: hpPerRankStep ${String(c.hpPerRankStep)} is not in (0, 1].`])];
}
/** The HP multiplier the lever gives a mage that gained `steps` rank steps: 1 + hpPerRankStep x steps. */
export const rankDefenceHpMult = (steps: number, spec: RankDefence): number => 1 + spec.hpPerRankStep * steps;
/** A mage's gained rank steps: its rankSteps (progression.ts) above `authoredSteps`, the steps its authored build carried at spawn
 * (0 for the player, whose ranks are all earned; an opponent mage's gain is the opponentMage lever's). They feed both D1 6.10 levers:
 * the exchange reach records them (only in a state that has one) and the rank defence scales HP by them. No lever, or no gain,
 * leaves the actor exactly as spawned. */
function gainedRanks(state: ArenaState, a: Actor, authoredSteps: number, defence: RankDefence | undefined): void {
  const steps = rankSteps(a, state) - authoredSteps;
  setReachSteps(state, a, steps);
  const mult = defence ? rankDefenceHpMult(steps, defence) : 1;
  if (mult !== 1) a.hp = a.maxHp = a.maxHp * mult;
}
/** The build that replaces this wave's rival: the `rivalBuild` option on its own wave, else (named mode) the named rival's build. */
function waveBuild(g: Games): RivalBuild | undefined {
  const own = g.rivalBuild !== undefined ? rivalBuilds[g.rivalBuild] : undefined;
  if (own && own.wave === g.wave) return own;
  const named = g.schoolRivals === 'named' ? rivals.find(r => r.wave === g.wave)?.build : undefined;
  return named !== undefined ? rivalBuilds[named] : undefined;
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
  for (const a of g.state.actors) if (a.mageAI && !a.tags.includes("DEFEATED")) inputs[a.id] = mageInput(g.state, a);
  if (playerInput) inputs[g.player.id] = playerInput;
  stepArena(g.state, inputs); queueDeathEffects(g.state);
  if (g.player.tags.includes("DEFEATED")) { g.phase = 'lost'; gamesResult(g); return; }
  const enemyAlive = g.state.actors.some(a => a.team !== g.player.team && !a.tags.includes("DEFEATED"));
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
export function runFight(seed: number, wave: number, maxSeconds = runtime.games.fightTimeoutS, tuning?: CombatTuning, difficulty: Difficulty = defaultDifficulty) {
  const composition = presets.find(p => p.name === runtime.games.referencePreset)!;
  const g = createGames(seed, composition, wave, true, undefined, tuning, difficulty), ledger = createLedger(g.state, g.player.id);
  const deadAirBuckets: boolean[] = []; let bucketActive = false;
  while (g.phase === 'active' && g.state.tick < ticks(maxSeconds)) {
    const eventsBefore = g.state.events.length; stepGames(g); observeLedger(ledger, g.state);
    if (g.state.events.slice(eventsBefore).some(e => e.kind === 'cast' || e.kind === 'hit') || g.state.projectiles.length || g.state.telegraphs.length || g.state.actors.some(a => a.pending)) bucketActive = true;
    if (g.state.tick % ticks(combat.pacingTargets.deadAirBucketS) === 0) { deadAirBuckets.push(!bucketActive); bucketActive = false; }
  }
  return { seed, wave: wave + 1, outcome: g.phase === 'active' ? 'timeout' : g.phase === 'lost' ? 'loss' : 'win', durationS: seconds(g.state.tick),
    hp: g.player.hp, mana: g.player.mana, stamina: g.player.stamina, perfects: g.player.metrics.perfects, incomingHits: g.player.metrics.hits,
    damageDealt: g.player.metrics.damageDealt, damageTaken: g.player.metrics.damageTaken, deadAirBuckets: deadAirBuckets.filter(Boolean).length, buckets: deadAirBuckets.length, answers: ledger.counts,
    hash: stateHash(g.state), finite: g.state.actors.every(a => [a.hp,a.mana,a.stamina,a.pos.x,a.pos.y].every(Number.isFinite) && a.hp >= 0 && a.hp <= a.maxHp && a.mana >= 0 && a.mana <= a.maxMana && a.stamina >= 0 && a.stamina <= a.maxStamina) };
}
