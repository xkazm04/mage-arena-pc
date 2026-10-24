import { boutAnswerLines } from "../answers.ts";
import { colours } from "../ui/kit.ts";
import type { GameShell } from "../game-shell.ts";

export function results(s: GameShell) {
  const a = s.arena!,
    g = a.games,
    u = s.ui,
    intermission = g?.phase === "intermission";
  u.begin("results");
  u.panel(1080, 270, 750, 650, "panel.modal");
  u.text(
    intermission
      ? "THE NEXT GATE WAITS"
      : g?.result?.finalWon
        ? "THE TIRO GAMES ARE YOURS"
        : "THE CROWD GRANTS YOUR LIFE",
    1130,
    290,
    26,
    colours.gold,
    650,
  );
  u.text(
    intermission ? "Bout won" : g?.result?.finalWon ? "Tiro victor" : "Missio",
    1130,
    353,
    60,
    colours.text,
    650,
    true,
  );
  u.icon("water", 1710, 399, 52);
  if (a.ledger) {
    u.panel(250, 270, 790, 350);
    u.text("HOW YOU ANSWERED", 290, 290, 26, colours.gold, 710);
    boutAnswerLines(a.ledger).forEach((line, i) =>
      u.text(line, 290, 350 + i * 52, 26, colours.text, 710),
    );
    if (a.season)
      u.button(
        "read-bout",
        "Read the bout",
        250,
        650,
        790,
        76,
        () => s.readBout(),
        {
          tooltip:
            "Replay this bout from your own inputs, seek to any threat, and take over as practice.",
        },
      );
  }
  u.text(
    intermission
      ? "Recover, then take your place beyond the next grille."
      : g?.result
        ? `${g.result.wavesCleared} bouts won  /  ${g.result.gold} gold  /  ${g.result.renown} renown`
        : "The ward yields. Take what you learned back to the proving ground.",
    1130,
    482,
    30,
    colours.text,
    650,
  );
  u.text(
    a.season?.bout.spectator
      ? "You watched your tent entrant. No player payout."
      : intermission
        ? "The next bout resets mana, stamina and the collar."
        : "Your life is spared. The camp will hear of this.",
    1130,
    590,
    30,
    colours.muted,
    650,
  );
  u.button(
    intermission ? "next-bout" : a.season ? "return-camp" : "return-training",
    intermission
      ? "Enter the next bout"
      : a.season
        ? "Return to camp"
        : "Return to practice",
    1130,
    710,
    650,
    76,
    () =>
      void s.run(async () => {
        if (intermission) await a.next();
        else if (a.season) {
          await a.flush();
          await a.season.finish();
        } else {
          a.dispose();
          s.arena = undefined;
          s.training();
        }
      }),
  );
  u.button(
    "result-settings",
    "Save / settings",
    1130,
    812,
    650,
    76,
    () => void s.pause(),
  );
  u.onBack = () => void s.pause();
  u.end();
}
export function readBout(s: GameShell) {
  const a = s.arena;
  if (!a) return;
  try {
    a.openReader().draw(s.ui, {
      back: () => s.results(),
      takeOver: () => a.takeOver(),
    });
  } catch (e) {
    s.ui.notice(e instanceof Error ? e.message : String(e));
  }
}
