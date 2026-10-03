import {
  admit,
  audioData as data,
  dbGain,
  nextTrackDelay,
  playlistFor,
  settingsFrom,
  validateAudioManifest,
  variation,
  type ActiveSound,
  type AudioManifest,
  type AudioSettings,
  type Bus,
  type Cue,
  type OneShotBus,
} from "./audio-policy.ts";

interface Playing extends ActiveSound {
  source: AudioBufferSourceNode;
  gain: GainNode;
  pan: StereoPannerNode;
}
interface Music {
  id: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
  started: number;
  offset: number;
  duration: number;
}
interface Log {
  time: number;
  event: string;
  cue?: string;
  detail?: unknown;
}

/** Replaceable asset boundary. A bad/missing asset resolves to silence, once. */
export class AudioLoader {
  manifest?: AudioManifest;
  private loading?: Promise<void>;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  constructor(
    private readonly log: (
      event: string,
      cue?: string,
      detail?: unknown,
    ) => void,
  ) {}
  init() {
    return (this.loading ??= (async () => {
      try {
        const r = await fetch(data.manifestUrl, {
          signal: AbortSignal.timeout(data.limits.fetchTimeoutMs),
        });
        if (!r.ok) throw Error(`HTTP ${r.status}`);
        this.manifest = validateAudioManifest(await r.json());
        this.log(
          "manifest-ready",
          undefined,
          Object.keys(this.manifest.assets).length,
        );
      } catch (e) {
        this.log("manifest-silent", undefined, String(e));
      }
    })());
  }
  async buffer(
    id: string,
    context: BaseAudioContext,
  ): Promise<AudioBuffer | null> {
    await this.init();
    if (!this.buffers.has(id))
      this.buffers.set(
        id,
        (async () => {
          try {
            const asset = this.manifest?.assets[id];
            if (!asset) throw Error("Unavailable asset");
            const r = await fetch(`/audio/${asset.file}`, {
              signal: AbortSignal.timeout(data.limits.fetchTimeoutMs),
            });
            if (!r.ok) throw Error(`HTTP ${r.status}`);
            const bytes = await r.arrayBuffer();
            if (bytes.byteLength > data.limits.maxAssetBytes)
              throw Error("Asset too large");
            const digest = [
              ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
            ]
              .map((n) => n.toString(16).padStart(2, "0"))
              .join("");
            if (digest !== asset.sha256) throw Error("Asset checksum mismatch");
            const buffer = await context.decodeAudioData(bytes);
            if (
              buffer.duration > data.limits.maxDurationSeconds ||
              Math.abs(buffer.duration - asset.duration) > 0.2
            )
              throw Error("Asset duration mismatch");
            this.log("decoded", id, {
              duration: buffer.duration,
              channels: buffer.numberOfChannels,
            });
            return buffer;
          } catch (e) {
            this.log("asset-silent", id, String(e));
            return null;
          }
        })(),
      );
    return this.buffers.get(id)!;
  }
}

