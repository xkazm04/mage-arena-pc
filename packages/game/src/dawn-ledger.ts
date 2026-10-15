import type { SeasonView } from "./season-api.ts";

type Change = SeasonView["changes"][number];
export interface LedgerRow {
  text: string;
  tone: "gain" | "loss" | "plain";
}

const causes: Record<string, string> = {
  BEFRIEND: "befriended",
  CONFIDE: "a confidence",
  PROTECT: "protection",
  WORK: "work",
  REST: "rest",
  TRAIN: "training",
  WATCH: "watched",
  SCHEME: "a scheme",
  REPORT: "a report to the Vigil",
  RECRUIT: "recruited",
  DEFECT: "changed tents",
  PLOT: "the bond",
  OFFER: "an offer",
  daily: "the day's toll",
  sameTentTrust: "tent life",
  caught: "caught by the Vigil",
  rankThresholds: "practice paid off",
  bondFractureTrust: "a fractured bond",
  takenInTrust: "taken in",
  newMemberLoyalty: "a new tent",
  desperateHunger: "desperate hunger",
};
/** "rules/effects/daily/sameTentTrust" -> "tent life": the most specific segment the camp has words for. */
export function causeOf(rule: string) {
  const parts = rule.split("/");
  if (parts[1] === "schemes")
    return parts[3] === "reactions" ? "a rumour" : `a ${parts[2]} scheme`;
  for (const part of parts.slice(2).reverse())
    if (causes[part]) return causes[part];
  return "";
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const capital = (s: string) => s.replace(/^./, (c) => c.toUpperCase());
const order = ["gold", "hunger", "fatigue", "renown", "loyalty", "points", "stats", "stocks", "sick", "tent"];
// Rising hunger and fatigue are losses; every other number is a gain when it rises.
const costly = new Set(["hunger", "fatigue"]);

function playerRow(field: string, sub: string | undefined, c: Change): LedgerRow | null {
  const cause = causeOf(c.rule);
  const tail = cause ? ` · ${cause}` : "";
  if (field === "stocks")
    return c.after
      ? { text: `The Vigil put you in the stocks${tail}`, tone: "loss" }
      : { text: "Released from the stocks", tone: "gain" };
  if (field === "sick")
    return c.after
      ? { text: `You fell sick${tail}`, tone: "loss" }
      : { text: "You recovered", tone: "gain" };
  if (field === "tent")
    return {
      text: `You now live in the ${capital(String(c.after))} tent${tail}`,
      tone: "plain",
    };
  if (typeof c.before !== "number" || typeof c.after !== "number") return null;
  const delta = c.after - c.before;
  const label =
    field === "points"
      ? `${capital(sub ?? "")} practice`
      : field === "stats"
        ? `${capital(sub ?? "")} rank`
        : field === "renown"
          ? "Reputation"
          : field === "loyalty"
            ? "Loyalty to your tent"
            : capital(field);
  return {
    text: `${label} ${signed(delta)} (now ${c.after})${tail}`,
    tone: (delta > 0) !== costly.has(field) ? "gain" : "loss",
  };
}

/** The night's changes in the camp's words: the player first, then bonds by how far they moved. */
export function dawnLedger(
  changes: readonly Change[],
  player: string,
  nameOf: (id: string) => string,
  limit = 8,
) {
  const own: { rank: number; row: LedgerRow }[] = [];
  const bonds = new Map<string, { toYou?: Change; fromYou?: Change }>();
  for (const c of changes) {
    const [kind, a, b, c2] = c.path.split("/");
    if (kind === "characters" && a === player) {
      if (!b || !order.includes(b)) continue;
      const row = playerRow(b, c2, c);
      if (row) own.push({ rank: order.indexOf(b), row });
    } else if (kind === "trust" && a) {
      const [from, to] = a.split(">");
      if (to === player && from) bonds.set(from, { ...bonds.get(from), toYou: c });
      else if (from === player && to)
        bonds.set(to, { ...bonds.get(to), fromYou: c });
    }
  }
  const moved = (c?: Change) =>
    c && typeof c.after === "number" && typeof c.before === "number"
      ? c.after - c.before
      : 0;
  const bondRows: { size: number; row: LedgerRow }[] = [];
  for (const [id, { toYou, fromYou }] of bonds) {
    const name = nameOf(id);
    const row = (c: Change, label: string) => {
      const delta = moved(c),
        cause = causeOf(c.rule);
      return {
        size: Math.abs(delta),
        row: {
          text: `${label} ${signed(delta)} (now ${String(c.after)})${cause ? ` · ${cause}` : ""}`,
          tone: delta > 0 ? "gain" : "loss",
        } as LedgerRow,
      };
    };
    if (
      toYou &&
      fromYou &&
      toYou.before === fromYou.before &&
      toYou.after === fromYou.after
    )
      bondRows.push(row(toYou, `${name} and you: trust`));
    else {
      if (toYou) bondRows.push(row(toYou, `${name}'s trust in you`));
      if (fromYou) bondRows.push(row(fromYou, `Your trust in ${name}`));
    }
  }
  const rows = [
    ...own.sort((x, y) => x.rank - y.rank).map((x) => x.row),
    ...bondRows.sort((x, y) => y.size - x.size).map((x) => x.row),
  ];
  return { rows: rows.slice(0, limit), more: Math.max(0, rows.length - limit) };
}
