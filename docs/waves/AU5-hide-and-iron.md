# AU5 Hide and iron: the deferred full arena track, on music_v2_5

**Result.** Hide and iron, the third 150 s arena score, now exists. AU3 deferred it for lack of credits.

- It plays in tiers 1 and 4, where the 20 s r1 loop played before.
- It streams through the P2 path, like Reed oath and Lyre under iron.
- Owner listening is open. Adaptive use stays off.

## What changed since AU3 (research, 2026-10-17)

ElevenLabs now ships Music v2 and v2.5 on the API (`model_id: "music_v2_5"`, changelog 2026-09-14). The
AU3 plan was written for `music_v1` and named "a newer-model reference route" as the way to keep the exact
kept audition. That route now exists:

- **Uploads.** `POST /v1/music/upload` stores an existing file for inpainting. It is billed like a
  generation of its length and copyright-screened.
- **Chunk plans.** v2/v2.5 composition plans are ordered `chunks` (`text`, `duration_ms`,
  `positive_styles`, `negative_styles`, `context_adherence`), not v1 `sections`. Durations are always
  enforced, so `respect_sections_durations` is ignored.
- **Conditioning.** A generation chunk can take `conditioning_ref` (`song_id` and a range of at most
  30 s) with `condition_strength` `low` to `xhigh`. The first chunk shapes the whole song.
- **Output.** `mp3_48000_*` and `pcm_48000` are available. v2 defaults to `mp3_48000_192`.
- **Price.** The public API price is one per-minute music rate for every model.

Sources:

- https://elevenlabs.io/docs/changelog/2026/9/14
- https://elevenlabs.io/docs/eleven-api/guides/how-to/music/composition-plans
- https://elevenlabs.io/docs/eleven-api/guides/how-to/music/inpainting
- https://elevenlabs.io/docs/api-reference/music/upload
- https://elevenlabs.io/pricing/api

## What was generated

| Step | Request | Observed cost |
|---|---|---|
| Upload | `arena-a.mp3`, byte-identical to the owner-kept r1 audition (`b2d7da15…`) | 276 credits |
| Compose | `music_v2_5`, six chunks of 15/30/30/30/30/15 s, `mp3_48000_192`, `store_for_inpainting` | 2,062 credits |

- **Total:** 2,338 observed. The ledger books 5,102 conservatively (30 credits per requested second).
  The job cap was 6,000.
- **Balance:** 139,703 before, 137,365 after.
- **Calls:** no retry, no other paid call. `docs/audio/evidence/r5/COST-MODEL.md` has the audit.
- **The plan** is the exact AU3 Hide and iron brief (`docs/audio/AU3-FULL-TRACKS-PLAN.md`), mapped to
  chunks:
  - the global styles lead chunk 1;
  - each section prompt is its chunk's style;
  - the shared negatives are on every chunk.
- **Conditioning:**
  - Entrance on the audition's 0-20 s, `high`;
  - Climax on its 5-20 s (the interlocking drums), `medium`.
- **Files:** `tools/audio/composition-plan-r5.json`, `tools/audio/run-r5.mjs`.

## Measured (offline, `process-r4.py arena-A-hide-and-iron r5`)

| | Hide and iron (AU5) | Reed oath | Lyre under iron |
|---|---|---|---|
| Master | -26.0 LUFS, -13.3 dBTP | -25.99, -13.41 | -26.0, -12.75 |
| Loudness range | 6.1 LU | 8.5 | 9.0 |
| RMS per 15 s (first → peak → last) | -14.3 → -11.3 → -14.0 dB | -19.8 → -11.0 → -15.5 | -20.0 → -12.8 → -16.0 |
| Pitch-class similarity to its audition | **0.945** | 0.676 | 0.769 |
| Attacks within 20 ms of the 15 s cells | 3/9 | 9/9 | 9/9 |
| Longest literal repeat (5 s blocks) | 0.44 correlation | 0.30 | 0.31 |

- **Conditioning held the kept sound.** Harmonic colour is far closer to the audition the owner kept
  ("dramatic entrance and melody") than either earlier track is to its own audition.
- **The arc is flatter.**
  - The entrance starts near full level, where the brief asked for restraint. C and D start about
    6 dB lower.
  - Tension and Climax are about 3 dB louder than the opening.
- **The release decays to silence.** The last 2.5 s are at -60 dBFS RMS.
- **The tempo estimate wanders (127, 191, 64 BPM by window), and the cell boundaries don't line up.**
  The 96 BPM grid is not certified. That matters only for adaptive jumps, which stay off. Linear
  playback is unaffected.

Nobody has listened to it yet. Vocals, melody and the release's musical resolution are unassessed.

## Game integration

- **Served file.** `packages/game/public/audio/arena-a-full.mp3`: MP3 CBR 256 kbps, 48 kHz,
  7,200,000 samples, 4.8 MB.
  - Loudness and true peak are within 0.05 LU of the master.
  - It is encoded by `packages/tools/audio/encode-full-tracks.py`, which also re-encodes C and D to
    identical bytes.
- **Playlists.** `audio.json` tiers 1 and 4 now start with `arena-a-full`. The `arena-a` loop stays in
  the manifest as the conditioning reference.
- **Manifest.**
  - `au5.tracks` records the track with `linearPlaybackReady: true`, `adaptiveReady: false` and
    `productionApproved: false`.
  - `u6b.deferred` is now empty.

## Checks

- `npm run gate` exits 0: vitest 51 files, 350 tests; design check clean.
- `npm run smoke:audio` passes. `arena-a-full` streams and plays at `arena:1` and again at `arena:4`.
- `node --test tools/audio/guard.test.mjs tools/audio/guard-r4.test.mjs`: 28 pass.
- After closing, `budget.json` is `closed-owner-review` and `run-r5.mjs` refuses further calls.

## Not done

- **Owner listening.** Keep, replace or rework.
- **Rework is cheaper now.** v2.5 can regenerate one chunk while keeping the rest of the stored song
  (`song_id VOiwSLx5P0bNtl7Du3L6`) for about 14 credits per second. For example, the Entrance could be
  made quieter.
- **Originals stay local.** The raw provider MP3 and the master WAV are gitignored, like every audition
  original. Copies are in `docs/audio/audition/r5/` of both the main checkout and the AU5 worktree,
  with sidecar hashes in git.
