"""Session preservation and final scoped provider accounting; no image calls."""
from pathlib import Path
from common import ART,ROOT,read,write,sha,digest,now
from agy_evidence import calls_from
from providers import provider_of
from check_a13 import check,require

def audit():
    start=read(ART/'waves/A13/start-snapshot.json');usage=read(ART/'usage.json');recent=usage['jobs'][start['jobs']:]
    evidence=[]
    for j in recent:
        if j.get('provider')!='agy':continue
        logged=read(ROOT/j['invocation_evidence']/'agy-tool-evidence.json');rows=[]
        for ident in logged['conversations']:
            p=Path.home()/'.gemini/antigravity-cli/brain'/ident/'.system_generated/logs/transcript_full.jsonl'
            require(p.exists(),'PROVIDER_TRANSCRIPT_MISSING')
            calls=[c for c in calls_from(p) if c['name']=='generate_image']
            rows.append({'conversation':ident,'transcriptSha256':sha(p),'imageCalls':calls})
        count=sum(len(r['imageCalls']) for r in rows)
        require(count<=j['charged_images'],'LATE_PROVIDER_CALL_REQUIRES_APPENDED_CHARGE:'+j['id'])
        evidence.append({'job':j['id'],'charged':j['charged_images'],'observedCallsAfterCompletion':count,'evidence':rows})
    write(ART/'waves/A13/provider-final-audit.json',{'at':now(),'jobs':evidence,'scope':'only exact-request-linked conversations, no unrelated transcripts or credentials','newImageCalls':0})
    report=check();guards=read(ART/'providers/budget.json');totals={}
    for name,policy in guards['providers'].items():
        charged=sum(j['charged_images'] for j in usage['jobs'] if provider_of(j)==name)
        external=sum(policy.get('external_known_charges',{}).values())
        totals[name]={'projectCharges':charged,'knownExternalCharges':external,'guard':policy['weekly_image_cap'],
                      'localRemainder':policy['weekly_image_cap']-charged-external}
    spend={'inheritedCharges':start['charged'],'sessionCharges':report['sessionCharges'],
       'sessionJobs':len(recent),'generatedSourceImages':sum(j['status']=='generated' for j in recent),
       'sessionProviderCharges':{p:sum(j['charged_images'] for j in recent if j.get('provider')==p) for p in totals},
       'projectCharges':report['projectCharges'],'combinedCap':read(ART/'budget.json')['wave_hard_cap'],
       'combinedLocalRemainder':read(ART/'budget.json')['wave_hard_cap']-report['projectCharges'],
       'providers':totals,'providerLatches':report['providerLatches'],'actualAccountAllowance':'not measured',
       'imageMonetaryCost':'not measured','refunds':0,'latchResets':0,'serial':True}
    write(ART/'delivery/a13/spend.json',spend)
    write(ART/'delivery/a13/session-audit.json',{**report,'providerEvidence':'art/waves/A13/provider-final-audit.json',
          'scope':'A13 art-only delivery; existing A8/A10/A12, camp, portrait and UI files preserved',
          'gameIntegration':'not performed; current hook adaptation specified in README','pushed':False})
    print('A13 session audit:',spend['projectCharges'],'project charges;',spend['sessionCharges'],'this session')
    return spend

if __name__=='__main__':audit()
