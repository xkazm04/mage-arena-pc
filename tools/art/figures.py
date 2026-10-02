"""A3 deterministic matte extraction, anchored key-pose atlases and scale proofs.

No image-generation calls. Generated anatomy is never redrawn or in-betweened.
"""
import argparse
import csv
import html
import math
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageOps
from common import ART, ROOT, read, write, sha, source_path, relative, digest
from waves import brief, generated, gate
from grade import route
from board import font

OUT = ART/'delivery/a3'
CELL = (512,384)
ANCHOR = (256,320)
BODY = 192


def extract(image):
    """Remove only magenta chroma, including interior holes; keep matte metadata."""
    rgb=np.asarray(image.convert('RGB')).astype(np.float32)
    chroma=np.minimum(rgb[:,:,0]-rgb[:,:,1],rgb[:,:,2]-rgb[:,:,1])
    alpha=np.clip((55-chroma)/35,0,1)
    # Magenta contamination on antialiased boundaries is neutralised with the
    # observed matte, not painted character pixels. Interior opaque RGB stays exact.
    background=np.median(rgb[chroma>80],axis=0) if np.any(chroma>80) else np.array([255,0,255])
    clean=np.clip((rgb-(1-alpha[:,:,None])*background)/np.maximum(alpha[:,:,None],.05),0,255)
    clean[alpha==0]=0
    rgba=np.concatenate([clean,np.round(alpha[:,:,None]*255)],axis=2).astype('uint8')
    result=Image.fromarray(rgba)
    box=Image.fromarray((alpha>0.5).astype('uint8')*255).getbbox()
    if not box:raise ValueError('EMPTY_MATTE')
    return result,box,{'method':'magenta chroma threshold 20..55; measured-matte edge decontamination',
        'background_rgb':background.tolist(),'opaque_fraction':float(np.mean(alpha>.5))}


