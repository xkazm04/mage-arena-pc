"""Scoped agy transcript evidence: no credential/config inspection."""
import json
from pathlib import Path
from common import ART, read, write, sha, now
from generate import Budget

BRAIN=Path.home()/'.gemini/antigravity-cli/brain'

def calls_from(path):
    result=[]
    for line in path.read_text(encoding='utf-8').splitlines():
        try: event=json.loads(line)
        except ValueError: continue
        for i,call in enumerate(event.get('tool_calls',[])):
            args={}
            for k,v in call.get('args',{}).items():
                try: args[k]=json.loads(v) if isinstance(v,str) else v
                except ValueError: args[k]=v
            result.append({'at':event.get('created_at'),'step':event['step_index'],
                'callIndex':i,'name':call['name'],'arguments':args})
    return result

def audit():
    pairs=[('a10-brennic-north-agy-a01','f6fe3e8d-df66-4fa1-81e6-8ec3eabad1ef','d6d82c12-0271-446c-9cd5-97c6b3c03e0a'),
           ('a12-moonlit-proof-agy-agy-a01','41b5810b-e2fe-43b3-b61c-b77e7f2d905a','6ef9c003-ba0e-4c59-b8ee-ab494d0651f0')]
    for job,parent,child in pairs:
        evidence=[]
        for ident in (parent,child):
            path=BRAIN/ident/'.system_generated/logs/transcript_full.jsonl'
            calls=calls_from(path)
            # Keep task-owned calls only; do not copy responses containing unrelated
            # material the provider independently read outside its requested folder.
            evidence.append({'conversation':ident,'transcriptSha256':sha(path),
                'calls':[c for c in calls if c['name']=='generate_image' or
                         c['name']=='invoke_subagent' or 'Copy-Item output.png source.png' in str(c)]})
        image_calls=[c for e in evidence for c in e['calls'] if c['name']=='generate_image']
        write(ART/'waves/A12/provider-evidence'/f'{job}.json',{'job':job,'observedImageCalls':len(image_calls),'evidence':evidence})
        print(job, 'observed image calls',len(image_calls))
    b=Budget();usage=b.load()
    ident='a12-a10-agy-hidden-call-reconciliation'
    if not any(j['id']==ident for j in usage['jobs']):
        b.reserve({'id':ident,'wave':'A12-audit','style_id':'covenant','scene':'a10-agy-reconciliation',
          'provider':'agy','origin':'historical-call-audit','related_job':pairs[0][0]})
        b.update(ident,{'status':'historical-reconciliation','charged_images':1,
          'note':'Three historical generate_image calls now observed versus two old charges. Append one charge, never rewrite old jobs. No new image generated.',
          'evidence':'art/waves/A12/provider-evidence/a10-brennic-north-agy-a01.json'})

if __name__=='__main__':audit()
