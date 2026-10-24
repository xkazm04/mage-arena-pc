// Counter coverage (D1 4.2 / section 6.4): for each shape-class answer row (Ring of Cinders: close pressure, Air Form:
// projectiles, Tide Ward: beams), the share of the blows it could answer that it did answer. Pure: no I/O, so
// report-counters.ts and counter-coverage.test.ts share one runner.
// The unit is the threat-answer ledger's (ledger.ts): every graded contact on the holder plus every aimed threat it avoided.
// A unit counts for a row when its shape class is one the row answers and it is blockable (no answer row meets an
// unblockable blow: Air Form does not evade them, Tide Ward eases a ward that cannot hold them, archetypes.ts skips them).
// - slotted: the holder carries the row in its loadout (a Water mage: the row's line is in its composition).
// - reachable ("could answer"): the row is castable by its collar tier at that tick. A Fire/Air row stays unlocked once its
//   tier opens; a Water line plays one row per tier, so Tide Ward (mend II) is reachable only while the holder sits at tier II.
// - answered: the row's effect was up at the blow (Air Form's evade window, Tide Ward's drain cut), or the holder released
//   the row between first seeing the blow and its contact (how Ring of Cinders, an instant blast, answers).
// The reader taps contacts and reads threats beside the state; it never writes, so every fight hashes as its census fight.
import { createGames, presets, runtime, seconds, spellFor, spells, stateHash, stepGames, threats, ticks, tapContacts, type Actor, type ArenaState, type ShapeClass, type WaterLine } from '../src/arena/index.ts';
import { createLedger, detachLedger, observeLedger, type ThreatLedger } from '../src/arena/ledger.ts';
import { answersShape, rivalBuilds } from '../src/arena/archetypes.ts';
import { canonicalSpells } from '../src/arena/schools.ts';

export interface DefensiveRow { id: string; name: string; school: 'water' | 'fire' | 'air'; tier: number; line?: WaterLine }
/** The shape-class answer rows, one per school: the Fire and Air rows whose plan role is `answer`, and Water's Tide Ward. */
export const defensiveRows: readonly DefensiveRow[] = [
  ...(['fire', 'air'] as const).flatMap(school => canonicalSpells[school].filter(s => answersShape(s)).map(s => ({ id: s.id, name: s.name, school, tier: s.tier }))),
  ...spells.filter(s => s.effect === 'ward').map(s => ({ id: s.id, name: s.name, school: 'water' as const, tier: s.tier, line: s.line as WaterLine })),
];
/** The classes a row answers in this state (Tide Ward: beams, the mage-ai.ts answer rule). */
export function rowClasses(row: DefensiveRow, _state: ArenaState): ShapeClass[] {
  if (row.school === 'water') return ['beam'];
  return [answersShape(canonicalSpells[row.school].find(s => s.id === row.id)!)!];
}
const holds = (a: Actor, row: DefensiveRow): boolean => row.school === 'water'
  ? !a.schoolState && a.water.composition.lines.includes(row.line!)
  : a.schoolState?.school === row.school && a.schoolState.loadout.slots.includes(row.id);
/** Castable by tier now: Fire/Air once the collar reaches the row's tier; Water while the line's slot plays this row. */
function reachable(state: ArenaState, a: Actor, row: DefensiveRow): boolean {
  if (row.school !== 'water') return a.tier >= row.tier;
  const slot = 1 + a.water.composition.lines.indexOf(row.line!);
  return spellFor(a, slot, state)?.id === row.id;
}
function effectUp(state: ArenaState, a: Actor, row: DefensiveRow): boolean {
  if (row.school === 'water') return state.tick < a.water.wardUntil;
  return row.school === 'air' && state.tick < (a.schoolState?.formUntil ?? 0);
}

export interface RowTally {
  /** Blockable blows of the row's classes the holder met, then those met while the row was castable, then those answered. */
  slotted: number; reachable: number; answered: number;
  /** Answered blows the ledger graded `avoided` (the answer kept the blow off) or that still went through (`took`). */
  answeredAvoided: number; answeredTook: number;
  /** Releases of the row, and fights in which a holder carried it. */
  casts: number; holderFights: number;
  /** The same three counts per shape class the row answers. */
  byClass: Partial<Record<ShapeClass, ClassTally>>;
}
export interface ClassTally { slotted: number; reachable: number; answered: number }
export const emptyTally = (): RowTally => ({ slotted: 0, reachable: 0, answered: 0, answeredAvoided: 0, answeredTook: 0, casts: 0, holderFights: 0, byClass: {} });
export function addTally(into: RowTally, from: RowTally): RowTally {
  for (const k of ['slotted', 'reachable', 'answered', 'answeredAvoided', 'answeredTook', 'casts', 'holderFights'] as const) into[k] += from[k];
  for (const [c, n] of Object.entries(from.byClass)) {
    const to = into.byClass[c as ShapeClass] ??= { slotted: 0, reachable: 0, answered: 0 };
    to.slotted += n!.slotted; to.reachable += n!.reachable; to.answered += n!.answered;
  }
  return into;
}

