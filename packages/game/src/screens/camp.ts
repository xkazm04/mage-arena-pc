import { Graphics } from "pixi.js";
import type { CampCommand } from "@mage/director";
import { request, type SeasonView } from "../season-api.ts";
import { picture, portrait } from "../ui/artwork.ts";
import { art } from "../art.ts";
import { colours } from "../ui/kit.ts";
import type { GameShell } from "../game-shell.ts";

export function camp(s: GameShell) {
  if (s.view.season.complete) {
    s.chapter();
    return;
  }
  s.campHeader("camp", "Within the wards");
  const u = s.ui,
    v = s.view;
  const fallbackAnchors: Record<string, [number, number]> = {
    yard: [0.23, 0.2],
    cistern: [0.62, 0.2],
    pit: [0.87, 0.24],
    exchange: [0.24, 0.5],
    commons: [0.52, 0.5],
    door: [0.77, 0.59],
    tent: [0.195, 0.8],
    edge: [0.89, 0.8],
  };
  for (const p of v.places) {
    const anchor = art.manifest?.places.find((a) => a.id === p.id)?.anchor ??
      fallbackAnchors[p.id] ?? [0.5, 0.5];
    const px = anchor[0]! * 1920,
      py = anchor[1]! * 1080;
    const x = Math.max(96, Math.min(1552, px - 136)),
      y = Math.max(306, Math.min(710, py));
    const link = new Graphics()
      .moveTo(px, Math.max(286, py))
      .lineTo(x + 136, y + 38)
      .stroke({ color: colours.gold, width: 2, alpha: 0.65 });
    u.content.addChild(link);
    u.button(
      `place-${p.id}`,
      p.name,
      x,
      y,
      272,
      80,
      () => {
        s.selected = p.id;
        s.camp();
      },
      {
        selected: s.selected === p.id,
        disabled: !p.isOpen,
        tooltip: p.description,
      },
    );
  }
  const p = v.places.find((p) => p.id === s.selected) ?? v.places[0]!;
  u.panel(96, 806, 1728, 72, "button.normal");
  u.text(p.name, 134, 825, 28, colours.gold, 265);
  u.text(p.description, 430, 818, 24, colours.text, 940);
  const allowed =
    !v.listening && !v.nightFinished && p.isOpen && !v.player.stocks;
  u.button(
    "visit-place",
    "Enter",
    1440,
    808,
    350,
    68,
    () => {
      s.nav.reset("visit");
      if (p.id === v.location) s.visit();
      else void s.command({ type: "travel", place: p.id });
    },
    { disabled: !allowed },
  );
  s.timeFooter();
  u.end(`place-${s.selected}`);
}
export function visit(s: GameShell) {
  const u = s.ui,
    v = s.view,
    p = v.places.find((p) => p.id === v.location)!;
  s.campHeader("visit", p.name);
  u.panel(96, 312, 558, 548);
  picture(u, `place.${p.id}`, 146, 352, 458, 175);
  u.text(p.description, 128, 545, 32, colours.text, 494);
  u.text(
    v.presence.length ? "HERE WITH YOU" : "A QUIET MOMENT",
    128,
    686,
    24,
    colours.gold,
  );
  v.presence.slice(0, 4).forEach((person, i) => {
    portrait(u, person.id, "neutral", 134 + i * 112, 727, 88, 106);
  });
  if (!v.presence.length)
    u.text("Only the wardstones listen.", 128, 731, 30, colours.muted, 490);
  const actions: {
    id: string;
    label: string;
    subtitle: string;
    run: () => void;
  }[] = [];
  if (
    v.slot === "night" &&
    v.location === "tent" &&
    !v.listening &&
    !v.nightFinished &&
    v.hoursRemaining >= v.listeningHours &&
    !v.player.stocks
  )
    actions.push({
      id: "listen",
      label: "Listen at the tent flap",
      subtitle: `${v.listeningHours} hours · Follow the voices. Hide from the Vigil.`,
      run: () => void s.command({ type: "listen" }),
    });
  for (const m of v.parley.moments)
    actions.push({
      id: `parley-${m.target}`,
      label: `Speak with ${m.name}`,
      subtitle: `${v.parleyHours} hours · A Knowing gives your words weight.`,
      run: () => {
        s.parleyText = "";
        s.parleyApproach = 0;
        s.parley(m);
      },
    });
  for (const a of v.actions)
    actions.push({
      id: `action-${a.id}`,
      label: a.label,
      subtitle: `${a.hours} ${a.hours === 1 ? "hour" : "hours"} · ${a.gains}`,
      run: () => void s.command({ type: "act", action: a.id }),
    });
  u.text("CHOOSE A MOMENT", 712, 314, 26, colours.gold);
  u.text(
    "Choose how to spend your remaining hours.",
    712,
    354,
    30,
    colours.muted,
    1000,
  );
  const paged = s.nav.state("visit");
  actions.slice(paged.page * 4, paged.page * 4 + 4).forEach((a, i) =>
    u.button(a.id, a.label, 704, 419 + i * 110, 1120, 94, a.run, {
      subtitle: a.subtitle,
      disabled: v.settling || v.parley.pending || v.nightFinished,
    }),
  );
  if (!actions.length)
    u.text(
      "Nothing calls for your time here.\nReturn to the map or let the hours pass.",
      720,
      464,
      34,
      colours.text,
      980,
    );
  if (actions.length > 4) {
    u.button(
      "actions-previous",
      "Previous",
      704,
      798,
      242,
      68,
      () => {
        paged.page--;
        s.visit();
      },
      { disabled: paged.page === 0 },
    );
    u.button(
      "actions-next",
      "More activities",
      966,
      798,
      320,
      68,
      () => {
        paged.page++;
        s.visit();
      },
      { disabled: (paged.page + 1) * 4 >= actions.length },
    );
  }
  s.timeFooter();
  u.end();
}
export async function command(s: GameShell, command: CampCommand) {
  await s.run(async () => {
    s.view = await request<SeasonView>("command", {
      command,
      revision: s.view.revision,
    });
    if (command.type === "travel") {
      s.selected = s.view.location;
      s.visit();
    } else if (command.type === "listen") s.listen();
    else if (command.type === "dawn") {
      s.nav.reset("board");
      s.cards("board");
    } else s.camp();
  });
}
