"""A8 frame atlas builder, emitted-light matte extraction and exact geometry."""
import argparse
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps
from common import ART,ROOT,read,write,sha,relative
from covenant import jobs,board,font
from restoration_common import luminous_alpha,grid,alpha_metrics,pack_frames,contact,extras,saved

OUT=ART/'delivery/a8'
SCHOOLS=['fire','water','earth','air']
KINDS=['cast','travel','impact','hit','aura']


def selected(scene):
    eligible=[]
    for j in jobs('A8'):
        if j['scene']!=scene:continue
        r=read(ART/'waves/A8/reviews'/(j['id']+'.json'))
        g=read(ART/'grades'/(j['id']+'.json'))
        if r['verdict']!='reject' and g['status']=='graded' and g['verdict']!='reject':eligible.append(j)
    if not eligible:raise ValueError('NO_REVIEWED_SOURCE:'+scene)
    return eligible[-1]


def exact_telegraph(school, phase, shape='ring'):
    im=Image.new('RGBA',(256,256));d=ImageDraw.Draw(im)
    c=read(ART/'style-covenant.json')['elements'][school]['color']
    pulse=round(160+70*math.sin(2*math.pi*phase/8))
    rgb=tuple(int(c[i:i+2],16) for i in (1,3,5))
    if shape=='ring':
        pts=[(128+102*math.cos(a),128+102*math.sin(a)*math.sin(math.radians(55))) for a in np.linspace(0,2*math.pi,257)]
    else:
        pts=[(128,128)]+[(128+102*math.cos(a),128+102*math.sin(a)*math.sin(math.radians(55))) for a in np.linspace(-math.pi/4,math.pi/4,65)]+[(128,128)]
    d.line(pts,fill=(5,14,23,235),width=12)
    d.line(pts,fill=(*rgb,pulse),width=7)
    for a in (0,math.pi/2,math.pi,math.pi*1.5) if shape=='ring' else (-math.pi/4,math.pi/4):
        x=128+102*math.cos(a);y=128+102*math.sin(a)*math.sin(math.radians(55))
        d.polygon([(x,y-5),(x+4,y),(x,y+5),(x-4,y)],fill=(249,239,199,255))
    return im


