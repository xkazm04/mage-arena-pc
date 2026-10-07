"""Summarize actual AU2 evidence, without inventing listening or billing attribution."""
import json,datetime,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/audio/evidence/r2'
OUT.mkdir(parents=True,exist_ok=True)
read=lambda p:json.loads((ROOT/p).read_text())
ledger=[json.loads(x) for x in (ROOT/'tools/audio/ledger.jsonl').read_text().splitlines() if x]
new=[e for e in ledger if e.get('wave')=='AU2']
music=[e for e in new if e['kind']=='music']
sfx=[e for e in new if e['kind']=='sfx']
plan=read('tools/audio/audition-plan-r2.json')['samples']
measure={m['id']:m for m in read('docs/audio/evidence/measurements.json')}
http=[json.loads(x) for x in (ROOT/'tools/audio/http.jsonl').read_text().splitlines() if x]
balances=[json.loads(x) for x in (ROOT/'tools/audio/balances.jsonl').read_text().splitlines() if x]
budget=read('tools/audio/budget.json')
spent=sum(e['chargedCredits'] for e in new)
def write(name,text):
    text=text.replace('](evidence/r2/','](').replace('](evidence/r1-final/','](../r1-final/').replace('](../../tools/audio/','](../../../../tools/audio/')
    (OUT/name).write_text(text.strip()+'\n',encoding='utf-8')
def table(head,rows):return '\n'.join(['| '+' | '.join(head)+' |','|'+'|'.join('---' for _ in head)+'|']+['| '+' | '.join(map(str,row))+' |' for row in rows])
def m(e):return measure[Path(e['out']).stem]
num=lambda n:f'{n:,.0f}'
parsed=lambda s:datetime.datetime.fromisoformat(s.replace('Z','+00:00'))
gaps=[(parsed(b['startedAt'])-parsed(a['completedAt'])).total_seconds() for a,b in zip(http,http[1:])]
errors=[e for e in http if e['status']>=400]
rate=[e for e in errors if e['status']==429]
rows=[];pair_evidence=[]
for e in music:
    # The next preflight is still before any other local paid call. It can reveal
    # a delayed music charge that escaped the scheduled settlement read.
    pos=new.index(e)
    following=new[pos+1]['accountBefore'] if pos+1<len(new) else balances[-1]
    nextdelta=e['accountBefore']['remaining']-following['remaining']
    observed=max(e['accountDelta'] or 0,e.get('settledDelta') or 0,nextdelta)
    pair_evidence.append({'id':Path(e['out']).stem,'before':e['accountBefore'],'immediateAfter':e['accountAfter'],'settlementReads':e.get('settlementReads',[e['accountSettled']] if e.get('accountSettled') else []),'nextLocalPreflight':following,'observedIntervalDelta':observed,'observedCreditsPerRequestedSecond':observed/e['seconds'],'attribution':'Shared-account interval observation; no intervening local POST. Not exclusive per-request invoice attribution.'})
    rows.append((Path(e['out']).stem,e['seconds'],e['accountBefore']['remaining'],e['accountDelta'],e.get('settledDelta','—'),nextdelta,e['chargedCredits'],f'{observed/e["seconds"]:.2f}'))
