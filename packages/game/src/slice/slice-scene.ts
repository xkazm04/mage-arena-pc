import {
  Assets,
  ColorMatrixFilter,
  Container,
  Matrix,
  Rectangle,
  Sprite,
  Texture,
} from "pixi.js";
import type { Vec } from "@mage/core/arena";
import {
  cameraMetrics,
  contract,
  groundToScreen,
  type Camera,
} from "../camera.ts";
import { EffectPlayer } from "../effect-player.ts";
import { SigilPlayer } from "../sigil-player.ts";
import { frameGraphics } from "../pixi-fixes.ts";
import { litBodyMesh, setLights } from "../lighting/lit-body.ts";
import {
  keyLightAt,
  lightInQuad,
  type LightingTier,
  type ScreenLight,
} from "../lighting/tier.ts";
import {
  SliceFixture,
  sliceBodyPx,
  sliceHash,
  slicePresentation,
  sliceSway,
  type SliceLight,
} from "./slice-fixture.ts";
import {
  plateFiles,
  slicePick,
  sliceUrl,
  type SliceOptions,
} from "./slice-pick.ts";

/** Where the verdigris floor plate paints the centre of its sand oval, in plate pixels (1920 x 1080). */
const plateDuel = [960, 650] as const;
const plateSize = [1920, 1080] as const;
type BodySlot = "water" | "fire";
interface Body {
  slot: BodySlot;
  color?: Texture;
  normal?: Texture;
  normalSource: "painted" | "derived" | "loading" | "failed";
  mesh?: ReturnType<typeof litBodyMesh>;
  sprite: Sprite;
  shadow: Sprite;
  lit: boolean;
  lights: number;
}
/** One soft white disc, drawn once: light pools on the floor (additive) and the vignette's inverse. */
function radialTexture(size: number, stops: [number, string][]) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!,
    gradient = g.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
  for (const [at, colour] of stops) gradient.addColorStop(at, colour);
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}
const rgb = (c: readonly number[]) =>
  (Math.round(c[0]! * 255) << 16) |
  (Math.round(c[1]! * 255) << 8) |
  Math.round(c[2]! * 255);
const nearestOnSegment = (a: Vec, b: Vec, p: Vec): Vec => {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(
      0,
      Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)),
    );
  return { x: a.x + dx * t, y: a.y + dy * t };
};

/**
 * The D2 section 5 mastery slice, drawn on its own layers in place of the arena scene (provisional pick, see
 * `slice-pick.ts`): layered verdigris plates with a little parallax, two painted bodies lit through `litBodyMesh` by
 * the spells, the flame cone's a13 telegraph and the meteor's filled disc and the beam's strip through `SigilPlayer`,
 * a8 flame clips through `EffectPlayer`, additive light pools on the floor, a procedural lightning bolt, dust and
 * embers, a colour grade and a vignette. Presentation only.
 */
