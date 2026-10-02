import { Sprite, Texture, Container, Graphics } from "pixi.js";
import { colours } from "./kit.ts";
import type { CanvasUI } from "./ui.ts";

const cache = new Map<string, Texture>();
const locations = [
  [340, 360, 150, 80],
  [650, 345, 120, 90],
  [1030, 375, 165, 110],
  [260, 620, 120, 85],
  [615, 585, 180, 100],
  [1010, 645, 100, 120],
  [480, 790, 160, 65],
  [1150, 790, 100, 60],
];
/** Original procedural environment. D18 rejects the old map; no old A4 pixels. */
function texture(kind: string) {
  const previous = cache.get(kind);
  if (previous) return previous;
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 1080;
  const c = canvas.getContext("2d")!;
  const night = kind.includes("night"),
    camp = kind.startsWith("camp");
  const base = c.createLinearGradient(0, 0, 1920, 1080);
  base.addColorStop(0, "#070e17");
  base.addColorStop(0.55, night ? "#101e32" : "#1d3637");
  base.addColorStop(1, "#070e15");
  c.fillStyle = base;
  c.fillRect(0, 0, 1920, 1080);
  const glow = (x: number, y: number, r: number, colour: string) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, colour);
    g.addColorStop(1, "transparent");
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  };
  glow(1080, 490, 690, night ? "#32517b55" : "#3a786e55");
  glow(1800, 740, 500, "#433e3055");
  if (camp) {
    c.fillStyle = "#14272b";
    c.beginPath();
    c.ellipse(660, 575, 680, 430, -0.05, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#668b7c50";
    c.lineWidth = 25;
    c.stroke();
    c.strokeStyle = "#202e33";
    c.lineWidth = 12;
    c.stroke();
    c.strokeStyle = "#72957d50";
    c.lineWidth = 2;
    c.stroke();
    for (let i = 0; i < 50; i++) {
      const a = (i * Math.PI * 2) / 50;
      const x = 660 + Math.cos(a) * 680,
        y = 575 + Math.sin(a) * 430;
      c.fillStyle = i % 2 ? "#233739" : "#1b2e32";
      c.fillRect(x - 8, y - 32, 16, 35);
      c.fillStyle = "#4a6360";
      c.fillRect(x - 9, y - 35, 18, 5);
    }
    // Roads connect the usable places, not decorative navigation targets.
    c.strokeStyle = "#354341";
    c.lineWidth = 22;
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(480, 790);
    c.lineTo(615, 585);
    c.lineTo(650, 345);
    c.moveTo(340, 360);
    c.lineTo(615, 585);
    c.lineTo(1030, 375);
    c.moveTo(260, 620);
    c.lineTo(615, 585);
    c.lineTo(1010, 645);
    c.lineTo(1150, 790);
    c.stroke();
    c.strokeStyle = "#6d7d6750";
    c.lineWidth = 1;
    c.stroke();
    for (let i = 0; i < locations.length; i++) {
      const [x, y, w, h] = locations[i]!;
      c.save();
      c.translate(x!, y!);
      c.fillStyle = "#040c13aa";
      c.beginPath();
      c.ellipse(28, 38, w! * 0.85, h! * 0.8, -0.1, 0, Math.PI * 2);
      c.fill();
      if (i === 1 || i === 2) {
        c.fillStyle = "#2e4244";
        c.beginPath();
        c.ellipse(0, 5, w! * 0.8, h! * 0.65, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "#6d8577";
        c.lineWidth = 4;
        c.stroke();
        c.fillStyle = i === 1 ? "#286766" : "#18282d";
        c.beginPath();
        c.ellipse(0, 0, w! * 0.6, h! * 0.5, 0, 0, Math.PI * 2);
        c.fill();
        if (i === 1)
          for (let r = 1; r <= 4; r++) {
            c.strokeStyle = "#79bbaa50";
            c.lineWidth = 1;
            c.beginPath();
            c.ellipse(0, 0, w! * 0.12 * r, h! * 0.09 * r, 0, 0, Math.PI * 2);
            c.stroke();
          }
      } else {
        c.fillStyle = "#1b2a31";
        c.fillRect(-w! / 2, -h! / 2, w!, h!);
        c.fillStyle = "#374c4d";
        c.beginPath();
        c.moveTo(-w! / 2 - 12, -h! / 2);
        c.lineTo(0, -h! / 2 - 38);
        c.lineTo(w! / 2 + 12, -h! / 2);
        c.lineTo(w! / 2, h! / 4);
        c.lineTo(-w! / 2, h! / 4);
        c.closePath();
        c.fill();
        c.strokeStyle = "#778978";
        c.lineWidth = 2;
        c.stroke();
        c.fillStyle = "#08131b";
        c.fillRect(-12, h! / 4, 24, h! / 4);
        for (let j = -1; j <= 1; j += 2) {
          c.fillStyle = "#b88d4b";
          c.fillRect(j * w! * 0.28 - 6, h! / 4 + 4, 12, 10);
        }
      }
      c.restore();
      glow(x!, y!, 110, i === 1 ? "#42bea022" : "#aa865615");
    }
    // Tall ward stones define the camp's outer magical boundary.
    for (const [x, y] of [
      [150, 320],
      [1230, 460],
      [980, 910],
      [80, 810],
    ]) {
      c.fillStyle = "#14202b";
      c.beginPath();
      c.moveTo(x! - 22, y!);
      c.lineTo(x! - 13, y! - 130);
      c.lineTo(x! + 4, y! - 150);
      c.lineTo(x! + 24, y!);
      c.closePath();
      c.fill();
      c.strokeStyle = "#537c74";
      c.lineWidth = 2;
      c.stroke();
      c.strokeStyle = "#8bd9b9";
      c.beginPath();
      c.moveTo(x!, y! - 100);
      c.lineTo(x! + 7, y! - 78);
      c.lineTo(x! - 5, y! - 50);
      c.stroke();
      glow(x!, y! - 70, 70, "#43aa8a33");
    }
  } else {
    // Monumental sealed gate, weathered basalt, and distant collar rings.
    for (let i = 0; i < 9; i++) {
      const x = 760 + i * 143;
      const h = 360 + Math.sin(i * 1.8) * 100;
      const g = c.createLinearGradient(x, 0, x + 100, 0);
      g.addColorStop(0, "#152830");
      g.addColorStop(0.55, "#263e42");
      g.addColorStop(1, "#0a141e");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x, 820);
      c.lineTo(x + 15, 400 - h / 2);
      c.lineTo(x + 65, 370 - h / 2);
      c.lineTo(x + 105, 820);
      c.closePath();
      c.fill();
      c.strokeStyle = "#587f7455";
      c.lineWidth = 2;
      c.stroke();
    }
    c.strokeStyle = "#79b8a82a";
    for (let i = 0; i < 3; i++) {
      c.lineWidth = i === 0 ? 5 : 1;
      c.beginPath();
      c.ellipse(1330, 535, 440 + i * 25, 335 + i * 20, 0, Math.PI, Math.PI * 2);
      c.stroke();
    }
    c.fillStyle = "#08111b";
    c.beginPath();
    c.moveTo(0, 930);
    c.lineTo(620, 840);
    c.lineTo(1040, 890);
    c.lineTo(1550, 770);
    c.lineTo(1920, 830);
    c.lineTo(1920, 1080);
    c.lineTo(0, 1080);
    c.fill();
    glow(1300, 660, 300, "#48ad9022");
  }
  // Sparse large atmospheric motes, avoiding paper/grain texture.
  for (let i = 0; i < 75; i++) {
    const x = (i * 397 + 71) % 1920,
      y = (i * i * 31 + 113) % 1080;
    c.fillStyle = i % 3 ? "#86c5af55" : "#dfc08566";
    c.fillRect(x, y, i % 7 === 0 ? 3 : 1.5, i % 7 === 0 ? 3 : 1.5);
  }
  const shade = c.createLinearGradient(0, 0, 0, 1080);
  shade.addColorStop(0, "#040a13cc");
  shade.addColorStop(0.32, "#040a1311");
  shade.addColorStop(0.74, "#040a1322");
  shade.addColorStop(1, "#040a13ee");
  c.fillStyle = shade;
  c.fillRect(0, 0, 1920, 1080);
  const t = Texture.from(canvas);
  cache.set(kind, t);
  return t;
}
export function backdrop(ui: CanvasUI, kind = "gate") {
  const s = new Sprite(texture(kind));
  ui.content.addChild(s);
  return s;
}

