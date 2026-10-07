# U6b - latest gated deliveries wired

2026-10-04. GAME / integration. [Design note](U6b-design.md),
[import hashes and packing witnesses](U6b-evidence/import.json),
[native gallery](U6b-evidence/index.html).

## Delivery audit

Read-only audit at sub-wave start and again before completion:

| Stream | Commit | Landed and technically passed | Still open |
|---|---|---|---|
| Art | `74b3d56` (A14.2; A14.1 `3c4f4a9`) | 124 of 192 priority state/direction slots, 532 frame references, 17 pages; 88 offline tests, 49 identical rebuild products, five browser viewports | 68 priority slots, owner acceptance, remaining legacy gait work |
| Audio | `8e8ab42` (AU3 round 4) | C / Reed oath and D / Lyre under iron, 150 s each, measured 48 kHz stereo masters; 28 guards, 73 source hashes | Full A, owner selection/production approval, certified adaptive transitions |

Both worktrees stayed clean and unchanged. GAME made no generation calls and did
not edit either branch. Copies retain source hashes, technical gate reports and
unaccepted review status; technical import is not an owner acceptance decision.

## Character integration

The existing A10 loader key now selects an additive A10+A14 manifest. Legacy
idle/run/cast/absorb and undelivered reaction directions remain intact. A14 clips
carry their own frame/clip anchor and v3 nominal size, so D32's 50% figure increase
is applied once: a full 384-pixel source frame draws at 145.8 px at 1080p / 194.4 px
at 1440p, with nominal standing body heights 60.75 / 81 px. Left atlas facings
mirror once. Original metadata/raw atlases are preserved alongside packed pages.

Packing crops the common nonzero-alpha bounds of each page, adds two-pixel
gutters, and retains orig/trim coordinates. Every copied RGBA key is byte-equal;
no nonzero alpha is discarded and no image is resampled. New pages require
37.259 MiB decoded RGBA instead of 151.610 MiB untrimmed.

All four mages and four soldiers use hit-light below 18 actual HP damage and
hit-heavy at or above 18. This data-driven threshold selects presentation only;
H1's deterministic damage/poise/stun rules are unchanged. The complete flinch
clip is fitted to the visual reaction window and completes on the presentation
clock even when a Lab fixture freezes simulation. Recoil/flash/sound still apply.

Delivered deaths finish their 600 ms collapse and select the matching single-key
corpse. The frame is identical to the last death key, including anchor/mirroring.
The exact-facing requirement prevents an inherited rear death from snapping to
a new front corpse. Corpses keep H1's DEFEATED state, floor sorting, no targeting
or collision, persistent pose and explicit G/R behavior.

Precisely missing: all four reaction states (hit-light, hit-heavy, death, corpse)
in four directions for cinder_hound, mire_maw, thornback and hush_moth: 64 slots;
Garran death/corpse ne/nw: four slots. Existing same-entity A10/procedural fallbacks
remain. A14.2 added no clips: it audited 18 inherited gaits without a safe repair.
Its 84 legacy backlog entries overlap the priority queue in 26 places: 68 priority
plus 58 other legacy requests remain, not 152 distinct requests. Art reports
exhausted Grok balance (402), repeated pre-image 503s, and bounded retry latches;
GAME neither bypassed the latches nor attempted generation.

## Full arena tracks

The verified audio manifest replaces the old C/D previews with their measured
150-second masters, 7,200,000 samples/channel. C measures -25.99 LUFS / -13.41 dBTP;
D -26.00 LUFS / -12.75 dBTP. The masters already include gain processing, so engine
trim is 0 dB. Existing tier gain, bus limits, ducking and output protection remain.
The bounded per-file size limit is 32 MiB for each 28.8 MB PCM16 file.

