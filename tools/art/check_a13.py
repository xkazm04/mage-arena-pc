"""A13 packaging/provenance checks. Technical pass is never visual acceptance."""
import math
import numpy as np
from PIL import Image
from common import ART,ROOT,read,write,sha,digest
from providers import provider_of

def require(ok,code):
    if not ok:raise ValueError(code)

def coverage(manifest):
    clips=manifest['clips'];required=set()
    for element in ('fire','water','earth','air'):
        required.update('cast.'+element+'.'+p for p in ('start','hold','release'))
        required.update('threat.'+element+'.'+p for p in ('ring','cone','line'))
    required.update(['ward.start','ward.hold','ward.release','absorb.contact','absorb.window','absorb.perfect',
                     'warning.normal','warning.unblockable','selection','target','inscription.collar','inscription.wardstone'])
    required.update('status.'+s for s in ('slowed','rooted','burning','wet','shielded'))
    required.update('floor.'+p for p in ('moonlit','verdigris','rust-sand'))
    require(required<=set(clips),'MISSING_REQUIRED_CLIPS:'+str(sorted(required-set(clips))))
    for ident,c in clips.items():
        require(c['frameCount']==len(c['frames'])>0,'FRAME_COUNT:'+ident)
        require(all(f['durationMs']>0 for f in c['frames']),'DURATION:'+ident)
        require(not c.get('ownerAccepted'),'OWNER_BOUNDARY:'+ident)
        if c['kind']=='telegraph':
            require(c['progress']['baseOpacity']>0,'HIDDEN_EMPTY_BOUNDARY:'+ident)
            require(c['warningOverlay']=='warning.normal','WARNING_MISSING:'+ident)
            require(c['geometry'].startswith('visual envelope'),'GEOMETRY_OWNERSHIP:'+ident)
    require(clips['absorb.window']['loop'] and clips['absorb.window']['kind']=='perfect-window','PERFECT_WINDOW_GATE')
    require(clips['warning.unblockable']['neverElementTint'] and clips['warning.unblockable']['unblockable'],'UNBLOCKABLE_CUE')

