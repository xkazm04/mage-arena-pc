import { CombatFeedback, feedbackPolicy } from "./combat-feedback.ts";
import { tuningFor } from "@mage/core/arena";
import {
  BitmapText,
  Container,
  Graphics,
  Sprite,
  type Application,
} from "pixi.js";
import {
  arenaGeometry,
  runtime,
  seconds,
  spells,
  type Actor,
  type ArenaState,
  type Vec,
} from "@mage/core/arena";
import {
  arcPoints,
  cameraMetrics,
  contract,
  depthOrder,
  groundToScreen,
  interpolate,
  type Camera,
  type Point,
} from "./camera.ts";
import { FigureLibrary } from "./sprites.ts";
import { ArenaArt, type Palette } from "./arena-art.ts";
import { BodyPlayer } from "./body-player.ts";
import { EffectPlayer } from "./effect-player.ts";
import animation from "../data/animation.json" with { type: "json" };

const ink = 0x07161e;
const familyColour = (family: string) =>
  family === "unblockable"
    ? 0xfb827c
    : family === "physical"
      ? 0xe5d6b2
      : 0x6df1e1;
export class ArenaScene {
  readonly library: FigureLibrary;
  readonly scenery: ArenaArt;
  private floor = new Container();
  private ground = new Graphics();
  private figures = new Container();
  private effects = new Graphics();
  readonly clips = new EffectPlayer();
  readonly sigils = new EffectPlayer("a13");
  readonly bodies = new BodyPlayer();
  readonly feedback = new CombatFeedback();
  debugEnabled = false;
  debugPage = 0;
  private debugLabel = new BitmapText({
    text: "",
    style: { fontFamily: "CovenantBody", fontSize: 20, fill: 0xffffff },
  });
  private debugPanel = new Graphics();
  private actors = new Map<
    number,
    { root: Container; sprite: Sprite; details: Graphics }
  >();
  private c!: Camera;
  private debug = false;
  visibleProjectiles = 0;
  sortedActorIds: number[] = [];
  constructor(app: Application, parent: Container = app.stage) {
    this.library = new FigureLibrary(app);
    parent.addChild(
      this.floor,
      this.sigils.behind,
      this.ground,
      this.clips.behind,
      this.figures,
      this.clips.front,
      this.sigils.front,
      this.effects,
      this.feedback.layer,
      this.debugPanel,
      this.debugLabel,
    );
    this.figures.sortableChildren = true;
    this.buildFloor();
    this.scenery = new ArenaArt(this.floor, this.figures);
  }
  palette(value: Palette) {
    void this.scenery.load(value);
  }
  depthSnapshot() {
    return this.figures.children.map((c) => ({ id: c.label, y: c.zIndex }));
  }
  dispose() {
    this.library.dispose();
    this.clips.dispose();
    this.sigils.dispose();
    this.bodies.dispose();
    this.feedback.dispose();
    this.debugLabel.destroy();
    this.debugPanel.destroy();
    this.scenery.dispose();
    for (const c of [this.floor, this.ground, this.figures, this.effects])
      c.destroy({ children: true });
  }
  private buildFloor(): void {
    const g = new Graphics(),
      { centre, widthM, heightM } = arenaGeometry;
    const rx = widthM / 2,
      ry = heightM / 2;
    g.ellipse(centre.x, centre.y, rx + 6, ry + 6).fill(0x09141d);
    g.ellipse(centre.x, centre.y, rx + 3, ry + 3)
      .fill(0x203338)
      .stroke({ color: 0x456c66, width: 0.4 });
    g.ellipse(centre.x, centre.y, rx, ry)
      .fill(0x20363b)
      .stroke({ color: 0x77a795, width: 0.32 });
    g.ellipse(centre.x, centre.y, rx - 0.65, ry - 0.65).stroke({
      color: 0x466c63,
      width: 0.16,
    });
    // Quiet, deterministic pigment marks; no generated bitmap or random source.
    for (let i = 0; i < 900; i++) {
      const angle = i * 2.399963,
        r = Math.sqrt((i + 0.5) / 900);
      const x = centre.x + Math.cos(angle) * (rx - 1.2) * r,
        y = centre.y + Math.sin(angle) * (ry - 1.2) * r;
      g.ellipse(x, y, 0.4 + (i % 5) * 0.14, 0.16 + (i % 3) * 0.07).fill({
        color: i % 2 ? 0x334b49 : 0x5c7668,
        alpha: 0.18,
      });
    }
    // Narrow tessera border follows the ellipse; the centre stays free of obstacles.
    for (let i = 0; i < 360; i++) {
      const a = (i * Math.PI * 2) / 360,
        b = a + 0.013;
      g.poly([
        centre.x + Math.cos(a) * (rx + 0.45),
        centre.y + Math.sin(a) * (ry + 0.45),
        centre.x + Math.cos(b) * (rx + 0.45),
        centre.y + Math.sin(b) * (ry + 0.45),
        centre.x + Math.cos(b) * (rx + 1.2),
        centre.y + Math.sin(b) * (ry + 1.2),
        centre.x + Math.cos(a) * (rx + 1.2),
        centre.y + Math.sin(a) * (ry + 1.2),
      ]).fill(i % 3 ? 0x42675f : 0x668477);
    }
    this.floor.addChild(g);
  }
  private path(points: Point[], g = this.ground): Graphics {
    for (let i = 0; i < points.length; i++) {
      const p = groundToScreen(points[i]!, this.c);
      if (!i) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    }
    return g;
  }
  private circle(
    p: Vec,
    radius: number,
    colour: number,
    alpha = 1,
    fill = false,
  ): void {
    const m = cameraMetrics(this.c),
      q = groundToScreen(p, this.c);
    this.ground.ellipse(
      q.x,
      q.y,
      radius * m.pxPerMetreX,
      radius * m.pxPerMetreY,
    );
    if (fill) this.ground.fill({ color: colour, alpha });
    else
      this.ground
        .stroke({ color: ink, width: m.outlinePx * 2.1, alpha: 0.85 })
        .stroke({ color: colour, width: m.outlinePx, alpha });
  }
  private locator(p: Vec, actualRadius: number, colour: number): void {
    const radius = Math.max(
      actualRadius,
      contract.telegraph.minimum_ground_diameter_metres / 2,
    );
    // Separate radial ticks locate small threats. The solid line always gives the real hit boundary.
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      this.path([
        {
          x: p.x + Math.cos(a) * (radius + 0.13),
          y: p.y + Math.sin(a) * (radius + 0.13),
        },
        {
          x: p.x + Math.cos(a) * (radius + 0.35),
          y: p.y + Math.sin(a) * (radius + 0.35),
        },
      ])
        .stroke({
          color: ink,
          width: cameraMetrics(this.c).outlinePx * 2.1,
          alpha: 0.85,
        })
        .stroke({ color: colour, width: cameraMetrics(this.c).outlinePx });
    }
  }
  private area(p: Vec, radius: number, colour: number, progress: number): void {
    this.sigils.draw("telegraph.area", progress * 1000, p, {
      behind: true,
      groundSize: { x: radius * 2, y: radius * 2 },
    });
    this.circle(p, radius, colour);
    this.circle(
      p,
      radius * Math.max(0, Math.min(1, progress)),
      colour,
      0.13,
      true,
    );
    this.locator(p, radius, colour);
  }
  private lane(
    origin: Vec,
    target: Vec,
    range: number,
    width: number,
    colour: number,
  ): void {
    const angle = Math.atan2(target.y - origin.y, target.x - origin.x),
      dx = Math.cos(angle),
      dy = Math.sin(angle),
      w = width / 2;
    const end = { x: origin.x + dx * range, y: origin.y + dy * range };
    this.sigils.draw(
      "telegraph.line",
      0,
      { x: (origin.x + end.x) / 2, y: (origin.y + end.y) / 2 },
      { behind: true, angle, groundSize: { x: range, y: width } },
    );
    this.path([
      { x: origin.x - dy * w, y: origin.y + dx * w },
      { x: end.x - dy * w, y: end.y + dx * w },
      { x: end.x + dy * w, y: end.y - dx * w },
      { x: origin.x + dy * w, y: origin.y - dx * w },
    ])
      .closePath()
      .fill({ color: colour, alpha: 0.12 })
      .stroke({
        color: ink,
        width: cameraMetrics(this.c).outlinePx * 2.1,
        alpha: 0.85,
      })
      .stroke({ color: colour, width: cameraMetrics(this.c).outlinePx });
    for (let d = 1; d < range; d += 1.5)
      this.path([
        { x: origin.x + dx * d - dy * w, y: origin.y + dy * d + dx * w },
        {
          x: origin.x + dx * (d + 0.6) + dy * w,
          y: origin.y + dy * (d + 0.6) - dx * w,
        },
      ]).stroke({
        color: colour,
        width: cameraMetrics(this.c).resolutionScale,
        alpha: 0.6,
      });
  }
  private sector(
    origin: Vec,
    target: Vec,
    radius: number,
    degrees: number,
    colour: number,
  ): void {
    this.sigils.draw("telegraph.cone", 0, origin, {
      behind: true,
      angle: Math.atan2(target.y - origin.y, target.x - origin.x),
      groundSize: { x: radius * 2, y: radius * 2 },
    });
    this.path([
      origin,
      ...arcPoints(
        origin,
        radius,
        Math.atan2(target.y - origin.y, target.x - origin.x),
        degrees,
      ),
      origin,
    ])
      .fill({ color: colour, alpha: 0.13 })
      .stroke({
        color: ink,
        width: cameraMetrics(this.c).outlinePx * 2.1,
        alpha: 0.85,
      })
      .stroke({ color: colour, width: cameraMetrics(this.c).outlinePx });
    this.locator(origin, radius, colour);
  }
  render(
    state: ArenaState,
    player: Actor,
    c: Camera,
    alpha: number,
    aim: Vec,
    _lastPerfect: number,
    debug: boolean,
  ): void {
    this.c = c;
    this.debug = debug;
    const m = cameraMetrics(c),
      g = this.ground,
      e = this.effects;
    g.clear();
    e.clear();
    this.clips.begin(state, c, alpha);
    this.sigils.begin(state, c, alpha);
    this.bodies.begin(state, alpha);
    this.feedback.begin(state);
    this.scenery.render(c);
    this.floor.scale.set(m.pxPerMetreX, m.pxPerMetreY);
    this.floor.position.set(
      c.width / 2 - c.centre.x * m.pxPerMetreX,
      c.height / 2 - c.centre.y * m.pxPerMetreY,
    );
    for (const z of state.zones) {
      this.circle(
        z.pos,
        z.radiusM,
        z.kind === "fog" ? 0x82969c : 0x398d98,
        0.2,
        true,
      );
      this.circle(z.pos, z.radiusM, 0x39818f, 0.65);
    }
    for (const t of state.telegraphs) {
      const colour = familyColour(t.family),
        progress =
          (state.tick - t.startTick) / Math.max(1, t.resolveTick - t.startTick);
      if (t.kind === "lane" || t.kind === "charge")
        this.lane(t.origin, t.target, t.rangeM, t.widthM, colour);
      else if (t.kind === "area")
        this.area(t.target, t.widthM, colour, progress);
      else if (t.kind === "melee")
        this.sector(t.origin, t.target, t.rangeM, t.widthM, colour);
      else {
        this.area(t.origin, 0.8, colour, progress);
        this.path([t.origin, t.target]).stroke({
          color: colour,
          width: m.outlinePx,
          alpha: 0.3,
        });
      }
    }
    for (const a of state.actors) {
      if (a.pending?.kind === "spell") {
        this.sigils.draw(
          `casting.${this.clips.element(a)}`,
          seconds(state.tick - a.pending.startTick + alpha) * 1000,
          a.pos,
          { behind: true },
        );
        const pending = a.pending,
          s = pending.spell ?? spells.find((s) => s.id === pending.spellId)!;
        const progress =
            (state.tick - pending.startTick) /
            Math.max(1, pending.releaseTick - pending.startTick),
          colour = familyColour(s.family);
        if (s.kind === "cone")
          this.sector(a.pos, pending.aim, s.rangeM, s.arcDeg, colour);
        else if (s.kind === "ring")
          this.area(a.pos, s.rangeM, colour, progress);
        else if (s.kind === "zone")
          this.area(pending.aim, s.radiusM, colour, progress);
        else if (s.kind === "target") {
          const target = state.actors.find(
            (candidate) => candidate.id === pending.targetId,
          );
          if (target) this.area(target.pos, target.radius, colour, progress);
        } else if (s.kind === "projectile" && s.family === "unblockable")
          this.lane(
            a.pos,
            pending.aim,
            s.rangeM,
            (s.radiusM || runtime.geometry.projectileRadiusM) * 2,
            colour,
          );
        else this.area(a.pos, 0.8, colour, progress);
      }
      if (a.water.decoy) {
        this.circle(a.water.decoy.pos, 0.6, 0x327b9d, 0.4, true);
        this.locator(a.water.decoy.pos, 0.6, 0x327b9d);
      }
    }
    const bodies = state.actors
      .map((a) => ({
        id: a.id,
        a,
        foot: a.down ? a.pos : interpolate(a.previousPos, a.pos, alpha),
      }))
      .sort(depthOrder);
    this.sortedActorIds = bodies.map((b) => b.id);
    const live = new Set(bodies.map((b) => b.id));
    for (const [id, view] of this.actors)
      if (!live.has(id)) {
        view.root.destroy({ children: true });
        this.actors.delete(id);
      }
    for (const { a, foot } of bodies) {
      const q = groundToScreen(foot, c);
      const h =
        m.figureHeightPx *
        (a.enemy && ["cinder_hound", "hush_moth"].includes(a.enemy.id)
          ? 0.65
          : 1);
      g.ellipse(q.x + h * 0.16, q.y + h * 0.02, h * 0.32, h * 0.09).fill({
        color: ink,
        alpha: 0.2,
      });
      this.circle(
        foot,
        a.radius * contract.character.draw_multiplier,
        a.team === player.team ? 0x226580 : 0xe9a777,
        0.65,
      );
      if (a.absorb) {
        const angle = Math.atan2(a.facing.y, a.facing.x),
          radius =
            contract.absorb.visual_radius_metres *
            this.feedback.compression(a, state.tick + alpha);
        this.path(
          arcPoints(foot, radius, angle, tuningFor(state).absorbArcDeg),
        ).stroke({
          color: 0x205f78,
          width: m.outlinePx * 2.6,
        });
        this.path(
          arcPoints(foot, radius, angle, tuningFor(state).absorbArcDeg),
        ).stroke({
          color: 0x9de9df,
          width: m.outlinePx * 1.3,
        });
        const fresh =
          seconds(state.tick - a.absorbFreshTick + alpha) <=
          tuningFor(state).absorbWindowS;
        if (fresh)
          this.path(
            arcPoints(foot, radius, angle, tuningFor(state).absorbArcDeg),
          ).stroke({
            color: 0xfff9d5,
            width: m.outlinePx * 1.9,
            alpha: feedbackPolicy.anticipationOpacity,
          });
        const wardArt = this.sigils.draw(
          "absorb.hold",
          seconds(state.tick - a.absorbFreshTick + alpha) * 1000,
          foot,
          {
            angle,
            barrier: true,
            scale: this.feedback.compression(a, state.tick + alpha),
          },
        );
        if (!wardArt)
          this.clips.draw(
            "absorb.hold",
            seconds(state.tick - a.absorbFreshTick + alpha) * 1000,
            foot,
            {
              angle,
              barrier: true,
              scale: this.feedback.compression(a, state.tick + alpha),
              opacity: animation.effects.barrierOpacity,
            },
          );
      }
      let view = this.actors.get(a.id);
      if (!view) {
        const root = new Container(),
          sprite = new Sprite(),
          details = new Graphics();
        root.label = `actor:${a.id}`;
        root.addChild(sprite, details);
        view = { root, sprite, details };
        this.actors.set(a.id, view);
        this.figures.addChild(root);
      }
      view.root.zIndex = foot.y;
      view.root.position.set(q.x, q.y);
      view.root.visible =
        q.x > -h && q.x < c.width + h && q.y > -h && q.y < c.height + h;
      if (!this.bodies.apply(view.sprite, a, m.figureHeightPx))
        this.library.apply(view.sprite, a, player.team, h);
      view.sprite.filters = this.feedback.flash(a, state.tick + alpha)
        ? [this.feedback.white]
        : null;
      const d = view.details;
      d.clear();
      if (!a.enemy && !a.dummy && !a.down) {
        this.clips.draw(
          `${this.clips.element(a)}.aura`,
          seconds(state.tick + alpha) * 1000,
          foot,
          {
            behind: true,
            lift: h * 0.36,
            opacity: animation.effects.auraOpacity,
            optional: true,
          },
        );
      }
      if (state.tick < a.water.encasedUntil)
        d.poly([
          -h * 0.3,
          0,
          -h * 0.4,
          -h * 0.75,
          0,
          -h * 1.1,
          h * 0.4,
          -h * 0.75,
          h * 0.3,
          0,
        ])
          .fill({ color: 0x80d9e0, alpha: 0.45 })
          .stroke({ color: 0x216c88, width: m.outlinePx });
      if (state.tick < a.immuneUntil)
        d.ellipse(0, -h / 2, h * 0.4, h * 0.56).stroke({
          color: 0xfffbdd,
          width: m.outlinePx,
        });
      if (a.hp < a.maxHp && !a.down) {
        d.rect(
          -h * 0.35,
          -h - 10 * m.resolutionScale,
          h * 0.7,
          6 * m.resolutionScale,
        ).fill(ink);
        d.rect(
          -h * 0.35,
          -h - 10 * m.resolutionScale,
          (h * 0.7 * a.hp) / a.maxHp,
          6 * m.resolutionScale,
        ).fill(a.team === player.team ? 0x78c9ca : 0xc05e46);
      }
      if (a.id === player.id) {
        this.path([
          foot,
          { x: foot.x + a.facing.x * 1.1, y: foot.y + a.facing.y * 1.1 },
        ]).stroke({ color: 0x216780, width: m.outlinePx });
        if (this.debug) {
          d.moveTo(-h * 0.55, 0)
            .lineTo(-h * 0.55, -h)
            .moveTo(-h * 0.62, 0)
            .lineTo(-h * 0.48, 0)
            .moveTo(-h * 0.62, -h)
            .lineTo(-h * 0.48, -h)
            .stroke({ color: 0x202f37, width: 2 * m.resolutionScale });
        }
      }
      // Keep distant enemies locatable when the follow camera or HUD hides their feet.
      if (
        !a.down &&
        a.team !== player.team &&
        (q.x < 26 * m.resolutionScale ||
          q.x > c.width - 26 * m.resolutionScale ||
          q.y < 180 * m.resolutionScale ||
          q.y > c.height - 240 * m.resolutionScale)
      ) {
        const dx = q.x - c.width / 2,
          dy = q.y - c.height / 2;
        const tx =
          (c.width / 2 - 26 * m.resolutionScale) /
          Math.max(0.001, Math.abs(dx));
        const ty =
          (c.height / 2 - (dy < 0 ? 180 : 240) * m.resolutionScale) /
          Math.max(0.001, Math.abs(dy));
        const t = Math.min(1, tx, ty),
          x = c.width / 2 + dx * t,
          y = c.height / 2 + dy * t;
        const angle = Math.atan2(dy, dx),
          size = 9 * m.resolutionScale;
        e.poly([
          x + Math.cos(angle) * size,
          y + Math.sin(angle) * size,
          x + Math.cos(angle + 2.4) * size,
          y + Math.sin(angle + 2.4) * size,
          x + Math.cos(angle - 2.4) * size,
          y + Math.sin(angle - 2.4) * size,
        ])
          .fill(0xe9a777)
          .stroke({ color: 0xf8e8ba, width: 2 * m.resolutionScale });
      }
    }
    this.visibleProjectiles = 0;
    for (const p of state.projectiles) {
      const pos = interpolate(p.previousPos, p.pos, alpha),
        q = groundToScreen(pos, c);
      const r = Math.max(p.radius * m.pxPerMetreY, m.projectileCorePx / 2);
      if (q.x < -r || q.x > c.width + r || q.y < -r || q.y > c.height + r)
        continue;
      this.visibleProjectiles++;
      const owner = state.actors.find((a) => a.id === p.ownerId);
      if (
        p.family !== "physical" &&
        this.clips.draw(
          `${this.clips.element(owner)}.travel`,
          seconds(state.tick + alpha) * 1000,
          pos,
          {
            angle: Math.atan2(p.velocity.y, p.velocity.x),
            opacity: animation.effects.travelOpacity,
          },
        )
      )
        continue;
      const colour = familyColour(p.family),
        speed = Math.hypot(p.velocity.x, p.velocity.y) || 1;
      const tail = groundToScreen(
        {
          x: pos.x - (p.velocity.x / speed) * 0.65,
          y: pos.y - (p.velocity.y / speed) * 0.65,
        },
        c,
      );
      e.moveTo(tail.x, tail.y)
        .lineTo(q.x, q.y)
        .stroke({ color: colour, width: r * 1.5, alpha: 0.6 });
      e.circle(q.x, q.y, r + 2 * m.resolutionScale).fill(0xf8efd4);
      if (p.family === "physical")
        e.poly([
          q.x,
          q.y - r * 1.6,
          q.x + r,
          q.y,
          q.x,
          q.y + r * 1.6,
          q.x - r,
          q.y,
        ]).fill(colour);
      else if (p.family === "unblockable")
        e.star(q.x, q.y, 4, r * 1.7, r).fill(colour);
      else e.circle(q.x, q.y, r).fill(colour);
    }
    this.clips.finish(state);
    this.debugLabel.visible = this.debugPanel.visible = this.debugEnabled;
    if (this.debugEnabled) {
      const messages = [...this.bodies.fallbacks],
        pageCount = Math.max(1, Math.ceil(messages.length / 10));
      const page = ((this.debugPage % pageCount) + pageCount) % pageCount;
      this.debugLabel.text =
        `ART DEBUG ? F8 close / [ ] pages ${page + 1}/${pageCount}\nA10 fallbacks logged once: ${messages.length} / A8 sprites: ${this.clips.snapshot().active}\n` +
        messages.slice(page * 10, page * 10 + 10).join("\n");
      this.debugLabel.position.set(
        100 * m.resolutionScale,
        290 * m.resolutionScale,
      );
      this.debugLabel.scale.set(m.resolutionScale);
      this.debugPanel
        .clear()
        .rect(
          this.debugLabel.x - 12,
          this.debugLabel.y - 12,
          this.debugLabel.width + 24,
          this.debugLabel.height + 24,
        )
        .fill({ color: 0x081118, alpha: 0.94 });
    }
    this.feedback.draw(state, c, alpha);
    const target = groundToScreen(aim, c),
      cross = 7 * m.resolutionScale;
    e.circle(target.x, target.y, cross).stroke({
      color: 0xbce3d0,
      width: 1.5 * m.resolutionScale,
    });
    e.moveTo(target.x - cross * 1.5, target.y)
      .lineTo(target.x + cross * 1.5, target.y)
      .moveTo(target.x, target.y - cross * 1.5)
      .lineTo(target.x, target.y + cross * 1.5)
      .stroke({ color: 0xbce3d0, width: m.resolutionScale });
    if (this.debug) {
      const p = interpolate(player.previousPos, player.pos, alpha);
      this.path([
        p,
        {
          x: p.x + contract.minimum_combatant_centre_separation_metres,
          y: p.y,
        },
      ]).stroke({ color: 0x243f47, width: 2 * m.resolutionScale, alpha: 0.7 });
      this.path([
        p,
        {
          x: p.x,
          y: p.y + contract.minimum_combatant_centre_separation_metres,
        },
      ]).stroke({ color: 0x243f47, width: 2 * m.resolutionScale, alpha: 0.7 });
    }
  }
}