Tier I: A preview. Tier II: C then D. Tier III: D then C. Tier IV: A preview, D, C.
Tier changes start a whole track at its entrance with the existing two-second
crossfade; stale rapid requests coalesce and at most two music sources coexist.
Stable II/III tiers advance to the other full track near the natural end. Sources
are not sample loops. Pause/resume restores the current offset; an explicit bout
reset restarts the entrance, including a reset within the same tier.

**Adaptive limitation:** source `linearPlaybackReady=true`, `adaptiveReady=false`,
`productionApproved=false`, owner choice null. The six 15-second-cell sections are
sample exact, but verified BPM/downbeat are null and allowedTransitions is empty.
No beat/bar section jumps, sustain cells, independent stems or sting system are
claimed or enabled. Tier switching uses only the previously shipped nonquantized
whole-track mechanism. The source manifest is copied intact in the evidence.

**Full A did not land.** Audio reports a 9,000-credit job cost and 1,689 remaining
balance, with only 1,000 left in that job's allowance / 689 above the account floor;
neither a 4,500-credit full A nor a 2,700-credit 90-second A fit. The prior ~20-second
A preview remains explicitly marked as such in the guide. Camp picks are unchanged.

## Verification

- `npm run gate`: 211 TypeScript tests and 11 reference checks, zero contradictions.
- `npm run build:game`: pass; existing bundle-size advisory remains.
- Additive coverage, exact corpse key, inherited rear-death handoff, size/anchor
  precedence, invalid placement rejection, audio source hashes/mastering and
  nonlooping full-track playlists have regression checks.
- `npx tsx packages/tools/src/u6b-browser.ts`: native 1080p/1440p light/heavy and
  death/corpse direction walk, old creature fallback, visible recoil, G/R, reduced
  motion and results. Exact observations and images are in the native gallery.
- `npx tsx packages/tools/src/u6b-audio.ts`: real WebAudio graph, all four actual
  collar tiers, 150-second decoded buffers, pause/resume offsets, rapid requests,
  settings/mute, source caps, missing-all/corrupt-file silence. A real 148-second
  C playback reaches the next full D track at stable tier II. Both native sizes
  pass, with no page errors. This is measured playback, not a listening judgment.
- `$env:MAGE_EVIDENCE="U6b"; npx tsx packages/tools/src/u3-replay.ts`: same two-week
  save/load/replay bytes and hash as H1: 1,300,369 bytes,
  `2451fa7085c6a8534036a26e347b48d6281d42f22dcf51616570ea82b7452bc2`.
  No deterministic core or census bands changed in U6b; H1's full 8,000-fight census
  remains the current gameplay measurement.

## Native evidence and memory

The reaction walk produced 124 native images, plus eight audio-walk captures and
four final performance captures. The U6 all-screen gallery remains the complete
screen tour; H1 retains its Hit controls/metrics and first reaction evidence.

`npx tsx packages/tools/src/u6b-performance.ts` passed with 100 continuously visible
projectiles and all 12 roster figures:

| Native size | Mean FPS | Frame p95 | Renderer CPU p95 | Decoded resident texture estimate |
|---|---:|---:|---:|---:|
| 1920x1080 | 60.003 | 16.70 ms | 2.60 ms | 294.135 MiB |
| 2560x1440 | 60.003 | 16.80 ms | 2.60 ms | 294.135 MiB |

This is Windows Chromium/D3D11 headless evidence, with the GPU-backed renderer.
The texture estimate is decoded RGBA residency (art + UI + font + derived textures),
not total driver/process allocation. CDP JS used heap measured 25.31 / 44.10 MiB;
raw heap categories are in performance/browser.json and should not be double-counted.

Audio is separate: the two full stereo float buffers consume 109.863 MiB together.
The complete audio/settings/combat walk retained 137.683 MiB decoded audio at 48 kHz,
including other cached cues/tracks. The engine exposes per-buffer and aggregate
counts in its audio snapshot. It does not claim this is total browser RSS.

Owner musical preference, tactile feel and TV viewing-distance acceptance remain
unmeasured. Pending upstream work is explicit above; no substitute asset is labelled
as a completed missing delivery.
