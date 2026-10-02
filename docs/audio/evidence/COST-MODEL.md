# AU1 cost evidence — incomplete proof series

2026-10-02. **Only two generations. The cap was not reached and the provider did not return a quota or rate-limit error.** The local tool's stricter billing-uncertainty stop latch fired on the music response because it had no `character-cost` header. The owner instructed that a tripped latch ends generation; it remains latched. Voice proof and the other 38 planned samples were not called. This is a tooling/accounting stop, not evidence that Starter cannot deliver a larger audition.

| Quantity | Evidence | Interpretation |
|---|---|---|
| Fire cast, 2 seconds | response `character-cost: 20` | exact provider header measurement: 10 credits per requested second; n=1 |
| Arena music, 20 seconds | no billing header; account 42,681 → 42,061 | 620-credit shared account change; not an exact music charge |
| Music working inference | 620 minus 20 delayed SFX credits = 600 | 30 credits/s **if** these are the only settling charges; not measured per request |
| Music budget debit | 1,200 | original conservative bound of 60/s, retained; not a claim of actual spend |
| Voice | no call | credits/character **not measured**; 1/character is the planning bound for multilingual v2, not a result |
| Total exact attributed billing | 20 | SFX only; music unresolved |
| Total conservative project debit | 1,220 / 12,000 | 20 measured + 1,200 reserved; 10,780 unspent capacity is locked, not used |
| Latest balance at generation stop | 42,061 / 90,000, starter | measured 19:14:19 UTC; other projects continue using the account |
| Reserve | 8,000 | remains protected; even initial 42,681 minus full 12,000 is 30,681 before other projects' spend |
| Reset | 2026-10-04 19:31:41 UTC | measured subscription response |

The first initial read was 42,721 at 19:13:09 UTC, already below the owner's older 43,319 snapshot. The SFX preflight at 19:13:21 was 42,681; immediate postflight stayed the same. The subsequent music preflight still showed 42,681. This demonstrates why a zero immediate delta is not a free call. A read-only analytics query found this sound-generation request at 19:13:22.593 and music at 19:13:59.008, with another music request at 19:14:20.716 and another SFX at 19:14:29.741. Shared requests exist. Analytics exposed timestamps and routes, not credit costs. No identity or API-key columns were retained.

## Public price context (retrieved 2026-10-02; account billing wins)

- [SFX API reference](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert) documents the optional billing header, duration and loop flag. Header absence must have an accounting path; this implementation chose to stop.
- [SFX help pricing](https://help.elevenlabs.io/hc/en-us/articles/25735337678481-How-much-does-it-cost-to-generate-sound-effects) distinguishes website and API charging, listing 20 credits/s for duration-specified API use; this one account response is 10/s. Do not silently substitute the public rate for the measurement.
- [Creative pricing](https://elevenlabs.io/pricing) lists Starter $6 / 30k monthly credits and Creator $22 / 121k monthly credits, excluding taxes; introductory and temporary offers can differ. The account's 90k limit is a measured balance limit, **not proof of 90k recurring credits each month**.
- [API pricing](https://elevenlabs.io/pricing/api) currently describes dollar metering, including music $0.15/min and effects $0.12/min. This live account exposes legacy-style credit counters. A plan change or new billing route must be quoted against this account; these dollar rates are not treated as a measured conversion factor for its credits.
- [Music compose API](https://elevenlabs.io/docs/api-reference/music/compose) provides full music generation; a full mix is not an adaptive stem contract. [History API](https://elevenlabs.io/docs/api-reference/history/list) explicitly excludes music and SFX from its retrieval coverage.

## Production extrapolation — scenario, not quote

Assumptions: 150 SFX × 2 s, 20 UI sounds × 1 s, 8 ambiences × 30 s, and 12 music tracks × 90 s × 4 independently authored layers. This is **4,320 generated music seconds**, not 1,080. Rendering an isolated usable layer at the same rate is unverified. One take per item is optimistic. At the observed SFX rate (10/s), the inferred music rate (30/s), and with no voice, totals are:

| Category | Requested output | Conditional credits |
|---|---:|---:|
| SFX | 300 s | 3,000 |
| UI | 20 s | 200 |
| Ambience | 240 s | 2,400 |
| Music, four layers | 4,320 s | 129,600 |
| Total one take | | 135,200 |
| With 50% regeneration allowance | | 202,800 |

These rates are weakly evidenced: one exact SFX proof, one inferred music rate, no layer generation proof. Conservative preflight bounds instead yield 285,800 one-take credits (15,000 SFX + 2,000 UI + 9,600 ambience + 259,200 music), or 428,700 with 50% extra. Neither figure includes mastering, loop edits, stem repair, actor direction or human review.

At 30k recurring Starter credits with an 8k reserve, 135,200 credits need ceil((135,200+8,000)/30,000) = **5 months, $30**; 202,800 need **8 months, $48**. At 121k Creator credits and the same reserve they need **2 months, $44** each. These are whole-month pooled-credit scenarios with no sister-project use, not an upgrade quote. Conservative 285,800 requires **10 Starter months ($60)** or **3 Creator months ($66)**; 428,700 requires **15 ($90)** or **4 ($88)**. Rollover caps, current offers, purchased extra credits and whether the account remains on this credit model may change feasibility.

A single full-mix tier/segment per track reduces the conditional first-take total to **38,000** (or 57,000 with 50% extra), but supplies neither four layers nor the same adaptive capability. Source-separated stems are also not automatically independent compositions. The main unknown is cost per **accepted usable adaptive set**, not cost per decoded minute. No production was generated.

## Next comparison, not a service call

The 40-item `tools/audio/audition-plan.json` is the proposed identical request list for a future Google comparison. No Google service was invoked. Before investing: which Google product actually exposes short SFX, instrumental music, independent stems and selectable narration; does the owner's Ultra allowance cover those calls or only consumer UI; can outputs be exported for a game; what are measured duration, latency, price, daily limits and reuse terms? Keep prompts, durations and blind labels equal; report unsupported categories explicitly. Measure one proof of each modality before a batch. Compare transient onset, exact event count, unwanted speech, element/family recognition, 96 BPM conformance, three loop joins, stem subsets, pronunciation, loudness and accepted takes per credit. More allowance does not fix bad seams or unavailable stems.
