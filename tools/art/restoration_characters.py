"""A10 reference-guided generation and deterministic character atlas pipeline."""
import argparse
from common import ART,ROOT,read,write,sha,relative
from session6 import brief,ref
from providers import generate
from covenant import jobs,inspect,review
import math
import numpy as np
from PIL import Image,ImageOps
from restoration_common import adaptive_magenta,variable_magenta,alpha_metrics,grid,pack_frames,contact,extras,isolated_sheet

OUT=ART/'delivery/a10'
FACINGS=['ne','se']
MIRRORS={'ne':'nw','se':'sw'}
ALL_FACINGS=['ne','se','sw','nw']
STATES=[('idle',[0,1],True,450),('run',[2,3,4,5,6,7],True,100),
        ('cast',[8,9],False,160),('absorb',[10,11],True,240),('hit',[12,13],False,120),('death',[14,15],False,280)]


def observation(job,note,body_heights,excluded=None,proof=False,facing=None,clip_selections=None,canonical_mirror=False,grid_shape=(4,4)):
    """Called only after direct inspection, never inferred from image statistics."""
    review(job,note,proof=proof)
    write(ART/'waves/A10/facings'/(job['id']+'.json'),{'sourceSha256':job['sha256'],
      'sourceRequestedFacing':job['scene'].rsplit('-',1)[1],'facing':facing or job['scene'].rsplit('-',1)[1],'bodyHeightSourcePx':body_heights,'excluded':excluded or [],'clipSelections':clip_selections or {},
      'canonicalMirrorX':canonical_mirror,'canonicalMirrorNote':'source left-facing sheet mirrored locally to right-facing atlas; runtime left mirrors it back' if canonical_mirror else None,
      'grid':list(grid_shape),
      'bodyMeasurement':'authored approximate head-to-sole span in standing keys, excluding weapon; normalization reference, not inferred anatomy',
      'facingByFrame':[(facing or job['scene'].rsplit('-',1)[1]) if [i%grid_shape[0],i//grid_shape[0]] not in (excluded or []) else 'rejected-or-unverified' for i in range(grid_shape[0]*grid_shape[1])],
      'facingObservation':note,'authority':'authored direct observation; local grader cannot accept',
      'owner_accepted':False})


def extract(job):
    op=ART/'waves/A10/facings'/(job['id']+'.json');obs=read(op)
    if obs['sourceSha256']!=job['sha256']:raise ValueError('FACING_REVIEW_HASH')
    grade=read(ART/'grades'/(job['id']+'.json'));direct=read(ART/'waves/A10/reviews'/(job['id']+'.json'))
    if grade['status']!='graded' or grade['verdict']=='reject' or direct['verdict']=='reject':raise ValueError('SOURCE_REJECTED')
    source=Image.open(ROOT/job['archive']);keyed,matte=variable_magenta(source)
    cols,rows=obs.get('grid',[4,4]);excluded=[y*cols+x for x,y in obs['excluded']]
    pieces={(x,y):(rect,im) for x,y,rect,im,_ in isolated_sheet(source,columns=cols,row_count=rows,excluded_indices=excluded,retain_clipped_for_rejection=True,keyer=variable_magenta)}
    records=[]
    for x,y,rect,im in grid(keyed,cols,rows):
        if (x,y) in pieces:rect,im=pieces[x,y]
        metric=alpha_metrics(im);errors=[]
        if metric['empty']:errors.append('EMPTY')
        elif metric['margin_px']<3:errors.append('SOURCE_CROP_MARGIN')
        if not metric['empty'] and not .015<metric['coverage']<.72:errors.append('SILHOUETTE_COVERAGE')
        if [x,y] in obs['excluded']:errors.append('DIRECT_POSE_OR_FACING_REJECTION')
        if obs.get('facingByFrame',[obs['facing']]*(cols*rows))[y*cols+x]!=obs['facing']:errors.append('FACING_MISMATCH')
        a=np.asarray(im);mask=a[:,:,3]>200
        pigment=np.median(a[:,:,:3][mask],axis=0).tolist() if mask.any() else [0,0,0]
        records.append({'col':x,'row':y,'crop':rect,'image':im,'metrics':metric,'pigmentRGB':pigment,'errors':errors})
    baseline=np.median([r['pigmentRGB'] for r in records[:2]],axis=0)
    mass=float(np.median([r['metrics'].get('mass',0) for r in records[:2]]))
    for r in records:
        drift=float(np.abs(np.array(r['pigmentRGB'])-baseline).mean());r['paletteDriftMeanRGB']=round(drift,3)
        if drift>55:r['errors'].append('PALETTE_DRIFT')
        ratio=r['metrics'].get('mass',0)/max(mass,1);r['silhouetteMassRatio']=round(ratio,3)
        if not .35<ratio<2.2:r['errors'].append('SILHOUETTE_DRIFT')
    for state,indices,_,_ in STATES:
        selected=[records[i] for i in indices if i<len(records)]
        for left,right in zip(selected,selected[1:]):
            if left['image'].tobytes()==right['image'].tobytes():right['errors'].append('DUPLICATE_KEY')
    return records,obs,matte


def build():
    roster=read(ART/'covenant-battle-roster.json')['entities'];entities={};pages=[];gates=[];pending=[];contacts=[]
    for entity,design in roster.items():
        allframes=[];clips={};source_rows=[];work=[]
        for direction in FACINGS:
            scene={'cassia-se':'cassia-east','shieldman-se':'shieldman-ne'}.get(entity+'-'+direction,entity+'-'+direction)
            if entity=='shieldman' and direction=='ne':scene='shieldman-ne-corrected'
            eligible=[j for j in jobs('A10') if j['scene']==scene and (ART/'waves/A10/facings'/(j['id']+'.json')).exists()]
            if eligible:work.append((direction,eligible[-1],STATES))
            else:pending.append(entity+':'+direction+':missing')
            gait=[j for j in jobs('A10') if j['scene']==entity+'-'+direction+'-gait' and (ART/'waves/A10/facings'/(j['id']+'.json')).exists()]
            if gait:work.append((direction,gait[-1],STATES[:2]))
        for direction,job,state_layout in work:
            try:records,obs,matte=extract(job)
            except ValueError as exc:pending.append(entity+':'+direction+':'+str(exc));continue
            for r in records:
                gates.append({'job':job['id'],**{k:v for k,v in r.items() if k!='image'}})
            pigment=np.median([r['pigmentRGB'] for r in records[:2]],axis=0);chroma=pigment/max(float(pigment.sum()),1)
            source_rows.append({'source':job['archive'],'sha256':job['sha256'],'bodyHeightSourcePx':obs['bodyHeightSourcePx'],'matteRGB':matte,'facing':direction,'idleChromaticity':chroma.tolist(),
              'facingReview':relative(ART/'waves/A10/facings'/(job['id']+'.json')),'localGrade':relative(ART/'grades'/(job['id']+'.json')),'observedLimitations':obs['facingObservation']})
            for state,columns,loop,ms in state_layout:
                columns=obs.get('clipSelections',{}).get(state,columns)
                clips.setdefault(state,{})
                if True:
                    rr=[records[i] for i in columns]
                    if any(r['errors'] for r in rr):
                        pending.append(entity+':'+state+':'+direction+':gate rejected');continue
                    indices=[]
                    for r in rr:
                        im=ImageOps.mirror(r['image']) if obs.get('canonicalMirrorX') else r['image'];scale=160/obs['bodyHeightSourcePx']
                        resized=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
                        # Align the opaque torso-band centre and lower contact;
                        # retain one source-to-master body scale per sheet.
                        foot=r['metrics']['bbox'][3]
                        alpha=np.asarray(im.getchannel('A'),dtype=float);box=r['metrics']['bbox'];top=box[1]+round((box[3]-box[1])*.25);bottom=box[1]+round((box[3]-box[1])*.65)
                        weights=alpha[top:bottom].sum(axis=0);nominal_center=float((weights*np.arange(im.width)).sum()/max(weights.sum(),1))
                        canvas=Image.new('RGBA',(384,384));offset=(round(192-nominal_center*scale),round(320-foot*scale))
                        canvas.alpha_composite(resized,offset)
                        if alpha_metrics(canvas)['margin_px']<3:
                            r['errors'].append('NORMALIZED_CROP');break
                        indices.append(len(allframes));allframes.append(canvas)
                    if len(indices)!=len(rr):pending.append(entity+':'+state+':'+direction+':normalized crop');continue
                    clips[state][direction]={'indices':indices,'frameDurationMs':ms,'loop':loop,'mirrorX':False,'origin':'distinct generated pose keys; keyed, scaled and baseline aligned locally',
                       'sourceIndices':columns,'selectionNote':'authored re-selection' if state in obs.get('clipSelections',{}) else 'requested state keys',
                       'nativeBodyPixelsPerDisplayPixel1440':round(obs['bodyHeightSourcePx']/54,3)}
                    clips[state][MIRRORS[direction]]={**clips[state][direction],'mirrorX':True,'origin':'horizontal mirror of generated '+direction+' keys; anatomical handedness also mirrors'}
        if not allframes:continue
        reference_chroma=np.median([r['idleChromaticity'] for r in source_rows],axis=0)
        for source in source_rows:
            drift=float(abs(np.array(source['idleChromaticity'])-reference_chroma).max());source['crossDirectionChromaDrift']=round(drift,5)
            if drift>.22:
                direction=source['facing'];pending.append(entity+':'+direction+':cross-direction palette rejection')
                for dirs in clips.values():
                    dirs.pop(direction,None)
                    dirs.pop(MIRRORS[direction],None)
        page,rects=pack_frames(allframes,OUT/'atlases'/(entity+'.png'),cols=8,cell=384)
        page['id']=entity;pages.append(page)
        for state,dirs in clips.items():
            for direction,clip in dirs.items():
                clip['frames']=[{'rect':rects[i],'durationMs':clip['frameDurationMs']} for i in clip.pop('indices')]
                clip['frameCount']=len(clip['frames']);clip['page']=entity
        entities[entity]={'kind':design['kind'],'clips':clips,'anchor':[.5,320/384],'bodyHeightMasterPx':160,
          'designBodyHeight1080':40.5,'designSize1080':[97.2,97.2],'sources':source_rows,'owner_accepted':False}
        for direction in FACINGS:
            if direction in clips.get('idle',{}):
                rec=clips['idle'][direction]['frames'][0]['rect'];pageim=Image.open(ROOT/page['file']);x,y,w,h=rec
                contacts.append((entity+' / '+direction,pageim.crop((x,y,x+w,y+h))))
    unresolved=[e+':'+s+':'+d+':missing' for e in roster for s,_,_,_ in STATES for d in ALL_FACINGS if d not in entities.get(e,{}).get('clips',{}).get(s,{})]
    m={'schemaVersion':1,'id':'covenant-characters-a10','status':'owner-review','pages':pages,'entities':entities,
      'directions':ALL_FACINGS,'directionAnglesWorldRadians':{'ne':-math.pi/4,'se':math.pi/4,'sw':3*math.pi/4,'nw':-3*math.pi/4},'cameraElevationDegrees':55,'paths':'repository-root-relative',
      'blend':'source-over; straight RGBA','owner_accepted':False,'backlog':unresolved,
      'aiMages':'reuse four school entities','motionOwnership':'engine selects facing and state; do not rotate upright body; effects from A8',
      'animationQuality':'incomplete candidate: distinct painted keys are not proof of an anatomically alternating gait; several leading-leg repeats remain',
      'identityDebt':['Garran rear hood versus bare front head','Iskar front cloth brighter pink and hood down','netter text-only front guide changes undersleeve and shoulder detail'],
      'providerStop':'both provider latches set at 285 charged reservations; ungenerated creature front views and cinder hound repair remain backlog'}
    write(OUT/'characters.json',m);write(OUT/'source-gates.json',{'frames':gates,'backlog':unresolved,'rejectedCandidateClips':pending,'owner_accepted':False})
    contact(contacts,OUT/'direction-contact.png','A10 / generated rear-right and front-right; left views mirrored',columns=6,tile=(250,290))
    from covenant import board
    evidence=[extras(OUT/'direction-contact.png','directions','Generated diagonal facings where available, plus mirrored left views. Several clips and creature front views remain missing; gait and identity limitations are explicit.')]
    from restoration_arena import render
    arena=read(ART/'delivery/a9/arena.json');layout=read(ART/'delivery/a9/layout.json')
    for palette in ['verdigris','rust-sand','moonlit']:
        for w,h in [(1920,1080),(2560,1440)]:
            path=OUT/'proofs'/f'{palette}-{w}.png';path.parent.mkdir(parents=True,exist_ok=True)
            render(arena,layout,palette,w,h,actor_manifest=m).save(path)
            evidence.append(extras(path,f'{palette}-{w}','Actual A10 run keys at 3.75% body height with A9 environment and A8 effects. Entities whose requested facing is missing are omitted, not substituted. Static compositing proof, not game integration.'))
    write(OUT/'proofs.json',{'rows':evidence,'owner_accepted':False})
    board('A10',evidence)
    import html
    rows=[]
    for entity in roster:
        available=entities.get(entity,{}).get('clips',{})
        cells=[]
        for state,_,_,_ in STATES:
            present=[d for d in ALL_FACINGS if d in available.get(state,{})]
            cells.append('<td>'+html.escape(', '.join(present) or 'missing')+'</td>')
        rows.append('<tr><th>'+entity+'</th>'+''.join(cells)+'</tr>')
    path=ART/'review/a10/index.html';text=path.read_text(encoding='utf-8')
    status='<section style="overflow:auto"><h2>Actual exported coverage</h2><p><a href="motion.html">Four-direction native-scale playback</a>. Listed clips pass technical gates and remain owner-review. Missing clips are not substituted.</p><table style="border-spacing:16px"><tr><th>Entity</th>'+''.join('<th>'+s[0]+'</th>' for s in STATES)+'</tr>'+''.join(rows)+'</table></section>'
    path.write_text(text.replace('<main>',status+'<main>'),encoding='utf-8')
    return m


def check():
    m=read(OUT/'characters.json');errors=[];coverage=[];pages={p['id']:p for p in m['pages']}
    for p in pages.values():
        im=Image.open(ROOT/p['file'])
        if sha(ROOT/p['file'])!=p['sha256'] or list(im.size)!=p['size']:errors.append('PAGE_HASH_OR_SIZE:'+p['id'])
        if max(im.size)>4096:errors.append('ATLAS_LIMIT:'+p['id'])
    for entity,e in m['entities'].items():
        for source in e['sources']:
            if sha(ROOT/source['source'])!=source['sha256']:errors.append('SOURCE_HASH:'+entity)
        for state,dirs in e['clips'].items():
            for direction,clip in dirs.items():
                coverage.append([entity,state,direction]);im=Image.open(ROOT/pages[clip['page']]['file'])
                if clip['frameCount']!=len(clip['frames']) or len(clip['frames'])<2:errors.append('KEY_COUNT:'+entity+state+direction)
                for f in clip['frames']:
                    x,y,w,h=f['rect']
                    if x<0 or y<0 or x+w>im.width or y+h>im.height or f['durationMs']<=0:errors.append('RECT_OR_TIME:'+entity)
                    elif alpha_metrics(im.crop((x,y,x+w,y+h)))['margin_px']<3:errors.append('ATLAS_CROP:'+entity)
                if clip['nativeBodyPixelsPerDisplayPixel1440']<1:errors.append('NATIVE_DENSITY:'+entity)
                if direction in ['nw','sw'] and not clip['mirrorX']:errors.append('UNDECLARED_MIRROR:'+entity)
    roster=read(ART/'covenant-battle-roster.json')['entities'];missing=[]
    for entity in roster:
        for state,_,_,_ in STATES:
            for direction in ALL_FACINGS:
                if [entity,state,direction] not in coverage:missing.append([entity,state,direction])
    report={'technicalStatus':'fail' if errors else 'pass','errors':errors,'deliveredClips':len(coverage),'requiredClips':288,
      'completeCoverage':not missing,'missingClips':missing,'owner_accepted':False,
      'scope':'source/page hashes, source density, atlas bounds, margins, timing and explicit direction coverage; no owner acceptance or game performance claim'}
    write(ART/'reports/a10-delivery-check.json',report);print({k:v for k,v in report.items() if k!='missingClips'});return report


def character_brief(entity,kind,pilot=False):
    bible=read(ART/'style-covenant.json');roster=read(ART/'covenant-battle-roster.json')['entities'];design=roster[entity]
    frame=next(r for r in read(ART/'delivery/a3c/figures.json')['frames'] if r['entity']==entity)
    refs=[ref(frame['source'],'identity, equipment and silhouette of this exact character'),
          ref(bible['references']['moonchalk-tempest-portrait']['path'],'approved painted volume, cloth, material and highlight fidelity')]
    prior=[j for j in jobs('A10') if j['scene']==entity+'-locomotion']
    if kind=='actions' and prior:refs.insert(0,ref(prior[-1]['archive'],'match exact already generated body, palette, scale and three facings'))
    states='''Columns 1-2: two subtle IDLE breathing keys, weight planted, cloth settling.
Columns 3-8: SIX successive RUN CYCLE keys: right foot contact, down/compression, passing, left foot contact, down/compression, passing. Opposite arms counter-swing. Distinct alternating leg positions, both feet visible when physically possible, a real looping gait. Cloth follows the stride. Do not duplicate the same standing pose.'''
    if kind=='actions':states='''Columns 1-2: CAST or natural ATTACK anticipation and release, distinct arm/head action in the row's facing direction. Mages lift their staff and extend free palm; soldiers use their actual weapon; creatures use their natural anatomy. No large magic is baked into the body.
Columns 3-4: ABSORB/BRACE anticipation and firm resisting pose, facing the same direction; mages plant staff and hold an open palm forward, others brace shield/body. No barrier is baked in.
Columns 5-6: HIT recoil and recovery, readable body reaction, same facing and identity, no wounds or blood.
Columns 7-8: DEATH collapse then still resting intact body on ground, non-gory, fully clothed, all equipment contained, no disappearance. A creature folds its limbs/wings naturally. These are two true poses, not a fading standing figure.'''
    prompt=f'''Use case: stylized-concept. Production CHARACTER ANIMATION sprite sheet, ONE image.
Original dark magical arena character: {design['design']}
Reference images supply identity and approved material fidelity. Keep exactly this identity, clothes, face, weapon, proportions and palette across EVERY frame. Do not copy the portrait layout or add a portrait. {bible['style_block']}
Finely painted substantial three-dimensional forms, layered cloth folds, selective worn metal highlights, clear anatomical joints, controlled rich surface detail. No flat vector icons, no chibi, no cartoon outlines.
EXACTLY EIGHT equal columns and THREE equal rows, 24 complete isolated full-body sprites, no labels, text, dividers or numbers. Largest available resolution, ideally 3072x1536. Each whole figure and weapon fit inside its cell with at least 12 percent completely empty margin on all sides. Uniform vivid MAGENTA #FF00FF between and behind sprites, no floor, no shadow, no glow outside cells.
Camera fixed 55-degree elevated orthographic, looking down enough to see head tops and shoulders. Same body scale and foot baseline in all standing/running cells. Full figure always visible.
ROW ONE: NORTH / WALKING AWAY from viewer. Show BACK of head/hood, BACK of clothing, heels; NO face, NO chest front. Entire row remains north-facing.
ROW TWO: EAST / screen RIGHT. Show true rightward profile, nose or creature muzzle points RIGHT, toes point RIGHT. Entire row remains east-facing.
ROW THREE: SOUTH / TOWARDS viewer. Show face and chest front, toes towards viewer. Entire row remains south-facing.
{states}
Read each row left to right. Keep equipment in a consistent anatomical hand; do not change staff into a spear or alter the silhouette between frames. No extra people, no duplicated limbs, no large spell effects. The game draws effects separately. Character will be 40 pixels tall at 1080p, so retain clear light/dark separation and recognizable silhouette. Original designs only.'''
    return brief('A10',entity+'-'+kind,prompt,refs,pilot)


def facing_brief(entity,direction,pilot=False,correction=False):
    bible=read(ART/'style-covenant.json');design=read(ART/'covenant-battle-roster.json')['entities'][entity]
    frame=next(r for r in read(ART/'delivery/a3c/figures.json')['frames'] if r['entity']==entity)
    refs=[ref(bible['references']['moonchalk-tempest-portrait']['path'],'material painting quality, not the portrait subject'),
          ref(frame['source'],'exact character identity, clothing, equipment and palette')]
    # A single identity crop prevents the image-edit provider from copying the
    # pose layout of a previous sheet into a different requested direction.
    montage=Image.new('RGB',(1200,650),'#17232d')
    sources=[Image.open(ROOT/refs[0]['path']).convert('RGB'),Image.open(ROOT/frame['source']).crop(frame['source_crop']).convert('RGB')]
    for i,source in enumerate(sources):
        image=ImageOps.contain(source,(590,640),Image.Resampling.LANCZOS)
        montage.paste(image,(i*600+(600-image.width)//2,(650-image.height)//2))
    path=ART/'waves/A10/references'/(entity+'-'+direction+'-single.png');path.parent.mkdir(parents=True,exist_ok=True);montage.save(path)
    refs.insert(0,ref(relative(path),'authored reference collage: left Moonchalk material bar, right ONE native A3c identity crop; layout and pose are not output instructions'))
    facing={'north':'NORTH, directly AWAY from the viewer: the BACK of the head and BACK of the torso are visible, face and chest never visible. The running feet move towards the TOP of the image. Never change into a side view.',
            'east':'EAST, directly screen RIGHT: rightward profile, face or muzzle and feet point RIGHT in EVERY pose. No front or back views.',
            'south':'SOUTH, directly TOWARDS the viewer: face and FRONT of torso visible; running feet come toward the BOTTOM of the image. Never change into a side view.'}[direction]
    prompt=f'''ONE production animation sprite sheet for ONE original character. {design['design']}
{bible['style_block']}
The supplied REFERENCE COLLAGE has TWO PANELS: LEFT is only the Moonchalk painted MATERIAL QUALITY, RIGHT is the exact character IDENTITY. Create an entirely NEW spritesheet; discard the collage layout and the identity pose. Rich sculpted hand-painted material and subtle broken painted edges, NOT thick ink outlines, flat comic shading or simplified cartoon shapes. Keep clothing layers, weapon, anatomy, proportions and colours identical in all keys. The weapon remains present in EVERY pose, held in the same anatomical hand; do not omit it from idle or running.
EXACTLY FOUR equal columns and FOUR equal rows, 16 sprites. Uniform pure MAGENTA #FF00FF. No text, labels, grid lines, floor, shadows or extra effects. Largest available square image, ideally 2048x2048.
Every sprite and all equipment must fit inside its own cell, central 70 percent, at least 15 percent empty magenta margin on ALL sides. No overlapping cells, no cropped tips. Fixed 55-degree elevated orthographic camera. Same figure size and foot baseline.
EVERY SINGLE CELL faces {facing}
READING ORDER, left to right then next row:
Row 1: cells 1-2 two IDLE breathing keys; cells 3-4 RUN keys 1-2 (right foot contact then compression).
Row 2: four RUN keys 3-6 (passing, left foot contact, compression, passing). Six total run keys make a real alternating gait in the SAME facing direction. Limbs visibly change, cloth follows, no repeated stills.
Row 3: cells 1-2 CAST/ATTACK anticipation then release using the character's staff, weapon or natural anatomy; cells 3-4 ABSORB/BRACE anticipation then planted resisting pose. Mages extend a free palm; other characters brace their shield or body. No large spell/barrier effects.
Row 4: cells 1-2 HIT recoil then recovery, without injury; cells 3-4 DEATH collapse then intact resting body. Non-gory, no blood, fully clothed, equipment contained. Preserve the row's facing through these actions.
Exact 16 poses, only one camera direction in this entire image. No portrait, no scene. Fine painted cloth folds, metal glints, clear joints, no noisy surface overlay. Designed for a 40px-tall figure in game. Original design, no franchise characters.'''
    if correction:
        old=next(j for j in reversed(jobs('A10')) if j['scene']==entity+'-'+direction)
        prompt+='\nCRITICAL CORRECTION: all sixteen poses MUST maintain the SAME requested facing, including casting, bracing, recoil and resting. Do not copy any previous sheet. No missing equipment. Absolutely no extra seventeenth figure below the grid. Keep broad empty gutters, at least 15 percent cell height ABOVE and BELOW each body. Paint rich subtle physical material without black comic outlines.'
        if direction=='north':prompt+=' Direct BACK view: shoulders horizontal and symmetrical, spine vertical and centered, both heels visible from BEHIND. Run directly away along image vertical axis, never sideways.'
        return brief('A10',entity+'-'+direction,prompt,refs,pilot,providers=['grok'],aspect_ratio='1:1',revision=2,correction_of=old['id'])
    return brief('A10',entity+'-'+direction,prompt,refs,pilot,providers=['grok'],aspect_ratio='1:1')


def portrait_facing_brief(entity,direction):
    bible=read(ART/'style-covenant.json');design=read(ART/'covenant-battle-roster.json')['entities'][entity]
    frame=next(r for r in read(ART/'delivery/a3c/figures.json')['frames'] if r['entity']==entity)
    old=[j for j in jobs('A10') if j['scene']==entity+'-'+direction];revision=len(old)+1
    raw=Image.open(ROOT/frame['source']);x0,y0,x1,y1=frame['source_crop'];head,sole=frame['body_y_source'];body=sole-head
    # Upper-body identity only: no running legs or sheet arrangement to copy.
    crop=raw.crop((x0,max(y0,head-10),x1,min(y1,round(head+body*.55))))
    ownportrait=ART/'delivery/a2c/portraits'/entity/'neutral.png'
    images=[Image.open(ROOT/bible['references']['moonchalk-tempest-portrait']['path']).convert('RGB'),crop.convert('RGB')]
    if ownportrait.exists():images.append(Image.open(ownportrait).convert('RGB'))
    montage=Image.new('RGB',(500*len(images),650),'#17232d')
    for i,source in enumerate(images):
        image=ImageOps.contain(source,(490,640),Image.Resampling.LANCZOS);montage.paste(image,(i*500+(500-image.width)//2,(650-image.height)//2))
    path=ART/'waves/A10/references'/f'{entity}-{direction}-bust-v{revision}.png';path.parent.mkdir(parents=True,exist_ok=True);montage.save(path)
    write(path.with_suffix('.json'),{'source':frame['source'],'sourceSha256':frame['source_sha256'],'crop':[x0,max(y0,head-10),x1,min(y1,round(head+body*.55))],
      'portrait':relative(ownportrait) if ownportrait.exists() else None,'portraitSha256':sha(ownportrait) if ownportrait.exists() else None,
      'style':bible['references']['moonchalk-tempest-portrait'],'origin':'authored reference collage, not generated art'})
    facing={'north':'directly AWAY, back of head and back of torso, symmetrical shoulders, no face, running away along image vertical axis',
      'east':'directly RIGHT in profile, nose/muzzle and toes point RIGHT, face profile visible, never show back of head',
      'south':'directly TOWARDS viewer, face/chest and toes visible, running towards viewer along image vertical axis',
      'ne':'THREE-QUARTER REAR RIGHT, diagonally AWAY and RIGHT: back of head/hood and back of torso visible, nose/muzzle points upper-right, no chest front. Maintain this rear-right view in idle, running and every action',
      'se':'THREE-QUARTER FRONT RIGHT, diagonally TOWARDS viewer and RIGHT: face and chest front visible, nose/muzzle points lower-right. Maintain this front-right view in idle, running and every action'}[direction]
    prompt=f'''Create an entirely NEW full-body game animation spritesheet. The reference collage contains only upper-body IDENTITY and painted MATERIAL references, not a layout or pose to copy. Character: {design['design']}
{bible['style_block']} High fidelity painted cloth and worn metal, rich sculpted volume, small sharp highlights, no black comic outlines. Keep the SAME headwear, clothing, weapon and hand in EVERY pose. For a hooded mage the hood remains UP over the head in all sixteen keys; the face is visible only when physically facing viewer.
ONE uniform magenta #FF00FF image, EXACTLY 4 columns by 4 rows, 16 fully isolated whole figures. No text, dividers, floor, shadow, magic trails or portrait panels. Each figure is SMALL within its cell, only HALF the cell height, at least 20 percent blank magenta above/below/sides. Leave a broad completely empty magenta border around the ENTIRE image, especially below the last row. All weapons and resting bodies fit their cells. Largest square output.
Fixed elevated 55-degree orthographic camera. Every pose faces {facing}. This entire sheet has only this ONE facing. Never switch direction or camera during any action. Weapon present in ALL keys. Same body size and ground contact baseline.
Row 1: idle breath A, idle breath B, run right-contact, run compression.
Row 2: run passing, run left-contact, run compression, run passing. Six total run keys visibly alternate feet and counter-swing arms in the specified facing.
Row 3: cast/attack preparation, cast/attack release, absorb/brace preparation, absorb/brace resisting. Use actual staff, weapon or creature anatomy. Keep the same facing.
Row 4: hit recoil, hit recovery, collapse onto knees/limbs, fully resting intact body. No injury, blood or gore. Keep the same identity and headwear, even at rest.
No extra figures. Do not copy a running pose from any reference. No effects beyond a tiny staff-tip glint. Original character design only.'''
    extra={'revision':revision,'aspect_ratio':'1:1'}
    if old:extra['correction_of']=old[-1]['id']
    return brief('A10',entity+'-'+direction,prompt,[ref(relative(path),'left Moonchalk material; centre A3c upper-body identity; right approved portrait when present')],False,providers=['agy','grok'],**extra)


def square_facing_brief(entity,direction):
    bible=read(ART/'style-covenant.json');design=read(ART/'covenant-battle-roster.json')['entities'][entity]
    frames=[r for r in read(ART/'delivery/a3c/figures.json')['frames'] if r['entity']==entity]
    frame=next((r for r in frames if r['state']=='ready'),frames[0])
    scene=entity+'-'+direction+('-corrected' if entity=='shieldman' and direction=='ne' else '')
    old=[j for j in jobs('A10') if j['scene']==scene];revision=(old[-1]['input'].get('revision',len(old))+1) if old else 1
    crop=Image.open(ROOT/frame['source']).crop(frame['source_crop']).convert('RGB')
    override=None
    guide=[j for j in jobs('A10') if j['scene']==entity+'-'+direction+'-guide']
    if guide:
        chosen=guide[-1];rp=ART/'waves/A10/reviews'/(chosen['id']+'.json');gp=ART/'grades'/(chosen['id']+'.json')
        if not rp.exists() or read(rp)['verdict']=='reject' or not gp.exists() or read(gp)['verdict']=='reject':raise ValueError('UNREVIEWED_DIRECTION_GUIDE')
        crop=Image.open(ROOT/chosen['archive']).convert('RGB');mirror_guide=(entity,direction) in [('conscript','se'),('shieldman','ne')]
        if mirror_guide:crop=ImageOps.mirror(crop)
        override={'source':chosen['archive'],'sha256':chosen['sha256'],'mirrorX':mirror_guide,'reason':'reviewed single-facing full-body identity guide; normalize observed left-facing guides by explicit mirror'}
    if entity=='brennic' and direction=='se' and old and not guide:
        previous=next((j for j in old if j['id']=='a10-brennic-se-grok-a02'),None)
        if previous:
            pieces=isolated_sheet(Image.open(ROOT/previous['archive']),columns=4,row_count=4,retain_clipped_for_rejection=True,keyer=variable_magenta)
            selected=next(piece for piece in pieces if piece[0:2]==(1,0));rgba=selected[3]
            crop=Image.new('RGB',rgba.size,(255,0,255));crop.paste(rgba,(0,0),rgba)
            override={'source':previous['archive'],'sha256':previous['sha256'],'sourceCell':[1,0],'crop':selected[2],'reason':'complete front-right standing identity; whole sheet rejected for other duplicate-weapon/facing keys'}
    if direction=='se' and entity in ['mire_maw','hush_moth'] and not guide:
        previous=next(j for j in jobs('A10') if j['scene']==entity+'-ne')
        index={'mire_maw':10,'hush_moth':9}[entity]
        pieces=isolated_sheet(Image.open(ROOT/previous['archive']),columns=4,row_count=4,retain_clipped_for_rejection=True,keyer=variable_magenta)
        selected=next(p for p in pieces if p[1]*4+p[0]==index);rgba=selected[3]
        crop=Image.new('RGB',rgba.size,(255,0,255));crop.paste(rgba,(0,0),rgba)
        override={'source':previous['archive'],'sha256':previous['sha256'],'sourceCell':[index%4,index//4],'crop':selected[2],'reason':'directly observed front-right anatomy key; excluded from rear-facing clip but reusable as explicit front-view generation reference'}
    square=Image.new('RGB',(768,768),(255,0,255));crop=ImageOps.contain(crop,(640,640),Image.Resampling.LANCZOS);square.paste(crop,((768-crop.width)//2,(768-crop.height)//2))
    path=ART/'waves/A10/references'/f'{entity}-{direction}-square-v{revision}.png';path.parent.mkdir(parents=True,exist_ok=True)
    import io,hashlib
    encoded=io.BytesIO();square.save(encoded,format='PNG');payload=encoded.getvalue()
    if path.exists() and sha(path)!=hashlib.sha256(payload).hexdigest():raise ValueError('IMMUTABLE_REFERENCE_COLLISION')
    path.write_bytes(payload)
    write(path.with_suffix('.json'),{'source':frame['source'],'sourceSha256':frame['source_sha256'],'crop':frame['source_crop'],'origin':'single native full-body identity crop on authored square magenta canvas; resampling only',
      'styleAuthority':bible['references']['moonchalk-tempest-portrait'],'styleUse':'author-reviewed painting bar and prompt guidance; Grok sees only this single full-body reference','override':override})
    facing='THREE-QUARTER REAR RIGHT, back of head and back of torso visible, moving RIGHT and AWAY' if direction=='ne' else 'THREE-QUARTER FRONT RIGHT, face and chest front visible, moving RIGHT and TOWARDS viewer'
    prompt=f'''Replace this single-character reference with an entirely new SQUARE 4x4 animation sheet of the SAME character. Retain identity and equipment, but do NOT retain its single-pose layout. {design['design']}
{bible['style_block']} Rich physical painted cloth folds and worn metal, subtle fine highlights. No thick comic outlines, no texture overlay.
EXACTLY FOUR columns and FOUR rows, sixteen separate WHOLE FULL-BODY figures, heads to feet plus weapons. All sixteen face {facing}. Same camera elevation 55 degrees, same body scale, same costume and headwear. Never change direction during an action. A hood stays up in every frame if present in the reference. Keep exactly ONE consistent staff/weapon in every frame, never two, never omit it.
For a MAGE, the ONE staff stays UPRIGHT beside the body in the SAME hand throughout idle, run, cast and brace. The free hand gestures to cast or resist. Do not swing the staff horizontally and do not add a second staff. Other characters retain their actual weapon/anatomy.
Pure flat magenta background, no panel borders or lines, no shadow or ground. Every figure is SMALL and fits inside the CENTRAL HALF of its cell; broad completely empty magenta gutters above and below every head and foot. Leave a LARGE empty margin around the whole image. No cropped head, foot, weapon or resting body.
Row 1: idle A, idle B, run right-foot contact, run compression.
Row 2: run passing, run left-foot contact, run compression, run passing. These six RUN frames are a real alternating gait in the same requested direction.
Row 3: cast/attack anticipation, cast/attack release, absorb/brace preparation, absorb/brace resisting. Use staff, actual weapon or natural creature anatomy. Keep same facing.
Row 4: hit recoil, hit recovery, intact collapse, intact resting body. No blood or injury. No large magical effect: game adds effects separately.
No letters, numbers, extra figures, portraits, layouts or labels. Original design only. Every pose has both head and feet within its own broad blank margins.'''
    if design['kind']=='creature':
        prompt=f'''Create an entirely new SQUARE animation sheet of this SAME original ANIMAL. {design['design']}
{bible['style_block']} Preserve this creature's exact anatomy, natural hide, colour and proportions. NO CLOTHING, NO WEAPONS, NO STAFF, NO HUMAN HANDS. Four-legged animal remains on FOUR LEGS, never humanoid. All sixteen keys face {facing}. Same elevated 55-degree orthographic camera and same body size.
Exactly FOUR columns by FOUR rows, sixteen complete isolated animals on pure uniform MAGENTA. No panel borders, labels, floor, shadow or scenery. Every entire creature, tail, feet, horns and wings fits comfortably inside its cell, broad empty margins on every side and around the whole image. Paint substantial physical volume and fine mineral/fur/wing detail, not thick comic outlines.
Row 1: idle breath A, idle breath B, running right-diagonal limb pair contact, running compression.
Row 2: running passing, running opposite diagonal limb pair contact, running compression, running passing. SIX real distinct gait phases with alternating natural limbs. Bog creature uses a low compress-launch-land hop. No attacks in run cells.
Row 3: natural head/mouth attack preparation, attack release, crouched defensive brace A, resisting brace B. Keep the same requested facing throughout.
Row 4: intact hit recoil, hit recovery, collapse folding legs, fully resting intact animal. No injury or gore. No large baked effects except this creature's inherent flame tail or throat glow. Never add equipment or clothes. Original design only.'''
    if entity=='hush_moth':
        prompt+='\nMOTH OVERRIDE: run means six WINGBEAT phases, broad wings down, halfway up, fully raised, halfway down, broad downstroke, recovering. No feet or running legs. Two idle keys gently hover; attack leans head/thorax; brace folds wings defensively; hit recoils; death folds intact wings onto ground. Keep the THORAX CENTRE locked to the same centre point in every cell while wings articulate. Four wings and two antennae, no additional anatomy.'
    extra={'revision':revision,'aspect_ratio':'1:1'}
    if old:extra['correction_of']=old[-1]['id']
    return brief('A10',scene,prompt,[ref(relative(path),'single full-body A3c identity crop or reviewed direction guide on square canvas')],False,providers=['grok'],**extra)


def direction_guide_brief(entity,direction):
    bible=read(ART/'style-covenant.json');design=read(ART/'covenant-battle-roster.json')['entities'][entity]
    frame=next(r for r in read(ART/'delivery/a3c/figures.json')['frames'] if r['entity']==entity)
    raw=Image.open(ROOT/frame['source']).crop(frame['source_crop']).convert('RGB');square=Image.new('RGB',(768,768),(255,0,255))
    raw=ImageOps.contain(raw,(600,600),Image.Resampling.LANCZOS);square.paste(raw,((768-raw.width)//2,(768-raw.height)//2))
    path=ART/'waves/A10/references'/f'{entity}-{direction}-guide-input.png';path.parent.mkdir(parents=True,exist_ok=True);square.save(path)
    facing='REAR-RIGHT three-quarter view, BACK of head, BACK of torso, away and right, no chest or face front. Show the actual back surfaces of clothes or creature anatomy' if direction=='ne' else 'FRONT-RIGHT three-quarter view, FACE and CHEST FRONT clearly visible, toward viewer and right. Show the actual front surfaces of clothing or creature anatomy'
    prompt=f'''Create ONE new full-body direction reference of this SAME original character. {design['design']}
Repaint the character from a different viewing direction: {facing}. This is a new anatomical view in three-dimensional space, NOT rotation of the flat image. The upright body remains vertical in the picture. Camera fixed elevated 55-degree orthographic.
ONE complete figure only, relaxed planted ready stance, both feet on ground (creature all supporting feet planted; moth wings spread in hovering rest). Keep identical clothes, equipment, headwear, proportions and colours. Preserve exactly one weapon and correct anatomy. No action, no attack, no magic effect, no duplicate object, no other characters.
{bible['style_block']} Refined physical painted volume and cloth folds, no heavy comic outline. Fine detail at worn edges.
Pure uniform MAGENTA #FF00FF background. Whole body including feet, weapon, wings and tail fits within middle 65 percent of image. At least 15 percent completely blank margin on every side. No floor, shadow, text, labels, panels or frame. Square image. Do not copy the reference facing if it differs from the requested new view.'''
    return brief('A10',entity+'-'+direction+'-guide',prompt,[ref(relative(path),'full-body A3c identity; change anatomical viewing direction only')],False,providers=['grok'],aspect_ratio='1:1')


def text_guide_brief(entity,direction):
    bible=read(ART/'style-covenant.json');design=read(ART/'covenant-battle-roster.json')['entities'][entity]
    old=[j for j in jobs('A10') if j['scene']==entity+'-'+direction+'-guide'];revision=len(old)+1
    facing='FRONT-RIGHT: face, chest/front torso, front belt and toes visible, diagonally towards viewer and right' if direction=='se' else 'REAR-RIGHT: back of head and back of torso, heels visible, diagonally away and right'
    prompt=f'''Original hand-painted full-body game character direction reference. ONE complete figure, {facing}. {design['design']}
{bible['style_block']} Camera elevated 55-degree orthographic, both head top and upright body visible. One coherent body, correct anatomy and exactly one set of equipment. Planted neutral ready stance, creature supporting feet planted; moth wings open at rest.
The entire body including weapon, tail and wings is fully visible, central 60 percent of image, generous empty margins above head and below feet. Pure uniform vivid MAGENTA #FF00FF background. No floor, shadows, effects, scenery, text, labels, panel borders or other figures. Square image. Rich sculpted painted volume and fine worn edges, no heavy comic outline. Exact requested facing, no looking backwards over shoulder. Original design only.'''
    extra={'revision':revision,'aspect_ratio':'1:1','provenance':'text-only direction-guide fallback; identity description from covenant-battle-roster and author-inspected A3c; downstream animation remains image-reference guided'}
    if old:extra['correction_of']=old[-1]['id']
    return brief('A10',entity+'-'+direction+'-guide',prompt,[],False,providers=['grok'],**extra)


def gait_brief(entity):
    source_id={'garran':'a10-garran-se-grok-a01','iskar':'a10-iskar-se-grok-a01'}[entity]
    index={'garran':13,'iskar':0}[entity];job=next(j for j in jobs('A10') if j['id']==source_id)
    pieces=isolated_sheet(Image.open(ROOT/job['archive']),columns=4,row_count=4,retain_clipped_for_rejection=True,keyer=variable_magenta)
    x,y,rect,rgba,_=next(p for p in pieces if p[1]*4+p[0]==index)
    if alpha_metrics(rgba)['margin_px']<3:raise ValueError('GAIT_REFERENCE_CROP')
    keyed=Image.new('RGB',rgba.size,(255,0,255));keyed.paste(rgba,(0,0),rgba);keyed=ImageOps.contain(keyed,(500,600),Image.Resampling.LANCZOS)
    square=Image.new('RGB',(768,768),(255,0,255));square.paste(keyed,((768-keyed.width)//2,(768-keyed.height)//2))
    path=ART/'waves/A10/references'/f'{entity}-se-gait.png';square.save(path)
    write(path.with_suffix('.json'),{'source':job['archive'],'sha256':job['sha256'],'sourceCell':[x,y],'crop':rect,'origin':'reviewed front-facing whole-body key, isolated and recentered as generation reference'})
    prompt='''Create an entirely new EIGHT-frame locomotion sheet of this EXACT character, same face, clothes, colours and ONE staff. EXACTLY FOUR columns and TWO rows on flat magenta. No panel lines, text, shadows or effects. Keep the FRONT-RIGHT three-quarter view of this reference in EVERY key; face and chest front visible. Never show the back. Fixed elevated 55-degree camera, uniform body scale, complete head, weapon and feet, very wide empty margins.
Row 1: idle planted both feet A; idle planted both feet B; RUN frame 1 RIGHT foot clearly FAR FORWARD and LEFT foot behind; RUN frame 2 right foot under weight while LEFT knee moves forward.
Row 2: RUN frame 3 LEFT foot passes ahead and right heel lifts; RUN frame 4 LEFT foot clearly FAR FORWARD and RIGHT foot behind; RUN frame 5 left foot under weight while RIGHT knee moves forward; RUN frame 6 right foot passes ahead and left heel lifts.
A real alternating six-phase gait: frame 1 and frame 4 have OPPOSITE legs forward. Do not repeat a single leading-leg pose. Cloth follows each stride. The ONE staff stays upright in the SAME hand, free arm counter-swings. No duplicate or missing staff. No attack, crouched attack or kneeling poses. Rich physical painted volume, subtle worn cloth and metal, fine highlights, no noisy texture or thick comic outlines. Original character, no extra figures.'''
    return brief('A10',entity+'-se-gait',prompt,[ref(relative(path),'complete reviewed front-right body key; preserve viewing direction and identity')],False,providers=['grok'],aspect_ratio='1:1')


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('command');p.add_argument('entity',nargs='?');p.add_argument('kind',nargs='?');a=p.parse_args()
    if a.command=='generate':generate(character_brief(a.entity,a.kind,pilot=a.entity=='cassia' and a.kind=='locomotion'))
    elif a.command=='facing':generate(facing_brief(a.entity,a.kind,pilot=a.entity=='cassia' and a.kind=='north'))
    elif a.command=='correct':generate(facing_brief(a.entity,a.kind,pilot=True,correction=True))
    elif a.command=='portrait-facing':generate(portrait_facing_brief(a.entity,a.kind))
    elif a.command=='square-facing':generate(square_facing_brief(a.entity,a.kind))
    elif a.command=='guide':generate(direction_guide_brief(a.entity,a.kind))
    elif a.command=='text-guide':generate(text_guide_brief(a.entity,a.kind))
    elif a.command=='gait':generate(gait_brief(a.entity))
    elif a.command=='build':build()
    elif a.command=='check':
        if check()['errors']:raise SystemExit(1)
