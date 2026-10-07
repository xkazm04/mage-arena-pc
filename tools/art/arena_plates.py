"""A12 coherent plate restoration, native proofs and portable runtime data.

No generation, no hidden replacement of the game boundary. Deterministic local
masking/upscaling/compositing is explicitly authorized by the A12 owner brief.
"""
import argparse
import math
import json
import html
import numpy as np
from scipy import ndimage
from PIL import Image, ImageDraw, ImageFilter, ImageOps
from common import ART, ROOT, read, write, sha, relative, digest
from covenant import font
from restoration_common import saved

OUT=ART/'delivery/a12'; WAVE=ART/'waves/A12'; REVIEW=ART/'review/a12'
PALETTES=('verdigris','rust-sand','moonlit')
SIN=math.sin(math.radians(55))

def enhanced(im,size):
    """Resampling and mild edge contrast only; never claim new resolved detail."""
    return im.convert('RGB').resize(tuple(size),Image.Resampling.LANCZOS).filter(
        ImageFilter.UnsharpMask(radius=1.0,percent=40,threshold=3))

def restore(concept,generated,boxes,feather):
    src=np.asarray(concept.convert('RGB'),dtype=np.float32)
    gen=np.asarray(generated.convert('RGB').resize(concept.size,Image.Resampling.LANCZOS),dtype=np.float32)
    result=src.copy(); union=np.zeros(src.shape[:2],dtype=np.float32); measures=[]
    w,h=concept.size
    for box in boxes:
        x0,y0,x1,y1=[round(v*(w if i%2==0 else h)) for i,v in enumerate(box)]
        mask=Image.new('L',(w,h));ImageDraw.Draw(mask).rounded_rectangle((x0,y0,x1,y1),radius=10,fill=255)
        inside=np.asarray(mask)>0
        distance=ndimage.distance_transform_edt(~inside)
        alpha=np.clip(1-distance/feather,0,1)
        # Smoothstep with flat endpoints prevents a hard derivative at the join.
        alpha=alpha*alpha*(3-2*alpha)
        ring=(distance>=feather)&(distance<feather+12)
        correction=np.clip(np.median(src[ring]-gen[ring],axis=0),-24,24)
        patched=np.clip(gen+correction,0,255)
        result=result*(1-alpha[:,:,None])+patched*alpha[:,:,None]
        union=np.maximum(union,alpha)
        measures.append({'boxSourcePx':[x0,y0,x1,y1], 'ringColourCorrectionRGB':correction.tolist(),
            'method':'median RGB difference in outer clean annulus, capped +/-24; smoothstep exterior feather'})
    return Image.fromarray(np.round(result).astype('uint8')),Image.fromarray(np.round(union*255).astype('uint8')),measures