(OUT/'music-balance-pairs.json').write_text(json.dumps(pair_evidence,indent=2)+'\n')
cost_table=table(['Music','Requested s','Before balance','Immediate delta','Settled delta','Next preflight delta','Cap debit','Observed interval / s'],rows)
sfx_rate=sum(e['measuredCredits'] or 0 for e in sfx)/sum(e['seconds'] for e in sfx) if sfx else 0
write('COST-MODEL.md',f'''
# Corrected account cost model · AU2

AU2 delivered **{len(new)} new files**, conservatively debiting **{num(spent)} / 5,000 credits**; {num(5000-spent)} remains unused. AU1 retains its own 1,852/4,000 history. Combined recorded debit is {num(1852+spent)}, not an invoice. Opening shared balance {num(balances[0]['remaining'])}, latest {num(balances[-1]['remaining'])} at {balances[-1]['observedAt']}; total account drop {num(balances[0]['remaining']-balances[-1]['remaining'])}, including possible sister-project spending. Hard floor 14,000, reserve 8,000; reset {balances[-1]['resetsAt']}.

| Modality | Real evidence | Model used for the cap |
|---|---|---|
| SFX | {len(sfx)} AU2 files; {sum(e['seconds'] for e in sfx):g} requested seconds; {sum(e['measuredCredits'] or 0 for e in sfx):g} provider-header credits = **{sfx_rate:g}/s**. AU1 also measured 10/s | **20/s** retained conservatively. Explicit duration avoids assuming the website's per-generation rate |
| Music | Paired reads below, including settlement and the next local preflight. First isolated 20 s call visibly settled at **600 credits = 30/s**. Immediate zero counters are stale. Song IDs retained, but no exact credit header | **30/s**; use the largest observed immediate/settlement delta if greater. Public creative 900/min = 15/s does not describe this account's observed route |
| Voice | Kept George line from AU1: exact header 32 credits / 32 characters = **1/character** | No new voice purchase; 1/character for production estimates |

## Every music call paired with real balance reads

{cost_table}

The music observations also show why a single large delta is not a per-song price: camp A day includes a 400-credit window for a 360-credit estimate, and camp A night includes 380 for 360. Earlier SFX counters were still settling. These excesses are retained in the conservative debit, not silently subtracted.

The first balance read after each music POST is taken at the earliest permitted eight-second request gap. Follow-ups wait 30 seconds. After the second music call showed a zero delta even then, the tool was extended to allow three such reads (up to roughly 90 seconds), stopping sooner once the estimated charge appears. The next local preflight column is additional observational evidence and is **not retroactively added as another charge**. No other local paid generation intervenes between a music POST and those observations.

The working whole-round cost is {num(sum(e['seconds'] for e in music)*30+sum(e['measuredCredits'] or 0 for e in sfx))} credits: music at 30/s plus exact SFX headers. Compare that model with the actual total account drop above; agreement supports the rate but cannot by itself prove exclusive per-request billing.

**Attribution limit:** these are actual counter observations tied to each local call window, substantially stronger than AU1's mixed-call inference. The account is still shared. Garden-vr can spend during the interval, and the counter can lag. Therefore 30/s is the measured interval-supported working account model, **not a claim of exclusive invoice attribution for every song**. No billing header means unavailable, never free. See [full timestamped music pairs](evidence/r2/music-balance-pairs.json), [HTTP evidence](../../tools/audio/http.jsonl) and original sidecars.

For each original, debit **max(immediate balance delta, music settlement delta, conservative estimate, provider credit header)**. Estimates reserve before POST; unresolved requests block later generation. Current balance and opening balance less all AU2 debits are both checked before spending. The guard refuses a predicted balance below 14,000 and latches if any actual balance read drops below it, even due to another project. The 8,000 reserve remains separately enforced. A client cannot atomically prevent independent account spending during an in-flight call.

One AIR request returned explicit HTTP 400 `invalid_text_length`, maximum 450 characters. It generated no file; a later read matched its preflight balance. Its 40-credit reservation was reconciled as rejected, with evidence in the request journal; the shortened brief was submitted as a new request. This was not a quota error or an ambiguous paid retry. The local guard now rejects oversized SFX prompts before network access.

Public context checked 2026-10-03 local: [pricing and shared credits](https://elevenlabs.io/pricing), [billing routes](https://elevenlabs.io/docs/overview/administration/billing), [SFX duration pricing](https://help.elevenlabs.io/hc/en-us/articles/25735337678481-How-much-does-it-cost-to-generate-sound-effects). Account observations take precedence for this forecast. The new AU2 allowance is explicit owner authorization, not an increase to AU1's cap.
''')

