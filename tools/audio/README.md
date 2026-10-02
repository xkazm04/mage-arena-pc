# Mage Arena AU2 audio tooling

AU2 is a separately authorized audition round on branch `audio`. The owner explicitly authorized archiving and clearing AU1's real 429 STOP; that exact file and AU1 accounting remain in `docs/audio/evidence/r1-final/`. AU1 retains its 1,852/4,000 history. The new cap is **5,000**, shared reserve **8,000**, and hard account floor **14,000**. Production is not authorized. Final budget status closes generation for owner review; never reopen a closed round implicitly.

## Offline commands

```
node --test tools/audio/guard.test.mjs
python tools/audio/plan-r2.py
python tools/audio/measure.py
python tools/audio/evidence-r2.py
python tools/audio/build-reports.py
python tools/audio/check-reports.py
```

Requires Node with fetch, Python with numpy/markdown/Playwright, ffmpeg/ffprobe and Playwright Chromium. This worktree has no game package/build; the reports are portable static files. The R1 page remains historical; the main proof now includes both rounds, with the historical proof also saved as PROOF-REPORT-r1.html.

## Paid calls and stop rules

`run-sample.mjs <id>` renders one explicit brief from audition-plan-r2.json. `run-r2.mjs` executes the owner-authorized round serially through that launcher, skipping completed ledger entries and deferring estimates that cannot fit. It stops on an error or persistent STOP. Neither report can generate audio. Guard outputs are restricted to audition/r2 and existing files cannot be overwritten for money.

One process lock covers **all** API commands, including subscription reads and analytics. Persistent pacing requires at least 8 seconds from a completely consumed response to the next request. A first GET 429 waits at least 60 seconds, respects a longer Retry-After, and increases the gap to 15 seconds. A second 429 stops. Paid POSTs are never automatically retried. An explicit rejected input can be reconciled from evidence and corrected as a new request; ambiguous outcomes retain their reservation.

The guard logs method, endpoint, timestamps, status, selected billing/rate headers and sanitized diagnostic status/message. It never logs credentials, request authorization headers or arbitrary provider bodies. Read-only balances below 14,000 latch immediately, including unrelated project spending. Predicted cap, reserve or floor breaches are refused before a paid POST. The current balance and the AU2 opening balance minus local debit are both checked. Other account writers cannot be controlled atomically by this client.

## Accounting

The ledger includes both rounds, but AU2 cap checks sum only `wave: AU2`. Every successful original has an equal sidecar and one ledger row, with its hash, full prompt and generation settings. Reservations and path reconciliation are journaled in requests.jsonl. Audio bytes are never changed by report building.

Debit = **max(immediate shared delta, music settlement delta, conservative estimate, provider billing header)**. SFX headers measure 10 credits/s; guard remains 20/s. Music's paired reads support an account working model of 30/s, versus public creative 15/s. The first immediate music read is separated only by required pacing; settlement reads wait 30 seconds, up to three times if the counter still lags. All readings stay in the sidecar, HTTP/balance journals and music-balance-pairs.json. These shared intervals cannot promise exclusive invoice attribution. Voice retains the AU1 measured 1/character; George is repeated without regeneration.

The key is read from ELEVENLABS_API_KEY or the two existing read-only .env paths used in AU1. No sister project files are modified. Tests intercept all requests with fake credentials.

## Verification

Raw files are decoded and measured with ebur128 true-peak mode. AIR has an explicit first-two-second envelope screen; loop-request overruns remain untrimmed. Every music sketch has a three-repeat numerical seam screen. None of these establishes musical quality. Absorb pairs with a very quiet member are matched downward to that member for fair within-pair review; no waveform is mastered.

Playwright opens r1, r2 and the cumulative proof using file:// on desktop/phone, light/dark. It checks every file's native playback, overflow, relative references, exact ledger/sidecar/hash equality, radio and multiline-note persistence, round-isolated storage, Markdown copy/export and repeat controls. Owner listening is pending and is never inferred from those checks.
