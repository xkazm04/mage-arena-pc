# Corrected account cost model · AU2

AU2 delivered **43 new files**, conservatively debiting **4,995 / 5,000 credits**; 5 remains unused. AU1 retains its own 1,852/4,000 history. Combined recorded debit is 6,847, not an invoice. Opening shared balance 22,913, latest 18,473 at 2026-10-02T23:24:35.957Z; total account drop 4,440, including possible sister-project spending. Hard floor 14,000, reserve 8,000; reset 2026-10-04T19:31:41.000Z.

| Modality | Real evidence | Model used for the cap |
|---|---|---|
| SFX | 33 AU2 files; 48 requested seconds; 480 provider-header credits = **10/s**. AU1 also measured 10/s | **20/s** retained conservatively. Explicit duration avoids assuming the website's per-generation rate |
| Music | Paired reads below, including settlement and the next local preflight. First isolated 20 s call visibly settled at **600 credits = 30/s**. Immediate zero counters are stale. Song IDs retained, but no exact credit header | **30/s**; use the largest observed immediate/settlement delta if greater. Public creative 900/min = 15/s does not describe this account's observed route |
| Voice | Kept George line from AU1: exact header 32 credits / 32 characters = **1/character** | No new voice purchase; 1/character for production estimates |

## Every music call paired with real balance reads

| Music | Requested s | Before balance | Immediate delta | Settled delta | Next preflight delta | Cap debit | Observed interval / s |
|---|---|---|---|---|---|---|---|
| arena-C-reed-oath | 20 | 22913 | 0 | 600 | 600 | 600 | 30.00 |
| arena-D-lyre-under-iron | 20 | 22313 | 0 | 0 | 600 | 600 | 30.00 |
| camp-A-day | 12 | 21573 | 400 | 400 | 400 | 400 | 33.33 |
| camp-A-dusk | 12 | 21173 | 0 | 360 | 360 | 360 | 30.00 |
| camp-A-night | 12 | 20793 | 380 | 380 | 380 | 380 | 31.67 |
| camp-B-day | 12 | 20413 | 0 | 360 | 360 | 360 | 30.00 |
| camp-B-dusk | 12 | 20053 | 0 | 360 | 360 | 360 | 30.00 |
| camp-B-night | 12 | 19693 | 0 | 360 | 360 | 360 | 30.00 |
| title-A-unbroken-thread | 10 | 19333 | 0 | 300 | 300 | 300 | 30.00 |
| title-B-oath-in-stone | 10 | 19033 | 300 | 300 | 300 | 300 | 30.00 |

The music observations also show why a single large delta is not a per-song price: camp A day includes a 400-credit window for a 360-credit estimate, and camp A night includes 380 for 360. Earlier SFX counters were still settling. These excesses are retained in the conservative debit, not silently subtracted.

The first balance read after each music POST is taken at the earliest permitted eight-second request gap. Follow-ups wait 30 seconds. After the second music call showed a zero delta even then, the tool was extended to allow three such reads (up to roughly 90 seconds), stopping sooner once the estimated charge appears. The next local preflight column is additional observational evidence and is **not retroactively added as another charge**. No other local paid generation intervenes between a music POST and those observations.

The working whole-round cost is 4,440 credits: music at 30/s plus exact SFX headers. Compare that model with the actual total account drop above; agreement supports the rate but cannot by itself prove exclusive per-request billing.

**Attribution limit:** these are actual counter observations tied to each local call window, substantially stronger than AU1's mixed-call inference. The account is still shared. Garden-vr can spend during the interval, and the counter can lag. Therefore 30/s is the measured interval-supported working account model, **not a claim of exclusive invoice attribution for every song**. No billing header means unavailable, never free. See [full timestamped music pairs](music-balance-pairs.json), [HTTP evidence](../../../../tools/audio/http.jsonl) and original sidecars.

For each original, debit **max(immediate balance delta, music settlement delta, conservative estimate, provider credit header)**. Estimates reserve before POST; unresolved requests block later generation. Current balance and opening balance less all AU2 debits are both checked before spending. The guard refuses a predicted balance below 14,000 and latches if any actual balance read drops below it, even due to another project. The 8,000 reserve remains separately enforced. A client cannot atomically prevent independent account spending during an in-flight call.

One AIR request returned explicit HTTP 400 `invalid_text_length`, maximum 450 characters. It generated no file; a later read matched its preflight balance. Its 40-credit reservation was reconciled as rejected, with evidence in the request journal; the shortened brief was submitted as a new request. This was not a quota error or an ambiguous paid retry. The local guard now rejects oversized SFX prompts before network access.

Public context checked 2026-10-03 local: [pricing and shared credits](https://elevenlabs.io/pricing), [billing routes](https://elevenlabs.io/docs/overview/administration/billing), [SFX duration pricing](https://help.elevenlabs.io/hc/en-us/articles/25735337678481-How-much-does-it-cost-to-generate-sound-effects). Account observations take precedence for this forecast. The new AU2 allowance is explicit owner authorization, not an increase to AU1's cap.
