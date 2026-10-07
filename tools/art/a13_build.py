"""A13 deterministic extraction, painted-glyph assembly and authored timing masks.

No provider calls. Glyphs and contour pixels come from archived paintings;
placement, tint, progress, alpha and interpolation are authored operations.
"""
import argparse
import math
import numpy as np
from PIL import Image, ImageDraw, ImageOps, ImageFilter
from common import ART, ROOT, read, write, sha, relative
from covenant import jobs, font
from restoration_common import luminous_alpha, grid, alpha_metrics, pack_frames, saved, contact

OUT=ART/'delivery/a13'
CELL=384
NAMES=['fire','water','earth','air','bind','open','gather','release','witness','danger','sever','endure']
ELEMENTS=read(ART/'style-covenant.json')['elements']
SOURCE_GATES=[]

def source(scene):
    choices=[]
    for j in jobs('A13'):
        if j['scene']!=scene:continue
        review=ART/'waves/A13/reviews'/(j['id']+'.json')
        if review.exists() and read(review)['verdict']!='reject':choices.append(j)
    if not choices:raise ValueError('NO_REVIEWED_SOURCE:'+scene)
    j=choices[-1]
    if sha(ROOT/j['archive'])!=j['sha256']:raise ValueError('SOURCE_CHANGED:'+scene)
    return j

