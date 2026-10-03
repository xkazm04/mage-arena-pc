"""Session-7 preservation, spend and evidence audit; no provider calls."""
import subprocess
from common import ART,ROOT,read,write,sha,digest
from check_a12 import check,require

def audit():
    check()
    preserved=read(ART/'waves/session6-start.json')['preserved_camp_portraits']
    changed=[p for p,h in preserved.items() if sha(ROOT/p)!=h]
    require(not changed,'APPROVED_CAMP_OR_PORTRAIT_CHANGED')
    start=read(ART/'waves/A12/start-snapshot.json');usage=read(ART/'usage.json')
    jobs=[j for j in usage['jobs'][start['jobs']:] if j.get('wave')=='A12']
    require(len(jobs)==11 and all(j['status']=='generated' and j['charged_images']==1 for j in jobs),'A12_SPEND_MISMATCH')
    for j in jobs:
        require(len(j['tool_calls'])==1,'IMAGE_CALL_COUNT')
        require(sha(ROOT/j['archive'])==j['sha256'],'ARCHIVE_CHANGED')
        require((ROOT/j['invocation_evidence']).exists(),'INVOCATION_MISSING')
    correction=[j for j in usage['jobs'] if j['id']=='a12-a10-agy-hidden-call-reconciliation']
    require(len(correction)==1 and correction[0]['charged_images']==1,'HISTORICAL_RECONCILIATION')
    latches={p:v['stop'] for p,v in read(ART/'providers/history.json')['providers'].items()}
    require(not latches['agy'] and not latches['grok'],'UNREPORTED_STOP')
    policy=read(ART/'providers/budget.json')
    require(policy['providers']['agy']['weekly_image_cap']==400 and policy['providers']['grok']['weekly_image_cap']==330,'PROVIDER_GUARDS')
    require(read(ART/'budget.json')['wave_hard_cap']==345,'PROJECT_GUARD')
    for name in ('browser-check','portable-check'):
        require(read(ART/f'delivery/a12/{name}.json')['status']=='pass','CHECK_FAILED:'+name)
    require(subprocess.check_output(['git','branch','--show-current'],cwd=ROOT,text=True).strip()=='art','WRONG_BRANCH')
    result={'status':'pass','wave':'A12','newImages':len(jobs),'historicalReconciliation':1,'projectCharges':297,
      'historicalJobsUnchanged':start['jobs'],'preservedCampPortraitFiles':len(preserved),'changedApprovedFiles':changed,
      'imageCallsVerifiedOnePerNewJob':True,'providerLatches':latches,'owner_accepted':False,
      'gameIntegration':'not performed; compact layout migration required','pushed':False,
      'knownLimits':['1376x768 native generation, exported with local upscaling','fine surface/rune/structure drift against A6','inferred overscan','static lighting','engine balance, collision and performance unmeasured']}
    write(ART/'delivery/a12/session-audit.json',result);print('Session 7 audit passes;',len(preserved),'camp/portrait files unchanged')

if __name__=='__main__':audit()
