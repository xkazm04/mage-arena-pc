import { maxEnemyLevel } from "@mage/core/arena";
import { colours } from "../ui/kit.ts";
import type { GameShell } from "../game-shell.ts";

/** The season's rhythm, as `tables.season` carries it: seven days a week, Games on the seventh, the Trial the eve before. */
const GAMES_DAY = 7;

export function calendar(s: GameShell) {
  s.campHeader("calendar", "One season. Six Games.");
  const u = s.ui,
    v = s.view;
  u.panel(96, 307, 1220, 554);
  u.text("THE ROAD THROUGH THE COLLAR", 132, 336, 26, colours.gold);
  for (let week = 0; week < 6; week++) {
    const y = 392 + week * 70;
    const state = week + 1 < v.day.week ? "PAST" : week + 1 === v.day.week ? "NOW" : "AHEAD";
    u.text(`WEEK ${week + 1}`, 132, y + 8, 26, state === "NOW" ? colours.gold : colours.muted);
    u.text(
      `LEVEL ${Math.min(maxEnemyLevel, week + 1)} · ${state}`,
      132,
      y + 38,
      18,
      state === "AHEAD" ? colours.text : colours.muted,
    );
    for (let day = 0; day < 7; day++) {
      const date = week * 7 + day + 1,
        x = 315 + day * 132;
      u.panel(x, y, 112, 64, date === v.day.day ? "button-focus" : "button");
      u.text(
        String(date).padStart(2, "0"),
        x + 16,
        y + 10,
        28,
        date % 7 === 0
          ? colours.gold
          : date < v.day.day
            ? colours.muted
            : colours.text,
      );
      if (date === v.day.day) u.text("TODAY", x + 56, y + 14, 16, colours.gold);
      if (date % GAMES_DAY === 0) u.text("GAMES", x + 16, y + 42, 16, colours.water);
      else if (date % GAMES_DAY === GAMES_DAY - 1) u.text("TRIAL", x + 16, y + 42, 16, colours.earth);
      if (date % 7 === 0) u.icon("water", x + 85, y + 29, 14);
      else if (date % 7 === 6) u.icon("earth", x + 85, y + 29, 14);
    }
  }
  u.panel(1350, 307, 474, 554);
  u.text("THE NEXT SUMMONS", 1382, 347, 26, colours.gold);
  u.text(
    `Tent Trial · ${v.day.trialHour}:00`,
    1382,
    406,
    40,
    colours.text,
    400,
    true,
  );
  u.text(
    "On the eve of the Games, earn the right to carry your tent into the arena.",
    1382,
    470,
    32,
    colours.muted,
    405,
  );
  u.text(
    `Games at ${String(v.day.gamesHour).padStart(2, "0")}:00 · days 7 / 14`,
    1382,
    644,
    30,
    colours.water,
    405,
  );
  u.text(
    "Later weeks await the next chapter.",
    1382,
    716,
    30,
    colours.muted,
    405,
  );
  s.timeFooter();
  u.end("nav-calendar");
}
