"""Deterministic A14 extraction. New poses are generated; packing is derived."""
import copy
import numpy as np
from PIL import Image,ImageOps
from common import ART,ROOT,read,write,sha,relative
from restoration_common import isolated_sheet,variable_magenta,alpha_metrics,pack_frames

OUT=ART/'delivery/a14'
STATES={'hit-light':([0,1,2,3],[30,45,45,40]),'hit-heavy':([4,5,6,7,8,9],[30,40,50,45,40,35]),'death':([10,11,12,13,14,15],[70,80,90,100,120,140])}
MIRROR={'ne':'nw','se':'sw'}
EXTRA_STATES={'motion':{'idle':(list(range(4)),[180]*4),'run':(list(range(4,10)),[75]*6),'cast':(list(range(10,16)),[90]*6)},'run':{'run':(list(range(6)),[75]*6)},'defense':{'absorb':(list(range(6)),[100]*6)},'combat':{'cast':(list(range(6)),[90]*6),'absorb':(list(range(6,12)),[100]*6)}}

def extract(job,obs):
    if obs['sha256']!=job['sha256']:raise ValueError('STALE_OBSERVATION')
    source=Image.open(ROOT/job['archive']);cols,rows=obs.get('grid',[4,4])
    if obs.get('regions'):
        keyed,matte=variable_magenta(source)
        for rect in obs.get('backgroundRuleBands',[]):keyed.paste((0,0,0,0),tuple(rect))
        pieces=[(i,0,rect,keyed.crop(rect),matte) for i,rect in enumerate(obs['regions'])]
    else:pieces=isolated_sheet(source,columns=cols,row_count=rows,retain_clipped_for_rejection=True,keyer=variable_magenta,slot_centers=obs.get('componentCenters'))
    records=[]
    for x,y,rect,im,matte in pieces:
        index=y*cols+x
        for region in obs.get('foreignPixelMasks',{}).get(str(index),[]):im.paste((0,0,0,0),tuple(region))
        metric=alpha_metrics(im);a=np.asarray(im);mask=a[:,:,3]>200
        pigment=np.median(a[:,:,:3][mask],axis=0) if mask.any() else np.zeros(3)
        errors=[]
        if metric['empty'] or metric['margin_px']<3:errors.append('SOURCE_CROP')
        if not .015<metric.get('coverage',0)<.82:errors.append('SILHOUETTE_COVERAGE')
        if index in obs.get('excluded',[]):errors.append('DIRECT_POSE_REJECTED')
        if obs['facings'][index]!=job['input']['direction']:errors.append('FACING')
        records.append({'index':index,'crop':rect,'image':im,'metrics':metric,'pigmentRGB':pigment.tolist(),'matteRGB':matte,'errors':errors})
    by={r['index']:r for r in records};baseline=np.array(by[0]['pigmentRGB']);mass=by[0]['metrics']['mass']
    identity=job['input']['references'][0];refpath=ROOT/identity['path']
    if sha(refpath)!=identity['sha256']:raise ValueError('IDENTITY_REFERENCE_HASH')
    refim,_=variable_magenta(Image.open(refpath));refarray=np.asarray(refim);refmask=refarray[:,:,3]>200
    refpigment=np.median(refarray[:,:,:3][refmask],axis=0)
    approved=None
    if job['input'].get('session')==10 and any('approved Covenant creature' in ref.get('role','') for ref in job['input']['references']):
        ref=next(ref for ref in job['input']['references'] if 'approved Covenant creature' in ref.get('role',''))
        if sha(ROOT/ref['path'])!=ref['sha256']:raise ValueError('CREATURE_REFERENCE_HASH')
        im,_=variable_magenta(Image.open(ROOT/ref['path']));a=np.asarray(im)
        approved=np.median(a[:,:,:3][a[:,:,3]>200],axis=0)
    for r in records:
        drift=float(abs(np.array(r['pigmentRGB'])-baseline).mean());ratio=r['metrics']['mass']/mass
        reference_drift=float(abs(np.array(r['pigmentRGB'])-refpigment).mean())
        r.update(paletteDriftMeanRGB=round(drift,3),referencePaletteDriftMeanRGB=round(reference_drift,3),silhouetteMassRatio=round(ratio,4))
        if drift>55:r['errors'].append('PALETTE_DRIFT')
        if reference_drift>70:r['errors'].append('REFERENCE_PALETTE_DRIFT')
        if not .30<ratio<2.4:r['errors'].append('SILHOUETTE_DRIFT')
        if approved is not None:
            drift=float(abs(np.array(r['pigmentRGB'])-approved).mean())
            value=float(np.dot(r['pigmentRGB'],[.2126,.7152,.0722])/np.dot(approved,[.2126,.7152,.0722]))
            r.update(approvedCreaturePaletteDriftMeanRGB=round(drift,3),approvedCreatureValueRatio=round(value,4))
            if drift>50 or not .60<value<1.65:r['errors'].append('APPROVED_CREATURE_STYLE_VALUE_DRIFT')
    return by