def autocorrelation(im):
    a=np.asarray(im.convert('L').resize((768,432),Image.Resampling.LANCZOS),dtype=np.float64)
    # Suppress broad light gradients. Test texture repetition over meaningful lags.
    a=a-ndimage.gaussian_filter(a,8)
    rows=[]
    for axis in (0,1):
        scores=[]
        for lag in range(40,a.shape[axis]//2+1,2):
            left=a[:-lag,:] if axis==0 else a[:,:-lag]
            right=a[lag:,:] if axis==0 else a[:,lag:]
            corr=float((left*right).sum()/max(math.sqrt(float((left*left).sum()*(right*right).sum())),1e-8))
            scores.append((corr,lag))
        value,lag=max(scores)
        rows.append({'axis':'y' if axis==0 else 'x','peak':round(value,6),'lagAt768x432':lag})
    return {'method':'mean-normalized highpass cross-correlation over overlapping lagged pixels; lags 40..half dimension, step 2',
        'axes':rows,'flagThreshold':.12,'repetitionFlag':any(r['peak']>.12 for r in rows),
        'thresholdCalibration':'all three A9 repeated-layout controls peak >=0.19; A6 controls <=0.017; 0.12 separates this small evidence set, not universal validation',
        'interpretation':'diagnostic only; does not prove absence of visible repetition, requires direct review'}

def pixel_metrics(concept,plate,mask):
    a=np.asarray(concept.convert('RGB'),dtype=float)/255
    b=np.asarray(plate.convert('RGB'),dtype=float)/255
    m=np.asarray(mask)/255
    lum=np.array([.2126,.7152,.0722]);la=a@lum;lb=b@lum
    border=(m>0)&(m<1);outside=m==0
    gradient=np.hypot(ndimage.sobel(lb,axis=0),ndimage.sobel(lb,axis=1))
    control=np.hypot(ndimage.sobel(la,axis=0),ndimage.sobel(la,axis=1))
    ratio=float(np.percentile(gradient[border],95)/max(np.percentile(control[border],95),1e-6))
    return {'meanEncodedLuminanceConcept':round(float(la.mean()),6),'meanEncodedLuminancePlate':round(float(lb.mean()),6),
        'meanLuminanceDelta':round(float(lb.mean()-la.mean()),6),'meanRGBDelta':np.round((b-a).mean(axis=(0,1)),6).tolist(),
        'preservedPixelFraction':round(float(outside.mean()),6),'maximumByteDifferenceOutsideMask':int(np.max(abs(b[outside]-a[outside]))*255),
        'patchJoinP95GradientRatioToConcept':round(ratio,6),'patchJoinFlag':ratio>1.8,
        'extensionSeams':{'status':'not applicable','joinCount':0,'reason':'one painting, no extension panels'},
        'thresholds':{'meanLuminanceAbsoluteDelta':.035,'meanRGBAbsoluteDelta':.035,'patchJoinGradientRatio':1.8},
        'driftFlag':bool(abs(lb.mean()-la.mean())>.035 or np.max(abs((b-a).mean(axis=(0,1))))>.035),
        'thresholdAuthority':'authored diagnostics, not calibrated perceptual acceptance'}

def wide_metrics(concept,plate):
    # Concept corresponds to the original centre five-sixths of the wide master.
    w,h=plate.size
    centre=plate.crop((w/12,h/12,w*11/12,h*11/12)).resize(concept.size,Image.Resampling.LANCZOS)
    a=np.asarray(concept,dtype=float)/255;b=np.asarray(centre,dtype=float)/255
    lum=np.array([.2126,.7152,.0722]);delta=(b-a).mean(axis=(0,1))
    grey=np.asarray(plate.convert('L'),dtype=float)
    seams=[]
    for axis,points in ((1,[w/12,w*11/12]),(0,[h/12,h*11/12])):
        dif=np.abs(np.diff(grey,axis=axis))
        for point in points:
            i=round(point);line=dif[:,max(0,i-2):i+2] if axis==1 else dif[max(0,i-2):i+2,:]
            band=dif[:,max(0,i-18):i+18] if axis==1 else dif[max(0,i-18):i+18,:]
            ratio=float(np.mean(line)/max(float(np.mean(band)),.001))
            seams.append({'axis':'x' if axis==1 else 'y','sourceCoordinate':i,'gradientRatioToNeighbourhood':round(ratio,5),'flag':ratio>1.8})
    return {'conceptCropInPlateNormalized':[1/12,1/12,5/6,5/6],
        'meanEncodedLuminanceConcept':round(float((a@lum).mean()),6),'meanEncodedLuminancePlate':round(float((b@lum).mean()),6),
        'meanLuminanceDelta':round(float(delta@lum),6),'meanRGBDelta':np.round(delta,6).tolist(),
        'driftFlag':bool(max(abs(delta))>.065 or abs(delta@lum)>.065),
        'thresholds':{'meanRGBOrLuminanceAbsoluteDelta':.065,'joinGradientRatio':1.8},
        'extensionSeams':{'assemblyJoinCount':0,'strategy':'one coherent regenerated wide painting, no assembled panels',
          'guideBoundaryChecks':seams,'flag':any(s['flag'] for s in seams)},
        'thresholdAuthority':'authored routing diagnostics; not calibrated perceptual acceptance; removes bright figures so some drift is expected'}

def match_environment_colour(master,concept,palette):
    """One whole-image grade, measured away from original combatants; no patches."""
    old=read(WAVE/'rejected-masked-trial/restoration-plan.json')['palettes'][palette]
    mask=Image.new('L',concept.size);draw=ImageDraw.Draw(mask)
    for box in old['removalBoxes']:
        rect=[round(v*(concept.width if i%2==0 else concept.height)) for i,v in enumerate(box)]
        draw.rectangle((rect[0]-16,rect[1]-16,rect[2]+16,rect[3]+16),fill=255)
    valid=np.asarray(mask)==0
    w,h=master.size;centre=master.crop((w/12,h/12,w*11/12,h*11/12)).resize(concept.size,Image.Resampling.LANCZOS)
    a=np.asarray(concept,dtype=float);b=np.asarray(centre,dtype=float)
    gains=np.clip(a[valid].mean(axis=0)/np.maximum(b[valid].mean(axis=0),1),.8,1.25)
    pixels=np.asarray(master,dtype=float)*gains
    output=Image.fromarray(np.round(np.clip(pixels,0,255)).astype('uint8'))
    return output,{'method':'single whole-image RGB gain from mean approved/reference-centre environment; original figure boxes excluded from measurement; never composited',
        'gainRGB':gains.tolist(),'gainLimits':[.8,1.25],'clippedChannelFraction':float((pixels>255).mean()),'measurementMaskExcludedFraction':float((~valid).mean())}

def world_from_uv(uv,geo):
    return [geo['plate']['worldTopLeftMetres'][i]+uv[i]*geo['plate']['worldSizeMetres'][i] for i in (0,1)]

def make_occluders(master,palette,geo):
    plan=read(WAVE/'occluders.json')['palettes'][palette]; rows=[]
    for obj in plan:
        mask=Image.new('L',master.size)
        points=[(round(x*master.width),round(y*master.height)) for x,y in obj['polygonUV']]
        ImageDraw.Draw(mask).polygon(points,fill=255)
        mask=mask.filter(ImageFilter.GaussianBlur(.65))
        box=mask.getbbox();sprite=master.convert('RGBA').crop(box);sprite.putalpha(mask.crop(box))
        info=saved(sprite,OUT/'occluders'/f'{palette}-{obj["id"]}.png')
        bx,by=[obj['baseUV'][i]*master.size[i] for i in (0,1)]
        rows.append({'id':obj['id'],**info,'cropMasterPx':[box[0],box[1],box[2]-box[0],box[3]-box[1]],
          'anchorPx':[round(bx-box[0],4),round(by-box[1],4)],'baseLineMasterPx':round(by,4),
          'baseWorldMetres':world_from_uv(obj['baseUV'],geo),'depthSort':'baseWorldMetres[1]',
          'purpose':'fixed-position foreground depth overlay; copied from this same plate, never moved or repeated',
          'backgroundContainsSameObject':True,'extraction':'authored silhouette polygon plus 0.65 master-pixel edge feather; RGB is byte-identical to plate crop',
          'collision':'none authored; game owns obstruction policy','polygonUV':obj['polygonUV']})
    return rows

def frame_from(page,clip,index=0):
    x,y,w,h=clip['frames'][index%len(clip['frames'])]['rect']
    im=page.crop((x,y,x+w,y+h))
    return ImageOps.mirror(im) if clip.get('mirrorX') else im

def crop_view(master,w,h,geo,centre=None):
    centre=centre or geo['camera']['proof_centre_metres']
    scale=h/1440;view=master.resize((round(master.width*scale),round(master.height*scale)),Image.Resampling.LANCZOS)
    pp=22.5*h/1080
    x=round((view.width-w)/2+(centre[0]-16)*pp)
    y=round((view.height-h)/2+(centre[1]-62)*pp*SIN)
    if x<0 or y<0 or x+w>view.width or y+h>view.height:raise ValueError('CAMERA_EXPOSES_UNPAINTED_EDGE')
    return view.crop((x,y,x+w,y+h))

def composite(master,palette,occluders,w,h,geo,extra_actors=None,centre=None):
    centre=centre or geo['camera']['proof_centre_metres'];s=h/1080
    canvas=crop_view(master,w,h,geo,centre).convert('RGBA')
    chars=read(ART/'delivery/a10/characters.json');fx=read(ART/'delivery/a8/effects.json')
    cp={p['id']:Image.open(ROOT/p['file']).convert('RGBA') for p in chars['pages']}
    ep={p['id']:Image.open(ROOT/p['file']).convert('RGBA') for p in fx['pages']}
    witnesses=read(WAVE/'proof-witnesses.json')['actors']
    actors=extra_actors if extra_actors is not None else witnesses
    layers=[];records=[]
    def screen(pos):return [w/2+(pos[0]-centre[0])*22.5*s,h/2+(pos[1]-centre[1])*22.5*s*SIN]
    for row in actors:
        ent=chars['entities'][row['entity']]; clip=ent['clips'][row['state']][row['facing']]
        im=frame_from(cp[clip['page']],clip,row.get('frame',0))
        size=[round(v*s) for v in ent['designSize1080']];im=im.resize(size,Image.Resampling.LANCZOS)
        pos=world_from_uv(row['footUV'],geo) if 'footUV' in row else row['positionMetres']
        foot=screen(pos);offset=[round(foot[i]-size[i]*ent['anchor'][i]) for i in (0,1)]
        # Disclosed light contact shadow; no recolouring/repainting of A10 figures.
        shadow=Image.new('RGBA',canvas.size);d=ImageDraw.Draw(shadow)
        d.ellipse((foot[0]-12*s,foot[1]-3*s,foot[0]+12*s,foot[1]+3*s),fill=(3,6,9,100))
        canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(1.5*s)))
        layers.append((pos[1],im,offset));records.append({**row,'positionMetres':pos,'bodyHeightPx':40.5*s,'atlasFrame':clip['frames'][row.get('frame',0)%len(clip['frames'])]})
    for obj in occluders:
        im=Image.open(ROOT/obj['file']).convert('RGBA');im=im.resize((max(1,round(im.width*h/1440)),max(1,round(im.height*h/1440))),Image.Resampling.LANCZOS)
        foot=screen(obj['baseWorldMetres']);offset=[round(foot[i]-obj['anchorPx'][i]*h/1440) for i in (0,1)]
        layers.append((obj['baseWorldMetres'][1],im,offset))
    for _,im,offset in sorted(layers,key=lambda r:r[0]):canvas.alpha_composite(im,tuple(offset))
    if extra_actors is None:
        for row in read(WAVE/'proof-witnesses.json')['effects']:
            clip=fx['clips'][row['clip']];im=frame_from(ep[clip['page']],clip,row['frame'])
            size=[round(v*s) for v in clip['designSize1080']];im=im.resize(size,Image.Resampling.LANCZOS)
            foot=screen(world_from_uv(row['footUV'],geo));anchor=clip.get('anchor',[.5,.5]);offset=[round(foot[i]-size[i]*anchor[i]) for i in (0,1)]
            # Respect source-over versus emitted-light blend from A8 metadata.
            if clip['blend']=='lighter':
                layer=Image.new('RGBA',canvas.size);layer.alpha_composite(im,tuple(offset))
                rgb=np.asarray(canvas).copy();a=np.asarray(layer,dtype=float)
                rgb[:,:,:3]=np.minimum(255,rgb[:,:,:3].astype(float)+a[:,:,:3]*(a[:,:,3:4]/255)).astype('uint8')
                canvas=Image.fromarray(rgb)
            else:canvas.alpha_composite(im,tuple(offset))
    return canvas.convert('RGB'),records

