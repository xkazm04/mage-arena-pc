# AU1 audio tooling

Run from the repository root. Requires Node (fetch/Response built in), Python 3 with numpy and Playwright, ffmpeg/ffprobe on PATH, and installed Chromium. No repository-wide app dependencies are introduced.

**Generation is stopped.** `STOP.json` records the missing music billing header; `state.json` keeps its unresolved reservation. The cap was not reached; no quota or rate-limit response occurred. Do not remove the latch or resume as part of this AU1 handoff.

## Read-only / offline commands

```
node tools/audio/elevenlabs.mjs credits
node tools/audio/elevenlabs.mjs voices --filter george
node tools/audio/elevenlabs.mjs usage --from 2026-10-02T19:13:15Z --to 2026-10-02T19:14:30Z
node --test tools/audio/guard.test.mjs
node tools/audio/plan-audition.mjs
python tools/audio/measure.py
python tools/audio/build-reports.py
python tools/audio/check-reports.py
```

`plan-audition.mjs` writes only the 40 original briefs. It is not a batch launcher. Measurements and reports derive from actual ledger entries. `check-reports.py` opens both pages via file URLs, verifies every asset/sidecar/hash/ledger relationship, decodes and plays all media, checks desktop/phone light/dark layouts, and exercises radio/note persistence, Markdown export and repeat control. It uses isolated browser contexts; test choices never become owner decisions.

The generator was copied from garden-vr and adapted in this repository only. Environment key takes precedence; otherwise only the two explicitly authorized original `.env` files are read. The key remains in memory, never printed, copied to a new env file or written to metadata. API error bodies and request authorization headers are never logged. Only safe response billing fields are retained. No environment override can loosen the AU1 cap/reserve.

## Accounting

`budget.json`: 12,000 cap and 8,000 shared reserve; pre-proof bounds remain conservative because the proof series stopped. `requests.jsonl`: durable reservations/completions. `ledger.jsonl`: exactly one original per successful response. `.mp3.json`: matching provenance. `state.json`: current unresolved reservation and starting snapshot. `STOP.json`: first latch reason, never automatically reset. The legacy name `chargedCredits` means **budget debit**, not necessarily a measured charge: consult `measuredCredits` and `costBasis`. For music it is 1,200 reserved, with actual billing unresolved.

Exponential 429 backoff exists for read-only subscription requests (4, 8, 16 s); first 429 writes the latch immediately. No billable POST is retried. A recovered lookup cannot authorize a POST after the latch. Quota errors, unknown generation outcomes and unmeasured billing also stop generation. This is intentionally stricter than stopping only for quota/429, and caused the early stop in this run. An unresolved reservation blocks crashes from silently resetting the budget. Project lock prevents overlapping local writers; it cannot serialize the read-only sister project's existing writer, so this is not a server-side atomic account-wide reserve.

One optional music billing header was incorrectly assumed to be necessary for proceeding. That conservative implementation choice limited this audition to two samples; it is not a Starter capacity limit. A future authorized run should design and prove a request-attributed music accounting fallback before generation. Never treat immediate zero balance deltas as free output or clear this latch merely to continue spending.
