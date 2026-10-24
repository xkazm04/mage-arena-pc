import { portrait } from "../ui/artwork.ts";
import { colours } from "../ui/kit.ts";
import type { GameShell } from "../game-shell.ts";

export function chapter(s: GameShell) {
  s.scene("chapter", "Two weeks survived", "THE FIRST CHAPTER");
  portrait(s.ui, "cassia", "calm", 1150, 262, 540, 610);
  s.ui.text(
    "The Tide has a place in the camp.\nYour board and journal remember the path here.",
    120,
    320,
    46,
    colours.text,
    1100,
  );
  s.ui.text(
    `${s.view.season.receipts.length} recorded Trials and Games\n${s.view.player.gold} gold  /  ${s.view.season.renown} renown`,
    120,
    511,
    36,
    colours.water,
    1100,
  );
  s.ui.button("chapter-board", "Read the Hollow Board", 120, 729, 650, 92, () =>
    s.cards("board"),
  );
  s.ui.button("chapter-journal", "Open your journal", 120, 841, 650, 92, () =>
    s.cards("journal"),
  );
  s.ui.button(
    "chapter-save",
    "Save / settings",
    1330,
    946,
    494,
    68,
    () => void s.pause(),
  );
  s.ui.onBack = () => void s.pause();
  s.ui.end();
}
