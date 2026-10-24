import { enemyRoster } from "@mage/core/arena";
import { ArenaGame } from "../arena-entry.ts";
import { columns, safeArea } from "../ui/anchors.ts";
import type { GameShell } from "../game-shell.ts";

export function training(s: GameShell, page = 0) {
  s.scene(
    "training",
    "The proving ground",
    "PRACTICE  /  NO SEASON STAKES",
    "arena",
  );
  const u = s.ui;
  const entries = [
    {
      id: "magic",
      name: "Magic thrower",
      hint: "Face the light. Time the ward.",
    },
    {
      id: "physical",
      name: "Steel from the side",
      hint: "Steel cannot be absorbed. Roll clear.",
    },
    {
      id: "flanker",
      name: "Alternating flanks",
      hint: "Turn to meet the next spell.",
    },
    {
      id: "charge",
      name: "Unblockable lane",
      hint: "Leave the mark before it resolves.",
    },
    {
      id: "stream",
      name: "Three-bolt stream",
      hint: "Keep the ward up through a volley.",
    },
    {
      id: "tiro",
      name: "Tiro Games",
      hint: "Four bouts. The collar begins anew.",
    },
    ...enemyRoster.map((e) => ({
      id: `enemy:${e.id}`,
      name: e.name,
      hint: "Face this opponent in isolation.",
    })),
  ];
  const halves = columns(safeArea(), 2, 32);
  entries
    .slice(page * 6, page * 6 + 6)
    .forEach((e, i) =>
      u.button(
        `training-${e.id}`,
        e.name,
        halves[i % 2]!.x,
        269 + Math.floor(i / 2) * 186,
        halves[i % 2]!.w,
        156,
        () => s.compose(e.id),
        { subtitle: e.hint, icon: i % 2 ? "earth" : "water" },
      ),
    );
  u.button(
    "training-previous",
    "Previous",
    96,
    848,
    280,
    68,
    () => s.training(page - 1),
    { disabled: page === 0 },
  );
  u.button(
    "training-next",
    "More opponents",
    400,
    848,
    380,
    68,
    () => s.training(page + 1),
    { disabled: (page + 1) * 6 >= entries.length },
  );
  s.back(() => s.menu(), "Main menu");
  s.footer("Choose a lesson, compose your spells, and enter.");
  u.end();
}
export function openLab(s: GameShell) {
  s.arena?.dispose();
  s.arena = new ArenaGame(
    s.ui,
    () => void s.pause(),
    () => s.results(),
  );
  s.arena.startLab(() => s.compose("lab", s.arena!.lab!.config.composition));
  history.replaceState(null, "", `/lab${location.search}`);
}