def export_figures(pilot=False):
    OUT.mkdir(parents=True,exist_ok=True)
    b=brief('A3');roster=read(ART/'a3-roster-v1.json')['entities']
    overrides=read(ART/'a3-crops-v1.json') if (ART/'a3-crops-v1.json').exists() else {}
    derivatives=read(ART/'a3-derivations-v1.json')
    rows=[];sheets=[]
    for entity in roster:
        frames=[]
        for item in [i for i in b['items'] if i['entity']==entity['id']]:
            candidates=[j for j in generated('A3') if j['scene']==item['id']]
            if not candidates:continue
            job=candidates[-1]
            review=ART/'waves/A3/reviews'/(job['id']+'.json')
            grade=ART/'grades'/(job['id']+'.json')
            rejected = review.exists() and read(review)['verdict']=='reject'
            if not pilot and (not review.exists() or not grade.exists() or read(grade).get('status')!='graded' or route(read(grade))[0]=='reject'):
                continue
            if gate(job)['verdict']!='technical-pass':raise ValueError('SOURCE_GATE:'+job['id'])
            source=Image.open(source_path(job)).convert('RGB');w,h=source.size
            for column,state in enumerate(item['frames']):
                key=entity['id']+':'+state
                salvage=derivatives['salvage'].get(key)
                if rejected and not pilot and (not salvage or salvage['job']!=job['id']):continue
                crop=(column*w//2,0,(column+1)*w//2,h)
                if salvage and salvage['job']==job['id']:crop=tuple(salvage['crop'])
                settings=overrides.get(key,{})
                if settings.get('source_crop'):crop=tuple(settings['source_crop'])
                rgba,box,matte=extract(source.crop(crop))
                if settings.get('exclude_source_rects'):
                    md=ImageDraw.Draw(rgba)
                    for x0,y0,x1,y1 in settings['exclude_source_rects']:
                        md.rectangle((x0-crop[0],y0-crop[1],x1-crop[0]-1,y1-crop[1]-1),fill=(0,0,0,0))
                    box=rgba.getbbox()
                # Explicit body measurements can exclude spears, hands and wings.
                span=settings.get('body_span_px',max(box[2]-box[0],box[3]-box[1]) if state=='death' or entity['kind']=='creatures' else box[3]-box[1])
                scale=BODY*entity['height_ratio']/span
                piece=rgba.crop(box)
                if settings.get('horizontal_flip'):piece=ImageOps.mirror(piece)
                size=tuple(max(1,round(v*scale)) for v in piece.size)
                piece=piece.resize(size,Image.Resampling.LANCZOS)
                frame=Image.new('RGBA',CELL)
                # Origin is ground contact; fallen bodies retain a ground-centred pivot.
                xy=(ANCHOR[0]-size[0]//2,ANCHOR[1]-size[1])
                if xy[0]<2 or xy[1]<2 or xy[0]+size[0]>CELL[0]-2:raise ValueError('FRAME_CLIP:'+key)
                frame.alpha_composite(piece,xy)
                path=OUT/'frames'/(entity['id']+'-'+state+'.png');path.parent.mkdir(exist_ok=True)
                frame.save(path)
                record={'entity':entity['id'],'state':state,'file':relative(path),'sha256':sha(path),
                    'source_job':job['id'],'source_sha256':job['sha256'],'source_crop':list(crop),'alpha_bounds_in_crop':list(box),
                    'exclude_source_rects':settings.get('exclude_source_rects',[]),
                    'body_span_source_px':span,'body_span_basis':settings.get('basis','alpha bounds; no separate anatomical calibration'),
                    'scale_to_master':scale,'cell':list(CELL),'anchor':list(ANCHOR),'master_body_px':BODY*entity['height_ratio'],
                    'horizontal_flip':settings.get('horizontal_flip',False),
                    'flip_limit':'handedness and asymmetric costume also flip; not a new generated direction' if settings.get('horizontal_flip') else None,
                    'matte':matte,'provenance':'generated key pose; deterministic matte/crop/uniform scale; no painted in-betweens',
                    'salvage_from_rejected_sheet':salvage if rejected else None,
                    'facing':'southeast target; original head/body variation retained; horizontal flips explicit','owner_accepted':False}
                frames.append((frame,record));rows.append(record)
        for reuse in derivatives['reuse']:
            if reuse['entity']!=entity['id']:continue
            base=next(((im,r) for im,r in frames if r['state']==reuse['from_state']),None)
            if not base:continue
            im,r=base;path=OUT/'frames'/(entity['id']+'-'+reuse['state']+'.png');im.save(path)
            row={**r,'state':reuse['state'],'file':relative(path),'sha256':sha(path),'provenance':'composited state: reused generated cast body + separate procedural arc',
                'derivation':reuse,'salvage_from_rejected_sheet':None}
            frames.append((im,row));rows.append(row)
        if not frames:continue
        atlas=Image.new('RGBA',(CELL[0]*4,CELL[1]*2))
        for n,(frame,row) in enumerate(frames):
            x,y=n%4*CELL[0],n//4*CELL[1];atlas.alpha_composite(frame,(x,y));row['atlas_rect']=[x,y,*CELL]
        path=OUT/'atlases'/(entity['id']+'.png');path.parent.mkdir(exist_ok=True);atlas.save(path)
        sheets.append({'entity':entity['id'],'file':relative(path),'sha256':sha(path),'frames':len(frames),
            'state_map':{'idle':['idle'],'run':['run-a','run-b'],'cast':['cast-windup','cast-release'] if entity['kind']=='mage' else None,
                'attack':['attack-windup','attack-release'] if entity['kind']!='mage' else None,
                'absorb':['absorb'] if entity['kind']=='mage' else None,'hit':['hit'],'death':['death']},
            'unsupported':'other facings, generated in-betweens; enemy cast/absorb not in baseline' if entity['kind']!='mage' else 'other facings and generated in-betweens'})
        present={r['state'] for _,r in frames}
        sheets[-1]['state_map']={k:v if v and set(v)<=present else None for k,v in sheets[-1]['state_map'].items()}
    manifest={'version':'a3-figures-v1','roster_sha256':sha(ART/'a3-roster-v1.json'),'camera_sha256':sha(ART/'CAMERA-OK.md'),
        'scale_sha256':sha(ART/'scale-contract-v1.json'),'frames':rows,'atlases':sheets,'owner_accepted':False,
        'not_measured':['motion readability','owner feel','engine integration','precise generated elevation','cross-sheet identity stability']}
    write(OUT/'figures.json',manifest)
    return manifest


def paste_frame(canvas,row,foot,height):
    im=Image.open(ROOT/row['file']).convert('RGBA')
    scale=height/BODY;size=tuple(round(x*scale) for x in CELL)
    im=im.resize(size,Image.Resampling.LANCZOS)
    origin=(round(foot[0]-ANCHOR[0]*scale),round(foot[1]-ANCHOR[1]*scale))
    canvas.alpha_composite(im,origin)


def proof(manifest):
    contract=read(ART/'scale-contract-v1.json')
    src=ART/'review/sources/01-tessera-open-oval-sparse-near-a01.jpg'
    records=[];folder=OUT/'proofs';folder.mkdir(exist_ok=True)
    rows=manifest['frames'];cassia=next((r for r in rows if r['entity']=='cassia' and r['state']=='idle'),None)
    if not cassia:raise ValueError('CASSIA_PROOF_REQUIRED')
    for w,h in [contract['reference_viewport_px'],contract['second_viewport_px']]:
        canvas=Image.open(src).convert('RGBA').resize((w,h),Image.Resampling.LANCZOS)
        d=ImageDraw.Draw(canvas);rs=h/1080
        d.rectangle((0,0,w,64*rs),fill='#202923')
        d.text((24*rs,12*rs),'A3 / OPEN OVAL / 55° OBLIQUE / NATIVE SCALE STUDY',font=font(round(23*rs),True),fill='#f3e6c5')
        d.text((24*rs,40*rs),'Existing painted figures/effects belong to the unchanged source. Added figures below are anchored alpha composites.',font=font(round(14*rs)),fill='#e1ccb0')
        placements=[]
        for x,f in zip([.2,.38,.56],[.04,.05,.06]):
            foot=(w*x,h*.38);paste_frame(canvas,cassia,foot,h*f)
            d.text((foot[0]-45*rs,foot[1]+12*rs),f'{int(f*100)}% / {h*f:.1f}px',font=font(round(17*rs)),fill='#38261f')
            placements.append({'entity':'cassia','state':'idle','foot':list(foot),'body_height_target_px':h*f,'fraction':f})
        mage_ids=['cassia','brennic','garran','iskar']
        for n,e in enumerate(mage_ids):
            r=next((r for r in rows if r['entity']==e and r['state']=='absorb'),None)
            if not r:continue
            foot=(w*(.16+.21*n),h*.85);paste_frame(canvas,r,foot,h*.06)
            d.text((foot[0]-35*rs,foot[1]+14*rs),e.capitalize(),font=font(round(17*rs)),fill='#38261f')
            placements.append({'entity':e,'state':'absorb','foot':list(foot),'body_height_target_px':h*.06,'fraction':.06})
        # Exact ground-projected 140-degree arc faces screen right; rear stays open.
        cx,cy=w*.76,h*.37;ppm=30*1.2*rs;rx=2.4*ppm;ry=rx*math.sin(math.radians(55))
        pts=[(cx+rx*math.cos(math.radians(a)),cy+ry*math.sin(math.radians(a))) for a in np.linspace(-70,70,141)]
        d.line(pts,fill='#226b8b',width=round(5*rs))
        d.line([(x-2*rs,y) for x,y in pts],fill='#caf0e5',width=round(2*rs))
        absorb=next((r for r in rows if r['entity']=='cassia' and r['state']=='absorb'),cassia)
        paste_frame(canvas,absorb,(cx,cy),h*.06)
        d.text((cx-70*rs,cy+ry+20*rs),'140° / rear open 220°',font=font(round(16*rs)),fill='#38261f')
        d.rectangle((0,h-35*rs,w,h),fill='#202923')
        d.text((24*rs,h-29*rs),'Static composition, not gameplay. Generated poses + derived alpha; procedural arc. Owner readability review pending.',font=font(round(17*rs)),fill='#f3e6c5')
        path=folder/f'open-oval-{w}x{h}.png';canvas.convert('RGB').save(path)
        records.append({'file':relative(path),'sha256':sha(path),'size':[w,h],'source':relative(src),'source_sha256':sha(src),
            'source_operation':'unchanged plate uniformly resized; generated marks remain visible','placements':placements,
            'arc':{'world_angle':140,'rear_open':220,'radius_m':2.4,'projected_radius_px':[rx,ry],'facing_degrees':0},'owner_accepted':False})
    write(OUT/'proofs.json',records)
    print(json.dumps({'frames':len(rows),'atlases':len(manifest['atlases']),'proofs':len(records)}))


def encounter(manifest):
    from effects import draw_effect, recipes
    src=ART/'review/sources/01-tessera-open-oval-sparse-near-a01.jpg'
    roster=read(ART/'a3-roster-v1.json')['entities'];records=[]
    for w,h in [(1920,1080),(2560,1440)]:
        rs=h/1080;canvas=Image.open(src).convert('RGBA').resize((w,h),Image.Resampling.LANCZOS);d=ImageDraw.Draw(canvas)
        d.rectangle((0,0,w,65*rs),fill='#202923')
        d.text((24*rs,12*rs),'A3 / ROSTER ENCOUNTER / NEAR 6% HUMAN SCALE',font=font(round(24*rs),True),fill='#f3e6c5')
        d.text((24*rs,42*rs),'Added roster at contract scale; original painted combatants and effects remain in this source.',font=font(round(15*rs)),fill='#e1ccb0')
        placements=[]
        for n,e in enumerate(roster):
            x=w*(.23+.27*(n%3));y=h*(.23+.195*(n//3))
            if e['id']=='netter':x=w*.62  # avoid the plate's existing blue mage
            state='cast-release' if e['kind']=='mage' else 'attack-release'
            row=next((r for r in manifest['frames'] if r['entity']==e['id'] and r['state']==state),None)
            if not row:continue
            shadow=Image.new('RGBA',canvas.size);sd=ImageDraw.Draw(shadow)
            sd.ellipse((x-14*rs,y-4*rs,x+14*rs,y+4*rs),fill=(56,38,31,65));canvas.alpha_composite(shadow)
            if e['id']=='cassia':
                spec=next(s for s in recipes() if s['id']=='water-bolt');fx=draw_effect(spec,1,h)
                canvas.alpha_composite(fx,(round(x+100*rs-fx.width/2),round(y-32*rs-fx.height/2)))
            elif e['id']=='thornback':
                spec=next(s for s in recipes() if s['id']=='unblockable-unblockable-mark');fx=draw_effect(spec,1,h)
                canvas.alpha_composite(fx,(round(x+80*rs-fx.width/2),round(y-fx.height/2)))
            elif e['id']=='mire_maw':
                spec=next(s for s in recipes() if s['id']=='water-tide-orb');fx=draw_effect(spec,1,h)
                canvas.alpha_composite(fx,(round(x+100*rs-fx.width/2),round(y-12*rs-fx.height/2)))
            paste_frame(canvas,row,(x,y),h*.06)
            label=e['name'];d.text((x-90*rs,y+17*rs),label,font=font(round(16*rs),True),fill='#38261f')
            placements.append({'entity':e['id'],'state':state,'foot':[x,y],'nominal_human_body_px':h*.06,
                'authored_size_ratio':e['height_ratio'],'source_frame':row['file']})
        d.rectangle((0,h-40*rs,w,h),fill='#202923')
        d.text((24*rs,h-32*rs),'Static encounter arrangement. Creature sizes are authored silhouette ratios, not baseline collision bounds. No gameplay or motion claim.',font=font(round(17*rs)),fill='#f3e6c5')
        path=OUT/'proofs'/f'encounter-{w}x{h}.png';canvas.convert('RGB').save(path)
        records.append({'file':relative(path),'sha256':sha(path),'size':[w,h],'source_sha256':sha(src),'placements':placements,'owner_accepted':False})
    write(OUT/'encounters.json',records)


def main():
    p=argparse.ArgumentParser();p.add_argument('command',choices=['pilot','build']);a=p.parse_args()
    m=export_figures(a.command=='pilot');proof(m)
    if a.command=='build':encounter(m)


if __name__=='__main__':main()
