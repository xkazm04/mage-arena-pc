import {
  committedBody,
  contactVerdict,
  families,
  gradeContact,
  spells,
  threats,
  type Actor,
  type Answer,
  type ArenaState,
  type Family,
  type Hit,
  type Mistake,
  type Threat,
} from "@mage/core/arena";
import { hexColour, wardWord, wordAllowed, type Word } from "./combat-readout.ts";
import policy from "../data/combat-feedback.json" with { type: "json" };

// Answer cues: the ward word before the contact. For each threat that will reach the player, the facts the kernel will
// read at impact are predicted from the state on screen (its own contactVerdict, with the ward age carried to the impact
// tick) and graded by the ledger's own gradeContact, so the cue and the word after the hit cannot drift apart. Pure:
// reads the state, writes nothing, draws nothing.

export interface AnswerCue {
  activationId: number;
  family: Family;
  impactTick: number;
  /** The grade the contact gets if the player changes nothing. */
  answer: Answer;
  mistake?: Mistake;
  /** Ward down against a magic threat in the arc: wait for the perfect window, then raise. */
  phase?: "wait" | "raise";
  raiseInTicks?: number;
  /** Only the first cue carries a word: the mistake's ward word, or RAISE once the window is open. */
  word?: Word;
}

/** Cues follow the mode's session kind (arena-session.ts); the season is the owner's call and stays off by default. */
export const cuesEnabled = (kind: string): boolean =>
  policy.answerCues.enabled && policy.answerCues.modes.includes(kind);

// The threats the ledger tracks: a pending zone that is not a root and a self or passive cast carry no blow (ledger.ts hitBearing).
const hitBearing = (state: ArenaState, id: number): boolean => {
  const p = state.actors.find((a) => a.pending?.activationId === id)?.pending;
  if (!p || p.kind !== "spell") return true;
  const s = p.spell ?? spells.find((s) => s.id === p.spellId);
  return !s || s.kind === "projectile" || s.kind === "cone" || s.kind === "ring" || s.kind === "wave" || (s.kind === "zone" && s.effect === "root");
};
/** The owner of an activation: its telegraph, projectile, school effect or the windup that carries it. */
const ownerOf = (state: ArenaState, id: number): Actor | undefined => {
  const ownerId = state.telegraphs.find((x) => x.activationId === id)?.ownerId ?? state.projectiles.find((x) => x.activationId === id)?.ownerId
    ?? state.schoolEffects?.find((x) => x.activationId === id)?.ownerId ?? state.actors.find((a) => a.pending?.activationId === id)?.id;
  return state.actors.find((a) => a.id === ownerId);
};
/** Where the blow comes from as resolveHit reads it: an area from its centre, a resolving telegraph from its source, a body
 * on its committed line and a projectile from where it is (it lands from there) from the threat's origin. */
function source(state: ArenaState, t: Threat) {
  const tell = state.telegraphs.find((x) => x.activationId === t.id);
  return !tell || committedBody(tell) ? t.origin : tell.kind === "area" ? tell.target : tell.source;
}
const raise = (): Word => ({ text: policy.answerCues.raise.text, fill: hexColour(policy.answerCues.raise.fill) });

function cueFor(state: ArenaState, player: Actor, t: Threat): AnswerCue {
  const family = t.family as Family;
  const owner = ownerOf(state, t.id);
  const hit: Hit = { ownerId: owner?.id ?? -1, activationId: t.id, damage: t.damage, family, tier: 0, source: source(state, t) };
  const v = contactVerdict(state, player, owner, hit), lead = t.impactTick - state.tick;
  const absorbHeld = player.lastInput.absorb;
  // Air Form's evade is a draw at contact that no reader may take ahead of the kernel: the cue stands down.
  const formed = player.schoolState?.school === "air" && player.schoolState.formUntil > t.impactTick && family !== "unblockable";
  const grade = gradeContact({
    family, ...(formed ? { evaded: true } : {}), ...(v.guard ? { guard: v.guard } : {}),
    wardUp: player.absorb, inArc: v.inArc, ageTicks: v.ageTicks + lead, windowTicks: v.windowTicks,
    absorbHeld, castBlocked: absorbHeld && !player.absorb && !!player.pending,
  });
  const word = wardWord(grade);
  const cue: AnswerCue = { activationId: t.id, family, impactTick: t.impactTick, answer: grade.answer, ...(grade.mistake ? { mistake: grade.mistake } : {}), ...(word ? { word } : {}) };
  if (grade.answer === "took" && !grade.mistake && family === "magic" && v.inArc) {
    const raiseInTicks = lead - v.windowTicks;
    Object.assign(cue, raiseInTicks > 0 ? { phase: "wait", raiseInTicks } : { phase: "raise", word: raise() });
  }
  return cue;
}

/** One cue per threat aimed at the player that the kernel will grade, in the order the contacts land. */
export function answerCues(state: ArenaState, player: Actor): AnswerCue[] {
  if (player.tags.includes("DEFEATED")) return [];
  const cues = threats(state, player)
    .filter((t) => t.aimedAtUs && t.impactTick >= state.tick && families.includes(t.family as Family) && hitBearing(state, t.id))
    .map((t) => cueFor(state, player, t))
    .sort((a, b) => a.impactTick - b.impactTick || a.activationId - b.activationId);
  for (const c of cues.slice(1)) delete c.word;
  return cues;
}

/** The activations the scene draws at full strength; the other telegraphs dim. */
export const emphasis = (cues: readonly AnswerCue[]): Set<number> => new Set(cues.map((c) => c.activationId));

/** One cue word at a time: a word keeps showing while its cue holds, and a new one waits wardWords.minGapS after the last. */
export class CueWords {
  private key = "";
  private lastS = -1e9;
  pick(cues: readonly AnswerCue[], nowS: number): Word | undefined {
    const c = cues[0];
    if (!c?.word) {
      this.key = "";
      return;
    }
    const key = `${c.activationId}:${c.word.text}`;
    if (key === this.key) return c.word;
    if (!wordAllowed(this.lastS, nowS)) return;
    this.key = key;
    this.lastS = nowS;
    return c.word;
  }
  reset() {
    this.key = "";
    this.lastS = -1e9;
  }
}