export class SliceScene {
  readonly root = new Container();
  readonly sigils = new SigilPlayer();
  readonly clips = new EffectPlayer();
  private floor = new Sprite();
  private wall = new Sprite();
  private rim = new Sprite();
  private pools = new Container();
  private poolSprites: Sprite[] = [];
  private poolsUsed = 0;
  private shadows = frameGraphics();
  private figures = new Container();
  private fx = frameGraphics();
  private embers = frameGraphics();
  private dust = frameGraphics();
  private vignette = new Sprite();
  private grade?: ColorMatrixFilter;
  private poolTexture: Texture;
  private vignetteTexture: Texture;
  private bodies: Body[];
  private urls: string[] = [];
  private disposed = false;
  readonly diagnostics: string[] = [];
  /** Settles once every slice texture has loaded or failed. */
  readonly loaded: Promise<void>;
  constructor(
    readonly fixture: SliceFixture,
    readonly options: SliceOptions,
    readonly tier: LightingTier,
  ) {
    this.root.label = "slice";
    this.poolTexture = radialTexture(128, [
      [0, "rgba(255,255,255,1)"],
      [0.35, "rgba(255,255,255,0.45)"],
      [1, "rgba(255,255,255,0)"],
    ]);
    this.vignetteTexture = radialTexture(256, [
      [0, "rgba(4,7,10,0)"],
      [0.55, "rgba(4,7,10,0)"],
      [1, "rgba(4,7,10,0.85)"],
    ]);
    this.pools.blendMode = "add";
    this.fx.blendMode = "add";
    this.embers.blendMode = "add";
    this.vignette.texture = this.vignetteTexture;
    this.vignette.visible = options.grade;
    for (const s of [this.floor, this.wall, this.rim]) s.anchor.set(0.5);
    this.bodies = (["water", "fire"] as const).map((slot) => ({
      slot,
      normalSource: "loading",
      sprite: new Sprite(),
      shadow: new Sprite(),
      lit: false,
      lights: 0,
    }));
    for (const b of this.bodies) {
      b.shadow.tint = 0x000000;
      b.shadow.visible = b.sprite.visible = false;
    }
    for (const [a, e] of this.fixture.elements)
      this.clips.elementOverrides.set(a, e);
    this.root.addChild(
      this.floor,
      this.wall,
      this.pools,
      this.sigils.behind,
      this.clips.behind,
      this.shadows,
      ...this.bodies.map((b) => b.shadow),
      this.figures,
      this.clips.front,
      this.sigils.front,
      this.fx,
      this.rim,
      this.dust,
      this.embers,
      this.vignette,
    );
    if (options.grade) {
      // Dusk grade: a touch more contrast, warmer highlights, cooler shadows (one colour matrix, one full-screen pass).
      this.grade = new ColorMatrixFilter();
      // prettier-ignore
      this.grade.matrix = [
        1.15, 0, 0, 0, -0.05,
        0, 1.1, 0, 0, -0.05,
        0, 0, 1.02, 0, -0.03,
        0, 0, 0, 1, 0,
      ];
      this.root.filters = [this.grade];
    }
    this.loaded = this.load();
  }
  private async texture(url: string) {
    this.urls.push(url);
    return Assets.load<Texture>(url);
  }
  private async load() {
    const plate = async (sprite: Sprite, role: keyof typeof plateFiles) => {
      try {
        const t = await this.texture(sliceUrl("plates", role));
        if (!this.disposed) sprite.texture = t;
      } catch (e) {
        this.diagnostics.push(`Slice plate ${role}: ${String(e)}`);
      }
    };
    const body = async (b: Body) => {
      try {
        b.color = await this.texture(sliceUrl(b.slot, "color"));
        if (this.disposed) return;
        b.sprite.texture = b.shadow.texture = b.color;
      } catch (e) {
        this.diagnostics.push(`Slice body ${b.slot}: ${String(e)}`);
        b.normalSource = "failed";
        return;
      }
      // The provider-painted normal map, or the derived one (0 calls) when asked for or when the painted one fails.
      const order =
        this.options.normals === "painted"
          ? (["painted", "derived"] as const)
          : (["derived"] as const);
      for (const source of order)
        try {
          b.normal = await this.texture(
            sliceUrl(
              b.slot,
              source === "painted" ? "normalPainted" : "normalDerived",
            ),
          );
          b.normalSource = source;
          return;
        } catch (e) {
          this.diagnostics.push(
            `Slice ${source} normal ${b.slot}: ${String(e)}`,
          );
        }
      b.normalSource = "failed";
    };
    await Promise.all([
      plate(this.floor, "floor"),
      plate(this.wall, "wall"),
      plate(this.rim, "rim"),
      ...this.bodies.map(body),
      this.sigils.loaded,
      this.clips.loaded,
    ]);
  }
  private pool(at: { x: number; y: number }, rx: number, ry: number) {
    let s = this.poolSprites[this.poolsUsed++];
    if (!s) {
      s = new Sprite(this.poolTexture);
      s.anchor.set(0.5);
      this.poolSprites.push(s);
      this.pools.addChild(s);
    }
    s.visible = true;
    s.position.set(at.x, at.y);
    s.width = rx * 2;
    s.height = ry * 2;
    return s;
  }
  /** A spell light as the lit-body shader sees it from one body: a segment light gives its nearest point. */
  private screenLight(
    l: SliceLight,
    foot: Vec,
    c: Camera,
  ): { light: ScreenLight; strength: number; ground: Vec; heightM: number } {
    const m = cameraMetrics(c),
      ground = l.to ? nearestOnSegment(l.at, l.to, foot) : l.at,
      q = groundToScreen(ground, c),
      dist = Math.hypot(ground.x - foot.x, ground.y - foot.y, l.heightM - 1);
    return {
      light: {
        x: q.x,
        y: q.y - l.heightM * m.pxPerMetreX,
        // Out of the screen plane: how far the light stands in front of the body, never quite behind it.
        z: Math.max(0.3, ground.y - foot.y + 0.5) * m.pxPerMetreX,
        radius: l.radiusM * m.pxPerMetreX * Math.min(1.5, l.intensity),
        color: [...l.color],
      },
      strength: l.intensity * Math.max(0, 1 - dist / (l.radiusM * 1.2)) ** 2,
      ground,
      heightM: l.heightM,
    };
  }
  render(c: Camera, dt: number) {
    const f = this.fixture;
    f.update(dt);
    const t = f.timeS,
      m = cameraMetrics(c),
      px = m.pxPerMetreX,
      py = m.pxPerMetreY,
      k = c.height / 1440,
      state = f.state,
      ms = t * 1000,
      lights = f.lights(),
      p = slicePresentation;
    const area = this.root.filterArea;
    if (area?.width !== c.width || area.height !== c.height)
      this.root.filterArea = new Rectangle(0, 0, c.width, c.height);
    // Plates: screen-fitted paintings, the sand oval's centre on the duel; sway moves each layer by its parallax.
    const scale =
        Math.max(c.width / plateSize[0], c.height / plateSize[1]) *
        p.plateOverscan,
      sway = sliceSway(t);
    for (const [sprite, factor] of [
      [this.floor, p.parallax.floor],
      [this.wall, p.parallax.wall],
      [this.rim, p.parallax.rim],
    ] as const) {
      sprite.scale.set(scale);
      sprite.position.set(
        p.duelScreen[0] * c.width -
          (plateDuel[0] - plateSize[0] / 2) * scale -
          sway.x * px * factor,
        p.duelScreen[1] * c.height -
          (plateDuel[1] - plateSize[1] / 2) * scale -
          sway.y * py * factor,
      );
    }
    // Light pools on the floor: additive, the light's colour, an ellipse of its reach (no floor normal map).
    this.poolsUsed = 0;
    for (const l of lights) {
      if (l.intensity <= 0.02) continue;
      const alpha =
          Math.min(1, l.intensity) * (l.id === "lightning" ? 0.3 : 0.38),
        reach = l.radiusM * 0.75;
      const spots = l.to
        ? Array.from({ length: 17 }, (_, i) => ({
            x: l.at.x + ((l.to!.x - l.at.x) * i) / 16,
            y: l.at.y + ((l.to!.y - l.at.y) * i) / 16,
          }))
        : [l.at];
      for (const at of spots) {
        const q = groundToScreen(at, c);
        if (q.x < -reach * px || q.x > c.width + reach * px) continue;
        const s = this.pool(
          q,
          (l.to ? 0.55 : 1) * reach * px,
          (l.to ? 0.55 : 1) * reach * py,
        );
        s.tint = rgb(l.color);
        s.alpha = alpha;
      }
    }
    for (let i = this.poolsUsed; i < this.poolSprites.length; i++)
      this.poolSprites[i]!.visible = false;
    // Sigils: the cone telegraph (painted a13), the meteor disc and the beam strip (procedural), the ward.
    this.sigils.begin(state, c, 0);
    for (const tel of state.telegraphs)
      this.sigils.threat(
        "fire",
        tel.origin,
        { shape: "cone", range: tel.rangeM, degrees: tel.widthM },
        f.cone().progress,
        ms,
        Math.atan2(tel.target.y - tel.origin.y, tel.target.x - tel.origin.x),
        false,
      );
    this.sigils.schoolShapes(state, (a) =>
      a ? (f.elements.get(a.id) ?? "water") : "water",
    );
    this.sigils.ward(f.water, f.water.pos, p.wardRadiusM);
    this.sigils.finish();
    this.sigils.end();
    // a8 clips: the water ward's membrane, the flame stream fanned through the cone, impacts on the ward and the meteor.
    // a8 sizes follow the far camera's figure (1.5x a body); `fig` brings them back to the slice body.
    const fig = 1 / contract.character.draw_multiplier;
    this.clips.begin(state, c, 0, dt);
    this.clips.draw("absorb.hold", ms, f.water.pos, {
      angle: 0,
      barrier: true,
      scale: 0.42,
      opacity: 0.8,
    });
    const cone = f.cone();
    if (cone.stream > 0) {
      const from = f.fire.pos,
        aim = Math.atan2(f.water.pos.y - from.y, f.water.pos.x - from.x);
      for (let i = 0; i < 9; i++) {
        const phase = (cone.streamAge * 1.9 + i / 9) % 1,
          spread =
            ((sliceHash(i + 3) - 0.5) * p.cone.degrees * 0.7 * Math.PI) / 180,
          d = 0.5 + phase * (p.cone.rangeM - 1.3),
          at = {
            x: from.x + Math.cos(aim + spread) * d,
            y: from.y + Math.sin(aim + spread) * d,
          };
        this.clips.draw("fire.travel", ms + i * 37, at, {
          angle: aim + spread,
          lift: (1.15 - 0.2 * phase) * px,
          scale: fig * (0.25 + 0.35 * phase),
          opacity: cone.stream * (1 - phase ** 2) * 0.95,
        });
      }
      const ward = {
        x: f.water.pos.x + p.wardRadiusM,
        y: f.water.pos.y,
      };
      this.clips.draw("fire.impact", (cone.streamAge % 0.36) * 1000, ward, {
        lift: 1.0 * px,
        scale: fig * 0.55,
        opacity: cone.stream * 0.9,
      });
    }
    const meteor = f.meteor();
    if (meteor.sinceImpactS !== undefined && meteor.sinceImpactS < 0.6)
      this.clips.draw("fire.impact", meteor.sinceImpactS * 1000, f.meteorAt, {
        scale: fig * 1.6,
        opacity: 0.95,
      });
    this.clips.end();
    // Bodies: the painted body lit through litBodyMesh by a key light and the spells, depth-sorted by foot.
    const g = this.shadows;
    g.clear();
    const H = sliceBodyPx(c.height);
    const actors = { water: f.water, fire: f.fire };
    for (const b of this.bodies) {
      const a = actors[b.slot],
        q = groundToScreen(a.pos, c),
        tex = b.color;
      g.ellipse(q.x, q.y - 2 * k, H * 0.2, H * 0.055).fill({
        color: 0x05080b,
        alpha: 0.45,
      });
      if (!tex) continue;
      const W = (H * tex.width) / tex.height,
        mirror = b.slot === "fire" ? -1 : 1,
        quad = new Matrix(mirror * W, 0, 0, H, q.x - (mirror * W) / 2, q.y - H),
        size: [number, number] = [tex.width, tex.height];
      const spell = lights
          .filter((l) => l.intensity > 0.01)
          .map((l) => this.screenLight(l, a.pos, c)),
        key = keyLightAt(q, px, py),
        shown = [key, ...spell.map((s) => s.light)].map((l) =>
          lightInQuad(quad, size, l),
        );
      b.lights = shown.length;
      // A projected shadow from the strongest spell light, falling away from it across the floor.
      const strongest = spell.toSorted((x, y) => y.strength - x.strength)[0];
      if (strongest && strongest.strength > 0.04) {
        const gx = a.pos.x - strongest.ground.x,
          gy = a.pos.y - strongest.ground.y,
          gl = Math.hypot(gx, gy) || 1,
          tip = groundToScreen(
            { x: a.pos.x + gx / gl, y: a.pos.y + gy / gl },
            c,
          ),
          sx = tip.x - q.x,
          sy = tip.y - q.y,
          sl = Math.hypot(sx, sy) || 1,
          L = (0.9 / (1 + strongest.heightM / 2)) * H;
        b.shadow.setFromMatrix(
          new Matrix(
            (mirror * W) / tex.width,
            0,
            (-L * sx) / sl / tex.height,
            (-L * sy) / sl / tex.height,
            q.x - (mirror * W) / 2 + (L * sx) / sl,
            q.y + (L * sy) / sl,
          ),
        );
        b.shadow.alpha = Math.min(0.4, strongest.strength * 0.7);
        b.shadow.visible = true;
      } else b.shadow.visible = false;
      b.lit =
        this.tier === "lit" &&
        !!b.normal &&
        (b.normalSource === "painted" || b.normalSource === "derived");
      if (b.lit) {
        if (!b.mesh) {
          b.mesh = litBodyMesh(tex, b.normal);
          b.mesh.label = `slice-body:${b.slot}`;
          this.figures.addChild(b.mesh);
        }
        b.mesh.setFromMatrix(quad);
        setLights(b.mesh, shown, size);
        b.mesh.visible = true;
        b.sprite.visible = false;
      } else {
        if (!b.sprite.parent) this.figures.addChild(b.sprite);
        b.sprite.setFromMatrix(
          new Matrix(
            quad.a / tex.width,
            0,
            0,
            quad.d / tex.height,
            quad.tx,
            quad.ty,
          ),
        );
        b.sprite.visible = true;
        if (b.mesh) b.mesh.visible = false;
      }
    }
    // The nearer body (larger foot y) draws last.
    const order = this.bodies.toSorted(
      (x, y) => actors[x.slot].pos.y - actors[y.slot].pos.y,
    );
    order
      .map((b) => (b.lit ? b.mesh : b.sprite))
      .filter((v) => v?.parent === this.figures)
      .forEach((v, i) => {
        if (this.figures.getChildIndex(v!) !== i)
          this.figures.setChildIndex(v!, i);
      });
    this.drawFx(c, lights, k);
    this.drawAir(c, t, k);
    this.vignette.width = c.width;
    this.vignette.height = c.height;
  }
  /** Additive light shapes with no painted art: the lightning bolt and the falling meteor. */
  private drawFx(c: Camera, lights: SliceLight[], k: number) {
    const f = this.fixture,
      m = cameraMetrics(c),
      px = m.pxPerMetreX,
      e = this.fx;
    e.clear();
    const beam = lights.find((l) => l.id === "lightning")!,
      lift = beam.heightM * px,
      a = groundToScreen(beam.at, c),
      b = groundToScreen(beam.to!, c),
      lengthM = Math.hypot(beam.to!.x - beam.at.x, beam.to!.y - beam.at.y),
      n = Math.ceil(lengthM / 0.7),
      step = Math.floor((f.timeS * 1000) / slicePresentation.beam.flickerMs),
      nx = -(b.y - a.y) / Math.hypot(b.x - a.x, b.y - a.y),
      ny = (b.x - a.x) / Math.hypot(b.x - a.x, b.y - a.y);
    const points = Array.from({ length: n + 1 }, (_, i) => {
      const j =
        i === 0 || i === n ? 0 : (sliceHash(step * 131 + i) - 0.5) * 0.45 * px;
      return {
        x: a.x + ((b.x - a.x) * i) / n + nx * j,
        y: a.y + ((b.y - a.y) * i) / n - lift + ny * j,
      };
    });
    const stroke = (width: number, color: number, alpha: number) => {
      points.forEach((q, i) => (i ? e.lineTo(q.x, q.y) : e.moveTo(q.x, q.y)));
      e.stroke({
        width: width * k,
        color,
        alpha: alpha * beam.intensity,
        cap: "round",
        join: "round",
      });
    };
    stroke(26, 0x3d7cff, 0.16);
    stroke(9, 0x8fc6ff, 0.45);
    stroke(3, 0xf4fbff, 1);
    // Two short forks off the main bolt.
    for (let fork = 0; fork < 2; fork++) {
      const from = points[Math.floor(n * (0.3 + 0.35 * fork))]!,
        len = 3 + Math.floor(sliceHash(step + fork * 7) * 3);
      e.moveTo(from.x, from.y);
      let x = from.x,
        y = from.y;
      for (let i = 0; i < len; i++) {
        x += (sliceHash(step * 17 + fork * 29 + i) - 0.3) * 0.5 * px;
        y += (sliceHash(step * 23 + fork * 31 + i) - 0.2) * 0.35 * px;
        e.lineTo(x, y);
      }
      e.stroke({ width: 2 * k, color: 0xcfe6ff, alpha: 0.7 * beam.intensity });
    }
    const meteor = f.meteor();
    if (meteor.fill !== undefined && meteor.liftM > 0.2) {
      const ground = groundToScreen(f.meteorAt, c),
        drift = meteor.liftM * px * 0.35,
        x = ground.x + drift,
        y = ground.y - meteor.liftM * px,
        r = 0.32 * px;
      const tail = { x: x + 0.45 * px, y: y - 1.3 * px };
      for (const [width, color, alpha] of [
        [r * 2.4, 0xff5a12, 0.22],
        [r * 1.2, 0xff9a3a, 0.5],
        [r * 0.5, 0xfff0c8, 0.8],
      ] as const) {
        e.moveTo(tail.x, tail.y).lineTo(x, y);
        e.stroke({ width, color, alpha, cap: "round" });
      }
      e.circle(x, y, r * 1.8).fill({ color: 0xff6a18, alpha: 0.35 });
      e.circle(x, y, r).fill({ color: 0xffb060, alpha: 0.9 });
      e.circle(x, y, r * 0.5).fill({ color: 0xfff6e0, alpha: 1 });
    }
  }
  /** Atmosphere: dust drifting in the air and embers rising off the flame (deterministic, presentation only). */
  private drawAir(c: Camera, t: number, k: number) {
    const f = this.fixture,
      m = cameraMetrics(c),
      px = m.pxPerMetreX,
      d = this.dust,
      e = this.embers;
    d.clear();
    e.clear();
    for (let i = 0; i < 70; i++) {
      const x =
          ((((sliceHash(i) + t * 0.008 * (sliceHash(i + 3) + 0.3)) % 1) + 1) %
            1) *
          c.width,
        y =
          (0.3 + sliceHash(i + 5) * 0.65) * c.height +
          Math.sin(t * 0.6 + i) * 6 * k;
      d.circle(x, y, (0.7 + sliceHash(i + 7) * 1.3) * k).fill({
        color: 0xd9c9a6,
        alpha: 0.1 + sliceHash(i + 9) * 0.2,
      });
    }
    const cone = f.cone(),
      from = f.fire.pos,
      to = f.water.pos;
    for (let i = 0; i < 40; i++) {
      const life = 1.6,
        phase = (t / life + sliceHash(i + 11)) % 1,
        along = sliceHash(i + 13),
        ground = {
          x: from.x + (to.x - from.x) * along * 0.8,
          y: from.y + (to.y - from.y) * along + (sliceHash(i + 15) - 0.5) * 1.2,
        },
        q = groundToScreen(ground, c),
        heat = Math.max(0.15, cone.stream),
        x = q.x + (sliceHash(i + 17) - 0.5) * 1.4 * px * phase,
        y = q.y - (1 + phase * 1.8) * px;
      e.circle(x, y, (1.1 + sliceHash(i + 19) * 1.6) * k).fill({
        color: 0xffa040,
        alpha: (1 - phase) * 0.9 * heat,
      });
    }
  }
  snapshot() {
    return {
      fixture: this.fixture.snapshot(),
      pick: { ...slicePick },
      tier: this.tier,
      options: { ...this.options },
      plates: {
        floor: this.floor.texture !== Texture.EMPTY,
        wall: this.wall.texture !== Texture.EMPTY,
        rim: this.rim.texture !== Texture.EMPTY,
      },
      bodies: this.bodies.map((b) => ({
        slot: b.slot,
        candidate: slicePick[b.slot],
        loaded: !!b.color,
        lit: b.lit,
        normals: b.normalSource,
        lights: b.lights,
        shadow: b.shadow.visible,
      })),
      pools: this.poolsUsed,
      grade: !!this.grade,
      sigils: this.sigils.snapshot(),
      effects: this.clips.snapshot(),
      diagnostics: [...this.diagnostics],
    };
  }
  dispose() {
    this.disposed = true;
    this.sigils.dispose();
    this.clips.dispose();
    for (const b of this.bodies) {
      b.mesh?.shader?.destroy();
      b.mesh?.geometry.destroy();
    }
    this.root.destroy({ children: true });
    this.grade?.destroy();
    this.poolTexture.destroy(true);
    this.vignetteTexture.destroy(true);
    void Assets.unload(this.urls).catch(() => {});
  }
}
