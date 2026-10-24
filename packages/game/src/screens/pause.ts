import { gameAudio } from "../audio.ts";
import type { AudioSettings, Cue } from "../audio-policy.ts";
import { cycleDifficulty, difficulty, difficultyName } from "../difficulty.ts";
import { colours } from "../ui/kit.ts";
import { friendly } from "./chrome.ts";
import type { GameShell } from "../game-shell.ts";

export function pauseScreen(s: GameShell) {
  s.scene("pause", "The world can wait", "PAUSED");
  const u = s.ui;
  u.panel(520, 245, 880, 624, "panel.modal");
  u.button(
    "resume",
    "Return to the moment",
    580,
    294,
    760,
    90,
    () => void s.run(() => s.resume()),
    { icon: "water" },
  );
  u.button("open-settings", "Settings & controls", 580, 412, 760, 90, () =>
    s.settings(),
  );
  u.button("open-saves", "Save & load", 580, 530, 760, 90, () => s.saves());
  u.button(
    "main-menu",
    "Main menu",
    580,
    648,
    760,
    90,
    () =>
      void s.run(async () => {
        await s.arena?.flush();
        s.arena?.dispose();
        s.arena = undefined;
        s.menu();
      }),
  );
  u.button("pause-combat-lab", "Combat Feel Lab", 580, 766, 760, 70, () =>
    s.openLab(),
  );
  u.onBack = () => void s.run(() => s.resume());
  u.end("resume");
}
export function settings(s: GameShell) {
  s.scene("settings", "Your hands. Your magic.", "PAUSED  /  SETTINGS");
  const u = s.ui;
  u.panel(96, 242, 1094, 638);
  const lines = [
    ["MOVE", "W A S D  /  Left stick"],
    ["AIM & CAST", "Mouse + left button  /  Right stick + RT"],
    ["ABSORB", "Right button held  /  LT held"],
    ["ROLL & SPRINT", "Space + Shift  /  A + left stick press"],
    ["SPELL SLOTS", "1–4 or wheel  /  LB and RB"],
    ["MENUS", "Arrows + Enter  /  D-pad + A, B back"],
  ];
  lines.forEach(([label, value], i) => {
    u.text(label!, 132, 273 + i * 94, 24, colours.gold);
    u.text(value!, 132, 307 + i * 94, 32, colours.text, 1000);
  });
  u.button("sound", "Sound & music", 1240, 242, 584, 98, () =>
    s.audioSettings(),
  );
  u.button(
    "fullscreen",
    "Toggle fullscreen",
    1240,
    366,
    584,
    98,
    () => void u.fullscreen(),
  );
  u.button(
    "motion",
    `Motion: ${localStorage.getItem("mage-motion") === "reduced" ? "Reduced" : "Full"}`,
    1240,
    490,
    584,
    98,
    () => {
      localStorage.setItem(
        "mage-motion",
        localStorage.getItem("mage-motion") === "reduced" ? "full" : "reduced",
      );
      s.settings();
    },
  );
  u.button(
    "difficulty",
    `Difficulty: ${difficultyName(difficulty())}`,
    1240,
    614,
    584,
    98,
    () => {
      cycleDifficulty();
      s.settings();
    },
  );
  u.text(
    "Difficulty sets how fast rivals, soldiers and creatures move and attack, from the next bout.\n\nAim at the feet. The camera stays fixed until you approach an edge. Magic can be absorbed; steel and unblockable marks must be escaped.",
    1256,
    740,
    24,
    colours.muted,
    548,
  );
  s.back(() => s.pauseScreen());
  s.footer();
  u.end();
}
export function audioSettings(s: GameShell) {
  s.scene(
    "audio-settings",
    "Sound beneath the wards",
    "PAUSED  /  SOUND & MUSIC",
  );
  const u = s.ui,
    settings = gameAudio.settings;
  u.panel(96, 242, 1728, 638);
  (["master", "music", "effects", "voice", "ui"] as const).forEach((bus, i) => {
    const y = 278 + i * 108,
      value = Math.round(settings[bus] * 100);
    u.bar(
      bus === "ui" ? "Interface" : friendly(bus),
      132,
      y,
      950,
      value,
      100,
      bus === "music" ? colours.water : colours.gold,
    );
    for (const [direction, delta, x] of [
      ["down", -0.1, 1140],
      ["up", 0.1, 1484],
    ] as const)
      u.button(
        `volume-${bus}-${direction}`,
        delta < 0 ? "Quieter" : "Louder",
        x,
        y,
        292,
        78,
        () => {
          gameAudio.setSettings({
            [bus]: Math.round((settings[bus] + delta) * 10) / 10,
          } as Partial<AudioSettings>);
          s.audioSettings();
        },
        { disabled: delta < 0 ? value === 0 : value === 100 },
      );
  });
  u.button(
    "audio-mute",
    settings.muted ? "Unmute all" : "Mute all",
    1140,
    834,
    636,
    68,
    () => {
      gameAudio.setSettings({ muted: !settings.muted });
      s.audioSettings();
    },
  );
  u.button("audio-preview", "Test effects", 96, 834, 340, 68, () => {
    const cues: Cue[] = [
      "cast.fire",
      "cast.water",
      "cast.earth",
      "cast.air",
      "hit",
      "impact",
      "roll",
      "perfect",
    ];
    const cue = cues[s.audioPreview++ % cues.length]!;
    void gameAudio.play(cue);
    u.notice(`Sound: ${friendly(cue.replace("cast.", ""))}`);
  });
  u.button("voice-preview", "Test voice", 456, 834, 300, 68, () => {
    void gameAudio.play("voice.preview");
    u.notice("The collar loosens. Stand ready.");
  });
  s.back(() => s.settings());
  s.footer("Volume changes are saved on this device.");
  u.end();
}