error_table=table(['UTC','Method / endpoint','HTTP','Code'],[(e['completedAt'],e['method']+' '+e['endpoint'],e['status'],e.get('code','')) for e in errors])
write('RATE-LIMIT.md',f'''
# 429 diagnosis and pacing evidence

**Round 1:** HTTP 429, `rate_limited`, at 2026-10-02 21:02:26.023 UTC. The successful final absorb file and subsequent balance recovery place the error on the postflight **GET /v1/user/subscription**, not the generation POST. That is a control-flow inference supported by the original session logs. The old latch saved no body text, headers, endpoint or numeric quota, so those cannot now be recovered from it. The original STOP, ledger, budget and state are preserved in [r1-final](evidence/r1-final/STOP.json).

**AU2:** {len(http)} requests, all serialized, full response bodies consumed before the next request; smallest observed completion-to-next-start gap **{min(gaps) if gaps else 0:.3f} s**, against an 8 s minimum. {len(rate)} new 429 responses. The local lock covers balance reads, analytics and generation alike. Sister-project concurrency remains outside this worktree's control. Music has additional 30 s settlement gaps. No parallel network batch or automatic paid POST retry was used.

**What limit is actually established?** The old endpoint was rate-limited; its numeric request allowance remains unavailable. New responses exposed no numeric rate-limit headers. Endpoint burst/read frequency is the leading explanation because the old run made tightly paired balance reads and the paced run {'has no recurrence' if not rate else 'records the recurrence below'}. This is evidence, not proof of an exact requests/minute threshold. There is no basis to call this depleted credits or to assert a specific account concurrency count. The provider distinguishes concurrency errors such as `too_many_concurrent_requests` from generic rate errors; the saved code was `rate_limited`. See [official error guidance](https://elevenlabs.io/docs/eleven-api/resources/errors) and [429 explanation](https://elevenlabs.io/docs/help-center/technical/api-error-code-429).

The current guard records selected response headers (including Retry-After and any rate/concurrency fields), method, endpoint, time and sanitized status/message from the error body. Credentials and arbitrary response bodies are excluded. A first read-only 429 permits one recovery after at least 60 s (or the provider's longer Retry-After), increasing spacing to 15 s. A second 429 latches. A paid POST error stops without automatic retry to avoid duplicate billing. These paths are tested offline; {'the AU2 recovery branch was not needed live' if not rate else 'see live records for recovery details'}.

## Actual AU2 errors

{error_table}

The 400 body explicitly reported the 450-character SFX prompt limit; that is a confirmed input-size limit, separate from the unknown numeric rate limit. The revised prompts and local validation address it. Full retained diagnostics: [http.jsonl](../../tools/audio/http.jsonl); [balance timeline](../../tools/audio/balances.jsonl). A richer credit allowance has not been shown necessary to solve the historical GET burst issue.
''')