export function mage(
  ui: CanvasUI,
  x: number,
  y: number,
  scale: number,
  school = "water",
  parent: Container = ui.content,
) {
  const g = new Graphics();
  g.position.set(x, y);
  g.scale.set(scale);
  parent.addChild(g);
  const colour =
    colours[school as "water" | "fire" | "earth" | "air"] ?? colours.water;
  for (let i = 5; i > 0; i--)
    g.ellipse(0, -120, 36 + i * 15, 110 + i * 7).fill({
      color: colour,
      alpha: 0.012,
    });
  g.ellipse(0, 3, 65, 15).fill({ color: 0x02090f, alpha: 0.6 });
  g.poly([
    -28, -130, -48, -18, -58, 0, -17, -8, 5, -1, 46, -10, 34, -128, 16, -148,
  ])
    .fill(0x426871)
    .stroke({ color: 0x91b3af, width: 1.5 });
  g.poly([-5, -136, -19, -12, 3, -2, 20, -12, 10, -131]).fill(0xc3caba);
  g.poly([-25, -127, -59, -101, -41, -76, -25, -100]).fill(0x617f80);
  g.poly([22, -128, 48, -97, 32, -70, 21, -99]).fill(0x617f80);
  g.poly([-22, -130, -20, -160, -4, -181, 16, -169, 26, -143, 14, -125])
    .fill(0x334f5c)
    .stroke({ color: 0x789b9b, width: 1.5 });
  g.poly([-9, -157, 9, -158, 11, -134, 0, -126, -9, -136]).fill(0xbbb9a0);
  g.poly([-18, -151, -4, -174, 17, -160, 5, -160, -3, -143]).fill(0x273f4d);
  g.moveTo(-47, -24).lineTo(-56, -186).stroke({ color: 0xbda774, width: 5 });
  g.poly([-66, -181, -55, -201, -44, -181, -54, -171, -66, -181]).stroke({
    color: colour,
    width: 3,
  });
  g.circle(-55, -187, 5).fill(colour);
  g.poly([-22, -111, 22, -110, 21, -99, -22, -100]).fill(0x756954);
  for (let i = 0; i < 6; i++) g.circle(-16 + i * 6, -104, 2).fill(0xd1bf8b);
  for (let i = 0; i < 17; i++) {
    const a = i * 2.4,
      r = 50 + (i % 4) * 8;
    g.circle(
      Math.cos(a) * r,
      -100 + Math.sin(a) * 80,
      1.4 + (i % 3) * 0.4,
    ).fill({ color: colour, alpha: 0.55 });
  }
  return g;
}
