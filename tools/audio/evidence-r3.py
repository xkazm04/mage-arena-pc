"""AU2b accounting and technical summary from measured artifacts. No API calls."""
import json,datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/audio/evidence/r3'; OUT.mkdir(exist_ok=True)
read=lambda f:json.loads((ROOT/f).read_text(encoding='utf-8'))
rows=lambda f:[json.loads(s) for s in (ROOT/f).read_text().splitlines() if s]
ledger=rows('tools/audio/ledger.jsonl'); new=[e for e in ledger if e.get('wave')=='AU2b']
http=[e for e in rows('tools/audio/http.jsonl') if e.get('wave')=='AU2b']
balances=[e for e in rows('tools/audio/balances.jsonl') if e.get('wave')=='AU2b']
measure=[m for m in read('docs/audio/evidence/measurements.json') if m['wave']=='AU2b']
budget=read('tools/audio/budget.json')
stamp=lambda s:datetime.datetime.fromisoformat(s.replace('Z','+00:00'))
gaps=[(stamp(b['startedAt'])-stamp(a['completedAt'])).total_seconds() for a,b in zip(http,http[1:])]
summary={'wave':'AU2b','samples':len(new),'conservativeDebit':sum(e['chargedCredits'] for e in new),'cap':3000,'reserve':8000,'floor':13000,
 'openingSharedBalance':balances[0]['remaining'],'finalSharedBalance':balances[-1]['remaining'],'finalObservedAt':balances[-1]['observedAt'],
 'sharedDrop':balances[0]['remaining']-balances[-1]['remaining'],'minimumObservedBalance':min(e['remaining'] for e in balances),
 'httpRequests':len(http),'http429':sum(e['status']==429 for e in http),'httpErrors':sum(e['status']>=400 for e in http),'minimumRequestGapSeconds':min(gaps),
 'sfxHeaderCredits':sum(e['measuredCredits'] or 0 for e in new if e['kind']=='sfx'),'musicRequestedSeconds':sum(e['seconds'] for e in new if e['kind']=='music'),
 'decodedSeconds':round(sum(m['decodedSeconds'] for m in measure),6),'rawOverFullScale':[m['id'] for m in measure if m['samplesAboveFullScale']],
 'ownerReview':'pending; no audition results inferred','productionGeneration':False,'googleCalls':0,'capabilityProbeCalls':0}
(OUT/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
music=[{k:e.get(k) for k in ('out','seconds','accountBefore','accountAfter','accountDelta','settlementReads','accountSettled','settledDelta','estimatedCredits','chargedCredits','billingHeaders','flags')} for e in new if e['kind']=='music']
(OUT/'music-balance-pairs.json').write_text(json.dumps(music,indent=2)+'\n')
cost=f'''# AU2b cost and pacing evidence

Opening shared balance {summary['openingSharedBalance']:,}; final {summary['finalSharedBalance']:,} at {summary['finalObservedAt']}. The 364-credit decline since AU2 closed happened outside this round and is not charged again. Shared drop this round {summary['sharedDrop']:,}, conservative debit **{summary['conservativeDebit']:,}/3,000**, unused {3000-summary['conservativeDebit']:,}. AU1 1,852 and AU2 4,995 remain separate histories; cumulative debit {sum(e['chargedCredits'] for e in ledger):,}. No production, Google or paid capability probes.

Eleven SFX requests total 22 seconds, with exact provider headers totaling {summary['sfxHeaderCredits']} credits: 10/s. The guard retained 20/s. Two 30 s music requests reserve 900 each; immediate/settlement snapshots remain in [music-balance-pairs.json](music-balance-pairs.json). Reed standard's interval includes 925 credits; Lyre vow 900. The extra 25 is consistent with delayed preceding SFX but cannot be exclusively attributed, so the higher debit remains. Collar's shared delta 70 also exceeds its 20 estimate and 10 header; it remains charged at 70. Max-accounting intentionally overstates attributable billing rather than treating stale counters as free.

At 30/s music plus exact SFX headers, the whole-round working charge is 2,020; it matches the observed account drop. That agreement supports the model but does not exclude coincident garden-vr spending. Compare the 2,325 conservative cap debit, which is deliberately larger. No billing counter was lowered to make the budget fit.

{len(http)} HTTP requests, all 200, {summary['http429']} rate limits, minimum completion-to-next-start gap {min(gaps):.3f} s. All API commands share the lock and persisted pacing. Music settlement waits 30 s between reads, no automatic paid retries. Minimum observed balance {summary['minimumObservedBalance']:,}, above the 13,000 floor and 8,000 reserve. A separate process cannot be stopped atomically by this local guard.

Generation is closed-owner-review; no pending reservation. Round-2 final budget/state/pacing and the original proof were archived before opening AU2b. The 90,000 account limit is not a promised reset allocation; confirm the actual balance after 2026-10-04 19:31:41 UTC before setting a new production budget.
'''
(OUT/'COST-MODEL.md').write_text(cost,encoding='utf-8')
quality='''# AU2b technical screen and listening limits

The agent has no audio-listening model in this session. The prompts respond to the owner's notes; meters cannot establish physical barrier identity, crowd bloodlust, musical melody or a single perceived foot contact. All new direction votes remain blank. Original audio is unchanged. D30 gain/filter/compression/limiting is future app work, not a reason to regenerate softened source cues.

| Category | Evidence | Remaining owner/production check |
|---|---|---|
| Three absorb pairs | Different authored air-pressure, fluid-shear and mineral-friction mechanisms; paired playback matched downward. Normal requests 2 s; perfect 2.5 s, decodes 2.48 s. Both pressure-wall raws exceed full scale. | Hear impact then heavy slowing/containment; perfect recognizably same material, stronger/cleaner with physical release. Reject UI tone, cartoon, bell or boing. Quiet late samples do not prove a continuous brake or clean release. |
| Two title themes | Each requested 30 s; decodes 29.989 s. Raw -13.2 LUFS both, peaks -1.2/-1.3 dBTP; matched review gain -10.8 dB. | Memorable arena-related melody at calm intensity, distinct from camp; numerical duration does not certify musical development. Raw endings trail off before 30 s. They are complete sketches, not approved menu loops. |
| Two roll cues | Sand plant 0.680 s decoded; Sand cut 0.800 s. Both active immediately; activity ends around 0.59/0.54 s. No second event requested. | Listen for exactly one sand contact/scuff. Event counts cannot be inferred from duration or a smooth RMS envelope. Sand plant is materially quieter; inspect both matched and raw with care. |
| Two crowd cues | Both decode 3 s, loud raw mixes; Hungry terraces has decoded over-full-scale samples. | Raw hungry colosseum, irregular stamping and menace; no soccer chant. Numerical envelopes cannot distinguish cheering from bloodlust. Stamping bowl's last thresholded activity is 2.4 s. |
| Optional collar | One 1 s request after all required calls; existing Stone Waking was not regenerated. Main energy is in the latter half despite low-level onset at 0.04 s. | Alternative only. Assess tick timing before event integration; preserve the existing owner keep. |

The standard -40 dB-relative 10 ms RMS activity threshold can include tiny lead-ins and exclude long tails. It is a diagnostic, not perceived onset/offset. Three-repeat numerical seam screens are present for music but are not acceptance for these deliberately closing title sketches. AU3 defines separate full-track ending and interior-loop gates. LUFS for very short SFX is descriptive; compare envelope/peaks and owner listening. No normalization, mastering, audio slicing, inferred owner choice or production acceptance happened here.
'''
(OUT/'QUALITY.md').write_text(quality,encoding='utf-8')
print(json.dumps(summary,indent=2))
