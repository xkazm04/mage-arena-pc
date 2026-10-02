"""Local diagnostics for code-composed UI captures; authored text is permitted."""
import argparse
import json
import time
import urllib.request
from pathlib import Path
from common import ART, ROOT, config, digest, now, read, sha, write
from grade import encode, post, route, schema, validate_answer


def inspect(name, path, expectation):
    path=Path(path);cfg=config()['grader']
    tags=json.load(urllib.request.urlopen(cfg['host']+'/api/tags',timeout=10))
    model=next(m for m in tags['models'] if m['name']==cfg['model'])
    prompt=('Inspect this actual UI capture. It is authored HTML/SVG over project art, not a generated screenshot. '
            'The labels and numbers are intentional, code-drawn text and are allowed. Never approve an asset or infer owner acceptance. '
            'Use the supplied schema: forbidden_rendering means an unintended watermark, logo or photographic insert; '
            'overhead_view means requested UI framing/layout is present, not literally an overhead camera; '
            'required_content checks the stated visible controls or icons; style_match checks chalk-lime, umber, terracotta and mineral blue. '
            'Readability is 0 absent, 1 confused, 2 local ambiguity, 3 clear. State uncertain observations honestly. '
            'Describe overlap, text size, obscured controls and specific defects. EXPECTATION: '+expectation)
    inputs={'image_sha256':sha(path),'model':cfg['model'],'model_digest':model['digest'],'prompt':prompt,
            'schema':schema(),'options':{'temperature':0,'seed':47,'num_ctx':8192,'num_predict':1200}}
    key=digest(inputs);cache=ART/'grades/cache'/(key+'.json')
    if cache.exists():record=read(cache)
    else:
        record={'artifact':name,'at':now(),'input_hash':key,'source':path.resolve().relative_to(ROOT).as_posix(),
                'origin':'authored UI browser capture','scope':'local diagnostic; reject or route to owner only',**inputs}
        start=time.monotonic()
        try:
            response=post('/api/chat',{'model':cfg['model'],'messages':[{'role':'user','content':prompt,'images':[encode(path)]}],
                         'format':schema(),'stream':False,'think':False,'keep_alive':'10m','options':inputs['options']})
            record['raw_content']=response['message']['content'];answer=json.loads(record['raw_content'])
            if not validate_answer(answer):raise ValueError('INVALID_SCHEMA')
            record.update(status='graded',answers=answer,eval_count=response.get('eval_count'))
        except Exception as exc:record.update(status='ungraded',error=str(exc))
        record['elapsed_seconds']=round(time.monotonic()-start,3);write(cache,record)
    record['verdict'],record['codes']=route(record);record['owner_accepted']=False
    write(ART/'grades'/('ui-'+name+'.json'),record)
    print(json.dumps({'artifact':name,'status':record['status'],'verdict':record['verdict'],'seconds':record['elapsed_seconds']}),flush=True)
    return record


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('name');parser.add_argument('path');parser.add_argument('expectation');args=parser.parse_args()
    inspect(args.name,args.path,args.expectation)
