import { Graphics } from "pixi.js";
import { request } from "../season-api.ts";
import { colours } from "../ui/kit.ts";
import type { GameShell } from "../game-shell.ts";

export function listen(s: GameShell) {
  const u = s.ui;
  s.scene(
    "listen",
    "Beyond the tent flap",
    "NIGHT  /  FOLLOW THE VOICES",
    "place-tent",
  );
  s.lane = s.view.listening?.lane ?? 0;
  u.text(
    "Move to the voices. Hold Listen to gather a fragment.\nRelease it when the patrol reaches your cover.",
    96,
    222,
    34,
    colours.text,
    1500,
  );
  const stage = new Graphics();
  u.content.addChild(stage);
  const status = u.text("", 96, 806, 34, colours.water, 1500),
    progress = u.text("", 96, 858, 28, colours.muted, 1500);
  for (let i = 0; i < s.view.listeningRules.lanes; i++)
    u.button(
      `lane-${i}`,
      `Cover ${i + 1}`,
      190 + i * 530,
      660,
      480,
      82,
      () => {
        s.lane = i;
        void s.control();
      },
      { subtitle: "A / D or 1–3 changes cover" },
    );
  u.button("listen-hold", "Hold Listen", 1360, 946, 464, 68, () => {}, {
    hold: (value) => {
      s.held = value;
      void s.control();
    },
  });
  s.back(() => {
    s.held = false;
    void s.control();
    s.camp();
  }, "Camp map");
  s.footer("SPACE held  Listen     A / D  Move     Release SPACE  Hide");
  u.onKey = (e) => {
    if (e.repeat) return e.code === "Space";
    if (e.code === "Space") {
      s.held = true;
      void s.control();
      return true;
    }
    if (["KeyA", "KeyD", "Digit1", "Digit2", "Digit3"].includes(e.code)) {
      s.lane = Math.max(
        0,
        Math.min(
          2,
          e.code === "KeyA"
            ? s.lane - 1
            : e.code === "KeyD"
              ? s.lane + 1
              : Number(e.code.at(-1)) - 1,
        ),
      );
      void s.control();
      return true;
    }
    return false;
  };
  s.updateListening = () => {
    const n = s.view.listening;
    if (!n) return;
    stage.clear();
    for (let i = 0; i < 3; i++) {
      const x = 430 + i * 530;
      stage
        .ellipse(x, 530, 190, 75)
        .fill({ color: colours.panel, alpha: 0.9 })
        .stroke({
          color: s.lane === i ? colours.water : colours.edge,
          width: 3,
        });
      stage
        .poly([x - 140, 510, x, 320, x + 140, 510])
        .stroke({ color: colours.edge, width: 3 });
      if (i === n.beacon)
        stage.circle(x, 445, 50).stroke({ color: colours.gold, width: 3 });
      if (i === n.patrol)
        stage
          .poly([x, 355, x + 26, 405, x, 455, x - 26, 405])
          .fill({ color: colours.danger, alpha: 0.6 });
      if (i === n.lane) stage.circle(x, 544, 16).fill(colours.water);
    }
    status.text = n.done
      ? n.learned
        ? "A Knowing is yours. It waits in your journal."
        : "The camp has gone quiet. No new Knowing tonight."
      : `${n.clues} / ${s.view.listeningRules.requiredClues} fragments heard`;
    progress.text = `${n.alerts} moments exposed to the Vigil${n.done ? "  /  The night is complete" : ""}`;
    if (n.done) {
      s.held = false;
      const b = u.buttons.find((b) => b.id === "listen-hold");
      if (b) {
        b.hold = undefined;
        b.activate = () => void s.command({ type: "dawn" });
        b.label = "Meet the morning";
        b.root.destroy({ children: true });
        u.buttons = u.buttons.filter((x) => x !== b);
        u.button(
          "dawn",
          "Meet the morning",
          1360,
          946,
          464,
          68,
          () => void s.command({ type: "dawn" }),
        );
      }
    }
  };
  s.updateListening();
  u.end("listen-hold");
}
export async function control(s: GameShell) {
  if (!s.view.listening || s.view.nightFinished) return;
  try {
    await request("input", {
      lane: s.lane,
      listening: s.held,
      day: s.view.day.day,
    });
  } catch {
    s.held = false;
  }
}
