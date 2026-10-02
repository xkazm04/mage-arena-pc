import data from '../../../docs/design/reconciled/data/season-bridge.json' with { type: 'json' };
import { trialWeights } from './arena/data.generated.ts';
import { calendar, seededUnit } from './camp.ts';
import { passSlot, type CampSession } from './camp-session.ts';
import type { Tables, Trace } from './types.ts';
import { advanceGames, attachMageAI, createGames, gamesResult, stateHash, stepGames, presets, validateComposition, type Games, type GamesPlayer, type GamesResult, type Composition, type InputFrame } from './arena/index.ts';

export const bridgeRules = data;
export type TrialStance = keyof typeof data.trial.beats;
export interface Trial {
  id: string; day: number; rival: string; elder: string; stamina: [number, number];
  score: [number, number]; rounds: { stance: TrialStance; opponent: TrialStance; rolls: [number, number]; totals: [number, number]; won: boolean }[];
  phase: 'active' | 'complete'; entrant?: string; weights?: [number, number];
}
export type BoutInput = { type: 'tick'; tick: number; input: InputFrame } | { type: 'advance'; tick: number };
export interface SeasonBout {
  id: string; day: number; seed: number; phase: 'prepared' | 'active' | 'intermission' | 'terminal';
  entrant: GamesPlayer; spectator: boolean; composition: Composition; games: Games | null; log: BoutInput[];
}
export interface Receipt { id: string; day: number; kind: 'trial' | 'games'; entrant: string; result?: GamesResult; hash: string; trace: Trace[] }
export interface SeasonProgress { composition: Composition; trial: Trial | null; bout: SeasonBout | null; receipts: Receipt[] }
export function createSeason(): SeasonProgress { return { composition: structuredClone(presets[0]!), trial: null, bout: null, receipts: [] }; }
export function seasonDue(t: Tables, s: CampSession, p: SeasonProgress): 'trial' | 'games' | null {
  if (s.camp.day > t.season.daysPerWeek * data.weeksPlayable) return null;
  const day = calendar(t, s.camp.day);
  if (day.eve && s.slot === t.season.trialSlot && !p.receipts.some(r => r.kind === 'trial' && r.day === s.camp.day)) return 'trial';
  if (day.games && !p.receipts.some(r => r.kind === 'games' && r.day === s.camp.day)) return 'games';
  return null;
}
export function campPlayerSnapshot(t: Tables, s: CampSession, id = s.camp.player): GamesPlayer {
  const c = s.camp.characters[id];
  if (!c || c.school !== data.playableSchool || c.life !== 'Alive') throw Error('Only a living Water entrant is available in this chapter.');
  return { id, name: c.name, school: 'water', ranks: { vigor: c.stats.vigor, focus: c.stats.focus, nerve: c.stats.nerve }, mastery: c.mastery,
    hpPenalty: c.sick ? -t.rules.schemes.poison.nextGamesHp : 0,
    staminaPenalty: c.fatigue * data.fatigueStaminaPerPoint + (c.sick ? -t.rules.schemes.poison.nextGamesStamina : 0) };
}
export function beginTrial(t: Tables, s: CampSession, p: SeasonProgress): Trial {
  if (seasonDue(t, s, p) !== 'trial' || s.location !== t.season.trialLocation || p.bout || p.trial?.day === s.camp.day) throw Error('The Tent Trial belongs at the Pit on Games eve, at dusk, once per day.');
  const player = s.camp.characters[s.camp.player];
  const rival = Object.values(s.camp.characters).find(c => c.id !== player.id && c.school === player.school && c.rank === player.rank && c.role !== 'elder');
  const elder = Object.values(s.camp.characters).find(c => c.tent === player.tent && c.role === 'elder');
  if (!rival || !elder) throw Error('The Trial needs a rival and elder.');
  const stamina = [player, rival].map(c => createGames(s.camp.seed, p.composition, 0, false, campPlayerSnapshot(t, s, c.id)).player.maxStamina) as [number, number];
  return { id: `trial:${s.camp.seed}:${s.camp.day}`, day: s.camp.day, rival: rival.id, elder: elder.id, stamina, score: [0, 0], rounds: [], phase: 'active' };
}
export function trialTell(s: CampSession, trial: Trial): TrialStance {
  return data.trial.stances[Math.floor(seededUnit(s.camp.seed, trial.day, trial.rival, `trial-tell:${trial.rounds.length}`) * data.trial.stances.length)] as TrialStance;
}
export function exchangeTrial(t: Tables, s: CampSession, before: Trial, stance: TrialStance): Trial {
  if (before.phase !== 'active' || !data.trial.stances.includes(stance)) throw Error('That Trial exchange is unavailable.');
  const trial = structuredClone(before), opponent = trialTell(s, trial), choices = [stance, opponent] as const;
  const characters = [s.camp.characters[s.camp.player], s.camp.characters[trial.rival]];
  const rolls = characters.map(c => 1 + Math.floor(seededUnit(s.camp.seed, trial.day, c.id, `trial:${trial.rounds.length}`) * t.rules.contests.dieSides)) as [number, number];
  const totals = characters.map((c, i) => {
    const choice = choices[i]!, cost = data.trial.costs[choice];
    const exhausted = trial.stamina[i]! < cost;
    trial.stamina[i] = Math.max(0, trial.stamina[i]! - cost);
    return rolls[i]! + (c.stats.vigor + c.stats.nerve) * data.trial.rankWeight + (data.trial.beats[choice] === choices[1 - i] ? data.trial.counterBonus : 0) - (exhausted ? data.trial.exhaustedPenalty : 0);
  }) as [number, number];
  const won = totals[0] > totals[1]; trial.score[won ? 0 : 1]++;
  trial.rounds.push({ stance, opponent, rolls, totals, won });
  if (Math.max(...trial.score) >= data.trial.exchangesToWin || trial.rounds.length >= data.trial.maxExchanges) {
    trial.phase = 'complete';
    trial.weights = characters.map((c, i) => (trial.score[i]! > trial.score[1 - i]! ? trialWeights[0]! : 0) + (s.camp.trust[`${trial.elder}>${c.id}`] ?? 0) / data.trial.scoreScale * trialWeights[1]! + c.renown / data.trial.scoreScale * trialWeights[2]!) as [number, number];
    trial.entrant = trial.weights[0] > trial.weights[1] ? s.camp.player : trial.rival;
  }
  return trial;
}
function change(s: CampSession, trace: Trace[], path: string, value: number, rule: string) {
  const parts = path.split('/'); let obj = s.camp as unknown as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) obj = obj[part] as Record<string, unknown>;
  const key = parts.at(-1)!; const before = obj[key]; obj[key] = value;
  trace.push({ path, before, after: value, rule });
}
function social(t: Tables, s: CampSession, trace: Trace[], id: string, gain: number, rule: string) {
  const key = `${id}>${s.camp.player}`, [min, max] = t.rules.ranges.trust;
  change(s, trace, `trust/${key}`, Math.max(min, Math.min(max, (s.camp.trust[key] ?? 0) + gain)), rule);
}
function fact(s: CampSession, id: string, text: string, truth = true) {
  const f = { id, text, truth, visibility: 'public', type: truth ? 'arena' : 'rumour', actor: s.camp.player };
  s.camp.facts.push(f); s.dayEvents.push(f); s.camp.board.push({ factId: id, text });
  for (const c of Object.values(s.camp.characters)) c.knowledge.push(id);
}
export function receiveTrial(t: Tables, before: CampSession, p: SeasonProgress): CampSession {
  const trial = p.trial;
  if (!trial || trial.phase !== 'complete' || !trial.entrant || p.receipts.some(r => r.id === trial.id)) throw Error('Trial receipt is unavailable or already applied.');
  const s = passSlot(before), trace: Trace[] = [];
  social(t, s, trace, trial.rival, data.trial.respectTrust, 'season-bridge/trial/respectTrust');
  fact(s, `${trial.id}:result`, `${s.camp.characters[trial.entrant].name} carries the Tide into tomorrow's Tiro Games.`);
  p.receipts.push({ id: trial.id, day: trial.day, kind: 'trial', entrant: trial.entrant, hash: JSON.stringify(trial), trace });
  return s;
}
export function prepareBout(t: Tables, s: CampSession, p: SeasonProgress, composition: Composition): SeasonBout {
  if (seasonDue(t, s, p) !== 'games' || p.bout || validateComposition(composition).length) throw Error('The Games cannot open now.');
  const qualification = p.receipts.find(r => r.kind === 'trial' && r.day === s.camp.day - t.season.trialOffsetBeforeGames);
  if (!qualification) throw Error('The Tent Trial must settle before the Games.');
  const entrant = campPlayerSnapshot(t, s, qualification.entrant);
  const seed = Math.floor(seededUnit(s.camp.seed, s.camp.day, entrant.id, 'tiro-bout') * 0x100000000) >>> 0;
  return { id: `games:${s.camp.seed}:${s.camp.day}`, day: s.camp.day, seed, phase: 'prepared', entrant, spectator: entrant.id !== s.camp.player, composition: structuredClone(composition), games: null, log: [] };
}
export function startBout(bout: SeasonBout): void {
  if (bout.phase !== 'prepared' || bout.games) throw Error('The bout has already started.');
  bout.games = createGames(bout.seed, bout.composition, 0, false, bout.entrant);
  if (bout.spectator) attachMageAI(bout.games.player, data.trial.spectatorCompetence);
  bout.phase = 'active';
}
export function validInput(value: unknown): value is InputFrame {
  if (!value || typeof value !== 'object') return false;
  const f = value as InputFrame;
  const vec = (v: unknown, limit: number) => !!v && typeof v === 'object' && Object.keys(v).sort().join() === 'x,y' && Object.values(v).every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= limit);
  return Object.keys(f).sort().join() === 'absorb,aim,cast,move,roll,slot,sprint' && vec(f.move, 1) && vec(f.aim, 10000) && Number.isInteger(f.slot) && f.slot >= 0 && f.slot < 4 && ['cast', 'absorb', 'roll', 'sprint'].every(k => typeof f[k as keyof InputFrame] === 'boolean');
}
export function boutHash(b: SeasonBout): string { return b.games ? `${b.games.phase}:${b.games.wave}:${b.games.wavesCleared}:${stateHash(b.games.state)}` : 'prepared'; }
/** JSON transport stores actor IDs; restore the one player object before stepping. */
export function linkBout(b: SeasonBout): SeasonBout {
  if (b.games) {
    const player = b.games.state.actors.find(a => a.id === b.games!.player.id);
    if (!player || player.team !== 0) throw Error('Bout player reference is invalid.');
    b.games.player = player;
  }
  return b;
}
export function applyBoutInput(b: SeasonBout, entry: BoutInput): void {
  const g = b.games;
  if (!g || entry.tick !== g.state.tick || b.log.length >= data.limits.maxLogEntries || g.state.tick >= data.limits.maxBoutTicks) throw Error('Unordered or excessive bout input.');
  if (entry.type === 'advance') advanceGames(g);
  else if (entry.type === 'tick' && validInput(entry.input) && g.phase === 'active') stepGames(g, b.spectator ? undefined : entry.input);
  else throw Error('Invalid bout input or phase.');
  b.log.push(structuredClone(entry));
  b.phase = g.phase === 'lost' || g.phase === 'complete' ? 'terminal' : g.phase;
}
export function replayBout(source: SeasonBout): SeasonBout {
  const replay: SeasonBout = { ...structuredClone(source), games: null, log: [], phase: 'prepared' };
  if (source.phase === 'prepared') return replay;
  startBout(replay); for (const entry of source.log) applyBoutInput(replay, entry);
  return replay;
}
export function receiveBout(t: Tables, before: CampSession, p: SeasonProgress): CampSession {
  const bout = p.bout;
  if (!bout || bout.phase !== 'terminal' || p.receipts.some(r => r.id === bout.id)) throw Error('The bout is not ready for settlement.');
  const replay = replayBout(bout);
  if (boutHash(replay) !== boutHash(bout)) throw Error('Bout replay mismatch.');
  const result = gamesResult(replay.games!), s = passSlot(before), trace: Trace[] = [], player = s.camp.characters[s.camp.player];
  if (!bout.spectator) {
    for (const key of ['gold', 'renown'] as const) {
      const [min, max] = t.rules.ranges[key];
      change(s, trace, `characters/${player.id}/${key}`, Math.max(min, Math.min(max, player[key] + result[key])), `arena/arena-tiers/tiro/${key}`);
    }
    for (const c of Object.values(s.camp.characters).filter(c => c.role === 'main' && c.id !== player.id)) social(t, s, trace, c.id, result.finalWon ? data.aftermath.allyTrustOnFinal : data.aftermath.allyTrustOnMissio, 'season-bridge/aftermath');
    fact(s, `${bout.id}:rumour`, data.rumours[result.kind], false);
  }
  fact(s, `${bout.id}:result`, `${bout.entrant.name} returns from the Tiro Games ${result.finalWon ? 'with the victor’s wreath' : 'under missio'}. ${bout.spectator ? 'You watched from the benches.' : 'The camp remembers.'}`);
  p.receipts.push({ id: bout.id, day: bout.day, kind: 'games', entrant: bout.entrant.id, result, hash: boutHash(replay), trace }); p.bout = null;
  return s;
}
