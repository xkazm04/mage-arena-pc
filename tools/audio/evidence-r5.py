"""AU5: derivative provenance and cost audit for the Hide and iron take, offline."""
from pathlib import Path
import importlib.util, json, hashlib, sys
from datetime import datetime
ROOT=Path(__file__).resolve().parents[2]; AUDIO=ROOT/'docs/audio'; E=AUDIO/'evidence/r5'
sys.argv=[sys.argv[0],'-','r5']  # process-r4.py reads its round from argv
spec=importlib.util.spec_from_file_location('process_r4',ROOT/'tools/audio/process-r4.py'); p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
manifest=json.loads((AUDIO/'manifest-au5.json').read_text(encoding='utf-8'))
registry=[]
for t in manifest['tracks']:
    source=AUDIO/t['rawFile']; rawhash=hashlib.sha256(source.read_bytes()).hexdigest()
    assert rawhash==t['rawMeasurement']['sha256']
    byfile={t['file']:t['mastering']['measurement'],t['sting']['file']:t['sting']['measurement'],t['sustainLoop']['file']:t['sustainLoop']['measurement']}
    for f in sorted((AUDIO/t['file']).parent.glob('*.wav')):
        r=f.relative_to(AUDIO).as_posix(); measurement=byfile.get(r) or p.meter(f,t['id']+'-'+f.stem)
        processing=t['mastering'] if f.name=='master-48k.wav' else t['sting'] if f.name=='sting-5s.wav' else t['sustainLoop'] if f.name=='sustain.wav' else next(s for s in t['sectionMap'] if s['file']==r)
        entry=dict(kind='offline-audio-derivative',wave='AU5',file=r,sha256=hashlib.sha256(f.read_bytes()).hexdigest(),source=t['rawFile'],sourceSha256=rawhash,sourceSidecar=t['sidecar'],additionalPaidCalls=0,additionalCredits=0,tool='ffmpeg',reproduce=f"python tools/audio/process-r4.py {t['id']} r5",processing=processing,measurement=measurement,note='PCM derived from the lossy provider MP3 (mp3_48000_192); no claim of native lossless master. Paid generation ledger records the original only.')
        p.save(f.with_suffix(f.suffix+'.json'),entry);registry.append(entry)
    t['productionApproved']=False;t['linearPlaybackReadyMeaning']='Technical decode/mastering readiness only; owner approval is separate.'
    t['assetSidecars']=[e['file']+'.json' for e in registry if e['source']==t['rawFile']]
manifest['runtimeContract']['maxSimultaneousFullMixes']=2
manifest['runtimeContract']['fullMixLayering']='Horizontal playback only; do not stack separately generated full mixes as stems.'
manifest['runtimeContract']['maximumMusicBusGainDb']=0
p.save(AUDIO/'manifest-au5.json',manifest)
p.save(E/'derivatives.json',registry)
rows=lambda n:[json.loads(x) for x in (ROOT/'tools/audio'/n).read_text(encoding='utf-8').splitlines() if x]
ledger=[x for x in rows('ledger.jsonl') if x.get('wave')=='AU5']
http=[x for x in rows('http.jsonl') if x.get('wave')=='AU5']
gaps=[(datetime.fromisoformat(b['startedAt'])-datetime.fromisoformat(a['completedAt'])).total_seconds() for a,b in zip(http,http[1:])]
observed=lambda e:max(e['accountDelta'] or 0,e['settledDelta'] or 0)
cost=dict(jobCap=6000,floor=1000,totalConservativeCredits=sum(e['chargedCredits'] for e in ledger),totalObservedCredits=sum(observed(e) for e in ledger),httpCount=len(http),paidPosts=sum(e['method']=='POST' for e in http),statuses=[e['status'] for e in http],minimumRequestGapSeconds=min(gaps),perCall=[dict(step=e['step'],seconds=e['seconds'],before=e['accountBefore'],after=e['accountAfter'],settled=e['settlementReads'][-1] if e['settlementReads'] else None,observed=observed(e),debit=e['chargedCredits'],estimate=e['estimatedCredits'],observedPerSecond=observed(e)/e['seconds']) for e in ledger],pending=json.loads((ROOT/'tools/audio/state.json').read_text(encoding='utf-8'))['pending'])
assert cost['paidPosts']==2 and [e['step'] for e in ledger]==['upload','compose'] and cost['minimumRequestGapSeconds']>=8 and all(s==200 for s in cost['statuses']) and cost['pending'] is None
p.save(E/'cost-audit.json',cost)
up,co=cost['perCall']
(E/'COST-MODEL.md').write_text(f'''# AU5 measured cost: Hide and iron on music_v2_5 (2026-10-17)

Two paid requests, both HTTP 200, no retry:

| Step | Requested seconds | Observed shared delta | Per second | Ledger debit (conservative) |
|---|---|---|---|---|
| Reference upload (`/v1/music/upload`, the kept r1 audition) | {up['seconds']} | {up['observed']} | {up['observedPerSecond']:.2f} | {up['debit']} |
| Compose (`/v1/music`, six chunks, 150 s) | {co['seconds']} | {co['observed']} | {co['observedPerSecond']:.2f} | {co['debit']} |

Observed total **{cost['totalObservedCredits']:,}** credits; conservative ledger total **{cost['totalConservativeCredits']:,}** of the 6,000 job cap (30 credits/requested second, the AU3 bound, kept as the reservation rule). The compose charge appeared only in the settlement reads (immediate delta 0). Shared-account deltas, not exclusive invoice attribution.

On this Creator account, music_v2_5 observed about {co['observedPerSecond']:.1f} credits/s against music_v1's 30/s on the AU3 Starter account. The public API price is one per-minute rate for all music models (https://elevenlabs.io/pricing/api, 2026-10-17). The upload is billed like a generation of its length, as documented.

{len(http)} AU5 HTTP requests; minimum completion-to-next-request gap {min(gaps):.3f} s. Opening balance {up['before']['remaining']:,}; last observed {co['settled']['remaining'] if co['settled'] else co['after']['remaining']:,}.
''',encoding='utf-8')
print(json.dumps(dict(derivatives=len(registry),conservative=cost['totalConservativeCredits'],observed=cost['totalObservedCredits'],http=len(http),minimumGap=min(gaps))))
