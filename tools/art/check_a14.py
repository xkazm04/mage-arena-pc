"""A14 deterministic delivery and preservation gates; no semantic approval."""
import copy
from PIL import Image,ImageChops
from common import ART,ROOT,read,write,sha,digest
from restoration_common import alpha_metrics

def require(condition,message):
    if not condition:raise AssertionError(message)

def check(manifest=None,complete=False,save=True):
    m=manifest or read(ART/'delivery/a14/characters.json');pages={p['id']:p for p in m['pages']};cache={};count=0
    require(len(pages)==len(m['pages']),'DUPLICATE_PAGE')
    for pid,p in pages.items():
        path=ROOT/p['file'];require(sha(path)==p['sha256'],'PAGE_HASH:'+pid);im=Image.open(path);im.load();cache[pid]=im
        require(im.mode=='RGBA' and list(im.size)==p['size'] and max(im.size)<=4096,'PAGE_FORMAT:'+pid)
    for entity,body in m['entities'].items():
        require(body['designSize1080']==[145.8,145.8],'SCALE_V3')
        for source in body['sources']:
            require(sha(ROOT/source['source'])==source['sha256'],'SOURCE_HASH')
            require(source['nativeBodyPixelsPerDisplayPixel1440']>=1,'NATIVE_DENSITY')
            obs=read(ROOT/source['observation']);require(obs['sha256']==source['sha256'] and obs['verdict']!='reject','SOURCE_REVIEW')
        for state,dirs in body['clips'].items():
            for direction,clip in dirs.items():
                count+=1;require(not clip['loop'],'UNEXPECTED_LOOP');require(clip['frameCount']==len(clip['frames']),'FRAME_COUNT')
                require(clip['frameCount'] in {'hit-light':[3,4],'hit-heavy':[5,6],'death':[6,7,8],'corpse':[1]}[state],'STATE_FRAME_COUNT')
                require(clip['mirrorX']==(direction in ['nw','sw']),'MIRROR_RULE')
                im=cache[clip['page']]
                for f in clip['frames']:
                    x,y,w,h=f['rect'];require(w==h==384 and x>=2 and y>=2 and x+w<=im.width-2 and y+h<=im.height-2,'FRAME_RECT')
                    require(f['durationMs']>0,'FRAME_DURATION');a=alpha_metrics(im.crop((x,y,x+w,y+h)));require(not a['empty'] and a['margin_px']>=3,'FRAME_MARGIN')
                    gutter=im.crop((x-2,y-2,x+w+2,y+h+2));outer=gutter.getchannel('A');outer.paste(0,(2,2,w+2,h+2));require(outer.getbbox() is None,'TRANSPARENT_GUTTER')
                if state=='hit-light':require(sum(f['durationMs'] for f in clip['frames'])<200,'LIGHT_TOO_LONG')
                if state=='corpse':
                    death=body['clips']['death'][direction]
                    require(clip['frames'][0]['rect']==death['frames'][-1]['rect'] and clip['page']==death['page'] and clip['anchor']==death['anchor'],'CORPSE_JUMP')
                    require(clip['persistent'] and clip['static'] and death['holdLastFrame'],'CORPSE_PERSISTENCE')
                    p=ROOT/clip['standalone']['file'];require(sha(p)==clip['standalone']['sha256'],'CORPSE_HASH')
                    x,y,w,h=clip['frames'][0]['rect'];expected=im.crop((x,y,x+w,y+h))
                    if clip['mirrorX']:expected=expected.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                    require(Image.open(p).tobytes()==expected.tobytes(),'CORPSE_PIXELS')
    roster=read(ART/'covenant-battle-roster.json')['entities'];missing=[f'{e}:{s}:{d}' for e in roster for s in ['hit-light','hit-heavy','death','corpse'] for d in ['ne','se','sw','nw'] if d not in m['entities'].get(e,{}).get('clips',{}).get(s,{})]
    require(missing==m['backlog'],'HIDDEN_MISSING_CLIPS')
    if complete:require(not missing,'INCOMPLETE_STAGE1')
    start=read(ART/'waves/A14/start-snapshot.json');usage=read(ART/'usage.json');require(digest(usage['jobs'][:start['jobs']])==start['jobsDigest'],'HISTORY_CHANGED')
    for path,hash_ in start['protected'].items():require(sha(ROOT/path)==hash_,'PROTECTED_CHANGED:'+path)
    charges=sum(j['charged_images'] for j in usage['jobs']);require(charges<=450 and charges-start['charged']<=80,'SPEND_CAP')
    report={'status':'pass','clips':count,'requiredStage1Clips':192,'missing':missing,'complete':not missing,'projectCharges':charges,'sessionCharges':charges-start['charged'],'protectedFilesUnchanged':len(start['protected']),'owner_accepted':False}
    if save:write(ART/'delivery/a14/checks.json',report)
    return report

if __name__=='__main__':
    import sys
    print(check(complete='--complete' in sys.argv))
