import { gameAudio } from "../audio.ts";
import { seasonCommand, type SeasonView } from "../season-api.ts";
import { colours } from "../ui/kit.ts";
import { friendly } from "./chrome.ts";
import type { GameShell } from "../game-shell.ts";

/** The skill book as the season view carries it; absent on a season started without one. */
export type SkillsView = NonNullable<SeasonView["season"]["skills"]>;
export const perPage = 6;

/** The book's screen exists only for a season that carries a book (the PC flag); with none there is no route to it. */
export const hasBook = (view: Pick<SeasonView, "season">): boolean =>
  !!view.season.skills;
/** A spell row as the player reads it: `lash:1` is "Lash, tier 1", the water bolt `bolt:0` is just "Bolt". */
export function spellName(key: string): string {
  const [line, tier] = key.split(":");
  return tier && tier !== "0" ? `${friendly(line!)} ${tier}` : friendly(line!);
}
/** The buy button of one spell: what it is now, what it costs, and a top rank that cannot be bought. */
export function spellRow(row: SkillsView["spells"][number], points: number) {
  return {
    label: `${spellName(row.key)}  /  rank ${row.rank}`,
    subtitle:
      row.cost === null
        ? "Top rank"
        : `Rank ${row.rank + 1} for ${row.cost} points${row.cost > points ? "  /  not enough yet" : ""}`,
    disabled: row.cost === null,
  };
}
/** The lesson button of one elder: their signature, their trust in the player, and why not when they will not teach. */
export function teacherRow(row: SkillsView["teachers"][number], needed: number) {
  return {
    label: `${row.name}  /  ${spellName(row.signature)}`,
    trust: `Trust ${row.trust} of ${needed}`,
    subtitle: row.taught ? "Learned" : (row.problem ?? "Take the lesson"),
    disabled: row.taught,
  };
}
/** A refusal as the line the screen shows: the director's own words, never a thrown error. */
export const refusal = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

/** K opens the book from the camp screens, and only while the season carries one: with no book the key does nothing. */
export function installSkillsKey(s: GameShell, signal: AbortSignal) {
  window.addEventListener("keydown", (e) => {
    if (e.code !== "KeyK" || e.repeat || !hasBook(s.view) || s.busy || s.arena || s.typing) return;
    if (!["camp", "visit", "calendar", "board", "journal"].includes(s.ui.screen)) return;
    s.nav.open(s.ui.screen);
    s.nav.reset("skills");
    s.nav.go("skills");
  }, { signal });
}
export function skills(s: GameShell, message = "") {
  const k = s.view.season.skills;
  if (!k) return s.camp();
  const page = s.nav.state("skills").page, u = s.ui;
  s.scene("skills", "What your hands have learned", ["Castra Clausa", "Skill book"], `camp-${s.view.slot}`);
  u.text(`${k.points} skill points to spend  /  ${k.earned} earned`, 96, 210, 32, colours.gold, 1000);
  k.spells.slice(page * perPage, (page + 1) * perPage).forEach((row, i) => {
    const r = spellRow(row, k.points);
    u.button(`skill-${row.key}`, r.label, 96, 262 + i * 100, 820, 88, () => void act(s, { type: "buy-rank", key: row.key }), { subtitle: r.subtitle, disabled: r.disabled, icon: row.own ? "water" : "earth" });
  });
  const turn = (by: number) => () => {
    s.nav.state("skills").page = page + by;
    s.skills();
  };
  u.button("skills-previous", "Previous", 360, 946, 236, 68, turn(-1), { disabled: page === 0 });
  u.button("skills-next", "More spells", 620, 946, 236, 68, turn(1), { disabled: (page + 1) * perPage >= k.spells.length });
  u.text(message, 960, 880, 30, colours.water, 864);
  k.teachers.forEach((row, i) => {
    const r = teacherRow(row, k.trustNeeded);
    u.text(r.trust, 960, 262 + i * 150, 26, colours.muted, 864);
    u.button(`lesson-${row.id}`, r.label, 960, 300 + i * 150, 864, 100, () => void act(s, { type: "take-lesson", teacher: row.id }), { subtitle: r.subtitle, disabled: r.disabled });
  });
  s.back(() => s.camp(), "Camp map");
  s.footer();
  u.end();
}
/** Sends one book command through the season command path; the refusal comes back as the screen's own line. */
export async function act(s: GameShell, command: { type: "buy-rank"; key: string } | { type: "take-lesson"; teacher: string }) {
  await s.run(async () => {
    try {
      s.view = await seasonCommand(command);
      void gameAudio.play("ui.confirm");
      s.skills();
    } catch (e) {
      void gameAudio.play("ui.deny");
      s.skills(refusal(e));
    }
  });
}