def check():
    out=ART/'delivery/a13';m=read(out/'sigils.json');coverage(m);page_images={};source_count=0
    for p in m['pages']:
        require(sha(ROOT/p['file'])==p['sha256'],'PAGE_HASH:'+p['id'])
        im=Image.open(ROOT/p['file']);require(im.mode=='RGBA' and list(im.size)==p['size'],'PAGE_FORMAT:'+p['id'])
        page_images[p['id']]=im
    total=0;empty=[];max_edge=0
    for ident,c in m['clips'].items():
        page=page_images[c['page']]
        for i,f in enumerate(c['frames']):
            x,y,w,h=f['rect'];require(all(isinstance(v,int) for v in f['rect']),'RECT_INTEGER')
            require(x>=3 and y>=3 and x+w+3<=page.width and y+h+3<=page.height,'RECT_BOUNDS')
            alpha=np.array(page.getchannel('A'));frame=alpha[y:y+h,x:x+w]
            gutter=np.concatenate([alpha[y-3:y,x-3:x+w+3].ravel(),alpha[y+h:y+h+3,x-3:x+w+3].ravel(),alpha[y:y+h,x-3:x].ravel(),alpha[y:y+h,x+w:x+w+3].ravel()])
            require(not gutter.any(),'ATLAS_GUTTER:'+ident)
            if not frame.any():empty.append([ident,i])
            edge=int(max(frame[0].max(),frame[-1].max(),frame[:,0].max(),frame[:,-1].max()));max_edge=max(max_edge,edge)
            require(edge==0,'FRAME_EDGE:'+ident)
            total+=1
        if ident.startswith('cast.'):
            first=c['frames'][0]['rect'];last=c['frames'][-1]['rect']
            if ident.endswith('.start'):require([ident,0] in empty,'START_NOT_CLEAR')
            if ident.endswith('.release'):require([ident,c['frameCount']-1] in empty,'RELEASE_NOT_CLEAR')
    allowed={(i,0) for i in m['clips'] if i.endswith('.start')}|{(i,c['frameCount']-1) for i,c in m['clips'].items() if i.endswith('.release')}
    require(all(tuple(e) in allowed for e in empty),'UNEXPECTED_EMPTY_FRAME')
    for p in (out/'masks').glob('*.png'):
        im=Image.open(p);a=np.array(im);require(im.mode=='L' and im.size==(384,384),'MASK_FORMAT')
        require(a.min()>=1 and a.max()<=255,'MASK_RANGE')
    for s in read(out/'source-gates.json')['sources']:
        require(sha(ROOT/s['source'])==s['sha256'],'SOURCE_HASH')
        r=read(ART/'waves/A13/reviews'/(s['job']+'.json'));g=read(ART/'grades'/(s['job']+'.json'))
        require(r['verdict']!='reject' and r['sha256']==s['sha256'],'SOURCE_REJECTED')
        require(g['status']=='graded' and g['verdict']!='reject' and g['image_sha256']==s['sha256'],'LOCAL_SOURCE_GATE')
        require(all(t['sourceBorderMaxAlpha']<=110 for t in s['edgeTrims']),'OPAQUE_SOURCE_CLIP')
        source_count+=1
    glyphs=read(out/'glyphs.json')['glyphs'];require(len(glyphs)==12,'GLYPH_ALPHABET')
    for g in glyphs.values():require(sha(ROOT/g['file'])==g['sha256'],'GLYPH_HASH')
    require('excluded letter-like' in glyphs['danger']['origin'],'WARNING_DERIVATION')
    v3=read(ART/'scale-contract-v3.json');require(v3['character']['nominal_px_at_1080p']==60.75 and v3['character']['nominal_px_at_1440p']==81,'V3_BODY_SCALE')
    require(v3['camera']['ground_pixels_per_metre_at_1080p']==22.5,'CAMERA_SCALE_CHANGED')
    start=read(ART/'waves/A13/start-snapshot.json');usage=read(ART/'usage.json')
    require(digest(usage['jobs'][:start['jobs']])==start['jobsDigest'],'HISTORY_CHANGED')
    changed=[p for p,h in start['protected'].items() if sha(ROOT/p)!=h];require(not changed,'PROTECTED_ASSETS_CHANGED')
    recent=usage['jobs'][start['jobs']:];charged=sum(j['charged_images'] for j in recent)
    require(charged<=start['sessionImageCap'],'SESSION_CAP')
    require(all(j['status'] not in ('running','reserved') for j in recent),'UNRESOLVED_RESERVATION')
    for j in recent:
        if j['status']=='generated':require(len(j['tool_calls'])==1 and j['charged_images']==1,'EXTRA_GENERATED_CALL')
    latches={p:s['stop'] for p,s in read(ART/'providers/history.json')['providers'].items()}
    require(latches['agy'] and latches['agy']['reason']=='EXTRA_TOOL_CALL' and not latches['grok'],'UNREPORTED_PROVIDER_STOP')
    floor=read(out/'floor-placement.json')
    for p,v in floor['palettes'].items():
        require(sha(ROOT/v['plateSource'])==v['plateSha256'],'PLATE_CHANGED')
        for key in ('overlay','mask'):require(sha(ROOT/v[key]['file'])==v[key]['sha256'],'FLOOR_HASH')
        require(v['maskCoverage']<.055 and all(d['clip'] in m['clips'] for d in v['decals']),'FLOOR_PLACEMENT')
    report={'status':'pass','clips':len(m['clips']),'pages':len(m['pages']),'frameReferences':total,'canonicalGlyphs':12,
      'generatedSourcesUsed':source_count,'transparentEndpointFrames':empty,'maxFrameEdgeAlpha':max_edge,
      'preservedFiles':len(start['protected']),'changedProtectedFiles':changed,'historicalJobsUnchanged':start['jobs'],
      'sessionCharges':charged,'projectCharges':sum(j['charged_images'] for j in usage['jobs']),
      'decodedPageBytes':sum(p.width*p.height*4 for p in page_images.values()),'providerLatches':latches,
      'ownerAccepted':False,'performance':'not measured; load relevant pages on demand'}
    write(out/'checks.json',report);print('A13 integrity pass:',report['clips'],'clips;',total,'frame references;',charged,'charges')
    return report

if __name__=='__main__':check()
