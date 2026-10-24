import type { ParleyInput } from "@mage/director";
import { request, type SeasonView } from "../season-api.ts";
import { portrait } from "../ui/artwork.ts";
import { colours } from "../ui/kit.ts";
import type { GameShell } from "../game-shell.ts";

export type Moment = SeasonView["parley"]["moments"][number];
export function parley(s: GameShell, moment: Moment) {
  s.currentMoment = moment;
  const u = s.ui;
  s.scene(
    "parley",
    `Speak with ${moment.name}`,
    `A KNOWING MOMENT  /  ${s.view.hour}:00  /  ${s.view.hoursRemaining} HOURS REMAIN`,
    `place-${s.view.location}`,
  );
  u.panel(96, 226, 790, 658);
  portrait(u, moment.target, "neutral", 136, 252, 140, 175);
  u.text("WHAT YOU KNOW", 308, 255, 26, colours.gold);
  u.text(moment.cards[0]!.knowing, 308, 300, 28, colours.text, 526);
  moment.cards.forEach((card, i) =>
    u.button(
      `parley-card-${i}`,
      card.title,
      128,
      435 + i * 145,
      726,
      132,
      () => void s.speak({ target: moment.target, cardId: card.id }),
      {
        subtitle: card.text,
        fontSize: 30,
        selected: i === s.parleyApproach,
      },
    ),
  );
  u.panel(920, 226, 904, 658);
  u.text("SPEAK IN YOUR OWN WORDS", 956, 257, 26, colours.gold);
  u.button(
    "parley-approach",
    `Approach: ${moment.cards[s.parleyApproach]!.title}`,
    952,
    310,
    832,
    76,
    () => {
      s.parleyApproach = (s.parleyApproach + 1) % moment.cards.length;
      s.parley(moment);
    },
    {
      tooltip:
        "Your selected approach carries the conversation if a reply cannot reach you.",
    },
  );
  u.button(
    "parley-text",
    "",
    952,
    412,
    832,
    252,
    () => {
      if (s.ui.modality === "gamepad") {
        s.letterBoard();
        return;
      }
      s.typing = true;
      s.ui.focus = "parley-text";
      s.textDisplay!.text = s.parleyText || "Type your words…";
    },
    { tooltip: "Enter to write. Escape ends text entry." },
  );
  s.textDisplay = u.text(
    s.parleyText || "Choose here to write your appeal…",
    992,
    446,
    32,
    colours.text,
    752,
  );
  u.text(
    `Speaking takes ${s.view.parleyHours} hours. Your approach carries the reply\nwhen words cannot reach the camp.`,
    956,
    693,
    28,
    colours.muted,
    822,
  );
  u.button(
    "parley-speak",
    "Speak",
    952,
    790,
    400,
    68,
    () => {
      if (!s.parleyText.trim()) {
        s.typing = true;
        u.focus = "parley-text";
        return;
      }
      void s.speak({
        target: moment.target,
        cardId: moment.cards[s.parleyApproach]!.id,
        text: s.parleyText,
      });
    },
    { icon: "water" },
  );
  u.button(
    "parley-keyboard",
    "Letter board",
    1376,
    790,
    408,
    68,
    () => s.letterBoard(),
    { tooltip: "Compose words with the controller or arrow keys." },
  );
  s.back(() => {
    s.typing = false;
    s.visit();
  });
  s.footer("Once each day, a Knowing gives your words weight.");
  u.onKey = (e) => {
    if (!s.typing) return false;
    if (e.code === "Escape" || e.code === "Tab") {
      s.typing = false;
      return true;
    }
    if (e.code === "Backspace")
      s.parleyText = Array.from(s.parleyText).slice(0, -1).join("");
    else if (
      e.key.length === 1 &&
      Array.from(s.parleyText).length < s.view.parley.maxTextChars
    )
      s.parleyText += e.key;
    else if (e.code === "Enter") s.typing = false;
    else return true;
    s.textDisplay!.text = s.parleyText || "Type your words…";
    return true;
  };
  u.end();
}
export function letterBoard(s: GameShell) {
  const u = s.ui;
  s.typing = false;
  s.scene("keyboard", "Choose your words", "PARLEY  /  LETTER BOARD");
  u.panel(96, 221, 1728, 160);
  s.textDisplay = u.text(
    s.parleyText || "Your words begin here.",
    128,
    253,
    34,
    colours.text,
    1650,
  );
  const rows = ["ABCDEFGHIJ", "KLMNOPQRST", "UVWXYZ.,?!"];
  rows.forEach((row, i) =>
    [...row].forEach((ch, j) =>
      u.button(
        `letter-${ch}`,
        ch,
        110 + j * 172,
        432 + i * 104,
        152,
        84,
        () => {
          if (Array.from(s.parleyText).length < s.view.parley.maxTextChars)
            s.parleyText += ch.toLowerCase();
          s.textDisplay!.text = s.parleyText;
        },
        { fontSize: 36 },
      ),
    ),
  );
  u.button("letter-space", "Space", 110, 764, 500, 80, () => {
    if (Array.from(s.parleyText).length < s.view.parley.maxTextChars)
      s.parleyText += " ";
    s.textDisplay!.text = s.parleyText;
  });
  u.button("letter-delete", "Delete", 636, 764, 500, 80, () => {
    s.parleyText = Array.from(s.parleyText).slice(0, -1).join("");
    s.textDisplay!.text = s.parleyText;
  });
  u.button("letter-done", "Done", 1162, 764, 500, 80, () =>
    s.parley(s.currentMoment!),
  );
  s.back(() => s.parley(s.currentMoment!));
  s.footer();
  u.end("letter-A");
}
export async function speak(s: GameShell, input: ParleyInput) {
  s.typing = false;
  await s.run(async () => {
    s.ui.notice("They weigh your words. The lantern burns between you.");
    s.view = await request<SeasonView>("parley", {
      input,
      revision: s.view.revision,
    });
    const r = s.view.parley.last!;
    s.scene(
      "parley-result",
      `${r.name} answers`,
      "A MOMENT BETWEEN YOU",
      `place-${s.view.location}`,
    );
    s.ui.panel(300, 276, 1320, 574, "panel.story");
    portrait(
      s.ui,
      input.target,
      r.trustDelta > 0 ? "calm" : r.trustDelta < 0 ? "angry" : "neutral",
      354,
      328,
      240,
      300,
    );
    s.ui.text(`“${r.reply}”`, 640, 335, 40, colours.text, 900);
    s.ui.text(
      r.trustDelta
        ? `${r.trustDelta > 0 ? "+" : ""}${r.trustDelta} trust toward you.`
        : r.revealed
          ? `A new Knowing: ${r.revealed}`
          : r.effect === "flip_next_intent"
            ? "They will attempt a friendly act toward you tonight."
            : "They keep their own counsel.",
      366,
      632,
      32,
      colours.water,
      1180,
    );
    s.ui.text(
      "The moment has passed. The camp remembers.",
      366,
      755,
      30,
      colours.muted,
      1180,
    );
    s.back(() => s.camp(), "Return to camp");
    s.footer();
    s.ui.end("back");
  });
}
