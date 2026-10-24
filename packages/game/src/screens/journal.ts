import { picture, portrait, storyFor } from "../ui/artwork.ts";
import { colours } from "../ui/kit.ts";
import { friendly } from "./chrome.ts";
import castData from "../../../../docs/design/reconciled/data/characters.json" with { type: "json" };
import { columns, safeArea } from "../ui/anchors.ts";
import type { GameShell } from "../game-shell.ts";

export function cards(s: GameShell, kind: "board" | "journal") {
  s.campHeader(kind, kind === "board" ? "The Hollow Board" : "What you carry");
  const u = s.ui,
    v = s.view,
    st = s.nav.state(kind);
  const cards =
    kind === "board"
      ? v.board.map((b) => ({
          id: b.factId,
          text: b.text,
          rumour: b.rumour,
          visibility: "public",
        }))
      : v.journal;
  const page = cards.slice(st.page * 4, st.page * 4 + 4);
  u.text(
    kind === "board" ? "DEEDS, WHISPERS AND WITNESSES" : "PRIVATE KNOWINGS",
    96,
    307,
    24,
    colours.gold,
  );
  page.forEach((c, i) => {
    const index = st.page * 4 + i;
    u.button(
      `card-${index}`,
      c.text.length > 88 ? c.text.slice(0, 85) + "…" : c.text,
      96,
      354 + i * 125,
      766,
      112,
      () => {
        st.selected = index;
        s.cards(kind);
      },
      {
        selected: st.selected === index,
        fontSize: 28,
        kind: c.rumour ? "card.warning" : "card.normal",
        tooltip: c.rumour
          ? "A rumour is not a witnessed fact."
          : "Choose to read the full account.",
      },
    );
  });
  const card = cards[st.selected];
  u.panel(900, 307, 924, 554, "panel.story");
  const subject = castData.characters.find(
    (c) =>
      card?.text.includes(c.name) || card?.text.includes(c.name.split(" ")[0]!),
  );
  if (kind === "journal" && subject)
    portrait(u, subject.id, "neutral", 946, 410, 205, 256);
  else picture(u, `story.${storyFor(card?.text ?? "")}`, 946, 410, 270, 176);
  u.text(
    card?.rumour ? "A RUMOUR" : "A THREAD IN THE CAMP",
    950,
    355,
    26,
    card?.rumour ? colours.danger : colours.gold,
    750,
  );
  u.text(
    card?.text ??
      (kind === "board"
        ? "The board waits for the first morning. Tonight’s choices will leave their marks here."
        : "Some truths arrive softly. Listen at the tent flap, build trust, and keep what you learn."),
    1246,
    416,
    30,
    colours.text,
    526,
  );
  u.text(
    kind === "board"
      ? "Public words carry farther than their authors."
      : "Knowing opens a Parley when the right person is present.",
    940,
    752,
    28,
    colours.muted,
    830,
  );
  u.button(
    "cards-previous",
    "Previous",
    96,
    870,
    236,
    68,
    () => {
      st.page--;
      s.cards(kind);
    },
    { disabled: st.page === 0 },
  );
  u.button(
    "cards-next",
    "Next",
    352,
    870,
    236,
    68,
    () => {
      st.page++;
      s.cards(kind);
    },
    { disabled: (st.page + 1) * 4 >= cards.length },
  );
  u.text(
    `${st.page + 1} / ${Math.max(1, Math.ceil(cards.length / 4))}`,
    630,
    887,
    26,
    colours.muted,
  );
  if (kind === "journal")
    u.button("journal-cast", "People of the camp", 900, 870, 500, 68, () =>
      s.castJournal(),
    );
  s.back(() => s.camp(), "Camp map");
  s.footer(
    kind === "board"
      ? "A rumour remains a rumour. Choose a card to read it."
      : "Private knowledge stays with you across the season.",
  );
  u.end(`card-${st.selected}`);
}
export function castJournal(s: GameShell) {
  s.campHeader("cast", "Those beneath the collar");
  const u = s.ui,
    cast = castData.characters,
    st = s.nav.state("cast");
  u.text("FACES IN YOUR JOURNAL", 96, 300, 24, colours.gold);
  const quarters = columns(safeArea(), 4, 32);
  cast.slice(st.page * 8, st.page * 8 + 8).forEach((c, i) => {
    const { x, w } = quarters[i % 4]!,
      y = 354 + Math.floor(i / 4) * 238;
    u.button(`cast-${c.id}`, "", x, y, w, 214, () => s.castDetails(c.id), {
      kind: "card.normal",
      tooltip: c.name,
    });
    portrait(u, c.id, "neutral", x + 26, y + 29, 118, 148);
    u.text(c.name, x + 164, y + 39, 28, colours.text, 212);
    u.text(friendly(c.school), x + 164, y + 143, 24, colours.gold, 212);
  });
  u.button(
    "cast-previous",
    "Previous",
    96,
    846,
    236,
    68,
    () => {
      st.page--;
      s.castJournal();
    },
    { disabled: st.page === 0 },
  );
  u.button(
    "cast-next",
    "More people",
    352,
    846,
    280,
    68,
    () => {
      st.page++;
      s.castJournal();
    },
    { disabled: (st.page + 1) * 8 >= cast.length },
  );
  s.back(() => s.cards("journal"), "Journal");
  s.footer();
  u.end();
}
export function castDetails(s: GameShell, id: string) {
  const c = castData.characters.find((c) => c.id === id);
  if (!c) return;
  s.scene("cast-detail", c.name, "YOUR JOURNAL");
  portrait(s.ui, c.id, "neutral", 140, 268, 476, 596);
  s.ui.panel(720, 270, 1104, 594, "panel.story");
  s.ui.text(friendly(c.school), 774, 320, 40, colours.gold, 990, true);
  const known = s.view.journal.filter(
    (f) => f.text.includes(c.name) || f.text.includes(c.name.split(" ")[0]!),
  );
  const presence = s.view.presence.find((p) => p.id === id);
  s.ui.text(
    presence
      ? `Here with you at ${s.view.places.find((p) => p.id === s.view.location)?.name}.`
      : "Another life within the wards.",
    774,
    406,
    30,
    colours.muted,
    990,
  );
  s.ui.text(known[0]?.text ?? c.bio, 774, 499, 34, colours.text, 990);
  s.back(() => s.castJournal(), "People");
  s.footer();
  s.ui.end();
}
