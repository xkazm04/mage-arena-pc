import { bridgeRules } from "@mage/core";
import type { SeasonCommand } from "@mage/director";
import { seasonCommand } from "../season-api.ts";
import { portrait } from "../ui/artwork.ts";
import { colours } from "../ui/kit.ts";
import { friendly } from "./chrome.ts";
import type { GameShell } from "../game-shell.ts";

export function trial(s: GameShell) {
  const u = s.ui,
    v = s.view,
    t = v.season.trial;
  s.scene(
    "trial",
    "Who carries the Tide?",
    ["Games eve", "Tent trial"],
    `camp-${v.slot}`,
  );
  u.panel(96, 238, 720, 642);
  portrait(u, "cassia", "proud", 310, 340, 280, 350);
  u.text(
    t?.rivalName ?? "Your tent rival",
    140,
    734,
    38,
    colours.text,
    620,
    true,
  );
  u.text(
    "Best of three exchanges. Each stance costs stamina.\nBrace beats press. Feint beats brace. Press beats feint.",
    886,
    242,
    34,
    colours.text,
    930,
  );
  if (t?.day === v.day.day) {
    u.text(
      `EXCHANGES  ${t.score.join(" : ")}\nSTAMINA  ${t.stamina.join(" / ")}`,
      886,
      377,
      30,
      colours.gold,
      900,
    );
    if (t.phase === "active") {
      u.text(`Their stance: ${t.tell}`, 886, 508, 44, colours.water, 900, true);
      bridgeRules.trial.stances.forEach((stance, i) =>
        u.button(
          `trial-${stance}`,
          friendly(stance),
          886 + i * 312,
          659,
          290,
          120,
          () =>
            void s.seasonAction(
              {
                type: "exchange",
                stance: stance as "press" | "brace" | "feint",
              },
              () => s.trial(),
            ),
          {
            subtitle: `${bridgeRules.trial.costs[stance as keyof typeof bridgeRules.trial.costs]} stamina`,
          },
        ),
      );
    } else {
      u.text(
        `${t.entrantName} is selected.`,
        886,
        528,
        44,
        colours.water,
        850,
        true,
      );
      u.button(
        "receive-trial",
        "Accept the Trial",
        886,
        723,
        710,
        96,
        () => void s.seasonAction({ type: "receive-trial" }, () => s.camp()),
      );
    }
  } else
    u.button(
      "start-trial",
      v.location === "pit" ? "Step into the Trial" : "Answer the summons",
      886,
      622,
      790,
      110,
      () =>
        void s.run(async () => {
          if (s.view.location !== "pit")
            s.view = await seasonCommand({ type: "escort-trial" });
          s.view = await seasonCommand({ type: "trial" });
          s.trial();
        }),
      { subtitle: "The elder watches. Read your rival." },
    );
  s.back(() => s.camp(), "Camp map");
  s.footer();
  u.end();
}
export async function seasonAction(
  s: GameShell,
  command: SeasonCommand,
  after: () => void,
) {
  await s.run(async () => {
    s.view = await seasonCommand(command);
    after();
  });
}
