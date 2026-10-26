import { gameAudio } from "../audio.ts";
import { request, type SeasonView } from "../season-api.ts";
import { portrait } from "../ui/artwork.ts";
import { colours } from "../ui/kit.ts";
import type { GameShell } from "../game-shell.ts";

export function saves(s: GameShell, message = "") {
  s.scene("saves", "A thread held in time", ["Paused", "Save & load"]);
  const u = s.ui;
  u.panel(96, 252, 1728, 596);
  portrait(u, "cassia", "neutral", 150, 302, 174, 226);
  u.text(
    `Day ${s.view.day.day}  /  ${s.view.hour}:00  /  ${s.view.hoursRemaining} hours remain`,
    365,
    306,
    48,
    colours.text,
    1250,
    true,
  );
  u.text(
    `${s.view.player.name}  /  ${s.view.player.gold} gold  /  ${s.view.season.renown} renown`,
    365,
    387,
    32,
    colours.muted,
    1200,
  );
  u.text(
    s.arena?.season
      ? "Your accepted arena checkpoint will be held with the season."
      : s.arena
        ? "Practice is not part of your season save. Your camp progress is held."
        : "The season, Knowings and camp bonds will be held together.",
    365,
    459,
    32,
    colours.muted,
    1240,
  );
  u.button(
    "save-season",
    "Save season",
    144,
    614,
    506,
    98,
    () =>
      void s.run(async () => {
        await s.arena?.flush();
        await request("save", {});
        void gameAudio.play("ui.confirm");
        s.saves("Season saved. Your thread is held.");
      }),
    { icon: "water" },
  );
  u.button(
    "load-season",
    "Load season",
    706,
    614,
    506,
    98,
    () => void s.load(false),
  );
  u.button(
    "load-previous",
    "Recover previous",
    1268,
    614,
    506,
    98,
    () => void s.load(true),
  );
  u.text(
    message ||
      "Loading returns you here, paused, before the world moves again.",
    144,
    761,
    32,
    message ? colours.water : colours.muted,
    1600,
  );
  s.back(() => void s.nav.back());
  u.button(
    "resume-loaded",
    "Resume",
    1444,
    946,
    380,
    68,
    () => void s.run(() => s.resume()),
  );
  s.footer();
  u.end();
}
export async function openSaves(s: GameShell, from: string) {
  gameAudio.pauseWorld(true);
  s.nav.open(from);
  await s.run(async () => {
    await request("pause", { paused: true });
    s.nav.go("saves");
  });
}
export async function load(s: GameShell, previous: boolean) {
  await s.run(async () => {
    s.arena?.pause(true);
    await s.arena?.flush();
    s.view = await request<SeasonView>(previous ? "load-previous" : "load", {});
    s.arena?.dispose();
    s.arena = undefined;
    await s.continue(true);
    // The loaded world is paused beneath the pause menu, and saves sits on top of both.
    s.nav.open(s.arena ? "arena" : s.ui.screen);
    s.nav.push("pause");
    s.nav.push("saves");
    gameAudio.pauseWorld(true);
    s.saves("Save loaded. Resume when ready.");
  });
}
