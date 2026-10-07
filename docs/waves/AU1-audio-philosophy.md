# AU1 — philosophy and smaller audition handoff

2026-10-02, branch `audio`. AU1 only. **15 samples delivered; real HTTP 429 stop; coverage incomplete; both reports ready for owner review.** No production assets, engine work or AU2–AU4.

## Design and sources

Read the project plan in full, OWNER-NOTES, baseline report and combat/location/school mechanics, the garden-vr bible/choices/three report generations/sidecars/tool, and registry adaptive music, spatial priority/concurrency/cooldown, voice-budget, quantisation and audio-generation guidance. Sister projects were read only. D1–D4 and D16–D24 override baseline loops, controls and obsolete art.

The proposal is **matter under impossible pressure**: bronze, hide, cloth, stone and breath support dangerous elemental energy. The collar audibly releases restraint every confirmed tier; perfect absorb has immediate returning-energy feedback. Camp audio carries time and people because casting there is suppressed. UI shares the world's materials. The bible specifies all four elemental event palettes, day/dusk/night and eight places, buses/ducking/priorities, 32 playback voices, loudness and a collar-driven four-layer adaptive proposal. Owner choices remain empty and outrank the bible.

A 96 BPM / 4/4 proposal aligns six bars to the nominal 15 s tier clock; perfect absorbs advance it, so gameplay feedback remains immediate while musical entries/transitions use declared boundaries. Existing sustained layers can ramp immediately. The audition music is full-mix style sketches, never claimed as independently usable adaptive stems.

## Scope and budget amendment

The host's session-2 note explicitly authorized archiving/clearing the previous billing-fault latch, reducing the **total** cap to 4,000 (including prior audio), keeping reserve 8,000, and using conservative shared-delta accounting. Original STOP/state/budget/ledger/requests/cost evidence are under `../audio/evidence/session1/`. The completed old music reservation was reconciled, not silently discarded: previous samples debit 660 under the new rule.

Smaller priorities: 27 one-shot SFX, two arena directions plus camp night at 20 s each, at most two short voice lines; two originally authored ambience probes only if budget remained. Six original music/voice directions were deferred. Fresh SFX/music/voice proofs preceded the remaining batch. The remaining priority estimate was 1,432 after a 1,332 conservative total, leaving room for shared-delta variation and optional beds.

Tool policy: read subscription immediately before and after each generation; record both snapshots and delta upper-bound proxy, documented estimate, conservative estimate and optional billing header. Debit max(delta, conservative estimate, header). Negative/>2× estimate deltas are flagged, never fatal by themselves. No zero-cost inference from stale balance. Durable pending reservation, project lock and output-overwrite refusal remain. The latest shared balance minus all prior project debit is the conservative reserve check; independent sister-project spending cannot be atomically locked. Keys remain in environment or the two original read-only env files and are never printed/copied/committed.

## Actual generation and stop

- 12 SFX: all eight elemental A/B casts and all four normal/perfect absorb cues. Header costs 240 total, **10 credits/s** observed; guard retains documented 20/s. Conservative SFX debit 600, including shared/delayed deltas.
- Two 20 s arena sketches: Hide and iron and Ashen vault. No exact music headers. Prior 620 delta is an upper-bound proxy; 30/s is a working inference. Conservative music debit 1,220.
- One 32-character George line, 2.090 decoded seconds: exact header/debit 32, **1/character**.

**Total: 1,852/4,000 conservative credits; 272 exact header-attributed subset; 2,148 cap capacity unused.** Last balance 24,672, above reserve, resetting 2026-10-04 19:31:41 UTC. Exact music spend remains unresolved; the total debit is not presented as an exact invoice.

The last absorb audio completed. Its postflight subscription lookup returned **HTTP 429 `rate_limited` at 21:02:26.023 UTC**. Read-only exponential backoff recovered the balance; the first error still persisted STOP.json and ended generation. No paid POST retry. The 140 delta on this call is flagged against a 40 estimate and fully debited. The current latch is a real provider stop and **was not cleared**. Budget status closes generation too.

## Reports and gates

`../audio/audition/r1/index.html` is direction triage: theme groups, philosophy per card, player per take, keep/maybe/reject plus optional note, localStorage and Markdown export with clipboard fallback, light/dark and phone layouts. `../audio/PROOF-REPORT.html` is complete investment evidence: every original, prompt/duration/cost, category totals, measured/estimated rates, quality and family limitations, seams, loudness, production/next-tier scenarios and same-list Google questions. No Google service invoked.

Commands and measured results:

- `node --test tools/audio/guard.test.mjs`: 10 offline tests pass, including cap/reserve, no cap raise, stale/missing billing, anomaly accounting, pending reservation, paid overwrite, quota/429 persistence and the observed successful-audio/postflight-GET-429 case.
- `python tools/audio/measure.py`: all 15 originals decoded and ffmpeg ebur128 measured. Six SFX have decoded values above full scale; both music clips fail the authored direct-repeat edge-level screen (5.21 and 76.82 dB differences). No camp bed exists. Raw files unchanged; matched playback uses -26 LUFS SFX and -24 music/voice, with -3 dBTP ceiling.
- `python tools/audio/build-reports.py`; `python tools/audio/check-reports.py`: both file:// reports at desktop/phone and light/dark; all audio decode/play; no console/page errors or page overflow; picks/notes persist; Markdown copy/export/repeat work; every relative file exists; one sidecar/ledger line per original with exact metadata equality and matching hashes. See validation JSON, meter logs and screenshots in `../audio/evidence/`.

Technical assessment does not invent listening. Exact music attribution, ear-judged family consistency, tempo/grid, stem subsets, omitted categories and runtime mix are **not measured**. 17 priority samples remain ungenerated; two optional beds and six smaller-scope deferrals are explicit. The stop is not proof that a richer plan is required. A future separately authorized batch should pace reads/generation to avoid burst rate limits; the current latch remains intact.

Update plan/status/session log and OWNER-CHECKS, one local commit, never push. Stop for owner direction triage; AU2–AU4 remain blocked/untouched.
