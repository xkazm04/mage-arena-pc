import { Graphics, type BitmapText } from "pixi.js";
import { bridgeRules, linkBout, type SeasonBout } from "@mage/core";
import type { CampCommand, ParleyInput, SeasonCommand } from "@mage/director";
import {
  combat,
  enemyRoster,
  presets,
  spells,
  validateComposition,
  waterLines,
  type Composition,
  type TrainingKind,
} from "@mage/core/arena";
import { ArenaGame } from "./arena-entry.ts";
import { request, seasonCommand, type SeasonView } from "./season-api.ts";
import { CanvasUI } from "./ui/ui.ts";
import { backdrop } from "./ui/backdrop.ts";
import { picture, portrait, storyFor } from "./ui/artwork.ts";
import { art } from "./art.ts";
import { colours } from "./ui/kit.ts";

type Moment = SeasonView["parley"]["moments"][number];
const friendly = (text: string) =>
  text.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
export class GameShell {
  readonly ui = new CanvasUI();
  private view!: SeasonView;
  private arena?: ArenaGame;
  private busy = false;
  private pollBusy = false;
  private poll?: number;
  private readonly lifetime = new AbortController();
  private selected = "tent";
  private cardPage = 0;
  private cardSelected = 0;
  private castPage = 0;
  private visitPage = 0;
  private returnScreen = "camp";
  private held = false;
  private lane = 0;
  private updateListening?: () => void;
  private parleyText = "";
  private parleyApproach = 0;
  private typing = false;
  private textDisplay?: BitmapText;
  private currentMoment?: Moment;
  private disposed = false;
  async init(host: HTMLElement) {
    await this.ui.init(host);
    await art.preload(["place.door", "portrait.cassia.neutral"]);
    this.view = await request<SeasonView>("session");
    this.ui.onFrame = (dt) => this.arena?.frame(dt);
    this.ui.onGamepad = (pad) => this.arena?.input.updateGamepad(pad);
    this.ui.onGamepadLost = () => {
      if (this.arena && !this.arena.paused) void this.pause();
    };
    const signal = this.lifetime.signal;
    window.addEventListener(
      "keyup",
      (e) => {
        if (e.code === "Space" && this.held) {
          this.held = false;
          void this.control();
        }
      },
      { signal },
    );
    window.addEventListener(
      "blur",
      () => {
        if (this.held) {
          this.held = false;
          void this.control();
        }
        if (this.arena && !this.arena.paused) void this.pause();
      },
      { signal },
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden && this.arena && !this.arena.paused)
          void this.pause();
      },
      { signal },
    );
    this.poll = window.setInterval(() => void this.refresh(), 150);
    if (location.pathname === "/camp") await this.continue();
    else if (location.pathname === "/training") this.training();
    else {
      await request("pause", { paused: true });
      this.menu();
    }
    document.body.dataset.ready = "true";
  }
  private async refresh() {
    if (this.pollBusy || this.busy || this.disposed || this.arena) return;
    this.pollBusy = true;
    try {
      const next = await request<SeasonView>("session");
      if (this.disposed) return;
      if (this.busy || next.revision < this.view.revision) return;
      const changed =
        next.revision !== this.view.revision ||
        next.settling !== this.view.settling ||
        next.nightFinished !== this.view.nightFinished;
      this.view = next;
      if (changed) {
        if (this.ui.screen === "listen") this.updateListening?.();
        else if (
          ["camp", "visit", "calendar", "board", "journal", "trial"].includes(
            this.ui.screen,
          )
        )
          this.redraw();
      }
    } catch {
      /* Keep the last scene during a transient disconnection. */
    } finally {
      this.pollBusy = false;
    }
  }
  private async run(action: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true;
    this.ui.busy = true;
    try {
      await action();
    } catch (e) {
      this.ui.notice(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy = false;
      this.ui.busy = false;
    }
  }
  private scene(id: string, title: string, kicker: string, kind = "gate") {
    this.ui.begin(id);
    backdrop(this.ui, kind);
    this.ui.text(kicker, 96, 57, 24, colours.gold);
    this.ui.text(title, 96, 99, 58, colours.text, 1550, true);
    this.ui.line(96, 183, 1728);
  }
  private back(action: () => void, label = "Back") {
    this.ui.button(
      "back",
      label === "Return to camp" ? "Camp map" : label,
      96,
      946,
      236,
      68,
      action,
    );
    this.ui.onBack = action;
  }
  private footer(
    text = "ARROWS / TAB  Navigate     ENTER  Choose     ESC  Back",
  ) {
    this.ui.text(text, 370, 966, 24, colours.muted, 1140);
  }
  private menu() {
    this.ui.begin("menu");
    backdrop(this.ui);
    this.ui.text("A COVENANT IN CHAINS", 112, 168, 26, colours.gold);
    this.ui.text("MAGE\nARENA", 96, 220, 112, colours.text, 860, true);
    this.ui.line(112, 501, 460, colours.gold);
    this.ui.text(
      "Six weeks beneath the collar.\nWhat will you carry beyond the grille?",
      112,
      538,
      34,
      colours.muted,
      710,
    );
    portrait(this.ui, "cassia", "neutral", 1040, 200, 650, 680);
    this.ui.button(
      "pick-character",
      "Begin your story",
      112,
      667,
      570,
      84,
      () => this.pick(),
      { subtitle: "Choose your mage", icon: "water" },
    );
    this.ui.button(
      "continue-season",
      "Continue season",
      112,
      771,
      274,
      72,
      () => void this.run(() => this.continue()),
    );
    this.ui.button(
      "menu-load",
      "Load season",
      406,
      771,
      276,
      72,
      () => void this.openSaves("menu"),
    );
    this.ui.button(
      "training-arena",
      "The proving ground",
      112,
      863,
      570,
      72,
      () => this.training(),
      {
        tooltip: "Learn the ward, compose spells and challenge the Tiro Games.",
      },
    );
    this.ui.button(
      "fullscreen",
      "Fullscreen",
      1574,
      946,
      250,
      68,
      () => void this.ui.fullscreen(),
    );
    this.ui.text("WATER  /  THE FIRST TWO WEEKS", 112, 976, 24, colours.muted);
    this.ui.onBack = () => {};
    this.ui.end("pick-character");
    history.replaceState(null, "", `/${location.search}`);
  }
  private pick() {
    this.scene("character", "The four bound together", "CHOOSE YOUR MAGE");
    this.view.season.allies.forEach((ally, i) => {
      const x = 96 + i * 440;
      this.ui.panel(x, 248, 408, 626);
      this.ui.icon(ally.school, x + 204, 315, 40);
      portrait(this.ui, ally.id, "neutral", x + 64, 366, 280, 280);
      this.ui.text(ally.name, x + 28, 652, 36, colours.text, 352, true);
      this.ui.text(ally.school.toUpperCase(), x + 28, 752, 26, colours.gold);
      this.ui.button(
        `choose-${ally.school}`,
        ally.school === "water" ? "Walk as Cassia" : "Camp ally",
        x + 24,
        786,
        360,
        68,
        () => void this.run(() => this.continue()),
        {
          disabled: ally.school !== "water",
          tooltip:
            ally.school === "water"
              ? "Water bends the battle. Time the ward and answer with a Crest."
              : "This school joins you in camp. Its arena chapter is still to come.",
        },
      );
    });
    this.back(() => this.menu());
    this.footer(
      "Water is playable. The other three share your camp, bonds and rivalries.",
    );
    this.ui.end("choose-water");
  }
  private async continue(restored = false) {
    this.view = await request<SeasonView>("session");
    await request("pause", { paused: restored });
    this.view = await request<SeasonView>("session");
    if (this.view.season.bout) {
      if (this.view.season.bout.phase === "prepared") {
        await request("pause", { paused: false });
        await seasonCommand({ type: "start" });
        await request("pause", { paused: restored });
      }
      const bout = linkBout(await request<SeasonBout>("bout"));
      this.arena?.dispose();
      this.arena = new ArenaGame(
        this.ui,
        () => void this.pause(),
        () => this.results(),
        {
          bout,
          send: (entries, hash) =>
            request("bout-input", { id: bout.id, entries, hash }),
          finish: async () => {
            await seasonCommand({ type: "receive" });
            this.arena?.dispose();
            this.arena = undefined;
            this.view = await request<SeasonView>("session");
            this.camp();
          },
        },
      );
      this.arena.pause(restored);
      this.arena.hud();
    } else {
      this.selected = this.view.location;
      if (this.view.listening && !this.view.nightFinished) this.listen();
      else this.camp();
    }
    history.replaceState(null, "", `/camp${location.search}`);
  }
  private campHeader(id: string, title: string) {
    this.scene(
      id,
      title,
      `CASTRA CLAUSA  /  WEEK ${this.view.day.week}  /  DAY ${this.view.day.day}`,
      id === "visit" ? `place-${this.view.location}` : `camp-${this.view.slot}`,
    );
    const names = [
      ["camp", "Camp map"],
      ["calendar", "Season"],
      ["board", "Hollow Board"],
      ["journal", "Journal"],
    ];
    names.forEach(([key, label], i) =>
      this.ui.button(
        `nav-${key}`,
        label!,
        96 + i * 300,
        205,
        280,
        68,
        () => {
          this.cardPage = 0;
          this.cardSelected = 0;
          if (key === "camp") this.camp();
          else if (key === "calendar") this.calendar();
          else this.cards(key as "board" | "journal");
        },
        { kind: "tab", selected: key === id },
      ),
    );
    this.ui.button(
      "settings",
      "Pause",
      1644,
      205,
      180,
      68,
      () => void this.pause(),
    );
    this.ui.onBack = () => void this.pause();
  }
  private camp() {
    if (this.view.season.complete) {
      this.chapter();
      return;
    }
    this.campHeader("camp", "Within the wards");
    const u = this.ui,
      v = this.view;
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
          this.selected = p.id;
          this.camp();
        },
        {
          selected: this.selected === p.id,
          subtitle:
            p.id === v.location
              ? "You are here"
              : p.isOpen
                ? `${p.cost} time to reach`
                : `Opens ${p.open.join(" / ")}`,
          tooltip: p.description,
        },
      );
    }
    const p = v.places.find((p) => p.id === this.selected) ?? v.places[0]!;
    u.panel(96, 806, 1728, 72, "button.normal");
    u.text(p.name, 134, 825, 28, colours.gold, 265);
    u.text(p.description, 430, 818, 24, colours.text, 940);
    const allowed =
      !v.listening &&
      !v.nightFinished &&
      p.isOpen &&
      p.cost <= v.budget &&
      !v.player.stocks;
    u.button(
      "visit-place",
      p.id === v.location ? "Enter this place" : `Travel  /  ${p.cost} time`,
      1440,
      808,
      350,
      68,
      () => {
        this.visitPage = 0;
        if (p.id === v.location) this.visit();
        else void this.command({ type: "travel", place: p.id });
      },
      { disabled: p.id !== v.location && !allowed },
    );
    this.timeFooter();
    u.end(`place-${this.selected}`);
  }
  private timeFooter() {
    const u = this.ui,
      v = this.view;
    u.panel(96, 892, 1380, 134);
    u.text(
      `${v.player.name}   /   ${v.player.gold} gold   /   ${v.season.renown} renown   /   ${v.player.fatigue} fatigue`,
      120,
      908,
      26,
      colours.text,
      1200,
    );
    for (const [i, slot] of ["day", "dusk", "night"].entries()) {
      u.text(
        `${slot === v.slot ? "◆  " : "○  "}${slot.toUpperCase()}`,
        120 + i * 220,
        960,
        28,
        slot === v.slot ? colours.water : colours.muted,
      );
    }
    u.text(`${v.budget} TIME LEFT`, 940, 960, 28, colours.gold, 450);
    if (v.season.due === "trial")
      u.button(
        "trial-summons",
        "Tent Trial",
        1500,
        892,
        324,
        134,
        () => this.trial(),
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
        () => this.compose("season"),
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
        () => this.listen(),
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
        () => void this.command({ type: v.nightFinished ? "dawn" : "wait" }),
        {
          subtitle: v.nightFinished
            ? "Read the Hollow Board"
            : "Spend this time slot",
          disabled: v.settling || v.parley.pending,
        },
      );
  }
  private async command(command: CampCommand) {
    await this.run(async () => {
      this.view = await request<SeasonView>("command", {
        command,
        revision: this.view.revision,
      });
      if (command.type === "travel") {
        this.selected = this.view.location;
        this.visit();
      } else if (command.type === "listen") this.listen();
      else if (command.type === "dawn") {
        this.cardPage = 0;
        this.cardSelected = 0;
        this.cards("board");
      } else this.camp();
    });
  }
  private visit() {
    const u = this.ui,
      v = this.view,
      p = v.places.find((p) => p.id === v.location)!;
    this.campHeader("visit", p.name);
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
      v.budget >= v.actionCost &&
      !v.player.stocks
    )
      actions.push({
        id: "listen",
        label: "Listen at the tent flap",
        subtitle: "Follow the voices. Hide from the Vigil.",
        run: () => void this.command({ type: "listen" }),
      });
    for (const m of v.parley.moments)
      actions.push({
        id: `parley-${m.target}`,
        label: `Speak with ${m.name}`,
        subtitle: "A Knowing gives your words weight.",
        run: () => {
          this.parleyText = "";
          this.parleyApproach = 0;
          this.parley(m);
        },
      });
    for (const a of v.actions)
      actions.push({
        id: `action-${a.id}`,
        label: a.label,
        subtitle: a.gains,
        run: () => void this.command({ type: "act", action: a.id }),
      });
    u.text("CHOOSE A MOMENT", 712, 314, 26, colours.gold);
    u.text(
      "An activity ends this time slot.",
      712,
      354,
      30,
      colours.muted,
      1000,
    );
    actions.slice(this.visitPage * 4, this.visitPage * 4 + 4).forEach((a, i) =>
      u.button(a.id, a.label, 704, 419 + i * 110, 1120, 94, a.run, {
        subtitle: a.subtitle,
        disabled: v.settling || v.parley.pending || v.nightFinished,
      }),
    );
    if (!actions.length)
      u.text(
        "Nothing calls for your time here.\nReturn to the map or let the slot pass.",
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
          this.visitPage--;
          this.visit();
        },
        { disabled: this.visitPage === 0 },
      );
      u.button(
        "actions-next",
        "More activities",
        966,
        798,
        320,
        68,
        () => {
          this.visitPage++;
          this.visit();
        },
        { disabled: (this.visitPage + 1) * 4 >= actions.length },
      );
    }
    this.timeFooter();
    u.end();
  }
  private calendar() {
    this.campHeader("calendar", "One season. Six Games.");
    const u = this.ui,
      v = this.view;
    u.panel(96, 307, 1220, 554);
    u.text("THE ROAD THROUGH THE COLLAR", 132, 336, 26, colours.gold);
    for (let week = 0; week < 6; week++) {
      const y = 392 + week * 70;
      u.text(`WEEK ${week + 1}`, 132, y + 16, 26, colours.muted);
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
        if (date % 7 === 0) u.icon("water", x + 85, y + 29, 14);
        else if (date % 7 === 6) u.icon("earth", x + 85, y + 29, 14);
      }
    }
    u.panel(1350, 307, 474, 554);
    u.text("THE NEXT SUMMONS", 1382, 347, 26, colours.gold);
    u.text("Tent Trial", 1382, 406, 40, colours.text, 400, true);
    u.text(
      "On the eve of the Games, earn the right to carry your tent into the arena.",
      1382,
      470,
      32,
      colours.muted,
      405,
    );
    u.text("Games on days 7 and 14", 1382, 644, 30, colours.water, 405);
    u.text(
      "Later weeks await the next chapter.",
      1382,
      716,
      30,
      colours.muted,
      405,
    );
    this.timeFooter();
    u.end("nav-calendar");
  }
  private cards(kind: "board" | "journal") {
    this.campHeader(
      kind,
      kind === "board" ? "The Hollow Board" : "What you carry",
    );
    const u = this.ui,
      v = this.view;
    const cards =
      kind === "board"
        ? v.board.map((b) => ({
            id: b.factId,
            text: b.text,
            rumour: b.rumour,
            visibility: "public",
          }))
        : v.journal;
    const page = cards.slice(this.cardPage * 4, this.cardPage * 4 + 4);
    u.text(
      kind === "board" ? "DEEDS, WHISPERS AND WITNESSES" : "PRIVATE KNOWINGS",
      96,
      307,
      24,
      colours.gold,
    );
    page.forEach((c, i) => {
      const index = this.cardPage * 4 + i;
      u.button(
        `card-${index}`,
        c.text.length > 88 ? c.text.slice(0, 85) + "…" : c.text,
        96,
        354 + i * 125,
        766,
        112,
        () => {
          this.cardSelected = index;
          this.cards(kind);
        },
        {
          selected: this.cardSelected === index,
          fontSize: 28,
          kind: c.rumour ? "card.warning" : "card.normal",
          tooltip: c.rumour
            ? "A rumour is not a witnessed fact."
            : "Choose to read the full account.",
        },
      );
    });
    const card = cards[this.cardSelected];
    u.panel(900, 307, 924, 554, "panel.story");
    const subject = art.manifest?.characters.find(
      (c) =>
        card?.text.includes(c.name) ||
        card?.text.includes(c.name.split(" ")[0]!),
    );
    if (kind === "journal" && subject)
      portrait(u, subject.id, "neutral", 946, 410, 205, 256);
    else picture(u, `story.${storyFor(card?.text ?? "")}`, 946, 410, 270, 176);
    u.text(
      card?.rumour ? "A RUMOUR" : "A THREAD IN THE CAMP",
      950,
      355,
      26,
      card?.rumour ? colours.danger : colours.gold,
      750,
    );
    u.text(
      card?.text ??
        (kind === "board"
          ? "The board waits for the first morning. Tonight’s choices will leave their marks here."
          : "Some truths arrive softly. Listen at the tent flap, build trust, and keep what you learn."),
      1246,
      416,
      30,
      colours.text,
      526,
    );
    u.text(
      kind === "board"
        ? "Public words carry farther than their authors."
        : "Knowing opens a Parley when the right person is present.",
      940,
      752,
      28,
      colours.muted,
      830,
    );
    u.button(
      "cards-previous",
      "Previous",
      96,
      870,
      236,
      68,
      () => {
        this.cardPage--;
        this.cards(kind);
      },
      { disabled: this.cardPage === 0 },
    );
    u.button(
      "cards-next",
      "Next",
      352,
      870,
      236,
      68,
      () => {
        this.cardPage++;
        this.cards(kind);
      },
      { disabled: (this.cardPage + 1) * 4 >= cards.length },
    );
    u.text(
      `${this.cardPage + 1} / ${Math.max(1, Math.ceil(cards.length / 4))}`,
      630,
      887,
      26,
      colours.muted,
    );
    if (kind === "journal")
      u.button("journal-cast", "People of the camp", 900, 870, 500, 68, () =>
        this.castJournal(),
      );
    this.back(() => this.camp(), "Camp map");
    this.footer(
      kind === "board"
        ? "A rumour remains a rumour. Choose a card to read it."
        : "Private knowledge stays with you across the season.",
    );
    u.end(`card-${this.cardSelected}`);
  }
  private castJournal() {
    this.campHeader("cast", "Those beneath the collar");
    const u = this.ui,
      cast = art.manifest?.characters ?? [];
    u.text("FACES IN YOUR JOURNAL", 96, 300, 24, colours.gold);
    cast.slice(this.castPage * 8, this.castPage * 8 + 8).forEach((c, i) => {
      const x = 96 + (i % 4) * 440,
        y = 354 + Math.floor(i / 4) * 238;
      u.button(
        `cast-${c.id}`,
        "",
        x,
        y,
        408,
        214,
        () => this.castDetails(c.id),
        { kind: "card.normal", tooltip: c.name },
      );
      portrait(u, c.id, "neutral", x + 26, y + 29, 118, 148);
      u.text(c.name, x + 164, y + 39, 28, colours.text, 212);
      u.text(friendly(c.school), x + 164, y + 143, 24, colours.gold, 212);
    });
    u.button(
      "cast-previous",
      "Previous",
      96,
      846,
      236,
      68,
      () => {
        this.castPage--;
        this.castJournal();
      },
      { disabled: this.castPage === 0 },
    );
    u.button(
      "cast-next",
      "More people",
      352,
      846,
      280,
      68,
      () => {
        this.castPage++;
        this.castJournal();
      },
      { disabled: (this.castPage + 1) * 8 >= cast.length },
    );
    this.back(() => this.cards("journal"), "Journal");
    this.footer();
    u.end();
  }
  private castDetails(id: string) {
    const c = art.manifest?.characters.find((c) => c.id === id);
    if (!c) return;
    this.scene("cast-detail", c.name, "YOUR JOURNAL");
    portrait(this.ui, c.id, "neutral", 140, 268, 476, 596);
    this.ui.panel(720, 270, 1104, 594, "panel.story");
    this.ui.text(friendly(c.school), 774, 320, 40, colours.gold, 990, true);
    const known = this.view.journal.filter(
      (f) => f.text.includes(c.name) || f.text.includes(c.name.split(" ")[0]!),
    );
    const presence = this.view.presence.find((p) => p.id === id);
    this.ui.text(
      presence
        ? `Here with you at ${this.view.places.find((p) => p.id === this.view.location)?.name}.`
        : "Another life within the wards.",
      774,
      406,
      30,
      colours.muted,
      990,
    );
    this.ui.text(
      known[0]?.text ??
        "No private Knowing recorded. Listen, visit, and let the camp reveal its people.",
      774,
      499,
      34,
      colours.text,
      990,
    );
    this.back(() => this.castJournal(), "People");
    this.footer();
    this.ui.end();
  }
  private listen() {
    const u = this.ui;
    this.scene(
      "listen",
      "Beyond the tent flap",
      "NIGHT  /  FOLLOW THE VOICES",
      "place-tent",
    );
    this.lane = this.view.listening?.lane ?? 0;
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
    for (let i = 0; i < this.view.listeningRules.lanes; i++)
      u.button(
        `lane-${i}`,
        `Cover ${i + 1}`,
        190 + i * 530,
        660,
        480,
        82,
        () => {
          this.lane = i;
          void this.control();
        },
        { subtitle: "A / D or 1–3 changes cover" },
      );
    u.button("listen-hold", "Hold Listen", 1360, 946, 464, 68, () => {}, {
      hold: (value) => {
        this.held = value;
        void this.control();
      },
    });
    this.back(() => {
      this.held = false;
      void this.control();
      this.camp();
    }, "Camp map");
    this.footer("SPACE held  Listen     A / D  Move     Release SPACE  Hide");
    u.onKey = (e) => {
      if (e.repeat) return e.code === "Space";
      if (e.code === "Space") {
        this.held = true;
        void this.control();
        return true;
      }
      if (["KeyA", "KeyD", "Digit1", "Digit2", "Digit3"].includes(e.code)) {
        this.lane = Math.max(
          0,
          Math.min(
            2,
            e.code === "KeyA"
              ? this.lane - 1
              : e.code === "KeyD"
                ? this.lane + 1
                : Number(e.code.at(-1)) - 1,
          ),
        );
        void this.control();
        return true;
      }
      return false;
    };
    this.updateListening = () => {
      const n = this.view.listening;
      if (!n) return;
      stage.clear();
      for (let i = 0; i < 3; i++) {
        const x = 430 + i * 530;
        stage
          .ellipse(x, 530, 190, 75)
          .fill({ color: colours.panel, alpha: 0.9 })
          .stroke({
            color: this.lane === i ? colours.water : colours.edge,
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
        : `${n.clues} / ${this.view.listeningRules.requiredClues} fragments heard`;
      progress.text = `${n.alerts} moments exposed to the Vigil${n.done ? "  /  The night is complete" : ""}`;
      if (n.done) {
        this.held = false;
        const b = u.buttons.find((b) => b.id === "listen-hold");
        if (b) {
          b.hold = undefined;
          b.activate = () => void this.command({ type: "dawn" });
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
            () => void this.command({ type: "dawn" }),
          );
        }
      }
    };
    this.updateListening();
    u.end("listen-hold");
  }
  private async control() {
    if (!this.view.listening || this.view.nightFinished) return;
    try {
      await request("input", {
        lane: this.lane,
        listening: this.held,
        day: this.view.day.day,
      });
    } catch {
      this.held = false;
    }
  }
  private parley(moment: Moment) {
    this.currentMoment = moment;
    const u = this.ui;
    this.scene("parley", `Speak with ${moment.name}`, "A KNOWING MOMENT");
    u.panel(96, 226, 790, 658);
    portrait(u, moment.target, "neutral", 136, 252, 140, 175);
    u.text("WHAT YOU KNOW", 308, 255, 26, colours.gold);
    u.text(moment.cards[0]!.knowing, 308, 300, 28, colours.text, 526);
    moment.cards.forEach((card, i) =>
      u.button(
        `parley-card-${i}`,
        card.title,
        128,
        435 + i * 145,
        726,
        132,
        () => void this.speak({ target: moment.target, cardId: card.id }),
        {
          subtitle: card.text,
          fontSize: 30,
          selected: i === this.parleyApproach,
        },
      ),
    );
    u.panel(920, 226, 904, 658);
    u.text("SPEAK IN YOUR OWN WORDS", 956, 257, 26, colours.gold);
    u.button(
      "parley-approach",
      `Approach: ${moment.cards[this.parleyApproach]!.title}`,
      952,
      310,
      832,
      76,
      () => {
        this.parleyApproach = (this.parleyApproach + 1) % moment.cards.length;
        this.parley(moment);
      },
      {
        tooltip:
          "Your selected approach carries the conversation if a reply cannot reach you.",
      },
    );
    u.button(
      "parley-text",
      "",
      952,
      412,
      832,
      252,
      () => {
        if (this.ui.modality === "gamepad") {
          this.letterBoard();
          return;
        }
        this.typing = true;
        this.ui.focus = "parley-text";
        this.textDisplay!.text = this.parleyText || "Type your words…";
      },
      { tooltip: "Enter to write. Escape ends text entry." },
    );
    this.textDisplay = u.text(
      this.parleyText || "Choose here to write your appeal…",
      976,
      436,
      32,
      colours.text,
      784,
    );
    u.text(
      "Speaking ends this slot. Your approach carries the reply\nwhen words cannot reach the camp.",
      956,
      693,
      28,
      colours.muted,
      822,
    );
    u.button(
      "parley-speak",
      "Speak",
      952,
      790,
      400,
      68,
      () => {
        if (!this.parleyText.trim()) {
          this.typing = true;
          u.focus = "parley-text";
          return;
        }
        void this.speak({
          target: moment.target,
          cardId: moment.cards[this.parleyApproach]!.id,
          text: this.parleyText,
        });
      },
      { icon: "water" },
    );
    u.button(
      "parley-keyboard",
      "Letter board",
      1376,
      790,
      408,
      68,
      () => this.letterBoard(),
      { tooltip: "Compose words with the controller or arrow keys." },
    );
    this.back(() => {
      this.typing = false;
      this.visit();
    });
    this.footer("Once each day, a Knowing gives your words weight.");
    u.onKey = (e) => {
      if (!this.typing) return false;
      if (e.code === "Escape" || e.code === "Tab") {
        this.typing = false;
        return true;
      }
      if (e.code === "Backspace")
        this.parleyText = Array.from(this.parleyText).slice(0, -1).join("");
      else if (
        e.key.length === 1 &&
        Array.from(this.parleyText).length < this.view.parley.maxTextChars
      )
        this.parleyText += e.key;
      else if (e.code === "Enter") this.typing = false;
      else return true;
      this.textDisplay!.text = this.parleyText || "Type your words…";
      return true;
    };
    u.end();
  }
  private letterBoard() {
    const u = this.ui;
    this.typing = false;
    this.scene("keyboard", "Choose your words", "PARLEY  /  LETTER BOARD");
    u.panel(96, 221, 1728, 160);
    this.textDisplay = u.text(
      this.parleyText || "Your words begin here.",
      128,
      253,
      34,
      colours.text,
      1650,
    );
    const rows = ["ABCDEFGHIJ", "KLMNOPQRST", "UVWXYZ.,?!"];
    rows.forEach((row, i) =>
      [...row].forEach((ch, j) =>
        u.button(
          `letter-${ch}`,
          ch,
          110 + j * 172,
          432 + i * 104,
          152,
          84,
          () => {
            if (
              Array.from(this.parleyText).length < this.view.parley.maxTextChars
            )
              this.parleyText += ch.toLowerCase();
            this.textDisplay!.text = this.parleyText;
          },
          { fontSize: 36 },
        ),
      ),
    );
    u.button("letter-space", "Space", 110, 764, 500, 80, () => {
      if (Array.from(this.parleyText).length < this.view.parley.maxTextChars)
        this.parleyText += " ";
      this.textDisplay!.text = this.parleyText;
    });
    u.button("letter-delete", "Delete", 636, 764, 500, 80, () => {
      this.parleyText = Array.from(this.parleyText).slice(0, -1).join("");
      this.textDisplay!.text = this.parleyText;
    });
    u.button("letter-done", "Done", 1162, 764, 500, 80, () =>
      this.parley(this.currentMoment!),
    );
    this.back(() => this.parley(this.currentMoment!));
    this.footer();
    u.end("letter-A");
  }
  private async speak(input: ParleyInput) {
    this.typing = false;
    await this.run(async () => {
      this.ui.notice("They weigh your words. The lantern burns between you.");
      this.view = await request<SeasonView>("parley", {
        input,
        revision: this.view.revision,
      });
      const r = this.view.parley.last!;
      this.scene("parley-result", `${r.name} answers`, "A MOMENT BETWEEN YOU");
      this.ui.panel(300, 276, 1320, 574, "panel.story");
      portrait(
        this.ui,
        input.target,
        r.trustDelta > 0 ? "calm" : r.trustDelta < 0 ? "angry" : "neutral",
        354,
        328,
        240,
        300,
      );
      this.ui.text(`“${r.reply}”`, 640, 335, 40, colours.text, 900);
      this.ui.text(
        r.trustDelta
          ? `${r.trustDelta > 0 ? "+" : ""}${r.trustDelta} trust toward you.`
          : r.revealed
            ? `A new Knowing: ${r.revealed}`
            : r.effect === "flip_next_intent"
              ? "They will attempt a friendly act toward you tonight."
              : "They keep their own counsel.",
        366,
        632,
        32,
        colours.water,
        1180,
      );
      this.ui.text(
        "The moment has passed. The camp remembers.",
        366,
        755,
        30,
        colours.muted,
        1180,
      );
      this.back(() => this.camp(), "Return to camp");
      this.footer();
      this.ui.end("back");
    });
  }
  private trial() {
    const u = this.ui,
      v = this.view,
      t = v.season.trial;
    this.scene(
      "trial",
      "Who carries the Tide?",
      "GAMES EVE  /  TENT TRIAL",
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
        u.text(
          `Their stance: ${t.tell}`,
          886,
          508,
          44,
          colours.water,
          900,
          true,
        );
        bridgeRules.trial.stances.forEach((stance, i) =>
          u.button(
            `trial-${stance}`,
            friendly(stance),
            886 + i * 312,
            659,
            290,
            120,
            () =>
              void this.seasonAction(
                {
                  type: "exchange",
                  stance: stance as "press" | "brace" | "feint",
                },
                () => this.trial(),
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
          () =>
            void this.seasonAction({ type: "receive-trial" }, () =>
              this.camp(),
            ),
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
          void this.run(async () => {
            if (this.view.location !== "pit")
              this.view = await seasonCommand({ type: "escort-trial" });
            this.view = await seasonCommand({ type: "trial" });
            this.trial();
          }),
        { subtitle: "The elder watches. Read your rival." },
      );
    this.back(() => this.camp(), "Camp map");
    this.footer();
    u.end();
  }
  private async seasonAction(command: SeasonCommand, after: () => void) {
    await this.run(async () => {
      this.view = await seasonCommand(command);
      after();
    });
  }
  private compose(destination: string, initial: Composition = presets[0]!) {
    const choice = structuredClone(initial),
      u = this.ui;
    let selectedLine = 0;
    const draw = () => {
      this.scene(
        "composition",
        "Compose your Water",
        "BEFORE THE COLLAR OPENS",
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
          346,
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
          x + 390,
          476,
          142,
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
        u.panel(x, 695, 416, 181);
        u.text(
          `${["I", "II", "III", "IV"][i]}  /  ${combat.tierClock.unlockAtSeconds[tier as 1 | 2 | 3 | 4]}s`,
          x + 24,
          713,
          24,
          colours.gold,
        );
        u.text(s.name, x + 24, 754, 32, colours.text, 364);
        u.text(
          s.kind === "passive"
            ? "Perfect absorb counter"
            : `${s.mana} mana  /  ${s.cooldownS}s cooldown`,
          x + 24,
          829,
          24,
          colours.muted,
          364,
        );
      });
      this.back(() =>
        destination === "season" ? this.camp() : this.training(),
      );
      this.footer(
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
          void this.run(async () => {
            const errors = validateComposition(choice);
            if (errors.length) throw Error(errors.join(" "));
            if (destination === "season") {
              await seasonCommand({ type: "prepare", composition: choice });
              await seasonCommand({ type: "start" });
              await this.continue();
            } else {
              this.arena?.dispose();
              this.arena = new ArenaGame(
                u,
                () => void this.pause(),
                () => this.results(),
              );
              this.arena.composition = structuredClone(choice);
              if (destination === "tiro") this.arena.startGames();
              else if (destination.startsWith("enemy:"))
                this.arena.startRoster(destination.slice(6));
              else {
                this.arena.restart(destination as TrainingKind);
                this.arena.hud();
              }
              history.replaceState(null, "", `/training${location.search}`);
            }
          }),
      );
      u.end();
    };
    draw();
  }
  private training(page = 0) {
    this.scene(
      "training",
      "The proving ground",
      "PRACTICE  /  NO SEASON STAKES",
    );
    const u = this.ui;
    const entries = [
      {
        id: "magic",
        name: "Magic thrower",
        hint: "Face the light. Time the ward.",
      },
      {
        id: "physical",
        name: "Steel from the side",
        hint: "Steel cannot be absorbed. Roll clear.",
      },
      {
        id: "flanker",
        name: "Alternating flanks",
        hint: "Turn to meet the next spell.",
      },
      {
        id: "charge",
        name: "Unblockable lane",
        hint: "Leave the mark before it resolves.",
      },
      {
        id: "stream",
        name: "Three-bolt stream",
        hint: "Keep the ward up through a volley.",
      },
      {
        id: "tiro",
        name: "Tiro Games",
        hint: "Four bouts. The collar begins anew.",
      },
      ...enemyRoster.map((e) => ({
        id: `enemy:${e.id}`,
        name: e.name,
        hint: "Face this opponent in isolation.",
      })),
    ];
    entries
      .slice(page * 6, page * 6 + 6)
      .forEach((e, i) =>
        u.button(
          `training-${e.id}`,
          e.name,
          96 + (i % 2) * 880,
          269 + Math.floor(i / 2) * 186,
          848,
          156,
          () => this.compose(e.id),
          { subtitle: e.hint, icon: i % 2 ? "earth" : "water" },
        ),
      );
    u.button(
      "training-previous",
      "Previous",
      96,
      848,
      280,
      68,
      () => this.training(page - 1),
      { disabled: page === 0 },
    );
    u.button(
      "training-next",
      "More opponents",
      400,
      848,
      380,
      68,
      () => this.training(page + 1),
      { disabled: (page + 1) * 6 >= entries.length },
    );
    this.back(() => this.menu(), "Main menu");
    this.footer("Choose a lesson, compose your spells, and enter.");
    u.end();
  }
  private results() {
    const a = this.arena!,
      g = a.games,
      u = this.ui,
      intermission = g?.phase === "intermission";
    u.begin("results");
    u.panel(358, 245, 1204, 610, "panel.modal");
    u.text(
      intermission
        ? "THE NEXT GATE WAITS"
        : g?.result?.finalWon
          ? "THE TIRO GAMES ARE YOURS"
          : "THE CROWD GRANTS YOUR LIFE",
      420,
      290,
      26,
      colours.gold,
      1080,
    );
    u.text(
      intermission
        ? "Bout won"
        : g?.result?.finalWon
          ? "Tiro victor"
          : "Missio",
      420,
      353,
      76,
      colours.text,
      1070,
      true,
    );
    u.icon("water", 1400, 399, 64);
    u.text(
      intermission
        ? "Recover, then take your place beyond the next grille."
        : g?.result
          ? `${g.result.wavesCleared} bouts won  /  ${g.result.gold} gold  /  ${g.result.renown} renown`
          : "The ward yields. Take what you learned back to the proving ground.",
      420,
      482,
      36,
      colours.text,
      1070,
    );
    u.text(
      a.season?.bout.spectator
        ? "You watched your tent entrant. No player payout."
        : intermission
          ? "The next bout resets mana, stamina and the collar."
          : "Your life is spared. The camp will hear of this.",
      420,
      590,
      30,
      colours.muted,
      1070,
    );
    u.button(
      intermission ? "next-bout" : a.season ? "return-camp" : "return-training",
      intermission
        ? "Enter the next bout"
        : a.season
          ? "Return to camp"
          : "Return to practice",
      420,
      710,
      600,
      88,
      () =>
        void this.run(async () => {
          if (intermission) await a.next();
          else if (a.season) {
            await a.flush();
            await a.season.finish();
          } else {
            a.dispose();
            this.arena = undefined;
            this.training();
          }
        }),
    );
    u.button(
      "result-settings",
      "Save / settings",
      1050,
      710,
      450,
      88,
      () => void this.pause(),
    );
    u.onBack = () => void this.pause();
    u.end();
  }
  private async pause() {
    if (["pause", "settings", "saves"].includes(this.ui.screen)) return;
    this.returnScreen = this.ui.screen;
    this.arena?.pause(true);
    this.held = false;
    await this.control();
    await this.run(async () => {
      await this.arena?.flush();
      this.view = await request<SeasonView>("pause", { paused: true });
      this.pauseScreen();
    });
  }
  private pauseScreen() {
    this.scene("pause", "The world can wait", "PAUSED");
    const u = this.ui;
    u.panel(520, 245, 880, 624, "panel.modal");
    u.button(
      "resume",
      "Return to the moment",
      580,
      294,
      760,
      90,
      () => void this.run(() => this.resume()),
      { icon: "water" },
    );
    u.button("open-settings", "Settings & controls", 580, 412, 760, 90, () =>
      this.settings(),
    );
    u.button("open-saves", "Save & load", 580, 530, 760, 90, () =>
      this.saves(),
    );
    u.button(
      "main-menu",
      "Main menu",
      580,
      648,
      760,
      90,
      () =>
        void this.run(async () => {
          await this.arena?.flush();
          this.arena?.dispose();
          this.arena = undefined;
          this.menu();
        }),
    );
    u.text(
      "The collar and the camp are still.",
      580,
      790,
      30,
      colours.muted,
      760,
    );
    u.onBack = () => void this.run(() => this.resume());
    u.end("resume");
  }
  private settings() {
    this.scene("settings", "Your hands. Your magic.", "PAUSED  /  SETTINGS");
    const u = this.ui;
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
    u.button(
      "sound",
      `Absorb bell: ${localStorage.getItem("mage-sound") === "off" ? "Off" : "On"}`,
      1240,
      242,
      584,
      98,
      () => {
        localStorage.setItem(
          "mage-sound",
          localStorage.getItem("mage-sound") === "off" ? "on" : "off",
        );
        this.settings();
      },
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
          localStorage.getItem("mage-motion") === "reduced"
            ? "full"
            : "reduced",
        );
        this.settings();
      },
    );
    u.text(
      "Aim at the feet. The camera stays fixed until you approach an edge.\n\nMagic can be absorbed. Steel and unblockable marks must be escaped.",
      1256,
      643,
      32,
      colours.muted,
      548,
    );
    this.back(() => this.pauseScreen());
    this.footer();
    u.end();
  }
  private async openSaves(from: string) {
    this.returnScreen = from;
    await this.run(async () => {
      await request("pause", { paused: true });
      this.saves();
    });
  }
  private saves(message = "") {
    this.scene("saves", "A thread held in time", "PAUSED  /  SAVE & LOAD");
    const u = this.ui;
    u.panel(96, 252, 1728, 596);
    u.icon("mirror", 228, 395, 70);
    u.text(
      `Day ${this.view.day.day}  /  ${friendly(this.view.slot)}`,
      365,
      306,
      48,
      colours.text,
      1250,
      true,
    );
    u.text(
      `${this.view.player.name}  /  ${this.view.player.gold} gold  /  ${this.view.season.renown} renown`,
      365,
      387,
      32,
      colours.muted,
      1200,
    );
    u.text(
      this.arena?.season
        ? "Your accepted arena checkpoint will be held with the season."
        : this.arena
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
        void this.run(async () => {
          await this.arena?.flush();
          await request("save", {});
          this.saves("Season saved. Your thread is held.");
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
      () => void this.load(false),
    );
    u.button(
      "load-previous",
      "Recover previous",
      1268,
      614,
      506,
      98,
      () => void this.load(true),
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
    this.back(() =>
      this.returnScreen === "menu" ? this.menu() : this.pauseScreen(),
    );
    u.button(
      "resume-loaded",
      "Resume",
      1444,
      946,
      380,
      68,
      () => void this.run(() => this.resume()),
    );
    this.footer();
    u.end();
  }
  private async load(previous: boolean) {
    await this.run(async () => {
      this.arena?.pause(true);
      await this.arena?.flush();
      this.view = await request<SeasonView>(
        previous ? "load-previous" : "load",
        {},
      );
      this.arena?.dispose();
      this.arena = undefined;
      await this.continue(true);
      this.returnScreen = this.arena ? "arena" : "camp";
      this.saves("Save loaded. Resume when ready.");
    });
  }
  private async resume() {
    await request("pause", { paused: false });
    this.view = await request<SeasonView>("session");
    if (this.arena) {
      if (this.arena.games && this.arena.games.phase !== "active")
        this.results();
      else {
        this.arena.pause(false);
        this.arena.hud();
      }
    } else if (this.returnScreen === "menu") this.menu();
    else this.redraw(this.returnScreen);
  }
  private chapter() {
    this.scene("chapter", "Two weeks survived", "THE FIRST CHAPTER");
    portrait(this.ui, "cassia", "calm", 1150, 262, 540, 610);
    this.ui.text(
      "The Tide has a place in the camp.\nYour board and journal remember the path here.",
      120,
      320,
      46,
      colours.text,
      1100,
    );
    this.ui.text(
      `${this.view.season.receipts.length} recorded Trials and Games\n${this.view.player.gold} gold  /  ${this.view.season.renown} renown`,
      120,
      511,
      36,
      colours.water,
      1100,
    );
    this.ui.button(
      "chapter-board",
      "Read the Hollow Board",
      120,
      729,
      650,
      92,
      () => this.cards("board"),
    );
    this.ui.button(
      "chapter-journal",
      "Open your journal",
      120,
      841,
      650,
      92,
      () => this.cards("journal"),
    );
    this.ui.button(
      "chapter-save",
      "Save / settings",
      1330,
      946,
      494,
      68,
      () => void this.pause(),
    );
    this.ui.onBack = () => void this.pause();
    this.ui.end();
  }
  private redraw(screen = this.ui.screen) {
    if (screen === "visit") this.visit();
    else if (screen === "calendar") this.calendar();
    else if (screen === "board" || screen === "journal") this.cards(screen);
    else if (screen === "trial") this.trial();
    else if (screen === "listen") this.listen();
    else this.camp();
  }
  dispose() {
    this.disposed = true;
    clearInterval(this.poll);
    this.lifetime.abort();
    this.arena?.dispose();
    this.ui.dispose();
  }
}
