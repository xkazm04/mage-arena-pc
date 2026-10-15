import { applyBoutInput, startBout, type SeasonBout } from './season.ts';
import { createLedger, detachLedger, observeLedger, type Games, type LedgerEntry } from './arena/index.ts';

/**
 * Reading a fought season bout back from its own input log. Every position is reached through startBout and
 * applyBoutInput, the path settlement replays, and nothing here writes to the source bout, its log or a receipt.
 * A position counts applied log entries: position p is the state after log[0..p).
 */
export interface BoutCheckpoint { position: number; phase: SeasonBout['phase']; games: Games }
export interface BoutWaveReading { wave: number; first: number; last: number; startTick: number; entries: LedgerEntry[] }
export interface BoutReading { source: SeasonBout; wave: BoutWaveReading; checkpoints: BoutCheckpoint[] }

/** A copy of the bout's Games after its current log, kept beside (never inside) the state. */
export function boutCheckpoint(b: SeasonBout): BoutCheckpoint {
  if (!b.games) throw Error('Only a started bout can be checkpointed.');
  return { position: b.log.length, phase: b.phase, games: structuredClone(b.games) };
}
/** Replay the source log up to `position`, from the start or from a checkpoint of the same log. */
export function replayBoutTo(source: SeasonBout, position: number, from?: BoutCheckpoint): SeasonBout {
  if (!Number.isInteger(position) || position < 0 || position > source.log.length || (from && from.position > position)) throw Error('That bout position is outside its log.');
  const replay: SeasonBout = structuredClone({ ...source, phase: 'prepared', games: null, log: [] });
  if (from) Object.assign(replay, { phase: from.phase, games: structuredClone(from.games), log: source.log.slice(0, from.position) });
  else startBout(replay);
  for (let i = replay.log.length; i < position; i++) applyBoutInput(replay, source.log[i]!);
  return replay;
}
/** Log positions of every wave: [first, last] where first follows the wave's advance and last precedes the next. */
export function boutWaves(source: SeasonBout): { first: number; last: number }[] {
  const waves = [{ first: 0, last: source.log.length }];
  source.log.forEach((e, i) => { if (e.type === 'advance') { waves.at(-1)!.last = i; waves.push({ first: i + 1, last: source.log.length }); } });
  return waves;
}
/**
 * Replay one wave (the last by default) with a fresh ledger on the player, as the live bout observed it, and keep a
 * checkpoint every `every` positions so a seek steps at most every - 1 entries. `tape` holds earlier checkpoints of
 * the same log (taken live); the nearest one at or before the wave start skips the waves before it.
 */
export function readBout(source: SeasonBout, every: number, tape: readonly BoutCheckpoint[] = [], wave = boutWaves(source).length - 1): BoutReading {
  const span = boutWaves(source)[wave];
  if (!span || source.phase === 'prepared' || !Number.isInteger(every) || every < 1) throw Error('That bout cannot be read.');
  const start = tape.filter(c => c.position <= span.first).sort((x, y) => y.position - x.position)[0];
  const replay = replayBoutTo(source, span.first, start), g = replay.games!;
  const ledger = createLedger(g.state, g.player.id), checkpoints = [boutCheckpoint(replay)], startTick = g.state.tick;
  for (let i = span.first; i < span.last; i++) {
    applyBoutInput(replay, source.log[i]!); observeLedger(ledger, g.state);
    if ((i + 1 - span.first) % every === 0) checkpoints.push(boutCheckpoint(replay));
  }
  detachLedger(ledger);
  return { source, wave: { wave, ...span, startTick, entries: ledger.entries }, checkpoints };
}
/** Inside one wave every log entry is a tick, so ticks and positions map one to one. */
export const positionOfTick = (w: BoutWaveReading, tick: number) => Math.max(w.first, Math.min(w.last, w.first + tick - w.startTick));
export const tickOfPosition = (w: BoutWaveReading, position: number) => w.startTick + position - w.first;
/** The bout at a position inside the read wave, replayed from the nearest checkpoint. */
export function seekBout(r: BoutReading, position: number): SeasonBout {
  const at = Math.max(r.wave.first, Math.min(r.wave.last, position));
  const from = r.checkpoints.filter(c => c.position <= at).sort((x, y) => y.position - x.position)[0];
  return replayBoutTo(r.source, at, from);
}
/** Practice Games cloned from a replayed position: it accepts new input and is never part of a season bout. */
export function takeOverBout(at: SeasonBout): Games {
  if (!at.games) throw Error('Nothing to take over.');
  const games = structuredClone(at.games);
  if (at.spectator) delete games.player.mageAI;
  return games;
}
