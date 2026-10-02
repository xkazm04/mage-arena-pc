import {
  Application,
  Container,
  Graphics,
  NineSliceSprite,
  Sprite,
  Text,
} from "pixi.js";
import type { CampView } from "@mage/core";
import type { CampAssets } from "./assets.ts";

export type Scene = "map" | "visit" | "board" | "journal" | "listen";
export interface Presentation {
  scene: Scene;
  selected: string;
  page: number;
  selectedCard: number;
  read: Set<string>;
}
const W = 1280,
  H = 720;
const ink = 0x38291e,
  paper = 0xf3e7c7,
  blue = 0x236d84,
  slate = 0x172832,
  gold = 0xb48b47;
const pins: Record<string, [number, number]> = {
  yard: [0.2, 0.34],
  cistern: [0.53, 0.3],
  pit: [0.8, 0.35],
  exchange: [0.18, 0.63],
  commons: [0.43, 0.59],
  door: [0.67, 0.62],
  tent: [0.36, 0.92],
  edge: [0.87, 0.84],
};
export class CampScenes {
  private observer?: ResizeObserver;
  dispose() { this.observer?.disconnect(); this.app.destroy(true, { children: true }); }
  readonly app = new Application();
  readonly root = new Container();
  constructor(
    readonly assets: CampAssets,
    readonly select: (id: string) => void,
    readonly card: (index: number) => void,
    readonly lane: (index: number) => void,
  ) {}
  async init(host: HTMLElement) {
    await this.app.init({
      width: W,
      height: H,
      backgroundColor: slate,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    this.app.stage.addChild(this.root);
    host.append(this.app.canvas);
    this.app.canvas.setAttribute(
      "aria-label",
      "Camp scene. All actions also appear in the controls beside it.",
    );
    this.app.canvas.setAttribute("role", "img");
    this.observer = new ResizeObserver(() => {
      const width = host.clientWidth,
        height = host.clientHeight;
      const scale = Math.min(width / W, height / H);
      this.app.renderer.resize(width, height);
      this.root.scale.set(scale);
      this.root.position.set((width - W * scale) / 2, (height - H * scale) / 2);
    });
    this.observer.observe(host);
  }
  private rect(
    x: number,
    y: number,
    w: number,
    h: number,
    fill: number,
    alpha = 1,
    border?: number,
  ) {
    const g = new Graphics().rect(x, y, w, h).fill({ color: fill, alpha });
    if (border !== undefined) g.stroke({ color: border, width: 2 });
    this.root.addChild(g);
    return g;
  }
  private text(
    text: string,
    x: number,
    y: number,
    size = 18,
    fill = ink,
    width = 0,
    serif = false,
  ) {
    const t = new Text({
      text,
      style: {
        fontFamily: serif ? "Georgia" : "Segoe UI",
        fontSize: size,
        fill,
        wordWrap: width > 0,
        wordWrapWidth: width,
        lineHeight: size * 1.35,
      },
    });
    t.position.set(x, y);
    this.root.addChild(t);
    return t;
  }
  private art(key: string, x = 0, y = 0, w = W, h = H) {
    const texture = this.assets.get(key);
    if (texture) {
      const s = new Sprite(texture);
      s.position.set(x, y);
      s.width = w;
      s.height = h;
      this.root.addChild(s);
    } else {
      this.rect(x, y, w, h, 0xc2ae79);
      for (let i = 0; i < 8; i++)
        this.rect(
          x + w * (i / 8),
          y + h * 0.8,
          w / 10,
          h * 0.15,
          i % 2 ? 0x9c5944 : 0xcdbb8f,
        );
    }
  }
  draw(view: CampView, ui: Presentation) {
    for (const child of this.root.removeChildren())
      child.destroy({ children: true });
    if (ui.scene === "map") this.map(view, ui);
    else if (ui.scene === "visit") this.visit(view);
    else if (ui.scene === "listen") this.listen(view);
    else this.cards(view, ui);
  }
  private map(v: CampView, ui: Presentation) {
    this.art("map");
    if (v.slot !== "day")
      this.rect(
        0,
        0,
        W,
        H,
        v.slot === "night" ? 0x0a1930 : 0x873a1e,
        v.slot === "night" ? 0.66 : 0.22,
      );
    for (const p of v.places) {
      const [nx, ny] = p.position,
        [lx, ly] = pins[p.id];
      const x = (nx / 1000) * W,
        y = (ny / 600) * H,
        labelX = lx * W,
        labelY = ly * H;
      this.root.addChild(
        new Graphics()
          .moveTo(x, y)
          .lineTo(labelX, labelY)
          .stroke({ color: paper, width: 2, alpha: 0.8 }),
      );
      this.root.addChild(
        new Graphics()
          .circle(x, y, p.id === v.location ? 9 : 6)
          .fill(p.id === v.location ? 0x9dd5cf : gold)
          .stroke({ color: paper, width: 2 }),
      );
      const selected = ui.selected === p.id;
      const box = this.rect(
        labelX - 87,
        labelY - 30,
        174,
        60,
        selected ? 0xfff4d7 : p.isOpen ? paper : 0xd7c9a7,
        0.98,
        selected ? blue : ink,
      );
      box.eventMode = "static";
      box.cursor = "pointer";
      box.on("pointertap", () => this.select(p.id));
      const title = this.text(p.name, labelX - 77, labelY - 25, 18);
      title.eventMode = "none";
      const status = this.text(
        p.id === v.location
          ? "YOU ARE HERE"
          : !p.isOpen
            ? `Opens ${p.open.join(" / ")}`
            : `${p.cost} travel · ${p.cost + v.actionCost} with visit`,
        labelX - 77,
        labelY + 2,
        12,
        selected ? blue : ink,
      );
      status.eventMode = "none";
    }
    this.rect(18, 18, 338, 57, slate, 0.92);
    this.art(`icon-${v.slot}`, 29, 31, 32, 32);
    this.text(`${v.slot.toUpperCase()} / WITHIN THE WARDS`, 73, 28, 17, paper);
    this.text("A place, a choice, a consequence.", 73, 51, 12, 0xcebd93);
  }
  private visit(v: CampView) {
    this.art(`place-${v.location}`);
    this.rect(0, 485, W, 235, slate, 0.91);
    const place = v.places.find((p) => p.id === v.location)!;
    this.text(place.name, 48, 514, 38, paper, 0, true);
    this.text(place.description, 50, 573, 21, paper, 1100);
    this.text(
      v.presence.length
        ? `Here now: ${v.presence.map((p) => p.name).join(" · ")}`
        : "For a moment, you have the place to yourself.",
      50,
      628,
      18,
      0xbdd3cd,
      1120,
    );
  }
  private cards(v: CampView, ui: Presentation) {
    this.rect(0, 0, W, H, slate);
    this.rect(24, 24, W - 48, H - 48, 0x223640, 1, gold);
    this.text(
      ui.scene === "board" ? "The Hollow Board" : "Things you know",
      55,
      46,
      38,
      paper,
      0,
      true,
    );
    this.text(
      ui.scene === "board"
        ? "PUBLIC WORD · WITNESSED DEEDS · RUMOURS"
        : "A PRIVATE JOURNAL / HELD CLOSE",
      58,
      103,
      14,
      0xcab889,
    );
    const cards =
      ui.scene === "board"
        ? v.board.map((b) => ({ ...b, id: b.factId, visibility: "board" }))
        : v.journal;
    const start = ui.page * 6;
    if (!cards.length) {
      this.text(
        ui.scene === "board" ? "No new notices yet." : "No secrets held yet.",
        80,
        265,
        33,
        paper,
        0,
        true,
      );
      this.text(
        "The camp will have more to say at first light.",
        80,
        327,
        21,
        0xcebd93,
      );
    }
    for (const [i, c] of cards.slice(start, start + 6).entries()) {
      const x = 52 + (i % 3) * 396,
        y = 151 + Math.floor(i / 3) * 255;
      const state =
        ui.selectedCard === start + i
          ? "selected"
          : c.rumour
            ? "warning"
            : ui.read.has(c.id)
              ? "ordinary"
              : "unread";
      const texture = this.assets.get(`frame-${state}`);
      if (texture) {
        const frame = new NineSliceSprite({
          texture,
          leftWidth: 24,
          topHeight: 24,
          rightWidth: 24,
          bottomHeight: 24,
        });
        frame.position.set(x, y);
        frame.width = 380;
        frame.height = 235;
        this.root.addChild(frame);
      } else this.rect(x, y, 380, 235, paper, 1, gold);
      const hit = this.rect(x, y, 380, 235, paper, 0);
      hit.eventMode = "static";
      hit.cursor = "pointer";
      hit.on("pointertap", () => this.card(start + i));
      this.text(
        c.rumour
          ? "UNVERIFIED RUMOUR"
          : ui.scene === "journal"
            ? c.visibility.toUpperCase()
            : ui.read.has(c.id)
              ? "READ"
              : "NEW AT DAWN",
        x + 28,
        y + 27,
        13,
        blue,
      );
      this.text(c.text, x + 28, y + 66, 22, ink, 321, true);
    }
  }
  private listen(v: CampView) {
    const n = v.listening;
    this.art("place-tent");
    this.rect(0, 0, W, H, 0x091827, 0.76);
    this.text("Voices beyond the canvas", 48, 37, 39, paper, 0, true);
    this.text(
      "Move between cover. Hold Space to listen where the voices gather.",
      50,
      99,
      19,
      0xbdd3cd,
    );
    if (!n) return;
    const names = ["Basket shadow", "Tent rope", "Low wall"];
    for (let lane = 0; lane < v.listeningRules.lanes; lane++) {
      const x = 66 + lane * 408;
      const here = n.lane === lane,
        voices = n.beacon === lane,
        patrol = n.patrol === lane;
      const panel = this.rect(
        x,
        193,
        330,
        335,
        here ? 0x294b55 : slate,
        0.9,
        here ? 0x9dd5cf : gold,
      );
      panel.eventMode = "static";
      panel.cursor = "pointer";
      panel.on("pointertap", () => this.lane(lane));
      this.text(
        `${lane + 1} / ${names[lane]}`,
        x + 23,
        220,
        24,
        paper,
        280,
        true,
      );
      this.text(
        voices ? "VOICES CARRY HERE" : "Only the canvas stirs",
        x + 23,
        279,
        17,
        voices ? 0x9dd5cf : 0xaaa489,
      );
      this.text(
        patrol
          ? n.warning
            ? "Lantern approaching…"
            : "VIGIL IN SIGHT · KEEP QUIET"
          : "Clear of the lantern",
        x + 23,
        328,
        16,
        patrol ? 0xf2bc87 : 0xbdd3cd,
        285,
      );
      const circle = new Graphics()
        .circle(x + 165, 441, here ? 27 : 13)
        .fill(here ? 0x9dd5cf : 0x4a6263);
      this.root.addChild(circle);
      if (here)
        this.text(
          n.listening ? "LISTENING" : "IN COVER",
          x + 108,
          481,
          16,
          paper,
        );
    }
    this.rect(66, 564, 1146, 18, 0x283e45);
    this.rect(
      66,
      564,
      1146 * Math.min(1, n.progress / v.listeningRules.captureTicks),
      18,
      0x9dd5cf,
    );
    this.text(
      `${n.clues} / ${v.listeningRules.requiredClues} fragments heard`,
      66,
      609,
      24,
      paper,
    );
    this.text(
      n.done
        ? n.learned
          ? "A Knowing for your journal."
          : "The voices have faded."
        : `${n.secondsLeft}s until the camp sleeps`,
      763,
      609,
      24,
      paper,
    );
    this.text(
      "A / D or 1–3: move    ·    Space: hold Listen    ·    Release to stay quiet",
      66,
      663,
      16,
      0xbdd3cd,
    );
  }
}
