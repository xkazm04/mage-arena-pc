import {
  combat,
  pacePolicy,
  presets,
  spells,
  validateComposition,
  waterLines,
  type Composition,
  type TrainingKind,
} from "@mage/core/arena";
import { ArenaGame } from "../arena-entry.ts";
import { difficulty, difficultyName } from "../difficulty.ts";
import { seasonCommand } from "../season-api.ts";
import { colours } from "../ui/kit.ts";
import { friendly } from "./chrome.ts";
import type { GameShell } from "../game-shell.ts";

export function compose(
  s: GameShell,
  destination: string,
  initial: Composition = presets[0]!,
) {
  const choice = structuredClone(initial),
    u = s.ui;
  let selectedLine = 0;
  const draw = () => {
    s.scene(
      "composition",
      destination === "lab"
        ? "Compose your practice loadout"
        : "Compose your Water",
      `BEFORE THE COLLAR OPENS  /  DIFFICULTY: ${difficultyName(
        (destination === "lab" ? s.arena?.lab?.config.difficulty : undefined) ??
          difficulty(),
      ).toUpperCase()}`,
      "arena",
    );
    u.text(
      "Rain Needle is always yours. Bring three lines; each grows as the collar unlocks.",
      96,
      209,
      32,
      colours.muted,
      1650,
    );
    presets.forEach((p, i) =>
      u.button(
        `preset-${i}`,
        p.name,
        96 + i * 414,
        274,
        394,
        68,
        () => {
          Object.assign(choice, structuredClone(p));
          draw();
        },
        { selected: choice.name === p.name, kind: "tab" },
      ),
    );
    choice.lines.forEach((line, i) => {
      const x = 96 + i * 580;
      u.panel(x, 374, 556, 204);
      u.icon(line, x + 58, 429, 29);
      u.text(`SLOT ${i + 2}`, x + 106, 401, 24, colours.gold);
      u.button(
        `line-${i}`,
        friendly(line),
        x + 24,
        476,
        304,
        76,
        () => {
          const allowed = waterLines.filter(
            (l) => l === line || !choice.lines.includes(l),
          );
          choice.lines[i] =
            allowed[(allowed.indexOf(line) + 1) % allowed.length]!;
          choice.name = "Custom";
          selectedLine = i;
          draw();
        },
        { tooltip: "Choose another spell line. Each line can appear once." },
      );
      u.button(
        `inspect-${i}`,
        "Inspect",
        x + 348,
        476,
        184,
        76,
        () => {
          selectedLine = i;
          draw();
        },
        { selected: selectedLine === i, fontSize: 26 },
      );
    });
    const line = choice.lines[selectedLine]!;
    u.text(`${friendly(line)}  /  TIER EVOLUTION`, 96, 613, 28, colours.gold);
    const branch = choice.branches[line as keyof typeof choice.branches];
    if (branch)
      u.button(
        "branch",
        `Branch ${branch}`,
        1500,
        601,
        324,
        68,
        () => {
          choice.branches[line as keyof typeof choice.branches] =
            branch === "A" ? "B" : "A";
          choice.name = "Custom";
          draw();
        },
        { tooltip: "Switch the branch and inspect the spells below." },
      );
    [1, 2, 3, 4].forEach((tier, i) => {
      const x = 96 + i * 440,
        s = spells.find(
          (s) =>
            s.line === line &&
            s.tier === tier &&
            (!s.branch || branch === s.branch),
        )!;
      u.panel(x, 695, 416, 210);
      u.text(
        `${["I", "II", "III", "IV"][i]}  /  ${combat.tierClock.unlockAtSeconds[tier as 1 | 2 | 3 | 4]}s`,
        x + 24,
        724,
        24,
        colours.gold,
      );
      u.text(s.name, x + 36, 765, 30, colours.text, 344);
      u.text(
        s.kind === "passive"
          ? "Perfect absorb counter"
          : `${s.mana} mana  /  ${Number((s.cooldownS / pacePolicy.player).toFixed(1))}s cooldown`,
        x + 36,
        856,
        24,
        colours.muted,
        364,
      );
    });
    s.back(() =>
      destination === "season"
        ? s.camp()
        : destination === "lab"
          ? s.arena!.labUI!.openSetup()
          : s.training(),
    );
    s.footer(
      "Alternate lines to build Flow. A full Flow makes the next cast a free Crest.",
    );
    u.button(
      "composition-start",
      destination === "season" ? "Enter season Games" : "Enter the arena",
      1444,
      946,
      380,
      68,
      () =>
        void s.run(async () => {
          const errors = validateComposition(choice);
          if (errors.length) throw Error(errors.join(" "));
          if (destination === "season") {
            await seasonCommand({
              type: "prepare",
              composition: choice,
              difficulty: difficulty(),
            });
            await seasonCommand({ type: "start" });
            await s.continue();
          } else if (destination === "lab") {
            s.arena!.labUI!.reset({
              ...s.arena!.lab!.config,
              composition: choice,
            });
          } else {
            s.arena?.dispose();
            s.arena = new ArenaGame(
              u,
              () => void s.pause(),
              () => s.results(),
            );
            s.arena.composition = structuredClone(choice);
            if (destination === "tiro") s.arena.startGames();
            else if (destination.startsWith("enemy:"))
              s.arena.startRoster(destination.slice(6));
            else {
              s.arena.restart(destination as TrainingKind);
              s.arena.hud();
            }
            history.replaceState(null, "", `/training${location.search}`);
          }
        }),
    );
    u.end();
  };
  draw();
}