def pair(a,b,title_left,title_right,path):
    sheet=Image.new('RGB',(a.width+b.width,a.height+64),'#0d161e');d=ImageDraw.Draw(sheet)
    d.text((20,16),title_left,font=font(24),fill='#e0dfd5');d.text((a.width+20,16),title_right,font=font(24),fill='#e0dfd5')
    sheet.paste(a,(0,64));sheet.paste(b,(a.width,64));saved(sheet,path)

def build():
    config=read(WAVE/'restoration-plan.json');geo=read(OUT/'geometry.json');palettes={};proofs=[]
    usages={j['id']:j for j in read(ART/'usage.json')['jobs']}
    contacts=[]
    for palette in PALETTES:
        spec=config['palettes'][palette];job=usages[spec['generatedJob']]
        if job['status']!='generated':raise ValueError('SOURCE_NOT_GENERATED')
        if sha(ROOT/spec['concept'])!=spec['conceptSha256'] or sha(ROOT/job['archive'])!=job['sha256']:raise ValueError('SOURCE_CHANGED')
        concept=Image.open(ROOT/spec['concept']).convert('RGB');generated=Image.open(ROOT/job['archive']).convert('RGB')
        plate=generated
        native=saved(plate,OUT/'native'/f'{palette}.png')
        upscale=read(WAVE/'upscaled'/f'{palette}.json')
        if upscale['sourceSha256']!=sha(ROOT/job['archive']) or sha(ROOT/upscale['output'])!=upscale['outputSha256']:raise ValueError('UPSCALE_PROVENANCE_MISMATCH')
        master=Image.open(ROOT/upscale['output']).convert('RGB')
        master,colour_grade=match_environment_colour(master,concept,palette)
        record=saved(master,OUT/'plates'/f'{palette}.png')
        overlays=make_occluders(master,palette,geo)
        metric=wide_metrics(concept,master)
        metric['rawGenerationDrift']=wide_metrics(concept,plate)
        metric['wholePlateColourGrade']=colour_grade
        metric['autocorrelation']=autocorrelation(master)
        metric['a6ControlAutocorrelation']=autocorrelation(concept)
        metric['a9ControlAutocorrelation']=autocorrelation(Image.open(ART/'delivery/a9/proofs'/f'{palette}-1920.png'))
        record.update({'palette':palette,'offsetWorldMetres':geo['plate']['worldTopLeftMetres'],
          'worldSizeMetres':geo['plate']['worldSizeMetres'],'preprojected':True,'repeat':False,
          'nativeRestoration':native,'occluders':overlays,
          'provenance':{'concept':spec['concept'],'conceptSha256':spec['conceptSha256'],'conceptNativeSize':list(concept.size),
            'generated':job['archive'],'generatedSha256':job['sha256'],'generatedNativeSize':list(generated.size),'job':job['id'],
            'method':config['method'],'upscaleEvidence':relative(WAVE/'upscaled'/f'{palette}.json'),
            'pixelPreserving':False,'outpaintGuide':job['input']['references'][0],'wholePlateColourGrade':colour_grade},
          'density':{'exportTexelsPerDisplayPixel1080':4/3,'exportTexelsPerDisplayPixel1440':1,
            'generatedSourcePixelsPerDisplayPixel1080':generated.width/2304,'generatedSourcePixelsPerDisplayPixel1440':generated.width/3072,
            'upscale':'35% local learned restoration + 65% Lanczos; exported density is not native resolved detail; full model/source/licence in separate evidence'},
          'quality':{'owner_accepted':False,'status':'owner-review','limits':['lower native resolution than A6; fine crack and rune geometry drift','under-figure floor and overscan architecture are inferred','local learned pass changes microtexture','compact geometry needs game migration','static light does not relight moving actors']}})
        palettes[palette]=record
        write(OUT/'metrics'/f'{palette}.json',metric)
        for w,h in ((1920,1080),(2560,1440)):
            view=crop_view(master,w,h,geo);refview=concept.resize((w,h),Image.Resampling.LANCZOS)
            comp,witnesses=composite(master,palette,overlays,w,h,geo)
            saved(view,OUT/'proofs'/f'{palette}-plate-{h}.png');saved(comp,OUT/'proofs'/f'{palette}-composite-{h}.png')
            pair(refview,view,f'A6 approved concept / {w} x {h}',f'A12 clean plate / {w} x {h}',OUT/'proofs'/f'{palette}-comparison-{h}.png')
            # Crop actual final pixels, with no subsequent scaling.
            crops=Image.new('RGB',(1280,1152));draw=ImageDraw.Draw(crops)
            # Third pair includes a foreground pylon: architecture as well as floor.
            obj=overlays[0];uv=[(obj['baseWorldMetres'][i]-geo['plate']['worldTopLeftMetres'][i])/geo['plate']['worldSizeMetres'][i] for i in (0,1)]
            structure=((uv[0]-1/12)*6/5,(uv[1]-1/12)*6/5-.09)
            for i,(u,v) in enumerate(((.5,.17),(.63,.57),structure)):
                x=max(0,min(w-640,round(u*w-320)));y=max(0,min(h-352,round(v*h-176)))
                a=refview.crop((x,y,x+640,y+352));b=view.crop((x,y,x+640,y+352))
                crops.paste(a,(0,i*384+32));crops.paste(b,(640,i*384+32))
                draw.text((12,i*384+5),f'A6 native crop [{x},{y},640,352]',font=font(18),fill='white')
                draw.text((652,i*384+5),f'A12 native crop / {h}p',font=font(18),fill='white')
            saved(crops,OUT/'proofs'/f'{palette}-native-crops-{h}.png')
            proofs.append({'palette':palette,'viewportPx':[w,h],'cameraCentre':geo['camera']['proof_centre_metres'],
                'actors':witnesses,'effects':read(WAVE/'proof-witnesses.json')['effects'],'nativeCropSizePx':[640,352],
                'composite':relative(OUT/'proofs'/f'{palette}-composite-{h}.png'), 'source':'A10 characters and A8 effects loaded from delivery manifests'})
            if h==1080:contacts.append((palette,refview,view,comp))
        # Show correct depth ordering on both sides of each baseline, no effects.
        for obj in overlays:
            foot=obj['baseWorldMetres'];centre=[max(geo['camera']['clamp_centre_metres'][0][i],min(geo['camera']['clamp_centre_metres'][1][i],foot[i])) for i in (0,1)]
            actors=[{'entity':'cassia','state':'idle','facing':'se','frame':0,'positionMetres':[foot[0],foot[1]-.9]}]
            behind,_=composite(master,palette,overlays,1920,1080,geo,actors,centre)
            actors[0]['positionMetres']=[foot[0],foot[1]+.9]
            front,_=composite(master,palette,overlays,1920,1080,geo,actors,centre)
            x=round(960+(foot[0]-centre[0])*22.5);y=round(540+(foot[1]-centre[1])*22.5*SIN)
            rect=(x-160,y-230,x+160,y+90)
            pair(behind.crop(rect),front.crop(rect),'Behind base line','In front of base line',OUT/'proofs'/f'{palette}-{obj["id"]}-occlusion.png')
    manifest={'schemaVersion':1,'id':'covenant-arena-plates-a12','status':'owner-review','paths':'repository-root-relative',
        'geometry':'art/delivery/a12/geometry.json','geometrySha256':sha(OUT/'geometry.json'),
        'paletteForGames':geo['paletteForGames'],'palettes':palettes,
        'renderOrder':['single preprojected opaque plate','ground contact shadows','actors and fixed-position occluder depth overlays sorted by foot world Y','A8 effects using declared blend'],
        'legacyLayoutCompatible':False,'requiredLayout':'a12-compact-single-plate','owner_accepted':False,
        'gameIntegration':'not performed; reference loader and proofs only'}
    write(OUT/'arena-plates.json',manifest);write(OUT/'proofs.json',proofs)
    sheet=Image.new('RGB',(1920,3*420+85),'#0c151c');d=ImageDraw.Draw(sheet)
    d.text((20,18),'A12 / Coherent arena plates / Owner review',font=font(30),fill='#e5e1d6')
    for row,(palette,a,b,c) in enumerate(contacts):
        for col,(im,label) in enumerate(((a,'APPROVED A6'),(b,'A12 CLEAN PLATE'),(c,'A12 + A10 + A8'))):
            sheet.paste(im.resize((640,360),Image.Resampling.LANCZOS),(col*640,85+row*420+30))
            d.text((col*640+12,85+row*420),palette+' / '+label,font=font(20),fill='#e5e1d6')
    REVIEW.mkdir(parents=True,exist_ok=True);sheet.save(REVIEW/'contact-sheet.jpg',quality=93)
    print(json.dumps({'palettes':list(palettes),'occluders':sum(len(p['occluders']) for p in palettes.values()),'proofs':len(proofs)}))

if __name__=='__main__':build()
