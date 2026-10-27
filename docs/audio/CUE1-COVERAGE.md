# CUE1: cues for the uncued sim event kinds (2026-10-24)

Operator-authorized ElevenLabs sound-effect round (wave `CUE1`, `tools/audio/budget.json`, plan `cue-plan-cue1.json`). SFX only, no music, no other provider. 13 calls, **387 conservative credits** (20/s bound; observed shared deltas were about 10/s). Live balance before the first call 120,805, after the last 120,620; floor 1,000. No quota error, no STOP latch. Every call has a `ledger.jsonl` row, `requests.jsonl` reservation and a sidecar `.mp3.json` with the exact prompt and request.

## Reconciliation

D2 is right, and `audio.json` is easy to misread. The `cast.<school>` cues exist, but `arena-entry.ts` `consumeEvents` plays them on the **`release`** event (`cast.${actor.school}`), never on `cast`. The `cast` event (cast committed, the bible's "cast / cast committed" hook) has no consumer, so cast start was silent. `down`, `interrupt` and `phase` have no consumer either.

## Coverage

| Event kind | Cue | Assets (trim dB) | Bus / priority |
|---|---|---|---|
| `cast` | `cast.start` | `cast-start-b` (-13), `cast-start-c` (-8.5) | effects / P2, 80 ms |
| `down` | `down` | `down-a` (-7) | effects / P1 |
| `interrupt` | `interrupt` | `interrupt-a` (-6.8) | effects / P1 |
| `phase` | `phase` | `phase-a` (-13) | effects / P1, one at a time, 2 s cooldown, centered |

Hit variants: the cue's `assets` list already picks one at random, so no new shape was needed. `hit` now draws from `hit-b`, `hit-c`, `hit-d`; `impact` from `impact-d`, `impact-e`; `stagger` reuses the `hit` pool at its lower pitch. Trims bring each file to about -25 LUFS-I (the level of the other elemental one-shots).

## Findings

- The shipped `hit-a` (-52 LUFS-I, peak -31.8 dBFS) and `impact-a` (-45, peak -21.2) are close to inaudible once their trim is applied, so they were left out of the new pools (they stay in the manifest). Whether the owner kept them deliberately is not known.
- `impact-e` (-31.8) and `impact-d` (-19.3) are the loudest impacts the provider returned in two passes; `impact-e` could not be trimmed up (the manifest forbids amplification), so the impact pool spans about 6 dB.
- Unused takes (`cast-start-a`, `impact-b`, `impact-c`, measured -30.6, -59.1, -35.2 LUFS) are kept with their sidecars in `evidence/cue1-unused/`. Their cost is in the 387.

## Not yet audible in the game

Main now routes events through the `routes` table in `audio.json` (`audio-routing.ts`), not literal `gameAudio.play` calls. The four kinds (`cast`, `down`, `interrupt`, `phase`) have authored cues (`cast.start`, `down`, `interrupt`, `phase`) but no route, so they stay in `uncuedKinds` and nothing plays them. `audio-events.test.ts` asserts each authored cue resolves to manifest assets and fails once a route is added, so the entry is dropped in the same change. Adding the routes is a playback change left to D2 4.5.

## Re-cut (2026-10-27, run 19f534ed, repair of held run 935a3a33)

AU4 audio was held 2026-10-24 on the `audio.test.ts` pin of 22 assets. Re-cut onto main ee241f70, no paid call, the old branch untouched:

- 34f931bb CUE1 wave (was 49f35ab9); conflict in `elevenlabs.mjs` resolved onto main's `rounds.json` registry: a `CUE1` row (cap 1000, floor 1000, minReserve 1000, `outDir` public/audio, `cuePlan`), the plan check and the `cues` status kept.
- 8cee7fc3 CUE1 ledger, requests and plan, 13 SFX calls, 387 credits (was 38bbc2d5); ledgers merged, no line dropped.
- 7f519951 cues and variants (was d07f86df); `audio-events.test.ts` kept on main's routes-driven form plus the authored-cue check above.
- 09fcfba2 pin fix: `audio.test.ts` now pins the exact sorted list of 32 asset keys and `toHaveLength(32)` (22 before). All other checks unchanged.

## Update 2026-10-27 (M3)

`down`, `interrupt` and `phase` now have routes in `audio.json` (`any` actor; `down` and `interrupt` spatial, `phase` centred) and leave `uncuedKinds`. `cast` (`cast.start`) remains unrouted, as do crowd, absorb raise/hold and telegraph cues.
