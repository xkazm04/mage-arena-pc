# P2 TV bout start and arena music: no loading work during the fight

**Result.** On the Fire TV Stick, the arena no longer loads music or compiles shaders mid-fight.

- **Music.** The two full arena tracks (`arena-c`, `arena-d`) shipped as 28.8 MB WAVs. Loading one mid-fight
  stalled the Stick for up to 0.47 s.
  - They now ship as 4.6 MB MP3s and stream through an `<audio>` element instead of decoding to 55 MB of PCM.
  - Near a track load, the worst frame fell from 100-400 ms (with long tasks) to 50-117 ms (none).
  - Decoded audio held in memory fell from 70-124 MiB to 15 MiB.
- **Bout start.** The arena's two remaining shader programs and the hit-flash filter are now made behind the
  loading card. After the gate opens, no program is linked (one per bout before).

Combat code and data are untouched; this is presentation only. Desktop plays the same.

## How it was found

The 2026-10-16 live session on the Stick played the arena through the phone controller (Playwright as the
phone, DevTools on the TV).

- **The magic lesson** dropped to 15-31 fps for about 3 s, with frames of 334-467 ms. That happened every
  time, about 15 s into the lesson.
  - Resource timing showed `arena-c-full.wav` arriving just before.
  - With the WAV blocked, the same run held 58.8 fps with 1.1% late frames.
- **A CPU profile of a Tiro bout** showed, on the first frame after the loading gate:
  - a shader link (`getProgramParameter`, 253 ms under the profiler);
  - texture uploads, which were already behind the gate;
  - the colour-matrix (hit flash) program linked on the first hit.

## Music

**Measured on the Stick** (`audioexp.mjs`): one 150 s track loaded the way the game loads it, in the menu.

| Format | Bytes | Fetch | SHA-256 | Decode (off main thread) | Main-thread long tasks |
|---|---|---|---|---|---|
| WAV PCM16 (before) | 28.8 MB | 1.1-1.4 s | 77-80 ms | 0.7-0.9 s | 85 ms; frames to 184 ms |
| MP3 192k | 3.4 MB | 0.2 s | 12 ms | 2.6 s | none |
| Opus 128k | 2.6 MB | 0.2 s | 8 ms | 3.2 s | none |

**The MP3 alone was not enough.** `decodeAudioData` still makes a 55 MB AudioBuffer for 150 s of 48 kHz
stereo, and the loader keeps every buffer it has decoded.

- After the lesson reaches `arena-d`, about 110 MB of PCM is resident on a 1.7 GB device that is already
  swapping. During the session, swap was 85% used and `kcompactd0` was at 85% of a core.
- One MP3 run still stalled for 467 ms while `arena-d` decoded.

**What landed:**

- **`packages/tools/audio/encode-full-tracks.py`** encodes each U6b master to MP3 CBR 256 kbps at 48 kHz.
  - 192 kbps measured 0.28 LU quieter than the master (its lower lowpass); 256 kbps matches it:
    - `arena-c`: -25.99 LUFS, true peak -13.43 dBTP;
    - `arena-d`: -26.00 LUFS, true peak -12.71 dBTP;
    - both decode to exactly 7,200,000 samples.
  - The masters are not kept in the served folder; `docs/audio/audition/**/*.wav` is ignored as before.
    The tool reads them from Git LFS at `78cd0ed` and checks each against its sidecar hash. A re-run gives
    identical bytes.
  - Each new sidecar (`arena-*-full.mp3.json`) keeps the master's measurement as `masterMeasurement`.
- **`audio.ts`: `kind: "track"` assets are streamed** (`AudioLoader.track`, `GameAudio.streamSource`).
  - The bytes are fetched, size-checked and hash-checked exactly as before, then kept as a blob URL.
  - An `<audio>` element plays the blob through a `MediaElementAudioSourceNode` into the same music bus.
    Crossfades, tier gain, ducking and pause offsets are unchanged.
  - Elements are reused per track, because an element can feed only one source node.
  - Streams pause with the page.
  - Loops and one-shots still decode to buffers.
  - The Fire TV shell already allows playback without a gesture (`setMediaPlaybackRequiresUserGesture(false)`).
