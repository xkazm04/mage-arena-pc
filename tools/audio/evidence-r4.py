"""Finalize derivative provenance, cost audit and engine contract, offline."""
from pathlib import Path
import importlib.util, json, hashlib, math
ROOT=Path(__file__).resolve().parents[2]; AUDIO=ROOT/'docs/audio'; E=AUDIO/'evidence/r4'
spec=importlib.util.spec_from_file_location('process_r4',ROOT/'tools/audio/process-r4.py'); p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
manifest=json.loads((AUDIO/'manifest-au3.json').read_text(encoding='utf-8'))
registry=[]
for t in manifest['tracks']:
    source=AUDIO/t['rawFile']; rawhash=hashlib.sha256(source.read_bytes()).hexdigest()
    assert rawhash==t['rawMeasurement']['sha256']
    byfile={t['file']:t['mastering']['measurement'],t['sting']['file']:t['sting']['measurement'],t['sustainLoop']['file']:t['sustainLoop']['measurement']}
    for f in sorted((AUDIO/t['file']).parent.glob('*.wav')):
        r=f.relative_to(AUDIO).as_posix(); measurement=byfile.get(r) or p.meter(f,t['id']+'-'+f.stem)
        processing=t['mastering'] if f.name=='master-48k.wav' else t['sting'] if f.name=='sting-5s.wav' else t['sustainLoop'] if f.name=='sustain.wav' else next(s for s in t['sectionMap'] if s['file']==r)
        entry=dict(kind='offline-audio-derivative',wave='AU3',file=r,sha256=hashlib.sha256(f.read_bytes()).hexdigest(),source=t['rawFile'],sourceSha256=rawhash,sourceSidecar=t['sidecar'],additionalPaidCalls=0,additionalCredits=0,tool='ffmpeg',reproduce=f"python tools/audio/process-r4.py {t['id']}",processing=processing,measurement=measurement,note='PCM derived from lossy provider MP3; no claim of native lossless master. Paid generation ledger records the original only.')
        p.save(f.with_suffix(f.suffix+'.json'),entry);registry.append(entry)
    t['productionApproved']=False;t['linearPlaybackReadyMeaning']='Technical decode/mastering readiness only; owner approval is separate.'
    t['assetSidecars']=[e['file']+'.json' for e in registry if e['source']==t['rawFile']]
manifest['runtimeContract']['maxSimultaneousFullMixes']=2
manifest['runtimeContract']['fullMixLayering']='Horizontal playback only; do not stack separately generated full mixes as stems.'
manifest['runtimeContract']['maximumMusicBusGainDb']=0
manifest['deferred']=[dict(id='arena-A-hide-and-iron',reason='150 s estimate 4500 and 90 s fallback 2700 exceed remaining job cap 1000 and final observed balance headroom 689.',generated=False)]
p.save(AUDIO/'manifest-au3.json',manifest)
p.save(E/'derivatives.json',registry)
ledger=[json.loads(x) for x in (ROOT/'tools/audio/ledger.jsonl').read_text(encoding='utf-8').splitlines() if x]
ledger=[x for x in ledger if x.get('wave')=='AU3']
http=[json.loads(x) for x in (ROOT/'tools/audio/http.jsonl').read_text(encoding='utf-8').splitlines() if x]
http=[x for x in http if x.get('wave')=='AU3']
from datetime import datetime
gaps=[(datetime.fromisoformat(b['startedAt'])-datetime.fromisoformat(a['completedAt'])).total_seconds() for a,b in zip(http,http[1:])]
cost=dict(jobCap=10000,floor=1000,totalConservativeCredits=sum(e['chargedCredits'] for e in ledger),totalRequestedSeconds=sum(e['seconds'] for e in ledger),httpCount=len(http),paidPosts=sum(e['method']=='POST' for e in http),statuses=[e['status'] for e in http],minimumRequestGapSeconds=min(gaps),perCall=[dict(id=e['trackId'],before=e['accountBefore'],after=e['accountAfter'],settled=e.get('accountSettled'),debit=e['chargedCredits'],estimate=e['estimatedCredits'],rate=e['chargedCredits']/e['seconds']) for e in ledger],pending=json.loads((ROOT/'tools/audio/state.json').read_text(encoding='utf-8'))['pending'])
assert cost['paidPosts']==2 and cost['totalConservativeCredits']==9000 and cost['minimumRequestGapSeconds']>=8 and all(s==200 for s in cost['statuses']) and cost['pending'] is None
p.save(E/'cost-audit.json',cost)
(E/'COST-MODEL.md').write_text(f'''# AU3 measured full-track cost — 2026-10-04

Two requests, each one six-section 150 s music_v1 composition: **4,500 credits each**, **9,000 total**, **30 credits/requested second** (1,800/minute). Each call's immediate and settled shared balance deltas were exactly 4,500. The decoded sources are each 150.047347 s: observed shared delta / decoded second is approximately {4500/150.04734693877552:.5f}. There is no per-track billing header, so these remain shared-account observations, not exclusive invoice attribution.

Opening live balance 10,689; final observed 1,689. Job cap 10,000; unused 1,000. Account floor 1,000; final observed headroom 689. Debit is max(30/s estimate, immediate and settled shared delta, any valid header). Every paid call had a fresh subscription read immediately before it, separated only by required pacing. {len(http)} AU3 HTTP requests, two paid POSTs, all HTTP 200; minimum response-completion-to-next-request gap {min(gaps):.3f} s. No quota/rate error, reset, paid retry or unresolved reservation. The shared garden-vr account cannot be locked atomically by this project.

One 150 s Hide and iron take would require 4,500; its 90 s fallback 2,700. Both exceed both remaining allowances. A reset increases account funds but never renews the job cap. Paid generation is closed. All mastering, section cuts, loop and sting edits cost zero extra provider credits.

At this measured rate, the three-track first-take plan is 13,500 credits / 450 requested seconds; 50% rework allowance 20,250. Cost per accepted minute is unknown until owner listening. Both sources provide long files and decaying tails; that is not evidence of exact melodic continuity, six perceptually convincing phases or seamless adaptive use. Do not upgrade on duration alone. Review these takes, then compare long-form/camp editing with Google under a separate authorization; Google quality and credit equivalence are untested here.

Evidence: paid ledger and equal raw sidecars; cost-audit.json; derivative sidecars and loudnorm logs. Archived API contract: compose-api-2026-10-04.md, fetched from https://elevenlabs.io/docs/api-reference/music/compose.md. The old 8,000 reserve and 13,000 floor were superseded only for this D39 job.
''',encoding='utf-8')
print(json.dumps(dict(derivatives=len(registry),cost=cost['totalConservativeCredits'],http=len(http),minimumGap=min(gaps))))
