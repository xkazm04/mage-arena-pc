"""Scoped completed-call audit, spend and protected-history evidence."""
from pathlib import Path
from common import ART,ROOT,read,write,sha,now
from agy_evidence import calls_from
from providers import provider_of
from check_a14 import check,require

def audit(complete=False):
    result=check(complete=complete);start=read(ART/'waves/A14/start-snapshot.json');usage=read(ART/'usage.json');recent=usage['jobs'][start['jobs']:];evidence=[]
    for j in recent:
        require(j['status'] not in ['reserved','running'],'UNRESOLVED_JOB')
        if j.get('provider')!='agy':continue
        saved=read(ROOT/j['invocation_evidence']/'agy-tool-evidence.json');rows=[]
        for ident in saved['conversations']:
            path=Path.home()/'.gemini/antigravity-cli/brain'/ident/'.system_generated/logs/transcript_full.jsonl'
            calls=[c for c in calls_from(path) if c['name']=='generate_image'];rows.append({'conversation':ident,'transcriptSha256':sha(path),'imageCalls':calls})
        count=sum(len(r['imageCalls']) for r in rows);require(count<=j['charged_images'],'UNCHARGED_LATE_CALL:'+j['id'])
        evidence.append({'job':j['id'],'charged':j['charged_images'],'observedCallsAfterCompletion':count,'driverStoppedAfterFirstImage':j.get('driver_stopped_after_first_completed_image',False),'evidence':rows})
    write(ART/'waves/A14/provider-final-audit.json',{'at':now(),'jobs':evidence,'scope':'exact request-linked conversations only; no unrelated data or credentials','newImageCalls':0})
    guards=read(ART/'providers/budget.json');providers={}
    for name,policy in guards['providers'].items():
        charges=sum(j['charged_images'] for j in usage['jobs'] if provider_of(j)==name);external=sum(policy.get('external_known_charges',{}).values())
        providers[name]={'projectCharges':charges,'knownExternalCharges':external,'localGuard':policy['weekly_image_cap'],'localRemainder':policy['weekly_image_cap']-charges-external}
    stops={name:row['stop'] for name,row in read(ART/'providers/history.json')['providers'].items()}
    spend={'inheritedCharges':start['charged'],'sessionCharges':result['sessionCharges'],'sessionJobs':len(recent),'generatedSourceImages':sum(j['status']=='generated' for j in recent),'projectCharges':result['projectCharges'],'combinedCap':450,'combinedLocalRemainder':450-result['projectCharges'],'sessionWorkingCap':80,'sessionWorkingRemainder':80-result['sessionCharges'],'providers':providers,'providerLatches':stops,'actualAccountAllowance':'not measured','imageMonetaryCost':'not measured','refunds':0,'latchRecoveries':{'initialOwnerAuthorizedExtraCallRepair':1,'boundedManualPreflight503Recovery':1,'repeated503LatchRetained':True},'serial':True}
    write(ART/'delivery/a14/spend.json',spend);write(ART/'delivery/a14/session-audit.json',{**result,'pushed':False,'gameIntegration':'not performed; art loader extension only','providerAudit':'art/waves/A14/provider-final-audit.json','providerLatches':stops})
    print('A14 audit:',result['sessionCharges'],'session charges;',result['projectCharges'],'total')

if __name__=='__main__':
    import sys
    audit('--complete' in sys.argv)
