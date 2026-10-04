import { Container, Matrix, Texture } from "pixi.js";
import {
  seconds,
  tuningFor,
  type Actor,
  type ArenaState,
  type Vec,
} from "@mage/core/arena";
import { art } from "./art.ts";
import {
  frameIndex,
  validateClips,
  type Element,
} from "./animation-contract.ts";
import {
  cameraMetrics,
  groundToScreen,
  contract,
  type Camera,
} from "./camera.ts";
import { sigilMesh } from "./sigil-shader.ts";
import {
  clampProgress,
  threatFrame,
  type SigilManifest,
  type ThreatExtent,
} from "./sigil-contract.ts";
import policy from "../data/sigils.json" with { type: "json" };
interface DrawOptions {
  angle?: number;
  opacity?: number;
  progress?: number;
  radius?: number;
  extent?: ThreatExtent;
  arcDeg?: number;
  lift?: number;
  screenOffsetX?: number;
  perfectWindowActive?: boolean;
  behind?: boolean;
}
interface Shot {
  clip: string;
  tick: number;
  at: Vec;
  actorId: number;
  angle?: number;
  radius?: number;
  holdMs?: number;
}
/** A13's independent ground/UV/rank contract, behind the shared verified asset loader. */
export class SigilPlayer {
  readonly behind = new Container();
  readonly front = new Container();
  manifest?: SigilManifest;
  readonly diagnostics: string[] = [];
  private pool: ReturnType<typeof sigilMesh>[] = [];
  private used = 0;
  private leases = new Map<string, number>();
  private state?: ArenaState;
  private eventIndex = 0;
  private wards = new Map<
    number,
    { at: Vec; angle: number; active: boolean }
  >();
  private shots: Shot[] = [];
  private disposed = false;
  private c!: Camera;
  private tick = 0;
  private serial = 0;
  private cpuMs = 0;
  private seen = new Set<string>();
  private castHolds = new Map<number, number>();
  private elements = new Map<number, Element>();
  constructor() {
    void this.init();
  }
  private async init() {
    try {
      const m = (await art.json("a13.manifest")) as SigilManifest;
      validateClips(m.pages, Object.values(m.clips));
      if (
        m.schemaVersion !== 1 ||
        Object.values(m.clips).some((c) => !c.anchor || !c.designFrameSize1080)
      )
        throw Error("Invalid A13 contract");
      if (!this.disposed) this.manifest = m;
    } catch (e) {
      this.diagnostics.push(String(e));
    }
  }
  private page(key: string) {
    if (!this.leases.has(key)) {
      art.retain(key);
      void art.load(key);
    }
    this.leases.set(key, this.serial);
    return art.get(key);
  }
  begin(state: ArenaState, c: Camera, alpha: number) {
    const start = performance.now();
    this.c = c;
    this.tick = state.tick + alpha;
    this.used = 0;
    this.serial++;
    for (const mesh of this.pool) mesh.visible = false;
    if (this.state !== state || state.events.length < this.eventIndex) {
      this.state = state;
      this.eventIndex = Math.max(
        0,
        state.events.findIndex((e) => e.tick >= state.tick - 1),
      );
      this.wards.clear();
      this.castHolds.clear();
      this.elements.clear();
      this.shots = [];
    }
    for (const event of state.events.slice(this.eventIndex)) {
      if (state.tick - event.tick > 60) continue;
      const a = state.actors.find((a) => a.id === event.actorId);
      if (!a) continue;
      if (event.kind === "release")
        this.shots.push({
          clip: `cast.${this.elements.get(a.id) ?? a.school ?? "water"}.release`,
          holdMs: this.castHolds.get(a.id),
          tick: event.tick,
          at: { ...a.pos },
          actorId: a.id,
          radius: policy.castRadiusM,
        });
      if (event.kind === "perfect" || (event.kind === "hit" && event.guarded))
        this.shots.push({
          clip: event.kind === "perfect" ? "absorb.perfect" : "absorb.contact",
          tick: event.tick,
          at: { ...a.pos },
          actorId: a.id,
          angle: Math.atan2(a.facing.y, a.facing.x),
          radius: contract.absorb.visual_radius_metres,
        });
    }
    this.eventIndex = state.events.length;
    for (const a of state.actors) {
      const old = this.wards.get(a.id),
        angle = Math.atan2(a.facing.y, a.facing.x);
      if (old?.active && !a.absorb && !a.down)
        this.shots.push({
          clip: "ward.release",
          tick: state.tick,
          at: old.at,
          actorId: a.id,
          angle: old.angle,
          radius: contract.absorb.visual_radius_metres,
        });
      this.wards.set(a.id, { at: { ...a.pos }, angle, active: a.absorb });
    }
    this.shots = this.shots
      .filter((s) => {
        const clip = this.manifest?.clips[s.clip];
        return clip
          ? frameIndex(clip, seconds(this.tick - s.tick) * 1000) >= 0
          : this.tick - s.tick < 60;
      })
      .slice(-48);
    // Render-frame age works while the Lab is paused and while replay tick goes backwards.
    for (const [key, last] of this.leases)
      if (this.serial - last > policy.unusedPageSeconds * 60) {
        art.release(key);
        this.leases.delete(key);
      }
    this.cpuMs = performance.now() - start;
  }
  draw(
    id: string,
    elapsedMs: number,
    at: Vec,
    options: DrawOptions = {},
  ): boolean {
    const clip = this.manifest?.clips[id];
    if (!clip) return false;
    if (clip.kind === "perfect-window" && !options.perfectWindowActive)
      return true;
    const page = this.page(`a13.page.${clip.page}`);
    const rank = clip.progress
      ? this.page(`a13.mask.${clip.progress.mask.split("/").at(-1)}`)
      : Texture.WHITE;
    if (!page || !rank) return false;
    const index = frameIndex(clip, elapsedMs);
    if (index < 0) return true;
    if (this.used >= policy.maxDecals) return true;
    const start = performance.now();
    let mesh = this.pool[this.used++];
    if (!mesh) {
      mesh = sigilMesh();
      this.pool.push(mesh);
    }
    const parent =
      options.behind === false || clip.plane !== "unprojected ground"
        ? this.front
        : this.behind;
    if (mesh.parent !== parent) parent.addChild(mesh);
    mesh.visible = true;
    mesh.alpha = options.opacity ?? 1;
    const m = cameraMetrics(this.c),
      q = groundToScreen(at, this.c);
    let size: [number, number] = clip.designFrameSize1080.map(
      (n) => n * m.resolutionScale,
    ) as [number, number];
    if (options.extent)
      size = threatFrame(clip, options.extent).map(
        (n) => n * m.pxPerMetreX,
      ) as [number, number];
    else if (options.radius)
      size = [
        (options.radius * m.pxPerMetreX) / clip.nominalBoundaryRadiusUV,
        (options.radius * m.pxPerMetreX) / clip.nominalBoundaryRadiusUV,
      ];
    if (id.startsWith("status."))
      size = size.map((n) =>
        Math.max(policy.minimumStatusPx * m.resolutionScale, n),
      ) as [number, number];
    const angle = options.angle ?? 0,
      cs = Math.cos(angle),
      sn = Math.sin(angle),
      squash =
        clip.plane === "unprojected ground" ? m.pxPerMetreY / m.pxPerMetreX : 1;
    const ax =
        size[0] * (options.extent?.shape === "line" ? 0.5 : clip.anchor[0]),
      ay = size[1] * clip.anchor[1];
    mesh.setFromMatrix(
      new Matrix(
        cs * size[0],
        sn * squash * size[0],
        -sn * size[1],
        cs * squash * size[1],
        q.x - cs * ax + sn * ay + (options.screenOffsetX ?? 0),
        q.y - (sn * ax + cs * ay) * squash - (options.lift ?? 0),
      ),
    );
    const shader = mesh.shader!,
      uniforms = shader.resources.sigilUniforms.uniforms;
    shader.resources.uPaint = page.source;
    shader.resources.uRank = rank.source;
    const rect = clip.frames[index]!.rect,
      next = clip.frames[(index + 1) % clip.frames.length]!.rect;
    const uv = (r: number[]) =>
      new Float32Array([
        r[0]! / page.width,
        r[1]! / page.height,
        r[2]! / page.width,
        r[3]! / page.height,
      ]);
    uniforms.uFrame = uv(rect);
    uniforms.uNext = uv(next);
    const total = clip.frames.reduce((n, f) => n + f.durationMs, 0),
      before = clip.frames
        .slice(0, index)
        .reduce((n, f) => n + f.durationMs, 0);
    const fraction =
      ((elapsedMs % total) - before) / clip.frames[index]!.durationMs;
    uniforms.uBlend = new Float32Array([
      clip.loop ? clampProgress((fraction - 0.72) / 0.28) : 0,
      clip.progress && options.progress !== undefined ? 1 : 0,
    ]);
    uniforms.uParams = new Float32Array([
      clampProgress(options.progress ?? 1),
      clip.progress?.baseOpacity ?? 1,
      clip.shape === "cone" ? 90 / (options.extent?.degrees ?? 90) : 0,
      options.arcDeg ? (options.arcDeg * Math.PI) / 360 : 0,
    ]);
    uniforms.uLaneRepeat =
      options.extent?.shape === "line"
        ? Math.max(
            1,
            Math.floor(
              (options.extent.range * m.pxPerMetreX) /
                (120 * m.resolutionScale),
            ),
          )
        : 1;
    shader.resources.sigilUniforms.update();
    this.seen.add(id);
    this.cpuMs += performance.now() - start;
    return true;
  }
  threat(
    element: Element,
    at: Vec,
    extent: ThreatExtent,
    progress: number,
    elapsed: number,
    angle: number,
    unblockable: boolean,
  ) {
    const centre =
      extent.shape === "line"
        ? {
            x: at.x + (Math.cos(angle) * extent.range) / 2,
            y: at.y + (Math.sin(angle) * extent.range) / 2,
          }
        : at;
    const drawn = this.draw(
      `threat.${element}.${extent.shape}`,
      elapsed,
      centre,
      {
        extent,
        progress,
        angle,
      },
    );
    if (drawn)
      this.draw(
        unblockable ? "warning.unblockable" : "warning.normal",
        elapsed,
        at,
        { behind: false, lift: 26 * cameraMetrics(this.c).resolutionScale },
      );
    return drawn;
  }
  casting(a: Actor, element: Element, timing = a.pending) {
    if (!timing || a.down) return;
    this.elements.set(a.id, element);
    const duration = Math.max(1, timing.releaseTick - timing.startTick),
      elapsed = this.tick - timing.startTick;
    const start = this.manifest?.clips[`cast.${element}.start`];
    if (!start) return;
    const startMs = start.frames.reduce((n, f) => n + f.durationMs, 0),
      phase = elapsed / duration;
    this.castHolds.set(
      a.id,
      Math.max(
        0,
        seconds(elapsed - duration * policy.castStartFraction) * 1000,
      ),
    );
    this.draw(
      `cast.${element}.${phase < policy.castStartFraction ? "start" : "hold"}`,
      phase < policy.castStartFraction
        ? Math.min(
            startMs - 0.001,
            (phase / policy.castStartFraction) * startMs,
          )
        : seconds(elapsed - duration * policy.castStartFraction) * 1000,
      a.pos,
      { radius: policy.castRadiusM },
    );
  }
  ward(a: Actor, at: Vec, radius: number) {
    const elapsed = seconds(this.tick - a.absorbFreshTick) * 1000,
      tune = tuningFor(this.state!);
    const start = this.manifest?.clips["ward.start"],
      duration = start?.frames.reduce((n, f) => n + f.durationMs, 0) ?? 0;
    const angle = Math.atan2(a.facing.y, a.facing.x),
      fresh =
        this.state!.tick - a.absorbFreshTick <=
        Math.ceil(tune.absorbWindowS * 60 - 1e-9);
    const drawn = this.draw(
      elapsed < duration ? "ward.start" : "ward.hold",
      elapsed < duration ? elapsed : elapsed - duration,
      at,
      {
        angle,
        radius,
        arcDeg: tune.absorbArcDeg,
        progress: clampProgress(
          elapsed / Math.max(1, tune.absorbWindowS * 1000),
        ),
      },
    );
    if (fresh)
      this.draw("absorb.window", elapsed, at, {
        radius,
        angle,
        perfectWindowActive: true,
      });
    return drawn;
  }
  finish() {
    for (const s of this.shots) {
      const actor = this.state?.actors.find((a) => a.id === s.actorId);
      if (actor?.down) continue;
      const elapsed = seconds(this.tick - s.tick) * 1000,
        blend = clampProgress(elapsed / policy.releaseCrossfadeMs);
      if (s.holdMs !== undefined && blend < 1)
        this.draw(s.clip.replace(".release", ".hold"), s.holdMs, s.at, {
          radius: s.radius,
          opacity: 1 - blend,
        });
      this.draw(s.clip, seconds(this.tick - s.tick) * 1000, s.at, {
        angle: s.angle,
        radius: s.radius,
        opacity: s.holdMs !== undefined ? blend : 1,
        arcDeg: s.clip.startsWith("ward.")
          ? tuningFor(this.state!).absorbArcDeg
          : undefined,
      });
    }
  }
  snapshot() {
    return {
      active: this.used,
      allocated: this.pool.length,
      pages: this.leases.size,
      cpuMs: this.cpuMs,
      clips: [...this.seen],
      diagnostics: [...this.diagnostics],
    };
  }
  dispose() {
    this.disposed = true;
    for (const mesh of this.pool) {
      mesh.shader?.destroy();
      mesh.geometry.destroy();
      mesh.destroy();
    }
    this.behind.destroy();
    this.front.destroy();
    for (const key of this.leases.keys()) art.release(key);
    this.leases.clear();
  }
}
