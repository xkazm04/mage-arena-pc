"""Reserve/ingest built-in image tool calls using the same atomic project ledger."""
import argparse
import json
import shutil
from pathlib import Path
from common import ART, ROOT, digest, read, relative, sha, write
from generate import Budget, quota_evidence, moderation_evidence
from waves import brief, spec_for, require_proof

def arguments(spec,prompt):
    result={'prompt':prompt,'transparent_background':False}
    if spec.get('reference'):
        result['referenced_image_paths']=[str((ROOT/spec['reference']['path']).resolve())]
    return result

def verify_call(job):
    ref=job['input'].get('reference')
    if ref and (not (ROOT/ref['path']).is_file() or sha(ROOT/ref['path'])!=ref['sha256']): return False
    expected=job['input']['prompt']
    if job.get('moderation_rewrite'): expected=job['correction'].strip()
    elif job.get('correction'): expected+='\n\nCORRECTION FROM DIRECT PIXEL REVIEW: '+job['correction'].strip()
    wanted=arguments(job['input'],expected)
    calls=job.get('tool_calls',[])
    if ref:
        # Caller absolute path was checked live. A portable checkout changes ROOT;
        # recheck its full project-relative suffix and exact reference bytes here.
        paths=calls[0].get('arguments',{}).get('referenced_image_paths',[]) if len(calls)==1 else []
        if len(paths)!=1 or not Path(paths[0]).as_posix().lower().endswith('/'+ref['path'].lower()): return False
        wanted['referenced_image_paths']=paths
    return (job['prompt']==expected and job.get('prompt_verbatim_verified') is True and
            calls==[{'name':'image_gen__imagegen','arguments':wanted}])

def reserve(item_id,correction=None):
    b=brief('A6'); item=next(i for i in b['items'] if i['id']==item_id); spec=spec_for('A6',item,b)
    require_proof(spec); budget=Budget(); old=[j for j in budget.load()['jobs'] if j['style_id']==spec['style']['id'] and j['scene']==item_id]
    if old and not correction: raise RuntimeError('EXISTING_SLOT: resume or hash-bound correction required')
    moderation_retry=bool(old and correction and old[-1]['status']=='moderation-refused')
    if moderation_retry and any(j.get('moderation_rewrite') for j in old):
        raise RuntimeError('MODERATION_RETRY_EXHAUSTED')
    if correction:
        previous=old[-1]; rejection=read(ART/'rejections'/(previous['id']+'.json'))
        if (previous['status']!='generated' and not moderation_retry or
                rejection['sha256']!=previous.get('sha256',previous['input_hash']) or rejection['correction']!=correction):
            raise RuntimeError('HASH_BOUND_REJECTION_REQUIRED')
    ref=spec.get('reference')
    if ref and sha(ROOT/ref['path'])!=ref['sha256']: raise RuntimeError('REFERENCE_HASH_MISMATCH')
    prompt=correction.strip() if moderation_retry else spec['prompt']+ ('\n\nCORRECTION FROM DIRECT PIXEL REVIEW: '+correction.strip() if correction else '')
    job_id=spec['style']['id']+'-'+item_id+f'-a{len(old)+1:02}'
    args=arguments(spec,prompt)
    j=budget.reserve(dict(id=job_id,style_id=spec['style']['id'],scene=item_id,attempt=len(old)+1,
                          input=spec,input_hash=digest(spec),prompt=prompt,wave='A6',origin='builtin-imagegen',
                          correction=correction,tool_calls=[],requested_tool_call=dict(name='image_gen__imagegen',arguments=args),
                          **({'moderation_rewrite':True} if moderation_retry else {})))
    write(ART/'raw'/job_id/'sidecar.json',j)
    print(json.dumps({'id':job_id,'arguments':args}))

def ingest(job_id,path=None,error=None):
    budget=Budget(); j=next(j for j in budget.load()['jobs'] if j['id']==job_id)
    if j['status']!='reserved': raise RuntimeError('ALREADY_RESOLVED')
    fields=dict(tool_calls=[j['requested_tool_call']],prompt_verbatim_verified=True)
    if error:
        quota=quota_evidence(error)
        if quota:
            budget.stop(job_id+': '+quota); fields.update(status='quota-stopped',error=error)
        elif moderation_evidence(error): fields.update(status='moderation-refused',error=error,moderation_retry_available=not j.get('moderation_rewrite',False))
        else:
            budget.stop(job_id+': uncertain built-in result'); fields.update(status='error-unknown-spend',error=error)
        fields['tool_results']=[error]
    else:
        from PIL import Image
        src=Path(path); dst=ART/'raw'/job_id/('source'+src.suffix.lower())
        with Image.open(src) as im: im.verify()
        shutil.copy2(src,dst)
        fields.update(status='generated',source=relative(dst),sha256=sha(dst),tool_results=[{'saved_path':str(src)}])
    j=budget.update(job_id,fields); write(ART/'raw'/job_id/'sidecar.json',j); write(ART/'attempts'/(job_id+'.json'),j)
    print(json.dumps({'id':job_id,'status':j['status'],'budget':budget.summary()}))

if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('command',choices=['reserve','ingest']); p.add_argument('item'); p.add_argument('--path'); p.add_argument('--error'); p.add_argument('--correction'); a=p.parse_args()
    reserve(a.item,a.correction) if a.command=='reserve' else ingest(a.item,a.path,a.error)