interface Watch { actor: Actor; row: DefensiveRow; ledger: ThreatLedger; facts: Map<string, { shape?: ShapeClass; reach: boolean; up: boolean }>; seen: Map<number, { shape?: ShapeClass; first: number }>; releases: number[] }
/** The shape class of a blow at contact: a live beam of its owner, else the class it was seen under, else its delivery. */
function contactShape(state: ArenaState, w: Watch, ownerId: number, activationId: number, delivery?: string): ShapeClass | undefined {
  if ((state.schoolEffects ?? []).some(e => e.kind === 'beam' && e.ownerId === ownerId)) return 'beam';
  return w.seen.get(activationId)?.shape ?? (delivery === 'projectile' ? 'projectile' : delivery === 'melee' ? 'close' : undefined);
}

/** Step a Games bout to its end with coverage watchers on every mage that holds an answer row. */
export function watchCoverage(g: ReturnType<typeof createGames>, maxSeconds: number): { tallies: Record<string, RowTally>; hash: string; outcome: string; durationS: number } {
  const watches: Watch[] = [];
  for (const actor of g.state.actors) if (actor.mageAI) for (const row of defensiveRows) if (holds(actor, row))
    watches.push({ actor, row, ledger: createLedger(g.state, actor.id), facts: new Map(), seen: new Map(), releases: [] });
  const untap = tapContacts(g.state, (s, target, hit) => {
    for (const w of watches) if (w.actor === target) w.facts.set(`${s.tick}:${hit.activationId}`, { shape: contactShape(s, w, hit.ownerId, hit.activationId, hit.delivery), reach: reachable(s, target, w.row), up: effectUp(s, target, w.row) });
  });
  const tallies: Record<string, RowTally> = {};
  const counted = new Map<Watch, number>();
  while (g.phase === 'active' && g.state.tick < ticks(maxSeconds)) {
    const eventsBefore = g.state.events.length; stepGames(g);
    for (const w of watches) {
      observeLedger(w.ledger, g.state);
      for (const e of g.state.events.slice(eventsBefore)) if (e.kind === 'release' && e.actorId === w.actor.id && e.spellId === w.row.id) w.releases.push(e.tick);
      for (const t of threats(g.state, w.actor)) if (!w.seen.has(t.id)) w.seen.set(t.id, { shape: t.shape, first: g.state.tick });
      const tally = tallies[w.row.id] ??= emptyTally(), classes = rowClasses(w.row, g.state);
      const from = counted.get(w) ?? 0;
      for (const entry of w.ledger.entries.slice(from)) {
        // The ledger follows a threat by its id; a beam or an unthrown volley orb is seen under a stand-in id (minus the owner)
        // that never meets a contact, so its `avoided` grade is not a blow. Its real blows are graded on contact.
        if (entry.answer === 'avoided' && entry.activationId < 0) continue;
        const fact = entry.answer === 'avoided'
          ? { shape: w.seen.get(entry.activationId)?.shape, reach: reachable(g.state, w.actor, w.row), up: effectUp(g.state, w.actor, w.row) }
          : w.facts.get(`${entry.tick}:${entry.activationId}`);
        if (!fact?.shape || !classes.includes(fact.shape) || entry.family === 'unblockable') continue;
        const byClass = tally.byClass[fact.shape] ??= { slotted: 0, reachable: 0, answered: 0 };
        tally.slotted++; byClass.slotted++;
        if (!fact.reach) continue;
        tally.reachable++; byClass.reachable++;
        const first = w.seen.get(entry.activationId)?.first ?? entry.tick;
        if (fact.up || w.releases.some(r => r >= first && r <= entry.tick)) {
          tally.answered++; byClass.answered++;
          if (entry.answer === 'avoided') tally.answeredAvoided++;
          if (entry.answer === 'took') tally.answeredTook++;
        }
      }
      counted.set(w, w.ledger.entries.length);
    }
  }
  untap();
  for (const w of watches) { detachLedger(w.ledger); const t = tallies[w.row.id] ??= emptyTally(); t.casts += w.releases.length; t.holderFights++; }
  return { tallies, hash: stateHash(g.state), outcome: g.phase === 'active' ? 'timeout' : g.phase === 'lost' ? 'loss' : 'win', durationS: seconds(g.state.tick - g.waveStartTick) };
}

/** A default-census fight (games.ts runFight: the reference preset, no build) with the coverage watchers. */
export function coverageDefaultFight(seed: number, wave: number, maxSeconds = runtime.games.fightTimeoutS) {
  const composition = presets.find(p => p.name === runtime.games.referencePreset)!;
  return { seed, ...watchCoverage(createGames(seed, composition, wave, true), maxSeconds) };
}
/** A builds-census fight (builds-census.ts runBuildFight) with the coverage watchers; `compositionName` swaps the reference preset. */
export function coverageBuildFight(seed: number, buildId: string, compositionName = runtime.games.referencePreset, maxSeconds = runtime.games.fightTimeoutS) {
  const build = rivalBuilds[buildId]; if (!build) throw Error(`Unknown build ${buildId}`);
  const composition = presets.find(p => p.name === compositionName)!;
  return { seed, ...watchCoverage(createGames(seed, composition, build.wave, true, undefined, undefined, undefined, { rivalBuild: buildId }), maxSeconds) };
}
export const coverage = (t: RowTally): number | null => t.reachable ? t.answered / t.reachable : null;
