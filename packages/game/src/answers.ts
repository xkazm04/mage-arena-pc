import { summarizeLedger, type ThreatLedger } from "@mage/core/arena";

const late = (ticks?: number) => (ticks === undefined ? "" : ` +${ticks}f`);

/** Lab second metrics line: answers by family, then the ward age at every guarded magic contact (the lead histogram). */
export function labAnswerLine(l: ThreatLedger): string {
  const { magic: m, physical: p, unblockable: u, magicMedianLateTicks } = summarizeLedger(l);
  const ages = Object.entries(l.ages).map(([age, n]) => `${age}f:${n}`).join(" ") || "--";
  const odd = m.unclassified + p.unclassified + u.unclassified;
  return `Magic perfect ${m.perfect}  held ${m.held}${late(magicMedianLateTicks)}  cast ${m["cast-blocked"]}  behind ${m["wrong-facing"]}  took ${m.took}  left ${m.rolled + m.avoided}   Steel rolled ${p.rolled + p.avoided}  warded ${p.guarded + p["wrong-facing"] + p["cast-blocked"]}  took ${p.took}   Unblockable left ${u.rolled + u.avoided}  took ${u.took}   Ward age ${ages}${odd ? `   Unclassified ${odd}` : ""}`;
}

/** Tiro results card lines for the bout just fought. */
export function boutAnswerLines(l: ThreatLedger): string[] {
  const { magic: m, physical: p, unblockable: u, magicMedianLateTicks } = summarizeLedger(l);
  const odd = m.unclassified + p.unclassified + u.unclassified;
  const leave = l.entries.filter((e) => e.family === "unblockable" && e.mistake === "leave").length;
  return [
    m.total ? `Magic absorbed ${m.perfect + m.held}/${m.contacts}, perfect ${m.perfect}${magicMedianLateTicks === undefined ? "" : `, median held +${magicMedianLateTicks}f`}` : "Magic: none came",
    m["wrong-facing"] + m["cast-blocked"] + m.took ? `Missed: behind ${m["wrong-facing"]}, mid-cast ${m["cast-blocked"]}, open ${m.took}` : "",
    p.total ? `Steel rolled or stepped ${p.rolled + p.avoided}/${p.total}, warded ${p.guarded + p["wrong-facing"] + p["cast-blocked"]}` : "Steel: none came",
    u.total ? `Unblockable left ${u.rolled + u.avoided}/${u.total}${leave ? `, warded ${leave}` : ""}` : "Unblockable: none came",
    odd ? `Unclassified ${odd}` : "",
  ].filter(Boolean);
}