def extraction(scene,cols,rows,target=(308,308)):
    import cv2
    j=source(scene);src=Image.open(ROOT/j['archive'])
    cells=[];rects=[];metrics=[];trims=[]
    for x,y,rect,raw in grid(src,cols,rows):
        if scene=='floor-wreaths':
            # Generated white inter-cell rules are layout, never artwork.
            raw=raw.copy();ImageDraw.Draw(raw).rectangle((0,0,5,raw.height),fill='black');ImageDraw.Draw(raw).rectangle((raw.width-6,0,raw.width,raw.height),fill='black')
        im=luminous_alpha(raw,black_floor=8)
        m=alpha_metrics(im,threshold=24)
        if m.get('empty'):raise ValueError('EMPTY_CELL:'+scene+':'+str((x,y)))
        arr=np.array(im);a=arr[:,:,3];border=np.concatenate([a[0],a[-1],a[:,0],a[:,-1]])
        if border.max()>110:raise ValueError('CLIPPED_PAINT_CORE:'+scene+':'+str((x,y)))
        yy,xx=np.mgrid[:im.height,:im.width];distance=np.minimum.reduce([xx,yy,im.width-1-xx,im.height-1-yy])
        feather=np.clip(distance/10,0,1);trimmed=(distance<10)&(a<110)
        arr[:,:,3]=np.where(trimmed,np.round(a*feather),a).astype('uint8');im=Image.fromarray(arr)
        trims.append({'sourceBorderMaxAlpha':int(border.max()),'softHaloEdgeFeatherPx':10,'coreProtectedAlpha':110,
                      'alphaMassRemoved':round(float((a.astype(float)-arr[:,:,3]).sum()/255),3)})
        cells.append(im);rects.append(rect);metrics.append(m)
    # Register row/column placement drift with translation only. Common scale
    # preserves painted motion and does not inflate dimmer phases.
    cw=max(im.width for im in cells);ch=max(im.height for im in cells);registered=[];shifts=[]
    padded=[]
    for im in cells:
        c=Image.new('RGBA',(cw,ch));c.alpha_composite(im);padded.append(c)
    reference=np.array(padded[0].getchannel('A'),dtype=np.float32)
    for i,im in enumerate(padded):
        if scene=='glyph-proof' or scene=='floor-wreaths':dx=dy=0.;response=1.
        else:
            (dx,dy),response=cv2.phaseCorrelate(reference,np.array(im.getchannel('A'),dtype=np.float32))
            if abs(dx)>cw*.25 or abs(dy)>ch*.35 or response<.1:raise ValueError('REGISTRATION_UNCERTAIN:'+scene+':'+str(i))
        shifts.append({'translationPx':[-round(dx,3),-round(dy,3)],'phaseCorrelationResponse':round(response,5)})
        arr=cv2.warpAffine(np.array(im),np.float32([[1,0,cw/2-dx],[0,1,ch/2-dy]]),(cw*2,ch*2),flags=cv2.INTER_LINEAR)
        registered.append(Image.fromarray(arr))
    boxes=[im.getchannel('A').getbbox() for im in registered]
    bounds=[min(b[0] for b in boxes)-4,min(b[1] for b in boxes)-4,max(b[2] for b in boxes)+4,max(b[3] for b in boxes)+4]
    frames=[]
    for im in registered:
        crop=(im.crop(bounds).resize(target,Image.Resampling.LANCZOS) if scene=='threat-line'
              else ImageOps.contain(im.crop(bounds),target,Image.Resampling.LANCZOS))
        frame=Image.new('RGBA',(CELL,CELL));frame.alpha_composite(crop,((CELL-crop.width)//2,(CELL-crop.height)//2));frames.append(frame)
    SOURCE_GATES.append({'scene':scene,'job':j['id'],'source':j['archive'],'sha256':j['sha256'],
       'sheetSize':list(src.size),'grid':[cols,rows],'rects':rects,'metrics':metrics,'sharedCrop':bounds,
       'edgeTrims':trims,'registration':shifts,'excludedLayout':'5px cell-edge rules' if scene=='floor-wreaths' else None,
       'origin':'generated painting; authored black-matte extraction and common sheet affine fit',
       'aspectMapping':'shared anisotropic lane mapping to 308x110' if scene=='threat-line' else 'uniform contain'})
    return frames,j

def opacity(im,value):
    im=im.copy();im.putalpha(im.getchannel('A').point(lambda a:round(a*max(0,min(1,value)))));return im

def tint(im,color,strength=1):
    arr=np.asarray(im).astype(np.float32).copy()
    rgb=np.array([int(color[k:k+2],16) for k in (1,3,5)],dtype=np.float32)/255
    # Keep painted value modulation and selected white highlights.
    light=arr[:,:,:3].max(axis=2)/255
    mix=np.clip((light-.9)*3,0,.25)[:,:,None]
    arr[:,:,:3]*=(1-strength)+strength*(rgb[None,None,:]*(1-mix)+mix)
    return Image.fromarray(np.clip(arr,0,255).astype('uint8'))

def stamp(canvas,glyph,x,y,size,angle=0,color=None,alpha=1):
    im=glyph
    if color:im=tint(im,color)
    im=ImageOps.contain(im,(size,size),Image.Resampling.LANCZOS)
    if angle:im=im.rotate(angle,resample=Image.Resampling.BICUBIC,expand=True)
    if alpha!=1:im=opacity(im,alpha)
    canvas.alpha_composite(im,(round(x-im.width/2),round(y-im.height/2)))

def radial_glyphs(canvas,glyphs,sequence,radius=119,size=43,start=-90,sweep=360,color=None,alpha=1):
    for i,name in enumerate(sequence):
        a=math.radians(start+i*sweep/len(sequence))
        stamp(canvas,glyphs[name],192+radius*math.cos(a),192+radius*math.sin(a),size,-math.degrees(a)-90,color,alpha)

def dark_edge(im):
    # A local dark pigment under-edge gives contrast on pale sand. No new shape.
    edge=im.getchannel('A').filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(.65))
    under=Image.new('RGBA',im.size,(6,11,19,0));under.putalpha(edge.point(lambda a:round(a*.78)))
    under.alpha_composite(im);return under

def rank_map(kind):
    yy,xx=np.mgrid[:CELL,:CELL];x=xx+.5-192;y=yy+.5-192
    if kind=='angular':rank=np.mod(np.arctan2(y,x)+math.pi/2,math.tau)/math.tau
    elif kind=='arc':rank=np.clip((np.arctan2(y,x)+math.pi/2)/math.pi,0,1)
    elif kind=='fan':rank=np.clip((xx+.5-128)/150,0,1)
    else:rank=np.clip((xx+.5-38)/308,0,1)
    return Image.fromarray(np.round(rank*254+1).astype('uint8'),'L')

def reveal(im,p,reverse=False):
    arr=np.asarray(im).copy();rank=np.asarray(rank_map('angular')).astype(float)/255
    weight=np.clip((p-rank)*12+.5,0,1)
    if p<=0:weight[:]=0
    if p>=1:weight[:]=1
    if reverse:weight=1-weight
    arr[:,:,3]=np.round(arr[:,:,3]*weight).astype('uint8');return Image.fromarray(arr)

def painted_fan(im):
    """UV-warp generated brush pigment around an authored 90-degree fan path.

    This creates no synthetic visible outline. Every visible pigment pixel is
    sampled from the generated ring painting. The hidden UV domain is geometry.
    """
    import cv2
    yy,xx=np.mgrid[:CELL,:CELL];points=np.stack([xx,yy],axis=-1).astype(float)
    apex=np.array([128.,192.]);radius=150.;half=math.pi/4
    lower=apex+radius*np.array([math.cos(half),math.sin(half)])
    upper=apex+radius*np.array([math.cos(-half),math.sin(-half)])
    length=2*radius+2*half*radius
    def segment(a,b,offset):
        delta=b-a;t=np.clip(np.sum((points-a)*delta,axis=-1)/np.dot(delta,delta),0,1)
        nearest=a+t[:,:,None]*delta;distance=np.linalg.norm(points-nearest,axis=-1)
        return distance,(offset+t*np.linalg.norm(delta))/length
    d1,t1=segment(apex,upper,0)
    xy=points-apex;angle=np.clip(np.arctan2(xy[:,:,1],xy[:,:,0]),-half,half)
    nearest=apex+radius*np.stack([np.cos(angle),np.sin(angle)],axis=-1)
    d2=np.linalg.norm(points-nearest,axis=-1);t2=(radius+(angle+half)*radius)/length
    d3,t3=segment(lower,apex,radius+2*half*radius)
    distances=np.stack([d1,d2,d3]);ts=np.stack([t1,t2,t3]);index=np.argmin(distances,axis=0)
    distance=np.take_along_axis(distances,index[None],axis=0)[0];t=np.take_along_axis(ts,index[None],axis=0)[0]
    inside=(xy[:,:,0]>=0)&(np.abs(np.arctan2(xy[:,:,1],xy[:,:,0]))<=half)&(np.linalg.norm(xy,axis=-1)<=radius)
    rad=120+np.where(inside,-distance,distance)
    mapx=(192+rad*np.cos(t*math.tau)).astype('float32');mapy=(192+rad*np.sin(t*math.tau)).astype('float32')
    arr=cv2.remap(np.array(im),mapx,mapy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
    arr[distance>42]=0
    return Image.fromarray(arr)

def build():
    OUT.mkdir(parents=True,exist_ok=True);SOURCE_GATES.clear();pages=[];clips={};tiles=[];glyphs={}
    raw,j=extraction('glyph-proof',4,3,(256,256))
    # Glyph masters have individually trimmed paint bounds, unlike animation.
    for name,im in zip(NAMES,raw):
        box=im.getchannel('A').getbbox();glyphs[name]=im.crop(box)
    # Cell 9 resembles H and is excluded. Isolate the three disconnected painted
    # splinters above GATHER's bowl, then turn them downward as a warning ligature.
    from scipy import ndimage
    g=glyphs['gather'];arr=np.asarray(g).copy();labels,count=ndimage.label(arr[:,:,3]>110)
    ids=[]
    for ident in range(1,count+1):
        yy,xx=np.where(labels==ident)
        if len(xx)>25 and yy.mean()<g.height*.52:ids.append(ident)
    if not ids:raise ValueError('WARNING_SPLINTER_EXTRACTION_FAILED')
    seeds=np.isin(labels,ids);distance,near=ndimage.distance_transform_edt(~seeds,return_indices=True)
    keep=seeds[near[0],near[1]] & (distance<5)
    arr[~keep]=0;danger=Image.fromarray(arr);danger=danger.crop(danger.getbbox()).rotate(180)
    glyphs['danger']=danger
    for name in NAMES:saved(glyphs[name],OUT/'glyphs'/f'{name}.png')
    rows=[(n,glyphs[n]) for n in NAMES]
    contact(rows,OUT/'glyph-sheet.png','THE BROKEN OATH / twelve painted radicals',4,(320,260))
    write(OUT/'glyphs.json',{'schemaVersion':1,'source':j['archive'],'sourceSha256':j['sha256'],
       'glyphs':{n:{'file':relative(OUT/'glyphs'/f'{n}.png'),'sha256':sha(OUT/'glyphs'/f'{n}.png'),
       'anchor':[.5,.5],'origin':'generated painting; authored extraction' if n!='danger' else 'authored ligature from GATHER painted splinters; excluded letter-like source cell 9'} for n in NAMES},'ownerAccepted':False})

    def add(ident,frames,*,loop=False,duration=100,kind='decal',element=None,progress=None,origin=None,extra=None):
        frames=[dark_edge(f) for f in frames]
        page,rects=pack_frames(frames,OUT/'atlases'/f'{ident}.png',cols=min(6,len(frames)),cell=CELL,gutter=3)
        page['id']=ident;pages.append(page)
        clip={'page':ident,'frames':[{'rect':r,'durationMs':duration} for r in rects],
          'frameCount':len(frames),'anchor':[.5,.5],'loop':loop,'frameDurationMs':duration,'kind':kind,
          'blend':'source-over','glowBlend':'lighter optional secondary pass <=0.2 opacity',
          'plane':'unprojected ground','element':element,'nominalBoundaryRadiusUV':.36,
          'designFrameSize1080':[160,160],'origin':origin or 'generated contour keys + canonical generated glyph cutouts; authored assembly',
          'progress':progress,'ownerAccepted':False}
        if extra:clip.update(extra)
        clips[ident]=clip;tiles.append((ident,frames[min(len(frames)-1,1)]))
        return clip

    for element in ELEMENTS:
        frames,j=extraction('casting-'+element,3,2)
        seq=[element,'gather','bind',element,'open','release',element,'endure']
        for i,im in enumerate(frames):
            radial_glyphs(im,glyphs,seq,116,41,color=ELEMENTS[element]['color'])
        for phase,indices,loop in [('start',[0]*6,False),('hold',[0,1,2,3,4,5,4,3,2,1],True),('release',[0]*6,False)]:
            if phase=='start':keys=[reveal(frames[0],p) for p in (0,.15,.35,.6,.85,1)]
            elif phase=='release':keys=[opacity(reveal(frames[0],p,True),a) for p,a in [(0,1),(.1,.9),(.3,.75),(.55,.55),(.8,.25),(1,0)]]
            else:keys=[frames[i] for i in indices]
            add('cast.'+element+'.'+phase,keys,loop=loop,duration=100,element=element,kind='casting',
                origin='generated six-key hold painting + canonical glyphs; authored start reveal, hold ping-pong, release dissolve',
                extra={'generatedSource':j['archive'],'sourceIndices':indices,'generatedUniqueKeys':6 if phase=='hold' else 1,
                  'authoredFrames':'angular ignition/dissolve and transparent endpoints; hold ping-pong playback','hideAfterEnd':not loop,'defaultWorldDiameterMetres':4.8})

    for kind in ('angular','linear','arc','fan'):
        saved(rank_map(kind),OUT/'masks'/f'{kind}-rank.png')
    threat_masters={}
    for shape in ('ring','cone','line'):
        if shape=='cone':
            frames=[painted_fan(f) for f in threat_masters['ring']];j=source('threat-ring')
        else:frames,j=extraction('threat-'+shape,3,2,(308,110) if shape=='line' else (308,308))
        threat_masters[shape]=frames
        for element in ELEMENTS:
            out=[]
            for im in frames:
                im=tint(im,ELEMENTS[element]['color'])
                if shape=='ring':
                    radial_glyphs(im,glyphs,[element,'danger',element,'gather',element,'danger',element,'release'],115,40,color=ELEMENTS[element]['color'])
                elif shape=='cone':
                    for x,y,n in [(170,192,element),(213,138,element),(213,246,'gather'),(248,192,element)]:
                        stamp(im,glyphs[n],x,y,35,color=ELEMENTS[element]['color'])
                else:
                    for x in (94,157,220,283):stamp(im,glyphs[element],x,192,37,color=ELEMENTS[element]['color'])
                out.append(im)
            add('threat.'+element+'.'+shape,out+[out[-2],out[-3],out[-4],out[-5]],loop=True,duration=90,kind='telegraph',element=element,
               progress={'mask':relative(OUT/'masks'/('angular-rank.png' if shape=='ring' else 'fan-rank.png' if shape=='cone' else 'linear-rank.png')),
                 'method':'persistent dim full perimeter plus threshold-lit painted pixels','empty':0,'full':1,'baseOpacity':.40,'filledOpacity':1,
                 'input':'clamp((simulationNow-telegraphStart)/(impactAt-telegraphStart),0,1); game owns all times'},
               extra={'shape':shape,'warningOverlay':'warning.normal','generatedSource':j['archive'],'generatedUniqueKeys':6,
                 'anchor':[1/3,.5] if shape=='cone' else [.1,.5] if shape=='line' else [.5,.5],
                 'nominalRangeUV':150/384 if shape=='cone' else .8,
                 'construction':'authored UV warp of generated ring pigment around fan perimeter; canonical glyph inlays' if shape=='cone' else 'generated boundary painting with canonical glyph inlays',
                 'sourceIndices':[0,1,2,3,4,5,4,3,2,1],'nominalConeDegrees':90 if shape=='cone' else None,
                 'geometry':'visual envelope only; engine-authored shape remains collision authority'})

    # Warnings are independently composited: tinting the school NEVER recolours them.
    for typ in ('normal','unblockable'):
        base=Image.new('RGBA',(CELL,CELL))
        stamp(base,glyphs['danger'],192,192,222,color='#a53350')
        stamp(base,glyphs['danger'],192,192,195,color='#fff0d4')
        if typ=='unblockable':
            stamp(base,glyphs['sever'],192,192,278,color='#e85270')
            for x in (93,291):stamp(base,glyphs['danger'],x,188,85,color='#fff0d4')
        seq=[.78,.94,1,.94,.78,.68] if typ=='normal' else [.72,1,.72,.96,.72,.72]
        add('warning.'+typ,[opacity(base,a) for a in seq],loop=True,duration=90,kind='warning',
           origin='canonical generated glyph pixels; authored composition and luminance pulse',
           extra={'plane':'screen billboard','designFrameSize1080':[56,56] if typ=='normal' else [72,72],
                  'neverElementTint':True,'shapeCue':'single warning tooth' if typ=='normal' else 'torn binding flanked by two warning teeth',
                  'appliesTo':['ring','cone','line'],'unblockable':typ=='unblockable'})

    frames,j=extraction('ward-arc',3,2)
    for im in frames:
        a=np.array(im.getchannel('A'));a[:,:192]=0;im.putalpha(Image.fromarray(a))
        radial_glyphs(im,glyphs,['bind','endure','gather','bind','endure','open'],121,45,-78,187,color='#b5e6ec')
    add('ward.hold',frames+frames[-2:0:-1],loop=True,kind='ward',duration=90,
        progress={'mask':relative(OUT/'masks/arc-rank.png'),'method':'glyph ignition along arc','baseOpacity':.32,'filledOpacity':1},
        extra={'generatedSource':j['archive'],'generatedUniqueKeys':6,'sourceIndices':[0,1,2,3,4,5,4,3,2,1],
           'visualArcDegrees':180,'gameArcDegreesDefault':140,'aim':'local +X; rotate before ground projection','rearOpen':True,
           'authoredCrop':'strict right-half isolation of generated longer crescent; left-side source tips excluded'})
    for phase,seq in [('start',[0,.3,.65,1]),('release',[1,.6,.2,0])]:
        add('ward.'+phase,[opacity(frames[0],a) for a in seq],duration=65,kind='ward',
            origin='generated ward key; authored ignition/dissolve',extra={'hideAfterEnd':True,'gameArcDegreesDefault':140,'rearOpen':True})
    perfect,j=extraction('perfect-ring',3,2,(250,250))
    for im in perfect:radial_glyphs(im,glyphs,['open','gather','open','release'],88,34,color='#f4fbff')
    add('absorb.perfect',perfect,duration=50,kind='perfect',extra={'generatedSource':j['archive'],'generatedUniqueKeys':6,
       'gameGate':'one-shot ONLY on confirmed perfect-absorb event; time supplied by simulation','designFrameSize1080':[120,120],'hideAfterEnd':True})
    add('absorb.window',[perfect[i] for i in [1,2,1]],duration=80,kind='perfect-window',loop=True,
        origin='three references to two generated inner-ring keys; authored loop',extra={'generatedUniqueKeys':2,
        'gameGate':'visible ONLY while perfectWindowActive; hide immediately when false','designFrameSize1080':[112,112]})
    add('absorb.contact',[opacity(frames[i],a) for i,a in [(2,.75),(3,1),(4,.85),(1,.55)]],duration=55,kind='ward',
       origin='selected generated ward keys; authored contact brightness sequence',extra={'trigger':'confirmed incoming-energy contact event','rearOpen':True,'hideAfterEnd':True})

    floors,j=extraction('floor-wreaths',3,1,(320,320))
    for palette,im in zip(('verdigris','rust-sand','moonlit'),floors):
        im=opacity(im,.20)
        radial_glyphs(im,glyphs,['bind','fire','endure','water','witness','earth','open','air'],113,43,alpha=.64)
        add('floor.'+palette,[opacity(im,a) for a in (.35,.37,.39,.37)],loop=True,duration=900,kind='floor',
            origin='one generated floor wreath + canonical glyphs; authored subtle four-state luminance loop',
            extra={'generatedSource':j['archive'],'generatedUniqueKeys':1,'designFrameSize1080':[300,300],'combatPriority':'lowest; dim during overlapping threat'})

    for name,seq,color in [('selection',['open','witness','open','witness'],'#b9ebc6'),('target',['witness','danger','witness','danger'],'#ffae90')]:
        frames=[]
        for im in threat_masters['ring']:
            im=opacity(tint(im,color),.6);radial_glyphs(im,glyphs,seq,123,52,color=color);frames.append(im)
        add(name,frames+frames[-2:0:-1],loop=True,duration=150,kind='selection',extra={'designFrameSize1080':[100,100],
              'shapeCue':'open outward bowls' if name=='selection' else 'inward watch and warning teeth','generatedUniqueKeys':6})
    status={'slowed':('water','bind','#9ad7ee'),'rooted':('earth','bind','#d6bd77'),
       'burning':('fire','release','#ffa657'),'wet':('water','gather','#75d9f4'),'shielded':('bind','endure','#b7e5de')}
    for name,(a,b,color) in status.items():
        im=Image.new('RGBA',(CELL,CELL));stamp(im,glyphs[a],168,178,225,color=color);stamp(im,glyphs[b],252,252,105,color=color)
        add('status.'+name,[opacity(im,a) for a in (.78,.9,1,.9)],loop=True,duration=220,kind='status',
          origin='two canonical generated glyph cutouts; authored ligature and luminance animation',
          extra={'plane':'screen billboard','designFrameSize1080':[36,36],'radicals':[a,b],'showOnlyWhen':'simulation status flag is true'})
    for name,seq in [('collar',['bind','endure','witness','open']),('wardstone',['bind','witness','endure','bind'])]:
        im=Image.new('RGBA',(CELL,CELL))
        if name=='collar':radial_glyphs(im,glyphs,seq,118,72)
        else:
            for i,n in enumerate(seq):stamp(im,glyphs[n],192,68+i*80,76)
        add('inscription.'+name,[im],kind='inscription',origin='canonical generated glyphs; authored inscription construction',
            extra={'designFrameSize1080':[96,96],'plane':'host surface UV; no automatic ground projection'})

    write(OUT/'sigils.json',{'schemaVersion':1,'id':'covenant-broken-oath-a13','status':'owner-review','paths':'repository-root-relative',
       'pages':pages,'clips':clips,'glyphs':'art/delivery/a13/glyphs.json','scaleContract':'art/scale-contract-v3.json',
       'alpha':'straight RGBA sRGB; premultiply exactly once at upload','maskChannel':'8-bit linear R, 1..255 rank; never sRGB-decode data masks',
       'projection':'rotate in unprojected XY, then ground Y *= sin(55deg); screen status/warning icons stay upright',
       'elementTints':{n:v['color'] for n,v in ELEMENTS.items()},
       'dangerLanguage':{'common':'ivory warning tooth on carmine dark-edge ink','unblockable':'severed binding with paired teeth and double beat; never depend on hue'},
       'hitGeometry':'engine data ONLY; art texture, glow and authored fill masks never affect collisions','ownerAccepted':False})
    write(OUT/'source-gates.json',{'sources':SOURCE_GATES,'ownerAccepted':False})
    contact(tiles,OUT/'atlas-contact.jpg','A13 / painted decals and authored playback',4,(350,300))
    v3=read(ART/'scale-contract-v2.json');v3['version']='scale-contract-v3';v3['authority']='D32: figures drawn 50 percent larger; A12 compact footprint; camera scale unchanged'
    c=v3['character'];c['draw_multiplier_from_v2']=1.5
    for key in ('screen_height_fraction','nominal_px_at_1080p','nominal_px_at_1440p'):c[key]*=1.5
    for key in ('screen_height_fraction_range','pixels_at_1080p','pixels_at_1440p'):c[key]=[v*1.5 for v in c[key]]
    v3['formulas']['body_height_px']='height * 0.05625';v3['arena_metres']=[94,62]
    v3['arenaGeometryAuthority']='art/delivery/a12/geometry.json; art proposal accepted D31, game migration owns runtime balance'
    write(ART/'scale-contract-v3.json',v3)
    print('A13 built:',len(clips),'clips;',sum(c['frameCount'] for c in clips.values()),'frame references;',len(SOURCE_GATES),'generated sources')

if __name__=='__main__':build()