- **`audio.json`: `maxAssetBytes` 32 MiB → 8 MiB.** The test now refuses a WAV for any full track.

**Checked on the Stick** (`abtest.sh … play.mjs magic`): a fresh app process per run, baseline (HEAD) and
this branch interleaved, each lesson loading `arena-c` at 15 s and `arena-d` at 30 s.

| Build | Track fetch | Worst frame within 4 s of a load | Long tasks there | Decoded audio |
|---|---|---|---|---|
| HEAD | 1.1-1.5 s | 100, 117, 317 ms | 0-4 | 70-124 MiB |
| P2 | 0.33-0.46 s | 50, 67, 67 ms | 0 | 15 MiB |

## Bout start

`ArenaScene.warm` runs on the last loading frame, after the bout's art is resident:

- it renders the populated world, one painted-sigil mesh and one sprite with the shared hit-flash filter
  into a 256x144 offscreen texture;
- the gate opens on the next frame (`arena-entry.ts`, `warm()`).

That makes these behind the loading card:

- the shader programs;
- the code Pixi generates per uniform layout;
- the filter's render-target path;
- the geometry buffers.

`__arena.snapshot().preload.warmMs` reports the cost: 18-110 ms, and up to 440 ms on a swapping Stick.

- **Pixi caveat.** Rendering a container as the root makes it a render group for good
  (`AbstractRenderer.render` → `enableRenderGroup()`). P1 measured world render groups as slower, so `warm`
  calls `disableRenderGroup()` afterwards. `worldGroup` is false after the gate in every run.

**Checked on the Stick** (`glprobe.mjs`, WebGL hooks, interleaved, 5 runs each):

- **Programs linked after the gate:** 1 per bout before (the hit flash, at the first hit), 0 after.
  - The sigil program, once linked on the first arena frame, now links before the gate.
  - With a warm WebView the links themselves cost 4-50 ms. The 253 ms seen under the profiler could not be
    reproduced on demand: Android WebView keeps no GPU program cache in the app's data to clear.
- **Fps in the first 3 s** is not a usable comparison on this Stick today. Both builds are bimodal under
  memory pressure (HEAD 15-47 fps, P2 16-46 fps), so no fps gain is claimed.
- **A profile of the fixed build's first 400 ms after the gate** shows only ordinary per-frame work:
  - scene and Pixi render;
  - telegraph `Graphics` re-tessellated every frame;
  - sigils;
  - audio ducking.

  Nothing in it is first-use setup.

## What remains (not changed here)

1. **Crowded fights are CPU-bound on the Stick.**
   - Tiro bout 1 (six enemies) runs at 41-49 fps: about 14.4 ms of JS a frame (scene ~5, Pixi render ~6).
   - P1's options 1 (HUD text rebuilds) and 4 (scene allocations) apply. So do the telegraph `Graphics` that
     re-tessellate each frame (earcut in the profile).
2. **The phone shim costs 1.5 ms per `getGamepads()` on the Stick** while a phone is seated
   (`tv/README.md` says about 0.5 ms). The game calls it once a frame.
3. **Memory pressure** makes the Stick bimodal (P1's option 2: release camp, menu and portrait art in the
   arena).

## Checks

- `npm run gate` exits 0 (vitest 51 files, 349 tests; design check clean).
- `npm run smoke:audio` passes (`{"passed":true,"runs":2,"faults":2}`). It covers camp and arena music,
  `arena-c`/`arena-d` playing, and pause/resume offsets.
- No core file changed; the replay pins are untouched.
- Stick: AFTKM at 10.0.0.142 (the address moved; `tv/README.md` still says .139). Each run used a fresh
  `dev.magearena.tv` process, the production build via `vite preview`, and an `adb reverse` tunnel. The
  difficulty setting was restored to unset after the Easy runs.
- Tools are in the session scratchpad, not the repo: `play.mjs`, `glprobe.mjs`, `abtest.sh`, `audioexp.mjs`.
