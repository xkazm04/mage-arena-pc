/** Camp trust 'other>player' runs over [-100, 100] (rules.json ranges.trust); the bands below are owner-confirmed 2026-10-27 (ruling 2: 15/40). */

/** Inside (-15, 15) a face shows nothing in particular. Skill-book teaching.trustAtLeast is 20, so a teacher who will teach is already past this edge and reads calm. */
export const MOOD_NEUTRAL_EDGE = 15;
/** At 40 of 100 (twice teaching.trustAtLeast 20) the face is proud; at -40 it is angry. */
export const MOOD_STRONG_EDGE = 40;

export type TrustMood = "neutral" | "calm" | "proud" | "scheming" | "angry";

/** The accepted painting for how far a character trusts the player; no trust in the view is neutral. Values beyond the range count as the range edge. */
export function moodForTrust(trust: number | undefined): TrustMood {
  if (trust === undefined || Number.isNaN(trust)) return "neutral";
  if (trust >= MOOD_STRONG_EDGE) return "proud";
  if (trust >= MOOD_NEUTRAL_EDGE) return "calm";
  if (trust <= -MOOD_STRONG_EDGE) return "angry";
  if (trust <= -MOOD_NEUTRAL_EDGE) return "scheming";
  return "neutral";
}
