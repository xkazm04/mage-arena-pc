import { art } from "../art.ts";
import type { GameShell } from "../game-shell.ts";
import { picture, portrait } from "../ui/artwork.ts";
import { colours } from "../ui/kit.ts";
import { friendly } from "./chrome.ts";

/** Delivery fixtures for the art review harness (`?harness` only). */
export function installArtReview(s: GameShell) {
  Object.assign(window, {
    __artReview: {
      clock: () => s.dailyDial?.snapshot(),
      portrait: (id: string) => {
        if (!art.manifest?.characters.some((c) => c.id === id))
          throw Error("Unknown portrait");
        s.scene("art-review", id, ["Portrait delivery fixture"]);
        [
          "neutral",
          "calm",
          "proud",
          "afraid",
          "angry",
          "scheming",
          "grieving",
        ].forEach((m, i) => {
          portrait(s.ui, id, m, 106 + i * 244, 330, 220, 300);
          s.ui.text(m, 106 + i * 244, 660, 28, colours.text, 220);
        });
        s.back(() => s.menu());
        s.ui.end();
      },
      place: (id: string) => {
        if (!art.manifest?.places.some((p) => p.id === id))
          throw Error("Unknown place");
        s.scene(
          "art-review",
          friendly(id),
          ["Place backdrop fixture"],
          `place-${id}`,
        );
        s.back(() => s.menu());
        s.ui.end();
      },
      slot: (slot: string) => {
        if (!["day", "dusk", "night"].includes(slot))
          throw Error("Unknown slot");
        s.scene(
          "art-review",
          "Castra Clausa",
          ["Map delivery fixture", slot],
          `camp-${slot}`,
        );
        s.back(() => s.menu());
        s.ui.end();
      },
      stories: () => {
        s.scene(
          "art-review",
          "The Hollow Board",
          ["Illustration fixture — no generated events"],
        );
        [
          "shared-loaf",
          "empty-bowl",
          "watch-rota",
          "ward-seam",
          "quiet-bargain",
          "before-grille",
        ].forEach((id, i) => {
          const x = 106 + (i % 3) * 578,
            y = 270 + Math.floor(i / 3) * 308;
          s.ui.panel(x, y, 552, 284, "card.normal");
          picture(s.ui, `story.${id}`, x + 50, y + 40, 452, 178);
          s.ui.text(
            friendly(id.replaceAll("-", " ")),
            x + 50,
            y + 225,
            24,
            colours.text,
            452,
          );
        });
        s.back(() => s.menu());
        s.ui.end();
      },
      preload: async () => {
        await art.preload(
          Object.keys(art.manifest?.entries ?? {}).filter((k) =>
            k.startsWith("portrait-page."),
          ),
        );
        return art.snapshot();
      },
    },
  });
}
