"""Session 10 authority, immutable baseline, and bounded serial calls."""
import argparse
import shutil
from common import ART, ROOT, read, write, sha, digest, now, relative

BASE=ART/'waves/A14/session10'

def prepare():
    if (BASE/'start.json').exists():
        print('Session 10 baseline already retained'); return
    usage=read(ART/'usage.json');history=read(ART/'providers/history.json')
    old=[j for j in usage['jobs'] if j['scene']=='garran-ne-collapse']
    failed=[j for j in old if j['status']!='generated']
    assert len(failed)==2 and all(not j.get('archive') and not j.get('tool_calls') and j.get('unique_output_images')==0 for j in failed)
    protected={relative(p):sha(p) for folder in ('delivery/a2c','delivery/a4c','delivery/a8','delivery/a10','delivery/a12','delivery/a13','ui') for p in (ART/folder).rglob('*') if p.is_file()}
    write(BASE/'start.json',{'at':now(),'jobs':len(usage['jobs']),'charged':sum(j['charged_images'] for j in usage['jobs']),'jobsDigest':digest(usage['jobs']),'protected':protected,'sessionImageCap':40,'authorization':'Owner ART session 10: agy first, 40 images, provider cap 500, preserve evidence and clear agy after host successful 15:32 probe; two fresh Garran collapse attempts; Grok unavailable; never push.'})
    for name in ('usage.json','budget.json','providers/history.json','providers/budget.json','delivery/a14/characters.json','delivery/a14/source-gates.json','delivery/a14/spend.json','waves/A14/provider-final-audit.json'):
        target=BASE/'before'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ART/name,target)
    write(BASE/'agy-latch-session9.json',history['providers']['agy']['stop'])
    write(BASE/'garran-attempt-reset.json',{'at':now(),'authority':'Explicit host note session 10: fresh cap two real attempts; old evidence retained, no refunds','prior':[{'id':j['id'],'status':j['status'],'error':j.get('error'),'archive':j.get('archive'),'toolCalls':len(j.get('tool_calls',[])),'charged':j['charged_images']} for j in old],'finding':'Two provider failures produced zero images; one genuine generated image was rejected for crop and endpoint. All three records remain immutable. Two fresh reservations permitted.','freshAttemptCap':2})
    policy=read(ART/'budget.json');policy['scene_attempt_caps']['covenant:garran-ne-collapse']=len(old)+2
    policy['session10_authorization']='40 fresh reservations from 342; Garran scene capped at two fresh attempts; agy 500; old ledger immutable.'
    write(ART/'budget.json',policy)
    history['providers']['agy']['events'].append({'at':now(),'event':'owner-authorized-reset','job':history['providers']['agy']['stop']['job'],'reason':'Host successful models and one-image probe at 15:32 2026-10-04; old latch in session10/agy-latch-session9.json'})
    history['providers']['agy']['stop']=None;write(ART/'providers/history.json',history)
    print('342 inherited; 40 session cap; agy reset archived; Grok unchanged; Garran two fresh attempts')

def call(entity,direction,kind,revision=None):
    from a14_generate import make
    from providers import generate
    start=read(BASE/'start.json');usage=read(ART/'usage.json')
    if sum(j['charged_images'] for j in usage['jobs'])-start['charged']>=40:raise RuntimeError('SESSION10_CAP')
    scene=f'{entity}-{direction}-{kind}'
    recent=[j for j in usage['jobs'][start['jobs']:] if j['scene']==scene]
    if len(recent)>=2:raise RuntimeError('SESSION10_SLOT_TWO_ATTEMPTS')
    if kind!='collapse' or direction=='ne':
        design=read(ART/'covenant-battle-roster.json')['entities'][entity]
        if design['kind']=='creature':
            proof=read(BASE/'proofs'/f'{entity}.json')
            if proof['verdict']!='technical-continuation-only' or sha(ROOT/proof['source'])!=proof['sha256']:raise RuntimeError('ENTITY_PROOF_REQUIRED')
    first=not any(j['input'].get('entity')==entity and j['status']=='generated' for j in usage['jobs'][start['jobs']:])
    spec=make(entity,direction,kind=kind,pilot=first,provider='agy',revision=revision)
    front=BASE/'references'/f'{entity}-{direction}.png'
    if kind!='collapse' and front.exists():
        spec['references'][0]={'path':relative(front),'sha256':sha(front),'role':'locally gated front proof derived crop; original approved creature source remains reference 2'}
    if entity=='garran' and recent:
        spec['references']=spec['references'][:2]
        spec['prompt']=spec['prompt'].split(' Reference-3.png supplies')[0]
        spec['prompt']+=' CORRECTION: '+str(revision)
    spec['session']=10
    if entity=='cinder_hound' and direction=='ne' and kind=='defense' and revision:
        spec['prompt']=spec['prompt'].replace('THREE columns by TWO rows','TWO columns by THREE rows')
        spec['grid']=[2,3]
    write(ART/'briefs/a14/session10'/(scene+('-retry' if revision else '')+'.json'),spec)
    job=generate(spec)
    if job['status']=='generated':
        from covenant import inspect
        inspect(job)
    return job

