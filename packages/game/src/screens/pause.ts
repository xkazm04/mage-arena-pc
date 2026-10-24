import { gameAudio } from "../audio.ts";
import type { AudioSettings, Cue } from "../audio-policy.ts";
import { cycleDifficulty, difficulty, difficultyName } from "../difficulty.ts";
import { colours } from "../ui/kit.ts";
import { uiScaleRange } from "../ui/anchors.ts";
import { applyWindowMode, ensureQualityProfile } from "../settings/apply.ts";
import {
  qualityTiers,
  settings as current,
  updateSettings,
} from "../settings/settings.ts";
import { friendly } from "./chrome.ts";
import type { GameShell } from "../game-shell.ts";

/** The UI scale steps the settings button cycles through. */
const uiScaleSteps = [0.75, 0.9, 1, 1.15, 1.3, 1.5].filter(
  (v) => v >= uiScaleRange.min && v <= uiScaleRange.max,
);
const nextUiScale = (now: number) =>
  uiScaleSteps.find((v) => v > now + 0.001) ?? uiScaleSteps[0]!;
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
    s.nav.go("settings"),
  );
  u.button("open-saves", "Save & load", 580, 530, 760, 90, () =>
    s.nav.go("saves"),
  );
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
    ["SPELL SLOTS", "1–5 or wheel  /  LB and RB"],
    ["MENUS", "Arrows + Enter  /  D-pad + A, B back"],
  ];
  lines.forEach(([label, value], i) => {
    u.text(label!, 132, 273 + i * 94, 24, colours.gold);
    u.text(value!, 132, 307 + i * 94, 32, colours.text, 1000);
  });
  const now = current();
  const row = (i: number) => 242 + i * 90;
  u.button("sound", "Sound & music", 1240, row(0), 584, 80, () =>
    s.nav.go("audio-settings"),
  );
  u.button(
    "fullscreen",
    `Window: ${now.windowMode === "fullscreen" ? "Fullscreen" : "Windowed"}`,
    1240,
    row(1),
    584,
    80,
    () =>
      void s.run(async () => {
        const mode =
          now.windowMode === "fullscreen" ? "windowed" : "fullscreen";
        updateSettings({ windowMode: mode });
        if (!(await applyWindowMode(mode))) {
          updateSettings({ windowMode: now.windowMode });
          u.notice("Fullscreen is unavailable in this window.");
        }
        s.settings();
      }),
  );
  u.button(
    "ui-scale",
    `UI scale: ${Math.round(now.uiScale * 100)}%`,
    1240,
    row(2),
    584,
    80,
    () => {
      updateSettings({ uiScale: nextUiScale(now.uiScale) });
      s.settings();
    },
  );
  u.button(
    "graphics",
    `Graphics: ${friendly(now.quality)}`,
    1240,
    row(3),
    584,
    80,
    () => {
      const tier =
        qualityTiers[
          (qualityTiers.indexOf(now.quality) + 1) % qualityTiers.length
        ]!;
      updateSettings({ quality: tier });
      if (ensureQualityProfile()) return;
      s.settings();
      u.notice("Saved. Only the desktop graphics profile ships on PC today.");
    },
  );
  u.button(
    "motion",
    `Motion: ${now.reducedMotion ? "Reduced" : "Full"}`,
    1240,
    row(4),
    584,
    80,
    () => {
      updateSettings({ reducedMotion: !now.reducedMotion });
      s.settings();
    },
  );
  u.button(
    "difficulty",
    `Difficulty: ${difficultyName(difficulty())}`,
    1240,
    row(5),
    584,
    80,
    () => {
      cycleDifficulty();
      s.settings();
    },
  );
  u.text(
    "Difficulty sets how fast rivals, soldiers and creatures move and attack, from the next bout. Aim at the feet; magic can be absorbed, steel and unblockable marks must be escaped.",
    1256,
    792,
    22,
    colours.muted,
    548,
  );
  s.back(() => void s.nav.back());
  s.footer(
    u.modality === "gamepad"
      ? "D-PAD  Navigate     A  Choose     B  Back"
      : "ARROWS / TAB  Navigate     ENTER  Choose     ESC  Back",
  );
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
  s.back(() => void s.nav.back());
  s.footer("Volume changes are saved on this device.");
  u.end();
}
