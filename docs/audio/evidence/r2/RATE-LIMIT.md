# 429 diagnosis and pacing evidence

**Round 1:** HTTP 429, `rate_limited`, at 2026-10-02 21:02:26.023 UTC. The successful final absorb file and subsequent balance recovery place the error on the postflight **GET /v1/user/subscription**, not the generation POST. That is a control-flow inference supported by the original session logs. The old latch saved no body text, headers, endpoint or numeric quota, so those cannot now be recovered from it. The original STOP, ledger, budget and state are preserved in [r1-final](../r1-final/STOP.json).

**AU2:** 145 requests, all serialized, full response bodies consumed before the next request; smallest observed completion-to-next-start gap **8.000 s**, against an 8 s minimum. 0 new 429 responses. The local lock covers balance reads, analytics and generation alike. Sister-project concurrency remains outside this worktree's control. Music has additional 30 s settlement gaps. No parallel network batch or automatic paid POST retry was used.

**What limit is actually established?** The old endpoint was rate-limited; its numeric request allowance remains unavailable. New responses exposed no numeric rate-limit headers. Endpoint burst/read frequency is the leading explanation because the old run made tightly paired balance reads and the paced run has no recurrence. This is evidence, not proof of an exact requests/minute threshold. There is no basis to call this depleted credits or to assert a specific account concurrency count. The provider distinguishes concurrency errors such as `too_many_concurrent_requests` from generic rate errors; the saved code was `rate_limited`. See [official error guidance](https://elevenlabs.io/docs/eleven-api/resources/errors) and [429 explanation](https://elevenlabs.io/docs/help-center/technical/api-error-code-429).

The current guard records selected response headers (including Retry-After and any rate/concurrency fields), method, endpoint, time and sanitized status/message from the error body. Credentials and arbitrary response bodies are excluded. A first read-only 429 permits one recovery after at least 60 s (or the provider's longer Retry-After), increasing spacing to 15 s. A second 429 latches. A paid POST error stops without automatic retry to avoid duplicate billing. These paths are tested offline; the AU2 recovery branch was not needed live.

## Actual AU2 errors

| UTC | Method / endpoint | HTTP | Code |
|---|---|---|---|
| 2026-10-02T22:50:50.080Z | POST /v1/sound-generation | 400 | invalid_text_length |

The 400 body explicitly reported the 450-character SFX prompt limit; that is a confirmed input-size limit, separate from the unknown numeric rate limit. The revised prompts and local validation address it. Full retained diagnostics: [http.jsonl](../../../../tools/audio/http.jsonl); [balance timeline](../../../../tools/audio/balances.jsonl). A richer credit allowance has not been shown necessary to solve the historical GET burst issue.