def normalized(record,obs,index):
    im=record['image'];box=record['metrics']['bbox'];scale=160/obs['bodyHeightSourcePx']*obs.get('scaleFactors',{}).get(str(index),1)
    if obs.get('mirrorSource'):im=ImageOps.mirror(im);box=alpha_metrics(im)['bbox']
    # An authored per-key ground pivot follows the fall toward the body centre.
    # Positions are fractions of the full subject box and explicitly reviewable.
    pivot=obs.get('pivotFractions',{}).get(str(index),[.5,1.0])
    px=box[0]+(box[2]-box[0])*pivot[0];py=box[1]+(box[3]-box[1])*pivot[1]
    resized=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
    canvas=Image.new('RGBA',(384,384));canvas.alpha_composite(resized,(round(192-px*scale),round(300-py*scale)))
    if alpha_metrics(canvas)['margin_px']<3:raise ValueError('NORMALIZED_CROP')
    return canvas

def build():
    OUT.mkdir(parents=True,exist_ok=True)
    jobs=[j for j in read(ART/'usage.json')['jobs'] if j.get('wave')=='A14' and j['status']=='generated']
    roster=read(ART/'covenant-battle-roster.json')['entities'];entities={};pages=[];gates=[];backlog=[]
    selected={}
    for job in jobs:
        p=ART/'waves/A14/observations'/(job['id']+'.json')
        if p.exists() and read(p)['verdict']!='reject':selected[(job['input']['entity'],job['input']['direction'],job['input']['kind'])]=(job,read(p))
    for entity,design in roster.items():
        clips={};sources=[]
        for direction,kind in [(d,k) for d in ('ne','se') for k in ('reaction','collapse','hits','motion','run','defense','combat')]:
            if (entity,direction,kind) not in selected:continue
            job,obs=selected[(entity,direction,kind)]
            grade=read(ART/'grades'/(job['id']+'.json'))
            if grade['verdict']=='reject':backlog.append(job['id']+':local-reject');continue
            records=extract(job,obs);frames=[];maps={}
            for idx,r in records.items():
                if job['input'].get('session')==10:
                    r['wholeBodyScaleFactor']=obs.get('scaleFactors',{}).get(str(idx),1)
                    r['nominalBodySourcePx']=obs['bodyHeightSourcePx']
                    r['groundPivotFraction']=obs.get('pivotFractions',{}).get(str(idx),[.5,1])
                if not r['errors']:
                    try:maps[idx]=len(frames);frames.append(normalized(r,obs,idx))
                    except ValueError as exc:r['errors'].append(str(exc))
                gates.append({'job':job['id'],**{k:v for k,v in r.items() if k!='image'}})
            if not frames:continue
            pid=f'a14-{entity}-{direction}-{kind}';page,rects=pack_frames(frames,OUT/'atlases'/f'{entity}-{direction}-{kind}.png',cols=4,cell=384);page['id']=pid;pages.append(page)
            sources.append({'source':job['archive'],'sha256':job['sha256'],'job':job['id'],'observation':relative(ART/'waves/A14/observations'/(job['id']+'.json')),'bodyHeightSourcePx':obs['bodyHeightSourcePx'],'facing':direction,'nativeBodyPixelsPerDisplayPixel1440':obs['bodyHeightSourcePx']/81,'limitations':obs['note']})
            layout=STATES if kind=='reaction' else {'death':(list(range(6)),STATES['death'][1])}
            if kind=='hits':layout={k:v for k,v in STATES.items() if k.startswith('hit-')}
            if kind in EXTRA_STATES:layout=EXTRA_STATES[kind]
            for state,(default_indices,durations) in layout.items():
                if state in obs.get('excludedStates',[]):continue
                indices=obs.get('selections',{}).get(state,default_indices)
                durations=obs.get('durations',{}).get(state,durations)
                if len(indices)!=len(durations):raise ValueError('TIMING_COUNT')
                if any(i not in maps for i in indices):backlog.append(f'{entity}:{state}:{direction}:source-gate');continue
                clip={'page':pid,'frames':[{'rect':rects[maps[i]],'durationMs':durations[k]} for k,i in enumerate(indices)],'frameCount':len(indices),'loop':False,'mirrorX':False,'anchor':[.5,300/384],'sourceIndices':indices,'source':job['archive'],'sourceSha256':job['sha256'],'origin':'generated pose keys; locally keyed, uniformly scaled and pivot-aligned','suggestedDurationMs':sum(durations),'owner_accepted':False}
                clip['selectionNote']='authored pose-key reselection; see hash-bound source observation' if state in obs.get('selections',{}) else 'requested generated state sequence'
                if obs.get('excludedStates'):clip['selectionNote']='partial source salvage; rejected states: '+', '.join(obs['excludedStates'])+'; only directly gated keys for this state delivered'
                clip['uniqueGeneratedKeys']=len(set(indices))
                if state in ('idle','run','absorb'):clip['loop']=True
                if obs.get('scaleFactors'):
                    clip['sourceScaleFactors']=[obs['scaleFactors'].get(str(i),1) for i in indices]
                    clip['scaleNormalizationNote']='Authored uniform whole-body scale per source key/group, measured from repeated ready anatomy; no limb reshaping.'
                if state=='death':clip.update(holdLastFrame=True,nextState='corpse',persistent=True,sortAnchor='body centre on ground at final key')
                clips.setdefault(state,{})[direction]=clip
                clips[state][MIRROR[direction]]={**copy.deepcopy(clip),'mirrorX':True,'origin':'derived horizontal mirror of '+direction+'; equipment handedness also mirrors'}
            death=clips.get('death',{}).get(direction)
            if death and 'death' in layout:
                last=death['sourceIndices'][-1];sprite=frames[maps[last]]
                for facing,mirror in [(direction,False),(MIRROR[direction],True)]:
                    output=ImageOps.mirror(sprite) if mirror else sprite
                    path=OUT/'corpses'/f'{entity}-{facing}.png';path.parent.mkdir(parents=True,exist_ok=True);output.save(path)
                    corpse={**copy.deepcopy(clips['death'][facing]),'frames':[dict(death['frames'][-1],durationMs=1000)],'frameCount':1,'sourceIndices':[last],'uniqueGeneratedKeys':1,'additionalGeneratedImages':0,'selectionNote':'exact final collapse key reused as a persistent static sprite','suggestedDurationMs':None,'static':True,'holdLastFrame':True,'persistent':True,'nextState':None,'origin':'derived from exact last generated collapse key'+('; horizontal mirror' if mirror else ''),'standalone':{'file':relative(path),'sha256':sha(path),'mirrorAlreadyApplied':mirror,'anchor':[.5,300/384]}}
                    clips.setdefault('corpse',{})[facing]=corpse
        if clips:entities[entity]={'kind':design['kind'],'clips':clips,'anchor':[.5,300/384],'bodyHeightMasterPx':160,'designBodyHeight1080':60.75,'designSize1080':[145.8,145.8],'scaleContract':'scale-contract-v3','sources':sources,'owner_accepted':False}
    missing=[f'{e}:{s}:{d}' for e in roster for s in ['hit-light','hit-heavy','death','corpse'] for d in ['ne','se','sw','nw'] if d not in entities.get(e,{}).get('clips',{}).get(s,{})]
    m={'schemaVersion':1,'id':'covenant-characters-a14','status':'owner-review' if not missing else 'partial-owner-review','baseManifest':'art/delivery/a10/characters.json','paths':'repository-root-relative','pages':pages,'entities':entities,'directions':['ne','se','sw','nw'],'cameraElevationDegrees':55,'backlog':missing,'rejectedCandidateClips':backlog,'owner_accepted':False,'merge':'Replace only present entity/state/direction clips. Honour clip anchor and A14 scale v3; see loader.js. Do not apply 1.5 twice.','aliases':{'hit':'hit-light'},'gameBoundary':'Simulation owns hit stun, interruption, immunity, collision, targetability and bout cleanup. No gameplay mechanics in this delivery.'}
    write(OUT/'characters.json',m);write(OUT/'source-gates.json',{'frames':gates,'backlog':missing,'thresholds':{'marginPx':3,'paletteMeanRGB':55,'referencePaletteMeanRGB':70,'silhouetteMassRatio':[.30,2.4],'approvedCreaturePaletteMeanRGB':50,'approvedCreatureValueRatio':[.60,1.65]},'facingGate':'hash-bound direct per-key observations; not a statistical proof of anatomical direction','owner_accepted':False})
    print('A14:',sum(len(ds) for b in entities.values() for ds in b['clips'].values()),'clips;',len(missing),'missing')
    return m

if __name__=='__main__':build()
