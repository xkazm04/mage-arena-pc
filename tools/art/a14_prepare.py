"""Session 9 immutable baseline, references and authorized provider recovery."""
import shutil
from PIL import Image, ImageOps
from common import ART,ROOT,read,write,sha,digest,now,relative
from restoration_common import contact

def prepare():
    out=ART/'waves/A14';out.mkdir(parents=True,exist_ok=True)
    usage=read(ART/'usage.json')
    if not (out/'start-snapshot.json').exists():
        protected={relative(p):sha(p) for folder in ('delivery/a2c','delivery/a4c','delivery/a8','delivery/a10','delivery/a12','delivery/a13','ui') for p in (ART/folder).rglob('*') if p.is_file()}
        write(out/'start-snapshot.json',{'at':now(),'jobs':len(usage['jobs']),'charged':sum(j['charged_images'] for j in usage['jobs']),'jobsDigest':digest(usage['jobs']),'protected':protected,'sessionImageCap':80,'authorization':'Owner ART session 9: diagnose/fix/clear agy; agy 500, Grok 450, project 450; about 80 images; serial, no push.'})
        for name in ('usage.json','budget.json','providers/history.json','providers/budget.json'):
            target=out/'before'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ART/name,target)
    m=read(ART/'delivery/a10/characters.json');pages={p['id']:p for p in m['pages']}
    old=read(ART/'delivery/a3c/figures.json');rows=[]
    for entity,design in read(ART/'covenant-battle-roster.json')['entities'].items():
        for facing in ('ne','se'):
            body=m['entities'].get(entity,{});clips=body.get('clips',{})
            clip=next((dirs[facing] for state,dirs in clips.items() if facing in dirs),None)
            if clip:
                page=pages[clip['page']];x,y,w,h=clip['frames'][0]['rect'];im=Image.open(ROOT/page['file']).crop((x,y,x+w,y+h))
                if clip['mirrorX']:im=ImageOps.mirror(im)
                origin={'source':page['file'],'sha256':page['sha256'],'rect':[x,y,w,h],'facing':facing,'origin':'A10 master cutout'}
            else:
                frame=next(f for f in old['frames'] if f['entity']==entity)
                from restoration_common import variable_magenta
                im,_=variable_magenta(Image.open(ROOT/frame['source']).crop(frame['source_crop']))
                origin={'source':frame['source'],'sha256':sha(ROOT/frame['source']),'crop':frame['source_crop'],'facing':'unverified; generation must change anatomical view','origin':'Covenant A3c identity; A10 requested view missing'}
            box=im.getbbox();im=im.crop(box);im=ImageOps.contain(im,(480,560),Image.Resampling.LANCZOS)
            square=Image.new('RGB',(768,768),(255,0,255));square.paste(im,((768-im.width)//2,(768-im.height)//2),im)
            p=out/'references'/f'{entity}-{facing}.png';p.parent.mkdir(parents=True,exist_ok=True);square.save(p);write(p.with_suffix('.json'),origin)
            rows.append((entity+' '+facing,square))
    contact(rows,out/'reference-contact.jpg','A14 identity inputs / missing views need generated anatomy',columns=6,tile=(220,260))
    gates=read(ART/'delivery/a10/source-gates.json')
    from collections import Counter
    write(out/'a10-baseline.json',{'pages':m['pages'],'missingClips':m['backlog'],'sourceGateRows':len(gates['frames']),'sourceGateErrors':dict(Counter(e for f in gates['frames'] for e in f['errors'])),'rejectedCandidateClips':gates['rejectedCandidateClips']})
    print('Snapshot, all A10 atlases/source gates and 24 identity references read; no generation.')

def reset():
    out=ART/'waves/A14';path=ART/'providers/history.json';state=read(path)
    if (out/'agy-recovery.json').exists():raise RuntimeError('RESET_ALREADY_RECORDED')
    stop=state['providers']['agy']['stop']
    if not stop or stop['reason']!='EXTRA_TOOL_CALL':raise RuntimeError('UNEXPECTED_LATCH')
    write(out/'latches/agy-session8.json',stop)
    audit=read(ART/'waves/A13/provider-final-audit.json')
    finding=next(j for j in audit['jobs'] if j['job']==stop['job'])
    write(out/'agy-recovery.json',{'at':now(),'authorization':'Explicit owner session 9 request to diagnose, fix driver, and clear latch with evidence kept','originalStop':stop,'audit':finding,'diagnosis':'Parent delegated and omitted retry prohibition; worker refined first result with output_v2. No uncharged late calls in final A13 audit.','driver':'Direct image-generator agent; stop after first completed scoped tool artifact; 100ms monitoring; final extra-call audit remains fail-closed.','tests':'python -m unittest discover -s tools/art -p test_providers.py','driverSha256':sha(ROOT/'tools/art/providers.py'),'evidenceReaderSha256':sha(ROOT/'tools/art/agy_evidence.py'),'noRefund':True})
    state['providers']['agy']['events'].append({'at':now(),'event':'owner-authorized-reset','job':stop['job'],'reason':'A14 driver repair and archived scoped evidence; live proof required'})
    state['providers']['agy']['stop']=None;write(path,state)
    print('Only agy latch cleared; original stop and charges preserved.')

if __name__=='__main__':
    import sys
    reset() if len(sys.argv)>1 and sys.argv[1]=='reset' else prepare()