airs=[e for e in new if Path(e['out']).stem.startswith('air-')]
airpasses=sum(m(e).get('sustainScreen',{}).get('pass',False) for e in airs)
write('OWNER-RESPONSE.md',f'''
# Response to the owner's round-1 rejections

The owner's words in CHOICES.md override the bible. Five kept references appear first on round 2: arena Hide and iron, fire A, water B, earth B and George. They are the original bytes and are not purchased again.

| Targeted owner feedback | New attempt | What is established |
|---|---|---|
| Arena B rejected: no melodic attempt or subtle instrument | Reed oath and Lyre under iron: two distinct melodic briefs inside the kept hide-and-iron entrance family | Files rendered; audible melody, instrument subtlety and family fit require owner listening |
| AIR A and B rejected: turbine, subtle but present for all 2 s | Silk rotor, Hollow vortex and Spiral filament; steady wind body rather than a one-shot | **{airpasses}/{len(airs)}** pass the declared continuous-envelope screen; turbine identity and comfort remain unjudged |
| Absorb A maybe: too aggressive, unsatisfying, no magic; B rejected | Three normal/perfect pairs: Warm rune, Liquid prism, Hushed orbit. Normal has a rounded single note; perfect requests a consonant rising answer | Six separate briefs render the proposed grammar; satisfying reward and reduced aggression are not certified by meters |
| Camp/title/hit/impact/collar/roll/crowd/UI unrendered in round 1 | Two directions per category; camp includes day/dusk/night, UI five independent events | Coverage is shown below; unrendered items are explicitly unjudged |

**How many rejections are fixed? Owner-confirmed: 0 of the 4 targeted rejected directions**, plus 0 confirmed resolutions of the absorb-A “maybe.” There are three regeneration groups (arena, air, absorb); offering new candidates is not itself a fix. The AIR envelope count above is a narrow technical correction, not an owner verdict. Fire B, water A and earth A were also rejected in round 1, but their already-kept alternatives define those families; they are not part of the requested rejection-repair count. No AU2 keep votes have been inferred or written into CHOICES.md.
''')

quality_rows=[]
for category,selector,strength,limit in [
 ('Arena music',lambda e:Path(e['out']).stem.startswith('arena-'),'Two distinct instrument/melody briefs retain the selected entrance family.','Twenty-second complete mixes; melody, measured tempo and family coherence still need listening. No independent adaptive stems.'),
 ('AIR',lambda e:Path(e['out']).stem.startswith('air-'),f'{airpasses}/{len(airs)} pass the sustained-envelope screen.','Continuous energy does not establish a turbine timbre or a pleasing magical edge.'),
 ('Absorb pairs',lambda e:Path(e['out']).stem.startswith('absorb-'),'Three separately rendered normal/perfect pairs support a direct matched comparison.','Tonal reward, aggression and pair recognition require owner listening. Distinct prompts do not guarantee matched timbres.'),
 ('Camp / title',lambda e:Path(e['out']).stem.startswith(('camp-','title-')),'Day/dusk/night and menu sketches fill the main AU1 music coverage gaps.','10–12 seconds is a phrase/timbre probe, too short to assess long-session fatigue or transitions; no ready seamless beds.'),
 ('Hit / collar / roll / crowd',lambda e:Path(e['out']).stem.startswith(('hit-','impact-','collar-','roll-','crowd-')),'Separate events can now be compared, with body/world and movement/feedback roles kept distinct.','Gameplay clarity, distance, tiny-speaker translation and repetition comfort remain unmeasured.'),
 ('UI',lambda e:Path(e['out']).stem.startswith('ui-'),'Five independent short cues in each of two material families.','Event recognition and family coherence need listening; no whole-sequence recording passed off as five separate cues.'),
 ('Kept cast variants',lambda e:Path(e['out']).stem.endswith('kept-variation'),'Additional cast takes within owner-kept directions if budget permitted.','Not replacements for the owner-kept references; no new voice or production set.')]:
    found=[e for e in new if selector(e)]
    peaks=sum(m(e)['samplesAboveFullScale']>0 for e in found)
    quality_rows.append((category,len(found),strength,limit+f' {peaks} raw files contain decoded samples above full scale.'))
