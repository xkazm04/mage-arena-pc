# Production forecast and investment decision

Scenario: **150 SFX × 2 s, 20 UI × 1 s, eight ambiences × 30 s, 12 music tracks × 90 s × four independent layers**. Music totals 4,320 generated seconds. This is a planning scenario, not proof the generator can supply usable independent layers. One take per asset is optimistic; four complete mixes cannot substitute for four aligned stems.

| Category | Account working model: SFX 10/s, music 30/s | Conservative guard model: SFX 20/s, music 30/s |
|---|---:|---:|
| 150 SFX | 3,000 | 6,000 |
| 20 UI cues | 200 | 400 |
| Eight 30 s ambiences | 2,400 | 4,800 |
| 12 tracks × four 90 s layers | 129,600 | 129,600 |
| First takes | **135,200** | **140,800** |
| With 50% regeneration allowance | **202,800** | **211,200** |

AU2's paired music windows now support the 30/s account model directly, with the shared-account attribution caveat. The 150-SFX and UI rate extrapolates from measured short cues; the longer ambience and layered music deliverables remain assumptions. Voice adds 1,000 credits per 1,000 characters at George's measured rate. Rejections and production repair can easily exceed the 50% allowance; no AU2 cost per accepted asset is available until the owner judges.

| Scenario | Required credits | Starter: 30,000/month, $6 | Creator: 121,000/month, $22 |
|---|---:|---|---|
| Working first takes | 135,200 | 5 allocations / $30 | 2 allocations / $44 |
| Working +50% regeneration | 202,800 | 8 allocations / $48 | 2 allocations / $44 |
| Guard +50% regeneration | 211,200 | 8 allocations / $48 | 2 allocations / $44 |

Allocation arithmetic is ceil((required + 8,000 reserve) / monthly allocation), generating over those cycles with no sister-project spend. The current 90,000 account limit is a rollover ceiling, not a new monthly allocation. These are nominal subscription-cycle comparisons, not a promise of instant banked capacity; they exclude tax, promotions, editing labour and any route-specific pricing differences. The AU2 14,000 floor remains in force now; a production authorization would need to set its own safety floor. Public Starter/Creator figures were rechecked on [official pricing](https://elevenlabs.io/pricing) on 2026-10-03 local. No upgrade was purchased.

A lean one-full-mix-per-track alternative costs about **38,000** working credits, or **57,000** with 50% rework. It removes the adaptive-layer requirement. The public creative music estimate of 15/s would give 76,000 with conservative SFX rates, but the account observations do not justify using that lower rate to authorize production.

Recommendation: use the new owner triage to establish which repairs work before buying more generation. The paced run tests the historical GET burst issue without changing plans. A higher tier may add allowance, but this audition does not demonstrate improved loops or independent stems. Compare Google only after verifying which interface the owner's Ultra credits cover, using the same briefs and acceptance criteria in the report's comparison list. No Google calls or production generation were made.
