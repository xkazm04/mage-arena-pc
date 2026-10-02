# AU1 — audio philosophy and first audition

Date: 2026-10-02. Branch: `audio`. Scope: AU1 only; owner chooses before AU2. No production assets or runtime audio engine.

## Design before spending

Read the full project plan, OWNER-NOTES, baseline report and combat/school/location/spell data, and the reference Wardstone story. D1–D4 and D16–D24 supersede the baseline's loops, gamepad-first controls and old art. Reference garden-vr bible, choices, all three audition reports, sidecars and generator were read only. Registry consultation: adaptive-music-authoring (clock, stems, measured acceptance), spatial-audio-scene-authoring and event-priority-concurrency-cooldown, sound-effect-generation and loop-seam-acceptance, music-prompt-composition, generated-music-acceptance, speech comparison guidance. All new sonic choices are proposals.

The sound identity is pressure held in worn materials: bronze, hide, cloth, lime, breath and unstable elemental energy. The collar is an audible restraint loosening; the Wardstones inhale spent magic. Combat information leads; the camp permits human closeness and uneasy silence. The detailed proposal is in `../audio/AUDIO-BIBLE.md`.

## Budget and evidence contract

Owner-authorized cap: 12,000 credits, deliberately used for direction evidence, including three cost proofs. Shared-account reserve: 8,000. No key leaves the environment or original read-only `.env` files. Record response billing headers, account snapshots, request IDs, prompts, bodies and hashes; never log authorization headers or raw error bodies. The reference ledger's zero immediate account deltas are not evidence of free generation.

Persist a reservation before each POST; an unresolved reservation blocks more spending. First quota/429 persists a stop latch. Retain exponential 429 backoff for read-only checks, never retry a billable POST after that latch. No automatic reset or cap increase. Project lock serializes this tool; it cannot lock the sister project's unmodified writer, so live balance checks and a conservative unsettled-debit allowance protect the reserve as far as a shared client can.

First measure one 2 s SFX, one 20 s music clip and one short stock-voice line. Size remaining audition from observed billing. Keep every generated take, including weak takes, in both reports. If a latch trips, finish reports with the actual coverage and explicit gaps.

## Gates / completion

**Partial AU1, stopped for owner.** Two successful generations (Fire cast and arena sketch); 38 planned samples and the voice proof remain unrendered. The second response omitted the optional music billing header. The additional local billing-uncertainty latch fired, so no further generation occurred. This conservative tool choice was stricter than the requested quota/429 stop and prevented the intended large audition. No provider quota or rate-limit error occurred; the cap was not reached. The latch is preserved.

Cost: exact Fire SFX 20 credits / 2 s = 10/s; music charge unresolved, 1,200-credit upper bound retained. Shared account moved 620 during the two-proof interval; 600 for music is an inference after subtracting delayed SFX, not exact per-request billing. Total conservative debit 1,220/12,000; 10,780 capacity unused and locked. Snapshot remaining 42,061, above the 8,000 reserve. See `../audio/evidence/COST-MODEL.md` for model, pricing sources and forecasts. Live public API dollar pricing differs from the account's credit counters, so no upgrade quote is claimed.

Both reports catalogue every actual file and the gaps. Triage has direction radio picks/notes, localStorage, Markdown copy with disk-compatible fallback, measured gain trims and light/dark layouts. Proof report separates technical observations, inferred economics, missing data and owner listening; the full 40-brief matrix is prepared for an identical future provider comparison. No Google calls. No production or AU2–AU4 work.

Commands and measured results:

- `node --test tools/audio/guard.test.mjs`: seven offline tests for boundary/refusal, persistent quota/429 latches, read-only backoff without POST, stale counters/header accounting, missing-header preservation, pending reservations and closed budget. Tests use mocked fetch and fake credentials in checked temporary directories; no paid calls.
- `python tools/audio/measure.py`: both original MP3s decoded, per-file ffmpeg ebur128 outputs and table. Fire 2.000 decoded seconds, -10.0 LUFS, +0.8 dBTP, 56 channel samples above full scale; music 20.062 s, -14.4 LUFS, -1.5 dBTP. Report playback trims -10.0 and -9.6 dB. Raw originals unchanged.
- Three-repeat decoded PCM seam screen: music endpoint jump -172.42 dBFS, but 0.5 s edge RMS differs 5.21 dB and spectral centroid 918 vs 2,940 Hz. Fails the authored ≤3 dB level-step screen. Perceptual/tempo/phase tests not measured; no camp beds exist to check.
- `python tools/audio/build-reports.py`; `python tools/audio/check-reports.py`: both file:// pages at 1440×1000 and 390×844, light/dark, all media decode/play, no JS/console errors or page overflow; localStorage note/radio persistence and Markdown export/copy/repeat tested. Every relative reference exists; ledger and sidecars match exactly; SHA256 verified. Screenshots inspected and an initial UTF-8 direction-label issue corrected.

Overall coverage gate **incomplete**, portable-report/provenance gates passed. No “felt” or production-ready claim. Future authorized work must reconcile billing and design a music accounting fallback before more generation; it must not treat a missing header or delayed zero balance delta as zero cost. Stop here for the owner, with one local commit and no push.
