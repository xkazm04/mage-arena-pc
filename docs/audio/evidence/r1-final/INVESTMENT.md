# Production forecast and investment questions

## A full production set: scenario, not quote

Assume **150 SFX × 2 s, 20 UI cues × 1 s, eight ambience beds × 30 s, and 12 music tracks × 90 s × four independently authored adaptive layers**. The music total is 4,320 generated seconds. This audition did not demonstrate usable independent layers; four separate full mixes are not a substitute. One take per item is optimistic.

| Category | Observed SFX 10/s + inferred music 30/s | Guard model SFX 20/s + music 30/s |
|---|---:|---:|
| 150 SFX | 3,000 | 6,000 |
| 20 UI cues | 200 | 400 |
| Eight ambiences | 2,400 | 4,800 |
| 12 × four music layers | 129,600 | 129,600 |
| Total, one take | **135,200** | **140,800** |
| With 50% regeneration allowance | **202,800** | **211,200** |

UI and ambience inherit the SFX rate by assumption; neither was measured here. Using the public music estimate of 15/s and documented SFX 20/s instead gives **76,000** (114,000 with rework). This spread is billing/model uncertainty, not a quality guarantee. Voice adds 1,000 credits per 1,000 characters at the measured stock-voice rate.

| Scenario | Credits | Starter: 30k/month, $6 | Creator (next tier): 121k/month, $22 |
|---|---:|---|---|
| Documented-rate first take | 76,000 | 3 monthly allocations / $18 | 1 allocation / $22 |
| Working first take | 135,200 | 5 allocations / $30 | 2 allocations / $44 |
| Working + 50% rework | 202,800 | 8 allocations / $48 | 2 allocations / $44 |
| Guard + 50% rework | 211,200 | 8 allocations / $48 | 2 allocations / $44 |

Allocation arithmetic: ceil((required + 8,000 reserve) / monthly allowance), assuming generation is spread across those cycles and no sister-project spend. **Not a promise that all credits can be banked:** rollover is capped. The current 90k account limit is not a recurring 90k monthly entitlement. Excludes taxes, temporary offers, top-ups, editing and review labour. Public figures checked 2026-10-02: [ElevenLabs pricing](https://elevenlabs.io/pricing); account/legacy/API billing must be confirmed before purchase. No plan was changed.

A lean alternative with one full mix per 90 s track is about **38,000** working credits, or 57,000 with rework. It removes the four-layer deliverable and therefore does not satisfy the same adaptive design. Cost per accepted game-ready set matters more than generated minutes.

## Recommendation questions before investing

**Recommendation:** triage the completed cast/absorb pairs and two arena directions first. The smaller, rate-limited audition is insufficient to justify an upgrade on quality grounds. A future authorized batch should pace subscription reads and generations; a richer credit allowance should not be assumed to remove this 429. The latch stays set.

1. Which limits caused the subscription-read 429, and would another tier change them? Does it add useful loop control, independent layers or export formats, or mainly allowance?
2. Which Google product/interface is actually covered by the owner's Ultra credits? Are short SFX, standalone instrumental music and TTS exports included, or separately billed? Probe access, limits, credit conversion and game-use terms before buying or batching.
3. Can Google produce the **same priority sample list** below with identical prompts, requested lengths, attempt limits and playback levels? Mark unsupported categories explicitly. Use comparable calm stock narration registers; exact voice identity cannot match across providers.
4. Can each provider produce an immediate single cast, distinguish normal/perfect absorb, and deliver five distinct UI events within one material family? Compare blind recognition, unwanted speech/music, attack delay, tail length and repetition comfort.
5. Can the 20 s camp-night request repeat three times without a click or content hole? Can the arena maintain measured 96 BPM / 4/4 and supply aligned independent layers whose subsets work? Prompt declarations do not count as measurements.
6. What are accepted takes per credit and cost per accepted set after rejection, seam repair, peak treatment and human review? Does combining services reduce that total while preserving the world's identity?

For a fair Google test: the **same three proof briefs first** (Fire B, Ashen vault, the 32-character voice line), then the **32 priority briefs**, with the **two optional ambience probes** only under a separately authorized budget. The six deferred briefs stay outside the primary comparison score. The complete prompts, lengths and scope labels are in the report matrix and `tools/audio/audition-plan.json`.

Record requested/decoded duration, prompt, model/interface, latency, credits/cash, failure status, loudness, seam measurements and owner keep/maybe/reject decisions. Unavailable categories remain unavailable; they must not silently disappear from the comparison. This is a proposed future probe, **not authorization to run it. No Google service was called.**
