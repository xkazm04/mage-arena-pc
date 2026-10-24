import { gameAudio } from "../audio.ts";
import { backdrop } from "../ui/backdrop.ts";
import { portrait, sigil } from "../ui/artwork.ts";
import { colours } from "../ui/kit.ts";
import { columns, safeArea } from "../ui/anchors.ts";
import type { GameShell } from "../game-shell.ts";

export function menu(s: GameShell) {
  gameAudio.setScene("silent");
  gameAudio.pauseWorld(false);
  s.ui.begin("menu");
  backdrop(s.ui);
  s.ui.text("A COVENANT IN CHAINS", 112, 168, 26, colours.gold);
  s.ui.text("MAGE\nARENA", 96, 220, 112, colours.text, 860, true);
  s.ui.line(112, 501, 460, colours.gold);
  sigil(s.ui, "inscription.collar", 795, 392, 210, 0.8);
  s.ui.text(
    "Six weeks beneath the collar.\nWhat will you carry beyond the grille?",
    112,
    538,
    34,
    colours.muted,
    710,
  );
  portrait(s.ui, "cassia", "neutral", 1040, 200, 650, 680);
  s.ui.button(
    "pick-character",
    "Begin your story",
    112,
    667,
    570,
    84,
    () => s.pick(),
    { subtitle: "Choose your mage", icon: "water" },
  );
  s.ui.button(
    "continue-season",
    "Continue season",
    112,
    771,
    274,
    72,
    () => void s.run(() => s.continue()),
  );
  s.ui.button(
    "menu-load",
    "Load season",
    406,
    771,
    276,
    72,
    () => void s.openSaves("menu"),
  );
  s.ui.button(
    "training-arena",
    "The proving ground",
    112,
    863,
    570,
    72,
    () => s.training(),
    {
      tooltip: "Learn the ward, compose spells and challenge the Tiro Games.",
    },
  );
  s.ui.button("combat-feel-lab", "Combat Feel Lab", 1040, 863, 650, 72, () =>
    s.openLab(),
  );
  s.ui.button(
    "fullscreen",
    "Fullscreen",
    1574,
    946,
    250,
    68,
    () => void s.ui.fullscreen(),
  );
  s.ui.text("WATER  /  THE FIRST TWO WEEKS", 112, 976, 24, colours.muted);
  s.ui.onBack = () => {};
  s.ui.end("pick-character");
  history.replaceState(null, "", `/${location.search}`);
}
export function pick(s: GameShell) {
  s.scene("character", "The four bound together", "CHOOSE YOUR MAGE");
  const cards = columns(safeArea(), 4, 32);
  s.view.season.allies.forEach((ally, i) => {
    const { x, w } = cards[i]!;
    s.ui.panel(x, 248, w, 626);
    s.ui.icon(ally.school, x + 204, 315, 40);
    portrait(s.ui, ally.id, "neutral", x + 64, 366, 280, 280);
    s.ui.text(ally.name, x + 28, 652, 36, colours.text, 352, true);
    s.ui.text(ally.school.toUpperCase(), x + 28, 752, 26, colours.gold);
    s.ui.button(
      `choose-${ally.school}`,
      ally.school === "water" ? "Walk as Cassia" : "Camp ally",
      x + 24,
      786,
      360,
      68,
      () => void s.run(() => s.continue()),
      {
        disabled: ally.school !== "water",
        tooltip:
          ally.school === "water"
            ? "Water bends the battle. Time the ward and answer with a Crest."
            : "This school joins you in camp. Its arena chapter is still to come.",
      },
    );
  });
  s.back(() => s.menu());
  s.footer(
    "Water is playable. The other three share your camp, bonds and rivalries.",
  );
  s.ui.end("choose-water");
}
