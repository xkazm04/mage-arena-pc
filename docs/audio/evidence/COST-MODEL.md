# AU1 smaller audition: cost evidence

2026-10-02. **15 samples; 1,852 conservative credits against the 4,000 total cap. 2,148 unused. Generation stopped on a real HTTP 429, not cap exhaustion.** The 8,000 shared reserve remains. There were 13 new samples plus the two retained first-session proofs. The original 12,000 allowance is superseded, not an additional pot.

## Three modality proofs before the batch

Session 2 generated Fire B, Ashen vault and George in that order before continuing the short SFX batch. All estimates, immediate before/after balances and optional billing headers are in each sidecar and the ledger.

| Modality | Measured evidence | Documented estimate | Conservative estimate used |
|---|---|---|---|
| Fire B SFX, 2 s | Header 20 credits; delta 0. All 12 SFX: 240 header credits / 24 requested seconds = **10 credits/s** | API duration-specified: 20/s | 20/s; each 2 s cue reserves 40. No fixed minimum with explicit duration |
| Ashen vault music, 20 s | No header; immediate delta 0. Earlier 20 s proof delta 620 = **31/s shared upper-bound proxy**, not attributed billing | Public Creative rate 900/min = 15/s; account/API route may differ | 30/s working inference from earlier delta: 600 music plus 20 delayed SFX if no competing charges. 600 reserved per 20 s |
| George, 32 text characters | Header 32; delta 0 = **1 credit/character**, n=1; 2.090 decoded seconds | Multilingual v2 1/character | 1/character; 32 reserved and debited |

An immediate zero delta does not mean free audio. The second-session proof preflight was 25,524; the read before the next SFX had settled to 24,872. Those 652 credits equal the working 600 music + 20 SFX + 32 voice, but shared/delayed billing prevents exact attribution. This corroborates the working model only conditionally.

The three fresh proofs brought the conservative total to 1,332. The remaining priorities then estimated 1,432 (25 SFX at 800, camp night at 600, second voice at 32), leaving 1,236 forecast capacity before optional beds and unexpected shared deltas. No cap increase or extra credit purchase occurred.

## Accounting and shared-account uncertainty

Charge **max(shared balance delta, conservative model estimate, optional exact billing header)** against the cap. Retain a separate documented-price estimate. A delta is an **upper-bound proxy** because another project can spend concurrently; lag means it is not a mathematical bound on eventual per-request billing. Negative deltas and deltas greater than twice the estimate are flagged, not fatal. Missing headers do not stop generation and are never treated as zero cost.

| Category | Samples | Requested output | Header-attributed credits | Conservative cap debit |
|---|---:|---:|---:|---:|
| Elemental cast SFX | 8 | 16 s | 160 | 340 |
| Absorb SFX | 4 | 8 s | 80 | 260 |
| Arena music | 2 | 40 s | unavailable | 1,220 |
| Voice | 1 | 32 characters | 32 | 32 |
| **Total** | **15** | **64 s + voice** | **272 attributed subset** | **1,852** |

The last absorb has a 140-credit shared delta, 3.5 times its 40 estimate, but an exact SFX header of 20. It is flagged as implausibly large for this call and the full 140 is still debited. Earth A has a 60 delta against its 40 estimate. These deltas may include settling neighbouring calls; conservative accounting can therefore count some charges twice. The 1,852 is **not claimed as the provider's exact project invoice**.

Session 1's original ledger, reservation, budget and billing-fault STOP are preserved under `session1/`. Under the host's explicit reconciliation instruction, its Fire debit became max(0, 40, 20) = 40 and music max(620, 600) = 620. Prior total 660; session 2 adds 1,192. The old 1,200 unresolved music reservation was replaced, not forgotten. Its original evidence remains available. Completed audio has one current ledger entry and exactly matching sidecar; the request journal records reconciliation.

## The real stopping event

At **2026-10-02 21:02:26.023 UTC**, the tool received HTTP **429**, code `rate_limited`. The last audio POST had succeeded; the following subscription GET was rate-limited. Read-only exponential backoff recovered a valid balance, but the first error had already persisted the latch. No billable POST was retried and no later generation occurred. The original latch format did not retain endpoint/method; this attribution follows the executed control flow and saved successful completion. The tool now records endpoint/method on future latches too.

The final balance was **24,672** at the timestamp recorded in the last sidecar, **16,672 above reserve**; reset **2026-10-04 19:31:41 UTC**. The second-session interval fell by 852, which may include other projects and delayed charges. The guard additionally subtracts all prior project debit from the latest balance as a lag allowance before approving a call. That deliberately over-reserves after settled charges; no client can atomically protect a shared account from an independent writer.

The new 429 latch stays set. The older billing-fault latch was cleared only under the explicit host authorization and is archived. Missing metadata no longer latches. Durable pending reservations still protect unknown/crashed requests; they are not automatically erased. No API keys, raw error bodies or authorization headers are written to evidence.

## Public source context, checked 2026-10-02

- [SFX API credit pricing](https://help.elevenlabs.io/hc/en-us/articles/25735337678481-How-much-does-it-cost-to-generate-sound-effects): explicit-duration API estimate 20/s, unlike this account's measured 10/s headers.
- [Creative pricing](https://elevenlabs.io/pricing): Starter $6 / 30k monthly credits, Creator $22 / 121k; music estimate 900/min and Multilingual v2 1/character. Taxes/offers and account metering can differ. Rollover is capped; a 90k balance limit does not establish 90k new credits each month.
- [Billing documentation](https://elevenlabs.io/docs/overview/administration/billing): legacy and newer billing routes differ. No upgrade or extra-credit purchase was made.

Public rates are documented estimates, not replacements for measured account evidence. Header attribution is exact when provided; the music model remains conditional. A larger credit plan is not demonstrated to cure a subscription-read rate limit.
