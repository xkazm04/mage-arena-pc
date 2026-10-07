# AU2 audio refinement - 2026-10-03

The owner's round-1 choices are the authority. Keep the original arena Hide and iron, fire A, water B, earth B and George at the top of the new audition as direct comparisons. Do not infer AU2 choices. No production set or runtime audio integration is authorized.

## Design decisions

- Two 20-second arena alternatives retain the dramatic hide-and-iron entrance, with different explicit melodic leads: reed and muted lyre. A third is omitted to preserve breadth.
- AIR has three directions. Initial B/C takes still faded early by measurement, so each received one loop-enabled regeneration before lower-priority spending. First attempts remain catalogued. The loop outputs last 2.25 seconds despite 2 seconds requested; preserve original bytes and screen continuity within the requested first two seconds. Do not silently trim or claim production loop readiness.
- Three normal/perfect absorb pairs request soft rounded catches with audible pitch and consonant rewards. Warm rune perfect is much quieter than its normal partner. Match each pair down to its quieter member for review; no source waveform is mastered. Reward quality cannot be certified by meters.
- Camp receives day/dusk/night in two families at 12 seconds each; title/menu two 10-second sketches. These short phrases test directions within the cap, not long-form composition or fatigue. Hit/impact, collar, roll, crowd and the five UI events each have two directions. Extra kept-cast takes are lowest priority.

## Guard and evidence decisions

The owner explicitly authorizes clearing the old real 429 latch. Its exact bytes, AU1 budget/state/ledger/requests, cost notes and prior validation are archived in docs/audio/evidence/r1-final. AU1 remains 1,852/4,000. AU2 has its own 5,000 cap, 8,000 reserve and 14,000 hard account floor. Both current balance and opening balance less all AU2 debits constrain each paid call.

All reads and writes share one process lock and at least an eight-second completion-to-start gap. The generator consumes the complete response before releasing pacing. Error evidence keeps selected headers and sanitized status/message. A first read-only 429 may recover after at least 60 seconds with 15-second subsequent pacing; a second stops. Paid POSTs are never automatically retried. This run does not discover the old endpoint's numeric rate threshold, and does not provoke failures to find it.

Music records immediate before/after balances plus 30-second settlement reads. The first 20-second song settled at 600 credits. The second needed the next local preflight before its 600 appeared; subsequent music allows up to three settlement reads. Public creative 15/s is not a safe substitute for the observed account model of 30/s. Shared and lagged counters still prevent exclusive invoice attribution. Debit max(delta, settlement delta, conservative estimate, header); retain excess intervals even when previous SFX likely explain them.

One SFX request was explicitly rejected with HTTP 400 invalid_text_length (450-character maximum). Balance stayed unchanged and no file existed; the durable reservation was reconciled with journal evidence, then the corrected brief was submitted as a new request. Local validation now enforces the limit. AU2 absorb paths include their family names to distinguish them from AU1 filenames; that path-only reconciliation is journaled, hashes and original audio bytes unchanged.

## Review and delivery

R2 stores keep/maybe/reject and notes per direction, separately from R1, and exports Markdown. The proof is cumulative, includes every paid original, separates owner feedback from technical measurements, records how many rejections are confirmed fixed (zero until owner review), gives the full production-cost scenario and the same-list future Google probe. No Google calls or plan purchases occurred. Historical R1 pages are labelled as such.

Final handoff: **43 new files / 58 cumulative**, including all 39 original required briefs, two AIR repairs and optional fire/water variants. Extra earth cast is deferred: its estimate 40 does not fit the remaining five credits. New decoded duration 180.360 s. AU2 debit **4,995/5,000**; AU1 1,852; combined conservative history 6,847. Final settled balance **18,473** at 2026-10-02T23:24:35.957Z. Actual round account drop 4,440 matches music at 30/s plus 480 exact SFX headers, subject to shared attribution. Reset 2026-10-04 19:31:41 UTC.

145 serialized HTTP calls, zero new 429, minimum measured request gap 8.000 s. One explicit input-length 400 was reconciled. The first-two-second envelope screen passes a candidate in every AIR direction; two first attempts remain visibly failed. Nine of ten new music sketches fail the repeat-boundary screen; one numerical pass is not a listening pass. Four raw files contain decoded samples above full scale. Owner-confirmed rejection fixes remain zero pending owner listening.

Validation: 17 offline guard tests; 58 decoded/ebur128-measured files; exact ledger/sidecar/hash checks; all three file:// reports play on 1440px/390px in light/dark with no errors or overflow. Radio/notes persist, rounds have separate storage, Markdown copy/export and repeat/single-player controls pass. Commands: node --test tools/audio/guard.test.mjs; python tools/audio/measure.py; python tools/audio/evidence-r2.py; python tools/audio/build-reports.py; python tools/audio/check-reports.py. Validation and screenshots are under docs/audio/evidence/r2.

Budget status is closed-owner-review and pending reservation is null. R1 choices remain untouched. One local commit; no push. Next: owner triage of R2. Production layers, mastering/loop repair, runtime audio and any Google comparison require their later authorized scope.