def proof(entity):
    from a14_build import extract
    jobs=[j for j in read(ART/'usage.json')['jobs'] if j['scene']==f'{entity}-se-collapse' and j['status']=='generated']
    j=jobs[-1];obs=read(ART/'waves/A14/observations'/(j['id']+'.json'));grade=read(ART/'grades'/(j['id']+'.json'))
    assert obs['verdict']!='reject' and grade['status']=='graded' and grade['verdict']!='reject'
    records=extract(j,obs)
    assert all(not records[i]['errors'] for i in obs.get('selections',{}).get('death',range(6)))
    write(BASE/'proofs'/f'{entity}.json',{'verdict':'technical-continuation-only','source':j['archive'],'sha256':j['sha256'],'style_hash':sha(ART/'style-covenant.json'),'owner_accepted':False,'note':'Direct inspection, local grader route and deterministic extraction gates permit siblings, never approve art.'})
    print(entity,'proof permits siblings')

def audit(stage):
    from check_a14 import check, require
    from agy_evidence import calls_from
    from pathlib import Path
    result=check();start=read(BASE/'start.json');usage=read(ART/'usage.json');recent=usage['jobs'][start['jobs']:]
    require(digest(usage['jobs'][:start['jobs']])==start['jobsDigest'],'SESSION9_HISTORY_CHANGED')
    for path,hash_ in start['protected'].items():require(sha(ROOT/path)==hash_,'PROTECTED_CHANGED:'+path)
    charges=sum(j['charged_images'] for j in recent);require(charges<=40,'SESSION10_CAP')
    evidence=[]
    for j in recent:
        require(j['status'] not in ('running','reserved'),'UNRESOLVED_JOB')
        saved=read(ROOT/j['invocation_evidence']/'agy-tool-evidence.json');calls=[]
        for ident in saved['conversations']:
            path=Path.home()/'.gemini/antigravity-cli/brain'/ident/'.system_generated/logs/transcript_full.jsonl'
            calls.extend(c for c in calls_from(path) if c['name']=='generate_image')
        require(len(calls)<=j['charged_images'],'UNCHARGED_LATE_CALL')
        if j['status']=='generated':require(len(calls)==j['charged_images']==j['unique_output_images']==1,'NOT_ONE_CALL_ONE_CHARGE')
        evidence.append({'job':j['id'],'calls':len(calls),'charged':j['charged_images'],'status':j['status'],'archive':j.get('archive'),'sha256':j.get('sha256')})
    prior=BASE/'stage2-protected.json';prior_count=0
    if stage=='stage3' and prior.exists():
        for path,hash_ in read(prior).items():require(sha(ROOT/path)==hash_,'STAGE2_IMAGE_CHANGED:'+path)
        prior_count=len(read(prior))
    report={**result,'session':10,'stage':stage,'inheritedCharges':start['charged'],'sessionCharges':charges,'generatedSources':sum(j['status']=='generated' for j in recent),'sessionCap':40,'providerJobs':evidence,'providerLatches':{k:v['stop'] for k,v in read(ART/'providers/history.json')['providers'].items()},'priorStageImagesUnchanged':prior_count,'actualAccountAllowance':'not measured','owner_accepted':False,'push':False}
    write(ART/'delivery/a14/session10'/f'{stage}-audit.json',report)
    write(ART/'delivery/a14/session10/current.json',report)
    write(ART/'delivery/a14/spend.json',report)
    write(ART/'delivery/a14/session-audit.json',report)
    manifest=read(ART/'delivery/a14/characters.json')
    old=read(ART/'delivery/a14/stage2/backlog.json')['priority2NonReactionLegacySlots']
    remaining=[]
    for slot in old:
        e,s,d=slot.split(':')[:3]
        if d not in manifest['entities'].get(e,{}).get('clips',{}).get(s,{}):remaining.append(slot)
    write(ART/'delivery/a14/session10/backlog.json',{'priority':manifest['backlog'],'otherLegacy':remaining,'priorityMissing':len(manifest['backlog']),'otherMissing':len(remaining),'owner_accepted':False,'boundedAttemptFailures':'Mire Maw rear collapse, Thornback rear collapse/hits and front motion each used both session attempts; no third attempt authorized. Shieldman rear attack failed crop/equipment continuity on its first sheet; no allowance remained for correction. Iskar front run and Slinger/Netter rear absorb were not reached within the session cap.'})
    print('Session 10',stage,':',charges,'charges;',result['projectCharges'],'project;',result['clips'],'slots')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('entity');p.add_argument('direction',nargs='?');p.add_argument('--kind',default='collapse');p.add_argument('--revision');a=p.parse_args()
    if a.entity=='prepare':prepare()
    elif a.entity=='audit':audit(a.direction)
    elif a.entity=='proof':proof(a.direction)
    else:call(a.entity,a.direction,a.kind,a.revision)
