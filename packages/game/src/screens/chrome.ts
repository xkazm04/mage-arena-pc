import { gameAudio } from "../audio.ts";
import { DailyClock } from "../ui/daily-clock.ts";
import { backdrop } from "../ui/backdrop.ts";
import { sigil } from "../ui/artwork.ts";
import { colours } from "../ui/kit.ts";
import type { GameShell } from "../game-shell.ts";

export const friendly = (text: string) =>
  text.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
export function scene(
  s: GameShell,
  id: string,
  title: string,
  kicker: string,
  kind = "gate",
) {
  s.dailyDial = undefined;
  s.ui.begin(id);
  backdrop(s.ui, kind);
  s.ui.text(kicker, 96, 57, 24, colours.gold);
  s.ui.text(title, 96, 99, 58, colours.text, 1550, true);
  s.ui.line(96, 183, 1728);
  if (!kind.startsWith("camp-") && !kind.startsWith("place-"))
    sigil(s.ui, "inscription.collar", 1718, 118, 150, 0.7);
}
export function back(s: GameShell, action: () => void, label = "Back") {
  s.ui.button(
    "back",
    label === "Return to camp" ? "Camp map" : label,
    96,
    946,
    236,
    68,
    action,
  );
  s.ui.onBack = action;
}
export function footer(
  s: GameShell,
  text = "ARROWS / TAB  Navigate     ENTER  Choose     ESC  Back",
) {
  s.ui.text(text, 370, 966, 24, colours.muted, 1140);
}
export function campHeader(s: GameShell, id: string, title: string) {
  gameAudio.setScene(`camp:${s.view.slot}`);
  gameAudio.pauseWorld(false);
  s.scene(
    id,
    title,
    `CASTRA CLAUSA  /  WEEK ${s.view.day.week}  /  DAY ${s.view.day.day}`,
    id === "visit" ? `place-${s.view.location}` : `camp-${s.view.slot}`,
  );
  const v = s.view;
  for (const [i, stat] of [
    {
      icon: "gold",
      value: v.player.gold,
      label: "GOLD",
      colour: colours.gold,
    },
    {
      icon: "reputation",
      value: v.player.reputation,
      label: "REPUTATION",
      colour: colours.water,
    },
    {
      icon: "fatigue",
      value: v.player.fatigue,
      label: "FATIGUE",
      colour: colours.muted,
    },
  ].entries()) {
    const x = 1284 + i * 186;
    s.ui.icon(
      `stat.${stat.icon}.header`,
      x,
      111,
      16,
      s.ui.content,
      stat.colour,
    );
    s.ui.text(String(stat.value), x + 36, 87, 34, colours.text, 120);
    s.ui.text(stat.label, x - 24, 147, 24, stat.colour, 178);
  }
  if (id !== "camp" && id !== "visit") {
    s.ui.text(
      `${String(v.hour).padStart(2, "0")}:00 / ${friendly(v.slot)}`,
      1320,
      207,
      24,
      colours.gold,
      310,
    );
    s.ui.text(
      `${v.hoursRemaining} hours remain`,
      1320,
      241,
      24,
      colours.muted,
      310,
    );
  }
  const names = [
    ["camp", "Camp map"],
    ["calendar", "Season"],
    ["board", "Hollow Board"],
    ["journal", "Journal"],
  ];
  names.forEach(([key, label], i) =>
    s.ui.button(
      `nav-${key}`,
      label!,
      96 + i * 300,
      205,
      280,
      68,
      () => {
        s.cardPage = 0;
        s.cardSelected = 0;
        if (key === "camp") s.camp();
        else if (key === "calendar") s.calendar();
        else s.cards(key as "board" | "journal");
      },
      { kind: "tab", selected: key === id },
    ),
  );
  s.ui.button("settings", "Pause", 1644, 205, 180, 68, () => void s.pause());
  s.ui.onBack = () => void s.pause();
}
export function timeFooter(s: GameShell) {
  const u = s.ui,
    v = s.view;
  u.panel(96, 892, 1380, 134);
  if (s.clockDay !== v.day.day) {
    if (!s.clockDay) s.shownHours = v.hoursRemaining;
    s.clockDay = v.day.day;
  }
  s.dailyDial = new DailyClock(u, v.wakingHours, 184, 959);
  s.dailyDial.draw(
    s.shownHours ?? v.hoursRemaining,
    performance.now(),
    v.hour,
    v.slot,
  );
  u.text(
    `${String(v.hour).padStart(2, "0")}:00  /  ${friendly(v.slot)}`,
    286,
    911,
    34,
    colours.text,
    500,
  );
  u.text(
    v.hoursRemaining === 0
      ? "The day is spent — dawn awaits"
      : v.hoursRemaining <= 2
        ? "Keep watch in the final hours"
        : `${v.hoursRemaining} waking hours remain`,
    286,
    965,
    26,
    v.hoursRemaining <= 2 ? colours.danger : colours.water,
    600,
  );
  u.text(
    v.day.eve
      ? `Trial at ${v.day.trialHour}:00`
      : v.day.games
        ? `Games at ${String(v.day.gamesHour).padStart(2, "0")}:00`
        : "The hours are yours to spend",
    946,
    914,
    26,
    colours.gold,
    480,
  );
  u.text("Travel freely between places", 946, 963, 24, colours.muted, 480);
  if (v.season.due === "trial")
    u.button(
      "trial-summons",
      "Tent Trial",
      1500,
      892,
      324,
      134,
      () => s.trial(),
      { subtitle: "Answer the summons", icon: "earth" },
    );
  else if (v.season.due === "games")
    u.button(
      "prepare-games",
      "Enter the Games",
      1500,
      892,
      324,
      134,
      () => s.compose("season"),
      { subtitle: "Compose your Water", icon: "water" },
    );
  else if (v.listening && !v.nightFinished)
    u.button(
      "resume-listen",
      "The voices",
      1500,
      892,
      324,
      134,
      () => s.listen(),
      { subtitle: "Return to the tent flap" },
    );
  else
    u.button(
      v.nightFinished ? "dawn" : "wait",
      v.nightFinished ? "Meet the morning" : `Let ${v.slot} pass`,
      1500,
      892,
      324,
      134,
      () => void s.command({ type: v.nightFinished ? "dawn" : "wait" }),
      {
        subtitle: v.nightFinished
          ? "Read the Hollow Board"
          : "Wait until the next phase",
        disabled: v.settling || v.parley.pending,
      },
    );
}
