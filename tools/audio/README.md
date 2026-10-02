# AU1 audio tooling — smaller audition, generation stopped

Run offline commands from the repository root. Requires Node with fetch, Python with numpy/markdown/Playwright, ffmpeg/ffprobe on PATH and Playwright Chromium.

**STOP.json records a real HTTP 429. Do not clear it or resume generation.** The host authorized clearing only the earlier billing-fault stop, preserved under `docs/audio/evidence/session1/`. Budget status also closes generation. Total cap 4,000; reserve 8,000. Current debit 1,852 for 15 samples. This is AU1, not production or AU2–AU4.

```
node --test tools/audio/guard.test.mjs
node tools/audio/plan-audition.mjs
python tools/audio/measure.py
python tools/audio/build-reports.py
python tools/audio/check-reports.py
```

The plan command authors metadata only: 32 priority briefs, two optional ambience probes and six deferred briefs. `run-sample.mjs <id>` is the single-brief launcher through the guard; it is currently blocked by the persistent latch and closed status. It never executes a whole matrix implicitly. No report launches generation.

## Accounting

Each call reads subscription balance immediately before/after. Sidecar and committed ledger record `documentedEstimateCredits`, conservative `estimatedCredits`, raw shared `accountDelta`, optional exact `measuredCredits` from a header and **`chargedCredits` as conservative budget debit**. Debit = max(delta, conservative estimate, available header). A shared delta is an upper-bound proxy, not attributed billing; delayed counters can underreport, concurrent usage can overreport. Zero never means free. Negative or >2× estimate deltas get flags. They do not latch.

SFX guard 20/s (documented API rate), measured headers 10/s; music guard 30/s (conditional prior-proof inference), public model 15/s, exact account music attribution unavailable; stock multilingual v2 voice 1/character measured. These are not interchangeable claims. See `docs/audio/evidence/COST-MODEL.md`.

Reservations persist before POST; an unresolved outcome cannot silently reset spending. A local lock serializes writers, and existing output refuses paid overwrite. The guard hard-refuses a cap above 4,000 or reserve below 8,000. Latest balance minus all project debit retains a conservative allowance for lag, sometimes double-counting settled local charges. A separate project can still spend concurrently; this is not a server-side atomic reserve.

First quota/429 persists STOP. Read-only 429 checks back off 4/8/16 s; paid POSTs never retry. A recovered GET cannot authorize more generation after a latch. Cap/reserve refusal also latches. Missing headers and unusual deltas alone do not. Crashed/ambiguous calls retain pending reservations rather than guessing outcomes.

## Provenance and verification

`requests.jsonl` journals reservations/completions/reconciliation; `ledger.jsonl` has exactly one row per generated original; `<asset>.mp3.json` matches it. Hashes verify the original bytes. Historical first-session evidence is archived separately and excluded from current debit totals. No discarded paid files are hidden.

The copied generator reads ELEVENLABS_API_KEY from environment first, else only `C:/Users/kazda/kiro/garden-vr/.env` and `C:/Users/kazda/kiro/pof/.env`, read-only. It writes no key or raw provider error body. Tests mock every network call and use only fake credentials.

The file:// Playwright gate checks desktop/phone and light/dark, every audio file, metadata equality/hashes, relative references, radio/notes/localStorage, Markdown export/copy fallback and repeat controls. Test choices live only in isolated browser contexts. Measurements and quality notes are technical; owner listening remains unmeasured. The reports preserve originals and apply review gain at playback only.