loop_rows=[(Path(e['out']).stem,m(e)['seam']['boundaryJumpDbFS'],m(e)['seam']['edgeLevelDifferenceDb'],m(e)['seam']['numericScreen']) for e in music]
air_rows=[(Path(e['out']).stem,m(e)['decodedSeconds'],m(e)['headActiveSeconds'],m(e)['lastActiveSeconds'],str(m(e)['quarterRmsDbFS']),m(e)['quarterLevelRangeDb'],'pass' if m(e)['sustainScreen']['pass'] else 'needs review') for e in airs]
write('QUALITY.md',f'''
# Honest strengths, weaknesses and technical screens

Round-1 **felt evidence** comes from the owner: the dramatic entrance/melody, authentic fire, mysterious magical water, earth B and George were kept. The rejected AIR and unsatisfying absorb show that brief conformance and timing matter more than a generic “magical” prompt. **AU2 has not been listened to by the owner**, and this agent has no audio-listening model. The following is measured technical evidence and authored intent, not a listening review.

{table(['Category','New files','Useful evidence / strength','Remaining weakness'],quality_rows)}

Practical assessment: short source cues now have far broader audition coverage than AU1, but they still require peak treatment, editing and a repetition listen. Music produces quick style candidates at a substantially higher cost; it has not supplied verified loops, a beat grid or adaptive layers. More credits buy further attempts; these measurements do not prove they buy better control. A direction keep is not production approval.

## AIR continuity: the owner's specific timing complaint

{table(['AIR take','Decoded s','Onset s','Last activity s','Quarter RMS dBFS','Quarter range dB','Envelope screen'],air_rows)}

The authored diagnostic requires all four half-second quarters within 12 dB, activity through at least 1.95 s and onset within 0.05 s. Activity uses 10 ms RMS at −40 dB relative to the maximum, floored at −100 dBFS. Quiet but detectable content is not necessarily perceptually present; the quarter-level test adds a stronger continuity check. The two generator-loop repairs return 2.25 s despite the requested 2 s. They are preserved untrimmed; the four continuity windows cover only the requested first 2 s. There is now one passing candidate in each of the three directions, while both early-fade first attempts remain visible. Raw envelope arrays are in measurements.json. Compare the old AIR A/B activity endpoints (1.25 s / 0.68 s) with these values; the owner, not this screen, decides whether the turbine brief works.

## Direct-repeat seam screen: every new music sketch

{table(['Music','Endpoint jump dBFS','Half-second edge RMS difference dB','Numeric screen'],loop_rows)}

**{sum(m(e)["seam"]["numericScreen"]=="needs-repair" for e in music)}/{len(music)} new music sketches fail the direct-repeat numerical screen.** Camp A dusk passes the simple boundary test, which does not certify a musically seamless loop.

Each decoded PCM clip is concatenated conceptually three times and both joins are checked. Authored screen: endpoint jump ≤ −60 dBFS and edge RMS difference ≤ 3 dB. Passing does not establish musical continuity; a phrase can still restart awkwardly or contain a silence. These are raw style sketches, not production loops. Native MP3 repeat may add a gap; repeat controls enable the owner's three-pass listen. No loop repair, tempo correction or stem extraction has been hidden in the evidence.

## Family consistency and loudness

Camp directions group all three times, absorb groups normal/perfect, and UI groups five individual events for owner triage. Shared prompts are authored intent, not measured family recognition. Integrated loudness on half-second UI cues is especially limited. The requested 0.5 s UI outputs decode to about 0.48 s. Cut bronze click is -42.2 LUFS / -27.2 dBTP, far quieter than its family; attenuation-only playback cannot bring it up to target. This inconsistency is a concrete weakness requiring later edit/mix work and listening, not evidence that the cue is absent. Playback normally uses the same attenuation-only review levels as round 1. Each AU2 absorb pair is instead matched to the quieter member if it falls below -26 LUFS, so a louder normal/perfect does not win merely through level. Warm rune perfect is unusually quiet (-33.8 LUFS), and that pair consequently plays at a lower target than the other families. This is an audition limitation; no source file has been amplified or mastered. Raw originals, hashes, ebur128 logs and sidecars remain unchanged. In-game simultaneous voices, spatial distance, music ducking, loop points, mono translation, speech intelligibility and long-session fatigue are not measured; AU3/AU4 are deferred.
''')
write('INVESTMENT.md','''
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
''')
print(json.dumps({'evidenceNotes':5,'newSamples':len(new),'musicPairs':len(pair_evidence),'new429':len(rate),'minimumRequestGapSeconds':min(gaps) if gaps else None}))
