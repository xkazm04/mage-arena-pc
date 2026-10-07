# AU4 — a restrained, replaceable mix

Authored 2026-10-03. D28/D30 and the audio worktree's `docs/audio/CHOICES.md`
outrank the audio bible. Selective asset integration takes only arena A/C/D,
camp A day/dusk/night, air B, hit/impact A, collar B, UI B, fire A/water B and
their kept variations, earth B and George. No generation or provider calls.
Source hashes and sidecars stay in development evidence, outside the player UI.

Roll A has two isolated transients: measured 50 ms RMS falls below -65 dBFS at
0.35 s, with the second event starting near 0.75 s. Keep only 0–0.45 s, fade the
last 50 ms. This is a source edit, not a new generated effect or listening verdict.
Rejected absorb/title/crowd takes remain excluded. Perfect absorb temporarily
uses the kept collar resonance as a restrained accent; no rejected bell returns.

One WebAudio context starts on a user gesture. Music, effects, UI and voice have
independent gain buses and persistent settings under master/mute. Missing,
corrupt or unsupported audio fails silently with diagnostic events. Per-cue
priority, concurrency, cooldown and variation live in data. Effects pass through
a high-cut filter, compressor, limiter and gain ducking under music/voice.

The kept music files are complete mixes, not stems. Use horizontal crossfades,
at most two music sources, following confirmed collar tiers (nominally every
15 seconds; never duplicate that gameplay clock). No unmeasured tempo claim or
fake phase-locked layering. Playlist scheduling uses decoded duration and is
ready for 120–180 s replacements. Camp music follows the hour-derived phase.
Paused transport preserves position; late obsolete transitions are discarded.

Read-only background: registry adaptive-music-authoring,
spatial-audio-scene-authoring and generated-music-acceptance notes. Their budget
and listening distinction informs this implementation. Tests and headless event
logs measure plumbing; headless audio cannot be listened to. Owner listening is
required for final trims, seams, masking, the step cut and perceptual consistency.

Runtime authorities: `packages/game/data/audio.json` owns buses, processing,
priority/cooldown/concurrency, variation, ducking and playlists;
`packages/game/public/audio/manifest.json` owns each asset's file, SHA-256,
decoded-duration expectation and gain trim. These data files win over this note.
`python packages/tools/audio/import-kept.py` selectively imports 22 sources and
records hashes, durations, sample peaks and the roll cut's 50 ms RMS windows in
`AU4-evidence/import.json` and `roll-cut.json`. Originals remain byte-identical
except the documented step crop. This is a selective asset merge, without merging
unapproved auditions or modifying the audio worktree. Initial read: `73048e6`;
final provenance snapshot: `23e0003`. Its new round-3 auditions have no owner
keeps and remain excluded. The copied `docs/audio/CHOICES.md` records that status.

The mix uses peak-based attenuation, not a claim of measured perceptual loudness.
The effects chain is low-pass, compressor, limiter, oversampled sample ceiling,
duck gain and bus volume. Master has a further limiter/ceiling. No true-peak or
listening verdict is inferred. Music crossfades use decoded duration, not a
hard-coded loop length; a manifest entry can become `track` without engine work.
Only current Water combat is implemented in core: its casts use Water; the other
kept elemental cues are wired to the common engine and settings preview for their
future combat catalogues. Enemy attacks use the kept impact cue. Ordinary absorb
has no approved source and remains silent; perfect uses the provisional accent.
Voice has the exact on-screen caption, "The collar loosens. Stand ready."

UI pointer, keyboard and controller interaction sounds are centralized in
`CanvasUI`, including navigation, selection, confirmation and disabled clicks.
Sound settings expose master/music/effects/voice/interface, mute and effect/voice
previews. Preferences live separately from deterministic game saves. Presentation
variation never draws from or mutates core RNG. Audio resumes music position after
pause and starts at the current tier after load; it does not replay saved combat
history or previous bouts. First gesture creates the sole context. Missing assets,
bad hashes/decode and unavailable WebAudio resolve to silence with bounded logs.

Measured validation: `npm run gate` (169 TypeScript + 11 reference tests, zero
design contradictions); `npm run smoke:audio` (1080p/1440p native gesture, actual
WebAudio filter/compressor/ceiling nodes, voice ducking, all camp phases, pause
position, volume/mute persistence, Water cast/roll/perfect and all four collar
tiers, cooldown stress, missing manifest and corrupt decoder cases). Raw events
and actual node parameters: [browser.json](AU4-evidence/browser.json); native
screens: `AU4-evidence/screens`. Headless audio cannot be listened to.
The initial test's incorrect reload route is retained under `attempts`; reload
correctly preserves `/training`. It was a test navigation error, not an engine
failure. Bout event-history review also caught and fixed replaying historical
effects on wave advance.

`npm run smoke:u3` also passes both full 14-day routes with audio enabled,
including real Parley/listening, Trials/Games, pointer/keyboard/emulated pad,
the changed settings route, exact camp/combat saves and zero page errors or
button overflow. The AU4 regression report is retained as
[`camp-regression.json`](AU4-evidence/camp-regression.json); U3's committed
26-image review gallery remains the visual baseline. AU4 adds eight native
audio/settings/failure-state captures. Screenshots do not establish sound quality.

`npx tsx packages/tools/src/u3-replay.ts` still produces an exact double replay
and save/load round trip: 1,300,369 bytes, envelope SHA-256
`0f0bdc7c698c45f2fa6b205bd805e3f80506fd92cc7452027c207e9d03a6fc0c`.
`git diff c44bf56 -- packages/core/src/arena docs/design/reconciled/data/arena*`
is empty. The 2,000-fight census and arena balance were not changed or regenerated.
Full-length music, approved absorb/crowd/title replacements and final listening
trims remain audio-stream/owner follow-up, not generated by this wave.