export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private inputs = {} as Record<Bus, GainNode>;
  private volumes = {} as Record<Bus, GainNode>;
  private ducks = {} as Record<Bus, GainNode>;
  private sounds = new Map<number, Playing>();
  private last = new Map<Cue, number>();
  private id = 0;
  private logs: Log[] = [];
  private music?: Music;
  private musicVoices = new Set<Music>();
  private scene = "silent";
  private playlistIndex = 0;
  private musicNextAt = Infinity;
  private musicRequest = 0;
  private musicLoading = false;
  private worldPaused = false;
  private pausedMusic?: { id: string; offset: number; scene: string };
  private dead = false;
  settings: AudioSettings = { ...data.defaults };
  readonly loader = new AudioLoader((e, c, d) => this.log(e, c, d));
  private log(event: string, cue?: string, detail?: unknown) {
    this.logs.push({
      time: this.context?.currentTime ?? 0,
      event,
      cue,
      detail,
    });
    if (this.logs.length > data.limits.logEntries) this.logs.shift();
  }
  init() {
    try {
      this.settings = settingsFrom(
        JSON.parse(localStorage.getItem("mage-audio") ?? "null"),
      );
    } catch {
      /* corrupt preferences use defaults */
    }
    void this.loader.init();
  }
  private compressor(
    spec: typeof data.effects.compressor,
  ): DynamicsCompressorNode {
    const node = this.context!.createDynamicsCompressor();
    for (const key of [
      "threshold",
      "knee",
      "ratio",
      "attack",
      "release",
    ] as const)
      node[key].value = spec[key];
    return node;
  }
  private ceiling() {
    const node = this.context!.createWaveShaper(),
      limit = dbGain(data.effects.sampleCeilingDb);
    node.curve = Float32Array.from({ length: 4097 }, (_, i) =>
      Math.max(-limit, Math.min(limit, i / 2048 - 1)),
    );
    node.oversample = "4x";
    return node;
  }
  /** Called only from pointer/key/controller gesture handlers, never on page load. */
  async unlock() {
    if (this.dead || this.context?.state === "running") return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master
          .connect(this.compressor(data.masterLimiter))
          .connect(this.ceiling())
          .connect(this.context.destination);
        for (const bus of ["music", "effects", "ui", "voice"] as const) {
          const input = this.context.createGain(),
            duck = this.context.createGain(),
            volume = this.context.createGain();
          this.inputs[bus] = input;
          this.ducks[bus] = duck;
          this.volumes[bus] = volume;
          if (bus === "effects") {
            const filter = this.context.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.value = data.effects.highCutHz;
            filter.Q.value = 0.707;
            input
              .connect(filter)
              .connect(this.compressor(data.effects.compressor))
              .connect(this.compressor(data.effects.limiter))
              .connect(this.ceiling())
              .connect(duck);
          } else input.connect(duck);
          duck.connect(volume).connect(this.master);
        }
        this.applySettings();
        this.log("context-created");
        for (const id of new Set(
          Object.values(data.cues).flatMap((c) => c.assets),
        ))
          void this.loader.buffer(id, this.context);
      }
      if (this.context.state !== "running") await this.context.resume();
      if (this.context.state === "running") {
        if (!this.logs.some((e) => e.event === "gesture-unlocked"))
          this.log("gesture-unlocked");
        if (!this.music && !this.musicLoading && !this.worldPaused) {
          const id = playlistFor(this.scene)[this.playlistIndex];
          if (id) void this.transition(id);
        }
      }
    } catch (e) {
      this.log("context-silent", undefined, String(e));
    }
  }
  setSettings(next: Partial<AudioSettings>) {
    this.settings = settingsFrom({ ...this.settings, ...next });
    try {
      localStorage.setItem("mage-audio", JSON.stringify(this.settings));
    } catch {
      /* storage is optional */
    }
    this.applySettings();
    this.log("settings", undefined, { ...this.settings });
  }
  private applySettings() {
    if (!this.context || !this.master) return;
    this.master.gain.setTargetAtTime(
      this.settings.muted ? 0 : this.settings.master,
      this.context.currentTime,
      0.015,
    );
    for (const bus of ["music", "effects", "ui", "voice"] as const)
      this.volumes[bus].gain.setTargetAtTime(
        this.settings[bus],
        this.context.currentTime,
        0.015,
      );
  }
  private duck() {
    if (!this.context) return;
    const voice = [...this.sounds.values()].some((s) => s.bus === "voice"),
      music = this.musicVoices.size > 0 && !this.worldPaused;
    for (const bus of ["music", "effects", "ui", "voice"] as const) {
      const db =
        (voice && bus !== "voice" ? data.duck.voice[bus] : 0) +
        (bus === "effects" && music ? data.duck.effectsUnderMusicDb : 0);
      const target = dbGain(db),
        param = this.ducks[bus].gain;
      param.setTargetAtTime(
        target,
        this.context.currentTime,
        target < param.value
          ? data.duck.attackSeconds
          : data.duck.releaseSeconds,
      );
    }
  }
  async play(cue: Cue, options: { pan?: number; gain?: number } = {}) {
    const context = this.context;
    if (!context || context.state !== "running" || this.dead) {
      this.log("locked", cue);
      return;
    }
    if (this.settings.muted || this.settings.master === 0) {
      this.log("muted", cue);
      return;
    }
    const requested = context.currentTime,
      v = variation(cue),
      buffer = await this.loader.buffer(v.asset, context);
    if (!buffer || this.dead) return;
    if (
      context.state !== "running" ||
      (context.currentTime - requested) * 1000 > data.limits.lateCueMs
    ) {
      this.log("late-drop", cue);
      return;
    }
    const policy = admit(
      cue,
      context.currentTime,
      [...this.sounds.values()],
      this.last.get(cue),
    );
    if (!policy.allowed) {
      this.log(policy.reason, cue);
      return;
    }
    for (const id of policy.steal) this.stopSound(id, "stolen");
    const c = data.cues[cue],
      source = context.createBufferSource(),
      gain = context.createGain(),
      pan = context.createStereoPanner();
    source.buffer = buffer;
    source.playbackRate.value = v.pitch;
    gain.gain.value =
      v.gain *
      dbGain(this.loader.manifest!.assets[v.asset]!.trimDb) *
      Math.max(0, Math.min(1, options.gain ?? 1));
    pan.pan.value = c.spatial
      ? Math.max(
          -data.spatial.maxPan,
          Math.min(data.spatial.maxPan, options.pan ?? 0),
        )
      : 0;
    source
      .connect(gain)
      .connect(pan)
      .connect(this.inputs[c.bus as Bus]);
    const id = ++this.id,
      sound: Playing = {
        id,
        cue,
        bus: c.bus as OneShotBus,
        priority: c.priority,
        started: context.currentTime,
        source,
        gain,
        pan,
      };
    this.sounds.set(id, sound);
    this.last.set(cue, context.currentTime);
    source.onended = () => {
      this.sounds.delete(id);
      source.disconnect();
      gain.disconnect();
      pan.disconnect();
      this.duck();
    };
    source.start();
    this.duck();
    this.log("play", cue, {
      asset: v.asset,
      pitch: v.pitch,
      gain: gain.gain.value,
      bus: c.bus,
      pan: pan.pan.value,
    });
  }
  private stopSound(id: number, reason: string) {
    const s = this.sounds.get(id);
    if (!s || !this.context) return;
    this.sounds.delete(id);
    s.gain.gain.cancelScheduledValues(this.context.currentTime);
    s.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.005);
    s.source.stop(this.context.currentTime + data.limits.stealFadeSeconds);
    this.log(reason, s.cue);
    this.duck();
  }
  setScene(scene: string) {
    if (scene === this.scene) return;
    this.scene = scene;
    this.playlistIndex = 0;
    this.pausedMusic = undefined;
    this.log("music-scene", scene);
    const id = playlistFor(scene)[0];
    if (!id) {
      this.musicRequest++;
      this.musicLoading = false;
      this.stopMusic();
    } else if (!this.worldPaused) void this.transition(id);
  }
  private async transition(id: string, offset = 0) {
    const context = this.context;
    if (!context || this.worldPaused || this.dead) return;
    const ticket = ++this.musicRequest;
    this.musicLoading = true;
    const buffer = await this.loader.buffer(id, context);
    if (ticket !== this.musicRequest || this.dead || this.worldPaused) return;
    this.musicLoading = false;
    if (!buffer) {
      this.stopMusic();
      this.log("music-silent", id);
      return;
    }
    while (this.musicVoices.size >= data.limits.music)
      this.stopMusicVoice([...this.musicVoices][0]!, 0);
    const now = context.currentTime,
      fade = Math.min(data.music.crossfadeSeconds, buffer.duration / 2);
    const source = context.createBufferSource(),
      gain = context.createGain();
    source.buffer = buffer;
    source.connect(gain).connect(this.inputs.music);
    const tier = this.scene.startsWith("arena:")
      ? (data.music.tierGainDb[
          this.scene.split(":")[1] as keyof typeof data.music.tierGainDb
        ] ?? 0)
      : 0;
    const level = dbGain(this.loader.manifest!.assets[id]!.trimDb + tier);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + fade);
    if (this.music) this.stopMusicVoice(this.music, fade);
    const track: Music = {
      id,
      source,
      gain,
      started: now,
      offset: Math.min(offset, buffer.duration - 0.01),
      duration: buffer.duration,
    };
    this.music = track;
    this.musicVoices.add(track);
    source.onended = () => {
      this.musicVoices.delete(track);
      source.disconnect();
      gain.disconnect();
      if (this.music === track) {
        this.music = undefined;
        this.musicNextAt = 0;
      }
      this.duck();
    };
    source.start(now, track.offset);
    this.musicNextAt = now + nextTrackDelay(buffer.duration, track.offset);
    this.duck();
    this.log("music-play", id, {
      scene: this.scene,
      duration: buffer.duration,
      offset: track.offset,
      crossfade: fade,
      nextAt: this.musicNextAt,
    });
  }
  private stopMusicVoice(track: Music, fade: number) {
    const now = this.context!.currentTime;
    track.gain.gain.cancelAndHoldAtTime(now);
    track.gain.gain.linearRampToValueAtTime(0, now + fade);
    track.source.stop(now + fade);
    if (!fade) this.musicVoices.delete(track);
  }
  private stopMusic() {
    for (const track of this.musicVoices)
      this.stopMusicVoice(track, data.limits.stealFadeSeconds);
    this.music = undefined;
    this.musicNextAt = Infinity;
    this.duck();
  }
  pauseWorld(paused: boolean) {
    if (paused === this.worldPaused) return;
    this.worldPaused = paused;
    if (paused) {
      if (this.music && this.context)
        this.pausedMusic = {
          id: this.music.id,
          offset:
            (this.music.offset +
              this.context.currentTime -
              this.music.started) %
            this.music.duration,
          scene: this.scene,
        };
      this.musicRequest++;
      this.musicLoading = false;
      this.stopMusic();
      for (const s of this.sounds.values())
        if (s.bus !== "ui") this.stopSound(s.id, "paused");
    } else {
      const saved = this.pausedMusic;
      this.pausedMusic = undefined;
      const id = playlistFor(this.scene)[this.playlistIndex];
      if (saved?.scene === this.scene)
        void this.transition(saved.id, saved.offset);
      else if (id) void this.transition(id);
    }
    this.log(paused ? "world-paused" : "world-resumed");
  }
  update() {
    if (
      this.context?.state !== "running" ||
      this.dead ||
      this.worldPaused ||
      this.musicLoading
    )
      return;
    const list = playlistFor(this.scene);
    if (list.length && this.context.currentTime >= this.musicNextAt) {
      this.playlistIndex = (this.playlistIndex + 1) % list.length;
      void this.transition(list[this.playlistIndex]!);
    }
  }
  async hidden(hidden: boolean) {
    if (!this.context || this.dead) return;
    try {
      if (hidden) await this.context.suspend();
      else await this.context.resume();
    } catch {
      /* silent in restricted browsers */
    }
  }
  snapshot() {
    return {
      state: this.context?.state ?? "locked",
      settings: { ...this.settings },
      scene: this.scene,
      worldPaused: this.worldPaused,
      music: this.music
        ? {
            id: this.music.id,
            offset: this.music.offset,
            duration: this.music.duration,
          }
        : null,
      musicVoices: this.musicVoices.size,
      active: [...this.sounds.values()].map(
        ({ id, cue, bus, priority, started }) => ({
          id,
          cue,
          bus,
          priority,
          started,
        }),
      ),
      processing: data.effects,
      duckGains: Object.fromEntries(
        Object.entries(this.ducks).map(([k, v]) => [k, v.gain.value]),
      ),
      logs: [...this.logs],
    };
  }
  close() {
    this.dead = true;
    this.musicRequest++;
    for (const s of this.sounds.values()) this.stopSound(s.id, "closed");
    this.stopMusic();
    void this.context?.close();
  }
}
export const gameAudio = new GameAudio();
