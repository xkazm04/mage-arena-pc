import { CombatFeedback } from "./combat-feedback.ts";
import { tuningFor } from "@mage/core/arena";
import {
  BitmapText,
  Container,
  Graphics,
  RenderTexture,
  Sprite,
  Texture,
  type Application,
  type Renderer,
  type TextureSource,
} from "pixi.js";
import { frameGraphics } from "./pixi-fixes.ts";
import { sigilMesh } from "./sigil-shader.ts";
import {
  arenaGeometry,
  runtime,
  seconds,
  spells,
  travelLine,
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
import { SigilPlayer } from "./sigil-player.ts";
import { RivalCollarView } from "./rival-collar-view.ts";
import { rivalRune } from "./rival-collar.ts";
import type { Element } from "./animation-contract.ts";
import animation from "../data/animation.json" with { type: "json" };
import { art } from "./art.ts";
import { quality } from "./quality.ts";
import { depthOf, orderByDepth, setDepth } from "./depth.ts";
import { preloadSigils } from "./ui/artwork.ts";
import {
  bodyPages,
  effectPages,
  preloadPolicy,
  sigilClips,
  sigilPages,
} from "./arena-preload.ts";

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
  /** The procedural floor; drawn only where the A12 plate (opaque) does not cover the view. */
  private floorArt = new Graphics();
  private ground = new Graphics();
  private figures = new Container();
  private effects = new Graphics();
  readonly clips = new EffectPlayer();
  readonly sigils = new SigilPlayer();
  readonly bodies = new BodyPlayer();
  readonly feedback = new CombatFeedback();
  readonly collars = new RivalCollarView();
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
  private timeMs = 0;
  visibleProjectiles = 0;
  sortedActorIds: number[] = [];
  private sceneryLoad: Promise<void> = Promise.resolve();
  /** Art held for the bout so nothing it can draw is unloaded or met lazily mid-fight. */
  private pins = new Set<string>();
  private wanted: string[] = [];
  private uploaded = new WeakSet<TextureSource>();
  private disposed = false;
  private readyGeneration = 0;
  constructor(app: Application, parent: Container = app.stage) {
    this.library = new FigureLibrary(app);
    parent.addChild(
      this.floor,
      this.sigils.behind,
      this.ground,
      this.clips.behind,
      this.collars.layer,
      this.figures,
      this.clips.front,
      this.sigils.front,
      this.effects,
      this.feedback.layer,
      this.debugPanel,
      this.debugLabel,
    );
    for (const g of [this.ground, this.effects, this.debugPanel])
      frameGraphics(g);
    this.buildFloor();
    this.scenery = new ArenaArt(this.floor, this.figures, app.renderer);
  }
  palette(value: Palette) {
    this.sceneryLoad = this.scenery.load(value);
  }
  /**
   * Settles once the plate, the bodies of `actors`, the sigils and effects of
   * their elements and the HUD inscription are decoded and on the GPU; returns
   * what failed. `additive` keeps the current pins (an intermission prefetch).
   */
  async ready(
    actors: readonly Actor[],
    upload: (source: TextureSource) => void,
    additive = false,
  ): Promise<string[]> {
    const elements = actors.map((a) => this.clips.element(a)),
      generation = additive ? this.readyGeneration : ++this.readyGeneration;
    if (!additive) this.wanted = [];
    // Each family starts its pages as soon as its own manifest settles; nothing waits on the plate.
    const pin = async (keys: string[]) => {
      if (this.disposed) return [];
      for (const key of keys)
        if (!this.pins.has(key)) {
          this.pins.add(key);
          art.retain(key);
        }
      if (!additive) this.wanted.push(...keys);
      await art.preload(keys);
      return keys;
    };
    const groups = await Promise.all([
      this.bodies.loaded.then(() =>
        this.bodies.manifest
          ? pin(
              bodyPages(
                this.bodies.manifest,
                actors.map((a) => this.bodies.identity(a)),
              ),
            )
          : [],
      ),
      this.sigils.loaded.then(() =>
        this.sigils.manifest
          ? pin(sigilPages(this.sigils.manifest, sigilClips(elements)))
          : [],
      ),
      pin(effectPages(elements)),
      this.clips.loaded.then(() => []),
      preloadSigils(["inscription.collar"]).then(() => []),
      this.sceneryLoad.catch(() => {}).then(() => []),
    ]);
    if (this.disposed) return [];
    const keys = groups.flat();
    // Only the newest bout drops pins; a superseded load must not unpin its successor's art.
    if (!additive && generation === this.readyGeneration)
      for (const key of this.pins)
        if (!keys.includes(key)) {
          this.pins.delete(key);
          art.release(key);
        }
    const wanted = [...new Set([...keys, ...this.scenery.keys])];
    // Decode alone leaves the GPU copy to the first frame that draws it; upload now, behind the card.
    const sources = wanted
      .map((k) => art.get(k)?.source)
      .filter((s): s is TextureSource => !!s && !this.uploaded.has(s));
    for (let i = 0; i < sources.length; i++) {
      if (i && i % preloadPolicy.uploadsPerFrame === 0)
        await new Promise((r) => requestAnimationFrame(r));
      if (this.disposed) return [];
      if (sources[i]!.destroyed) continue;
      upload(sources[i]!);
      this.uploaded.add(sources[i]!);
    }
    return [
      ...(this.bodies.manifest ? [] : ["a10.packed.manifest"]),
      ...(this.sigils.manifest ? [] : ["a13.manifest"]),
      ...(this.clips.manifest ? [] : ["a8.manifest"]),
      ...(this.scenery.source === "A12"
        ? []
        : [`a12.plate.${this.scenery.palette}`]),
      ...wanted.filter((k) => !art.get(k)),
    ];
  }
  /** Fraction of the current bout's art that is resident, and what is not yet. */
  progress() {
    const wanted = [...new Set([...this.wanted, ...this.scenery.keys])],
      pending = wanted.filter((k) => !art.get(k));
    return {
      fraction: wanted.length ? 1 - pending.length / wanted.length : 0,
      pending,
    };
  }
  depthSnapshot() {
    return this.figures.children.map((c) => ({ id: c.label, y: depthOf(c) }));
  }
  /**
   * Draws `world` as last rendered, one painted sigil and one hit flash into a small offscreen
   * target, so shader links, generated uniform code and geometry buffers are made behind the
   * loading card instead of on the first frames of the fight. Nothing reaches the screen.
   */
  warm(renderer: Renderer, world: Container) {
    const target = RenderTexture.create({ width: 256, height: 144 }),
      probe = new Container(),
      sigil = sigilMesh(),
      flash = new Sprite(Texture.WHITE);
    sigil.setSize(64, 64);
    flash.setSize(64, 96);
    flash.position.set(96, 0);
    flash.filters = [this.feedback.white];
    probe.addChild(sigil, flash);
    const shown = world.visible,
      group = world.isRenderGroup;
    world.visible = true;
    renderer.render({ container: world, target });
    world.visible = shown;
    // Rendering a container as the root makes it a render group for good, which costs the
    // world its place in the stage's single instruction set (slower on the Stick, P1).
    if (!group) world.disableRenderGroup();
    renderer.render({ container: probe, target, clear: false });
    flash.filters = null;
    probe.destroy({ children: true });
    target.destroy(true);
  }
  dispose() {
    this.disposed = true;
    for (const key of this.pins) art.release(key);
    this.pins.clear();
    this.library.dispose();
    this.clips.dispose();
    this.sigils.dispose();
    this.bodies.dispose();
    this.feedback.dispose();
    this.collars.dispose();
    this.debugLabel.destroy();
    this.debugPanel.destroy();
    this.scenery.dispose();
    for (const c of [this.floor, this.ground, this.figures, this.effects])
      c.destroy({ children: true });
  }
  private buildFloor(): void {
    const g = this.floorArt,
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
  private area(
    p: Vec,
    radius: number,
    colour: number,
    progress: number,
    element: Element = "water",
    unblockable = false,
  ): void {
    if (
      this.sigils.threat(
        element,
        p,
        { shape: "ring", range: radius },
        progress,
        this.timeMs,
        0,
        unblockable,
      ) &&
      !this.debug
    )
      return;
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
    progress = 0,
    element: Element = "water",
    unblockable = false,
  ): void {
    const angle = Math.atan2(target.y - origin.y, target.x - origin.x),
      dx = Math.cos(angle),
      dy = Math.sin(angle),
      w = width / 2;
    const end = { x: origin.x + dx * range, y: origin.y + dy * range };
    if (
      this.sigils.threat(
        element,
        origin,
        { shape: "line", range, width },
        progress,
        this.timeMs,
        angle,
        unblockable,
      ) &&
      !this.debug
    )
      return;
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
    progress = 0,
    element: Element = "water",
    unblockable = false,
  ): void {
    if (
      this.sigils.threat(
        element,
        origin,
        { shape: "cone", range: radius, degrees },
        progress,
        this.timeMs,
        Math.atan2(target.y - origin.y, target.x - origin.x),
        unblockable,
      ) &&
      !this.debug
    )
      return;
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
    dt = 1 / 60,
  ): void {
    this.c = c;
    this.debug = debug;
    this.timeMs = seconds(state.tick + alpha) * 1000;
    const m = cameraMetrics(c),
      g = this.ground,
      e = this.effects;
    g.clear();
    e.clear();
    this.clips.begin(state, c, alpha, dt);
    this.sigils.begin(state, c, alpha);
    this.collars.begin();
    this.bodies.begin(state, alpha, dt);
    this.feedback.reduced = localStorage.getItem("mage-motion") === "reduced";
    this.feedback.begin(state, dt);
    this.scenery.render(c);
    this.floorArt.visible =
      quality.floorUnderPlate ||
      this.scenery.source !== "A12" ||
      m.visibleGroundM.x > contract.plate.world_size[0]! ||
      m.visibleGroundM.y > contract.plate.world_size[1]!;
    this.floor.scale.set(m.pxPerMetreX, m.pxPerMetreY);
    this.floor.position.set(
      c.width / 2 - c.centre.x * m.pxPerMetreX,
      c.height / 2 - c.centre.y * m.pxPerMetreY,
    );
    for (const z of state.zones) {
      if (
        this.sigils.draw(
          `threat.${this.clips.element(state.actors.find((a) => a.id === z.ownerId))}.ring`,
          seconds(state.tick + alpha) * 1000,
          z.pos,
          {
            extent: { shape: "ring", range: z.radiusM },
            opacity: 0.3,
            progress: 1,
          },
        ) &&
        !this.debug
      )
        continue;
      this.circle(
        z.pos,
        z.radiusM,
        z.kind === "fog" ? 0x82969c : 0x398d98,
        0.2,
        true,
      );
      this.circle(z.pos, z.radiusM, 0x39818f, 0.65);
    }
    this.sigils.schoolShapes(state, (a) => this.clips.element(a));
    for (const t of state.telegraphs) {
      const element = this.clips.element(
          state.actors.find((a) => a.id === t.ownerId),
        ),
        unblockable = t.family === "unblockable";
      const colour = familyColour(t.family),
        progress =
          (state.tick - t.startTick) / Math.max(1, t.resolveTick - t.startTick);
      const owner = state.actors.find((a) => a.id === t.ownerId);
      if (t.contacted && owner) {
        // A travelling charge or lunge: only the corridor its body has yet to cover, from the simulated body onward.
        const line = travelLine(t),
          left = Math.max(
            0,
            line.distanceM -
              Math.hypot(owner.pos.x - t.origin.x, owner.pos.y - t.origin.y),
          ),
          ahead = { x: owner.pos.x + line.dir.x, y: owner.pos.y + line.dir.y };
        if (t.kind === "charge")
          this.lane(
            owner.pos,
            ahead,
            left,
            t.widthM,
            colour,
            1,
            element,
            unblockable,
          );
        else
          this.sector(
            owner.pos,
            ahead,
            left + (t.reachM ?? 0),
            t.widthM,
            colour,
            1,
            element,
            unblockable,
          );
        continue;
      }
      if (t.kind === "lane" || t.kind === "charge")
        this.lane(
          t.origin,
          t.target,
          t.rangeM,
          t.widthM,
          colour,
          progress,
          element,
          unblockable,
        );
      else if (t.kind === "area")
        this.area(t.target, t.widthM, colour, progress, element, unblockable);
      else if (t.kind === "melee")
        this.sector(
          t.origin,
          t.target,
          t.rangeM,
          t.widthM,
          colour,
          progress,
          element,
          unblockable,
        );
      else
        this.lane(
          t.origin,
          t.target,
          t.rangeM,
          runtime.geometry.projectileRadiusM * 2,
          colour,
          progress,
          element,
          unblockable,
        );
    }
    for (const a of state.actors) {
      if (!a.pending) {
        const tell = state.telegraphs.find(
          (t) => t.ownerId === a.id && !t.survivesOwner,
        );
        if (tell && state.tick < tell.resolveTick)
          this.sigils.casting(a, this.clips.element(a), {
            kind: "spell",
            startTick: tell.startTick,
            releaseTick: tell.resolveTick,
            aim: tell.target,
            activationId: tell.activationId,
          });
      }
      if (a.pending?.kind === "spell") {
        this.sigils.casting(a, this.clips.element(a));
        const element = this.clips.element(a);
        const pending = a.pending,
          s = pending.spell ?? spells.find((s) => s.id === pending.spellId)!;
        const progress =
            (state.tick - pending.startTick) /
            Math.max(1, pending.releaseTick - pending.startTick),
          colour = familyColour(s.family);
        if (s.kind === "cone")
          this.sector(
            a.pos,
            pending.aim,
            s.rangeM,
            s.arcDeg,
            colour,
            progress,
            element,
            s.family === "unblockable",
          );
        else if (s.kind === "ring")
          this.area(
            a.pos,
            s.rangeM,
            colour,
            progress,
            element,
            s.family === "unblockable",
          );
        else if (s.kind === "zone")
          this.area(
            pending.aim,
            s.radiusM,
            colour,
            progress,
            element,
            s.family === "unblockable",
          );
        else if (s.kind === "target") {
          const target = state.actors.find(
            (candidate) => candidate.id === pending.targetId,
          );
          if (target)
            this.area(
              target.pos,
              target.radius,
              colour,
              progress,
              element,
              s.family === "unblockable",
            );
        } else if (s.kind === "projectile") {
          for (let i = 0; i < s.count; i++) {
            const angle =
              Math.atan2(pending.aim.y - a.pos.y, pending.aim.x - a.pos.x) +
              (s.count > 1
                ? ((-s.spreadDeg / 2 + (i * s.spreadDeg) / (s.count - 1)) *
                    Math.PI) /
                  180
                : 0);
            this.lane(
              a.pos,
              { x: a.pos.x + Math.cos(angle), y: a.pos.y + Math.sin(angle) },
              s.rangeM,
              (s.radiusM || runtime.geometry.projectileRadiusM) * 2,
              colour,
              progress,
              element,
              s.family === "unblockable",
            );
          }
        }
      }
      if (a.water.decoy) {
        if (
          !this.sigils.draw(
            "target",
            seconds(state.tick + alpha) * 1000,
            a.water.decoy.pos,
            { radius: 0.6, opacity: 0.4 },
          )
        )
          this.circle(a.water.decoy.pos, 0.6, 0x327b9d, 0.4, true);
      }
    }
    const bodies = state.actors
      .map((a) => ({
        id: a.id,
        a,
        foot: a.tags.includes("DEFEATED")
          ? a.pos
          : interpolate(a.previousPos, a.pos, alpha),
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
      if (
        !a.tags.includes("DEFEATED") &&
        !this.sigils.draw(
          a.id === player.id ? "selection" : "target",
          seconds(state.tick + alpha) * 1000,
          foot,
          { radius: a.id === player.id ? 0.8 : 0.75, opacity: 0.8 },
        )
      )
        this.circle(
          foot,
          a.radius * contract.character.draw_multiplier,
          a.team === player.team ? 0x226580 : 0xe9a777,
          0.65,
        );
      const rune = rivalRune(state, a, player);
      if (rune)
        this.collars.draw(
          rune,
          foot,
          c,
          g,
          this.sigils.manifest,
          localStorage.getItem("mage-motion") === "reduced",
        );
      if (a.absorb && !a.tags.includes("DEFEATED")) {
        const angle = Math.atan2(a.facing.y, a.facing.x),
          radius =
            contract.absorb.visual_radius_metres * this.feedback.compression(a);
        const drawn = this.sigils.ward(a, foot, radius);
        if (!drawn || this.debug)
          this.path(
            arcPoints(foot, radius, angle, tuningFor(state).absorbArcDeg),
          ).stroke({ color: 0x9de9df, width: m.outlinePx * 1.5 });
      }
      if (!a.tags.includes("DEFEATED")) {
        const statuses = [
          state.tick < a.water.slowUntil ? "slowed" : "",
          state.tick < a.water.rootUntil ? "rooted" : "",
          state.tick < a.water.wardUntil || state.tick < a.water.sheenUntil
            ? "shielded"
            : "",
        ].filter(Boolean);
        for (const [i, status] of statuses.entries())
          this.sigils.draw(
            `status.${status}`,
            seconds(state.tick + alpha) * 1000,
            foot,
            {
              behind: false,
              lift: h + 24 * m.resolutionScale,
              screenOffsetX:
                (i - (statuses.length - 1) / 2) * 28 * m.resolutionScale,
            },
          );
      }
      let view = this.actors.get(a.id);
      if (!view) {
        const root = new Container(),
          sprite = new Sprite(),
          details = frameGraphics();
        root.label = `actor:${a.id}`;
        root.addChild(sprite, details);
        view = { root, sprite, details };
        this.actors.set(a.id, view);
        this.figures.addChild(root);
      }
      setDepth(view.root, foot.y);
      view.root.position.set(q.x, q.y);
      view.root.visible =
        q.x > -h && q.x < c.width + h && q.y > -h && q.y < c.height + h;
      view.sprite.position.set(0, 0);
      view.sprite.rotation = 0;
      if (!this.bodies.apply(view.sprite, a, m.figureHeightPx))
        this.library.apply(view.sprite, a, player.team, h);
      const reduced = localStorage.getItem("mage-motion") === "reduced";
      this.feedback.recoil(view.sprite, a, c, reduced);
      this.bodies.settle(view.sprite, a, m.figureHeightPx, reduced);
      view.sprite.filters = this.feedback.flash(a)
        ? [this.feedback.white]
        : null;
      this.bodies.recordPose(a, view.sprite);
      const d = view.details;
      d.clear();
      const auraFade = a.tags.includes("DEFEATED")
        ? Math.max(
            0,
            1 - this.bodies.deathAge(a) / tuningFor(state).deathAuraFadeS,
          )
        : 1;
      if (!a.enemy && !a.dummy && auraFade > 0) {
        this.clips.draw(
          `${this.clips.element(a)}.aura`,
          seconds(state.tick + alpha) * 1000,
          foot,
          {
            behind: true,
            lift: h * 0.36,
            opacity: animation.effects.auraOpacity * auraFade,
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
      if (a.hp < a.maxHp && !a.tags.includes("DEFEATED")) {
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
        if (this.debug)
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
        !a.tags.includes("DEFEATED") &&
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
    this.sigils.finish();
    this.debugLabel.visible = this.debugPanel.visible = this.debugEnabled;
    if (this.debugEnabled) {
      const messages = [...this.bodies.fallbacks],
        pageCount = Math.max(1, Math.ceil(messages.length / 10));
      const page = ((this.debugPage % pageCount) + pageCount) % pageCount;
      this.debugLabel.text =
        `ART DEBUG / F8 close / [ ] pages ${page + 1}/${pageCount}\nCharacter fallbacks logged once: ${messages.length} / A8 sprites: ${this.clips.snapshot().active}\n` +
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
    this.feedback.draw(state, c, player);
    const target = groundToScreen(aim, c),
      cross = 7 * m.resolutionScale;
    if (
      !this.sigils.draw("target", seconds(state.tick + alpha) * 1000, aim, {
        radius: 0.4,
        opacity: 0.85,
      })
    ) {
      e.circle(target.x, target.y, cross).stroke({
        color: 0xbce3d0,
        width: 1.5 * m.resolutionScale,
      });
      e.moveTo(target.x - cross * 1.5, target.y)
        .lineTo(target.x + cross * 1.5, target.y)
        .moveTo(target.x, target.y - cross * 1.5)
        .lineTo(target.x, target.y + cross * 1.5)
        .stroke({ color: 0xbce3d0, width: m.resolutionScale });
    }
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
    this.clips.end();
    this.sigils.end();
    this.collars.end();
    orderByDepth(this.figures);
  }
}
