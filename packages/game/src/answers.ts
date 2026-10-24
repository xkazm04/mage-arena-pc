import { summarizeLedger, type Grade, type ThreatLedger } from "@mage/core/arena";

const late = (ticks?: number) => (ticks === undefined ? "" : ` +${ticks}f`);

/** Lab second metrics line: answers by family (window: a blow an exchange window guarded; an Air Form evade counts as left),
 * then the ward age at every guarded magic contact (the lead histogram). */
export function labAnswerLine(l: ThreatLedger): string {
  const { magic: m, physical: p, unblockable: u, magicMedianLateTicks } = summarizeLedger(l);
  const ages = Object.entries(l.ages).map(([age, n]) => `${age}f:${n}`).join(" ") || "--";
  const odd = m.unclassified + p.unclassified + u.unclassified;
  return `Magic perfect ${m.perfect}  held ${m.held}${late(magicMedianLateTicks)}  window ${m.window}  cast ${m["cast-blocked"]}  behind ${m["wrong-facing"]}  took ${m.took}  left ${m.rolled + m.avoided + m.evaded}   Steel rolled ${p.rolled + p.avoided + p.evaded}  warded ${p.guarded + p["wrong-facing"] + p["cast-blocked"]}  window ${p.window}  took ${p.took}   Unblockable left ${u.rolled + u.avoided}  took ${u.took}   Ward age ${ages}${odd ? `   Unclassified ${odd}` : ""}`;
}

/** Tiro results card lines for the bout just fought. */
export function boutAnswerLines(l: ThreatLedger): string[] {
  const { magic: m, physical: p, unblockable: u, magicMedianLateTicks } = summarizeLedger(l);
  const odd = m.unclassified + p.unclassified + u.unclassified;
  const leave = l.entries.filter((e) => e.family === "unblockable" && e.mistake === "leave").length;
  return [
    m.total ? `Magic absorbed ${m.perfect + m.held + m.window}/${m.contacts}, perfect ${m.perfect}${m.window ? `, window ${m.window}` : ""}${m.evaded ? `, evaded ${m.evaded}` : ""}${magicMedianLateTicks === undefined ? "" : `, median held +${magicMedianLateTicks}f`}` : "Magic: none came",
    m["wrong-facing"] + m["cast-blocked"] + m.took ? `Missed: behind ${m["wrong-facing"]}, mid-cast ${m["cast-blocked"]}, open ${m.took}` : "",
    p.total ? `Steel rolled or stepped ${p.rolled + p.avoided + p.evaded}/${p.total}, warded ${p.guarded + p["wrong-facing"] + p["cast-blocked"]}${p.window ? `, window ${p.window}` : ""}` : "Steel: none came",
    u.total ? `Unblockable left ${u.rolled + u.avoided}/${u.total}${leave ? `, warded ${leave}` : ""}` : "Unblockable: none came",
    odd ? `Unclassified ${odd}` : "",
  ].filter(Boolean);
}

/** One timeline mark: the answer as the results card words it, and whether it was a miss (held late, behind, steel, leave, took,
 * mid-cast). A window guard, an evade and a hold that could not be perfect (no lateTicks) are clean. */
export function answerMark(g: Grade): { label: string; family: string; miss: boolean } {
  const family = g.family === "physical" ? "Steel" : g.family === "magic" ? "Magic" : "Unblockable";
  const good: Record<string, string> = { perfect: "PERFECT", rolled: "ROLLED", encased: "ENCASED", avoided: "LEFT", window: "WINDOW", evaded: "EVADED", unclassified: "UNCLASSIFIED" };
  if (good[g.answer]) return { label: good[g.answer]!, family, miss: false };
  if (g.answer === "held" && g.lateTicks === undefined) return { label: "HELD", family, miss: false };
  const label = g.answer === "held" ? `HELD +${g.lateTicks ?? 0}f`
    : g.answer === "cast-blocked" ? "MID-CAST"
      : g.mistake === "steel" ? "STEEL" : g.mistake === "leave" ? "LEAVE" : g.mistake === "behind" ? "BEHIND" : "TOOK";
  return { label, family, miss: true };
}