def build():
    OUT.mkdir(parents=True,exist_ok=True);pages=[];clips={};observations=[];contact_rows=[]
    for school in SCHOOLS:
        j=selected(school+'-animation');src=Image.open(ROOT/j['archive']);frames=[];source_rects=[];metrics=[]
        replacements={}
        if school=='earth':
            correction=selected('earth-impact-isolated')
            replacements={12+y*3+x:(rect,raw,correction) for x,y,rect,raw in grid(Image.open(ROOT/correction['archive']),3,2)}
        source_jobs=[]
        for x,y,rect,raw in grid(src,6,5):
            frame_job=j
            if y*6+x in replacements:rect,raw,frame_job=replacements[y*6+x]
            gray_matte=frame_job['provider']=='grok' and school=='earth' and y==2
            im=luminous_alpha(raw,black_floor=6 if gray_matte else 3,matte_rgb=[25,25,25] if gray_matte else None);m=alpha_metrics(im)
            excluded=school=='air' and y==1 and x in (0,3)
            if school=='water' and y==1 and x in (3,5):im=ImageOps.mirror(im)
            if m['empty']:raise ValueError(f'EMPTY_SOURCE:{school}:{x}:{y}')
            if m['margin_px']<2 and not excluded:raise ValueError(f'SOURCE_CLIP:{school}:{x}:{y}')
            # Keep the source canvas aspect and common grid positions, never
            # fit individual shapes (which would turn dissolves into scale jumps).
            cell=Image.new('RGBA',(256,256));im=ImageOps.contain(im,(248,248),Image.Resampling.LANCZOS)
            if not excluded:cell.alpha_composite(im,((256-im.width)//2,(256-im.height)//2))
            m['excluded']=excluded
            frames.append(cell);source_rects.append(rect);metrics.append(m)
            source_jobs.append(frame_job)
        page,rects=pack_frames(frames,OUT/'atlases'/(school+'.png'))
        page['id']=school;pages.append(page)
        for row,kind in enumerate(KINDS):
            idx=list(range(row*6,(row+1)*6));loop=kind in ('travel','aura')
            if school=='air' and kind=='travel':idx=[7,8,10,11]
            playback=idx+idx[-2:0:-1] if kind=='aura' else idx
            sizes={'cast':[96,96],'travel':[100,64],'impact':[144,144],'hit':[55,55],'aura':[90,72]}
            source_job=source_jobs[idx[0]]
            clips[school+'.'+kind]={'page':school,'frames':[{'rect':rects[i],'durationMs':100 if loop else 65,'sourceCrop':source_rects[i]} for i in playback],
              'frameCount':len(playback),'generatedKeyCount':len(idx),'loop':loop,'loopMethod':'authored ping-pong of six generated keys' if kind=='aura' else 'forward',
              'anchor':[.5,.5],'blend':'lighter','fallbackBlend':'source-over',
              'designSize1080':sizes[kind],'facing':'screen-right' if kind=='travel' else 'non-directional',
              'rotateWithAim':kind=='travel','source':source_job['archive'],'sourceSha256':source_job['sha256'],
              'origin':'generated consecutive painted keys; local black-matte extraction, common-cell resampling and packing',
              'mirroredSourceFrames':[3,5] if school=='water' and kind=='travel' else [],
              'excludedSourceFrames':[0,3] if school=='air' and kind=='travel' else [],
              'matteRGB':[25,25,25] if source_job['provider']=='grok' else [0,0,0],
              'timeline':'authored visual proposal; engine event owns start/stop and speed',
              'owner_accepted':False}
            stack=Image.new('RGBA',(768,128))
            for k,i in enumerate(idx):stack.alpha_composite(frames[i].resize((128,128)),(k*128,0))
            contact_rows.append((school+' / '+kind,stack))
            a=np.asarray(frames[idx[-1]],dtype=float);b=np.asarray(frames[idx[0]],dtype=float)
            observations.append({'id':school+'.'+kind,'sourceCells':[metrics[i] for i in idx],
               'loopJoinMeanAbsoluteRGBA':round(float(abs(a-b).mean()),3) if loop else None,
               'loopClaim':'phase sequence loops, pixel-perfect cyclic interpolation not claimed' if loop else 'one shot'})
        clips[school+'.projectile']={**clips[school+'.travel'],'aliasOf':school+'.travel'}
        marks=[exact_telegraph(school,i,shape) for shape in ['ring','cone'] for i in range(8)]
        page,rects=pack_frames(marks,OUT/'atlases'/(school+'-marks.png'),cols=8)
        page['id']=school+'-marks';pages.append(page)
        for row,shape in enumerate(['ring','cone']):
            clips[school+'.telegraph.'+shape]={'page':page['id'],'frames':[{'rect':r,'durationMs':90} for r in rects[row*8:row*8+8]],
              'frameCount':8,'loop':True,'anchor':[.5,.5],'blend':'source-over','designSize1080':[112,112],
              'origin':'procedurally authored exact projected geometry and rhythmic opacity; not generated',
              'projectionElevationDegrees':55,'mechanicalBoundary':'engine-owned; draw exact hitbox separately if dimensions differ',
              'rotateWithAim':False,'owner_accepted':False}
    # Absorb sources are added only after direct review, no hidden fallback.
    barrier=[j for j in jobs('A8') if j['scene']=='barrier-animation']
    if barrier:
        j=selected('barrier-animation');src=Image.open(ROOT/j['archive']);frames=[];crops=[]
        perfect_crops=[[45,512,275,768],[280,512,460,768],[510,512,735,768],
                       [730,512,955,768],[955,512,1147,768],[1147,512,1376,768]]
        if src.size!=(1376,768):raise ValueError('BARRIER_CROP_SOURCE_SIZE_CHANGED')
        barrier_metrics=[]
        for x,y,rect,raw in grid(src,6,3):
            excluded=y==1 and x in (0,1)
            if y==2:rect=perfect_crops[x];raw=src.crop(rect)
            im=luminous_alpha(raw);metric=alpha_metrics(im)
            if not excluded and (metric['empty'] or metric['margin_px']<2):raise ValueError(f'BARRIER_CROP:{x}:{y}')
            cell=Image.new('RGBA',(256,256));factor=.75
            # One authored common centre of curvature per source cell, never
            # recenter on changing glow bounds. Extended perfect crops isolate
            # complete shapes from adjacent cells without padding over clipping.
            pivot=[round(x*src.width/6)+85,y*256+128]
            im=im.resize((round(im.width*factor),round(im.height*factor)),Image.Resampling.LANCZOS)
            offset=[round(82-(pivot[0]-rect[0])*factor),round(128-(pivot[1]-rect[1])*factor)]
            if not excluded:cell.alpha_composite(im,offset)
            metric.update(sourceCrop=rect,sourcePivot=pivot,excluded=excluded)
            barrier_metrics.append(metric);frames.append(cell);crops.append(rect)
        page,rects=pack_frames(frames,OUT/'atlases/barrier.png');page['id']='barrier';pages.append(page)
        for row,kind in enumerate(['absorb.hold','absorb.contact','absorb.perfect']):
            indices=list(range(row*6,(row+1)*6)) if row!=1 else [8,9,10,11]
            clips[kind]={'page':'barrier','frames':[{'rect':rects[i],'durationMs':80,'sourceCrop':crops[i]} for i in indices],
              'frameCount':len(indices),'loop':row==0,'anchor':[82/256,.5],'blend':'lighter','designSize1080':[146,146],
              'origin':'generated barrier phases; local emitted-light key and atlas packing',
              'cropPolicy':'authored source isolation windows and common centre of curvature; no glow-bound recentering',
              'excludedSourceFrames':[0,1] if row==1 else [],
              'source':j['archive'],'sourceSha256':j['sha256'],'facing':'screen-right','rotateWithAim':False,
              'rendererArcDegrees':140,'geometryPolicy':'painted texture is clipped/remapped by renderer to exact game arc; generated angle is not measured and image is not hitbox',
              'owner_accepted':False}
            stack=Image.new('RGBA',(768,128))
            for k in range(6):stack.alpha_composite(frames[row*6+k].resize((128,128)),(k*128,0))
            contact_rows.append((kind,stack))
        observations.append({'id':'barrier','sourceCells':barrier_metrics})
    manifest={'schemaVersion':1,'id':'covenant-effects-a8','status':'owner-review','paths':'repository-root-relative',
       'pages':pages,'clips':clips,'alpha':'sRGB straight RGBA; RGB unpremultiplied once from black matte; convert once on GPU upload',
       'renderOrder':['ground telegraphs','rear aura','body','cast/travel/contact','front aura and barrier','localized perfect flare'],
       'scale':'design units at 1080p; multiply by viewportHeight/1080','gameOwns':['collision','slowing','event timing','arc direction','spell balance'],
       'owner_accepted':False}
    write(OUT/'effects.json',manifest);write(OUT/'source-measurements.json',{'observations':observations})
    contact(contact_rows,OUT/'frame-contact.png','A8 / generated consecutive keys; authored exact marks',columns=2,tile=(780,200))
    evidence=[extras(OUT/'frame-contact.png','animation-keys','Generated keys after black-matte extraction. Exact telegraphs are separately authored. Open motion.html for animation.')]
    bible=read(ART/'style-covenant.json')
    for name in ['verdigris-covenant-arena','moonchalk-tempest-arena']:
        evidence.append(extras(ROOT/bible['references'][name]['path'],'reference-'+name,'Approved Covenant concept reference; compare energy, fine sparks and mist. This is not a new generation.'))
    for p in sorted((ART/'review/a8').glob('motion-*.png')):
        evidence.append(extras(p,p.stem,'Measured standalone canvas capture with actual frame atlases. Existing A3c bodies witness scale; not gameplay.'))
    board('A8',evidence)
    import shutil
    shutil.copy2(ROOT/'tools/art/templates/restoration-effects.html',ART/'review/a8/motion.html')
    page=ART/'review/a8/index.html'
    page.write_text(page.read_text(encoding='utf-8').replace('<main>','<p><a href="motion.html">Open animated canvas / serve repository over HTTP</a></p><main>'),encoding='utf-8')
    return manifest


def check():
    m=read(OUT/'effects.json');errors=[];frames=0
    pages={p['id']:p for p in m['pages']}
    for p in m['pages']:
        im=Image.open(ROOT/p['file'])
        if sha(ROOT/p['file'])!=p['sha256']:errors.append('HASH:'+p['id'])
        if im.mode!='RGBA' or im.getchannel('A').getextrema()[0]!=0:errors.append('ALPHA:'+p['id'])
    for ident,c in m['clips'].items():
        if c['frameCount']!=len(c['frames']):errors.append('COUNT:'+ident)
        if not all(0<=a<=1 for a in c['anchor']):errors.append('ANCHOR:'+ident)
        im=Image.open(ROOT/pages[c['page']]['file']);fingerprints=[]
        for f in c['frames']:
            if f['durationMs']<=0:errors.append('TIMING:'+ident)
            x,y,w,h=f['rect'];frame=im.crop((x,y,x+w,y+h));frames+=1
            if x<2 or y<2 or x+w>im.width-2 or y+h>im.height-2:errors.append('BOUNDS:'+ident)
            if alpha_metrics(frame)['empty']:errors.append('EMPTY:'+ident)
            fingerprints.append(frame.tobytes())
            gutter=im.crop((x-2,y-2,x+w+2,y+h+2)).getchannel('A')
            ga=np.asarray(gutter)
            if np.any(ga[:2,:]) or np.any(ga[-2:,:]) or np.any(ga[:,:2]) or np.any(ga[:,-2:]):errors.append('GUTTER:'+ident)
        if len(set(fingerprints))<2:errors.append('STATIC_ANIMATION:'+ident)
        if 'source' in c and sha(ROOT/c['source'])!=c['sourceSha256']:errors.append('SOURCE:'+ident)
    required=[s+'.'+k for s in SCHOOLS for k in KINDS+['projectile','telegraph.ring','telegraph.cone']]+['absorb.hold','absorb.contact','absorb.perfect']
    for ident in required:
        if ident not in m['clips']:errors.append('MISSING:'+ident)
    result={'status':'fail' if errors else 'pass','errors':errors,'clips':len(m['clips']),'frameReferences':frames,
      'scope':'hash, alpha, nonempty, frame variance, metadata and coverage integrity; owner quality not certified','owner_accepted':False}
    write(ART/'reports/a8-delivery-check.json',result);print(result);return result


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('command');a=p.parse_args()
    if a.command=='build':build()
    elif check()['errors']:raise SystemExit(1)
