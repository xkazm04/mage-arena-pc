"""A9 native-density terrain, modular keyed scenery and explicit layout proof."""
import argparse
import math
import numpy as np
from PIL import Image,ImageDraw,ImageOps,ImageFilter
from common import ART,ROOT,read,write,sha,relative
from covenant import jobs,board,font
from restoration_common import isolated_sheet,adaptive_magenta,alpha_metrics,saved,extras,contact

OUT=ART/'delivery/a9';PALETTES=['verdigris','rust-sand','moonlit']
IDS={'structures':['rim.front','rim.back','stands','arch','gate','pylon'],
     'props':['banner','brazier','rubble','supplies','altar','column']}
WIDTHS={'rim.front':10.5,'rim.back':10.5,'stands':10.5,'arch':6,'gate':7,'pylon':3.8,
        'banner':3.1,'brazier':2.5,'rubble':3.5,'supplies':2.7,'altar':3.5,'column':3.1}


def selected(scene):
    eligible=[]
    for j in jobs('A9'):
        if j['scene']!=scene:continue
        r=read(ART/'waves/A9/reviews'/(j['id']+'.json'));g=read(ART/'grades'/(j['id']+'.json'))
        if r['verdict']!='reject' and g['status']=='graded' and g['verdict']!='reject':eligible.append(j)
    if not eligible:raise ValueError('NO_REVIEWED_SOURCE:'+scene)
    return eligible[-1]


def periodic(image,edge=64):
    """Condition only physical edge bands; retain native interior pixels."""
    a=np.asarray(image.convert('RGB'),dtype=float).copy();h,w=a.shape[:2]
    for x in range(edge):
        weight=(1-x/(edge-1))**2;mean=(a[:,x]+a[:,-1-x])/2
        a[:,x]=a[:,x]*(1-weight)+mean*weight;a[:,-1-x]=a[:,-1-x]*(1-weight)+mean*weight
    for y in range(edge):
        weight=(1-y/(edge-1))**2;mean=(a[y]+a[-1-y])/2
        a[y]=a[y]*(1-weight)+mean*weight;a[-1-y]=a[-1-y]*(1-weight)+mean*weight
    return Image.fromarray(np.round(a).astype('uint8'))


def seam_metrics(image):
    a=np.asarray(image.convert('RGB'),dtype=float)
    return {'leftRightMeanAbsoluteRGB':round(float(abs(a[:,0]-a[:,-1]).mean()),4),
            'topBottomMeanAbsoluteRGB':round(float(abs(a[0]-a[-1]).mean()),4)}


def export(palette_ids=None):
    OUT.mkdir(parents=True,exist_ok=True);palettes={};source_measurements=[]
    for palette in palette_ids or PALETTES:
        ground=selected(palette+'-ground');source=Image.open(ROOT/ground['archive']).convert('RGB');tile=periodic(source)
        floor=saved(tile,OUT/'ground'/(palette+'.png'))
        floor.update(source=ground['archive'],sourceSha256=ground['sha256'],sourcePixelsPerMetre=32,
          worldSizeMetres=[source.width/32,source.height/32],projection='unprojected; apply sin(55 degrees) to world Y',
          origin='generated physical material; deterministic opposite-edge conditioning in 64px bands; native interior retained',
          originalInteriorFraction=round((source.width-128)*(source.height-128)/(source.width*source.height),5),
          seamBefore=seam_metrics(source),seamAfter=seam_metrics(tile),
          pixelDensity={'1080p':{'screenPixelsPerMetreX':22.5,'sourcePixelsPerScreenPixel':32/22.5},
                        '1440p':{'screenPixelsPerMetreX':30,'sourcePixelsPerScreenPixel':32/30}},
          noUpscale=True)
        sprites={}
        for kind in ['structures','props']:
            j=selected(palette+'-'+kind);source=Image.open(ROOT/j['archive'])
            excluded=[0] if palette=='rust-sand' and kind=='props' else []
            pieces=[(*piece,j) for piece in isolated_sheet(source,excluded_indices=excluded)]
            if excluded:
                corrected=selected('rust-sand-banner');single=Image.open(ROOT/corrected['archive']);keyed,matte=adaptive_magenta(single)
                pieces.append((0,0,[0,0,single.width,single.height],keyed,matte,corrected))
            for x,y,rect,keyed,matte,frame_job in pieces:
                index=y*3+x
                ident=IDS[kind][index];metric=alpha_metrics(keyed)
                if metric['empty'] or metric['margin_px']<2:raise ValueError('CROP_GATE:'+palette+':'+ident)
                # Trim only after the source crop is proven complete. Four actual
                # transparent pixels protect filtering, never conceal source cuts.
                bbox=keyed.getbbox();im=keyed.crop(bbox);padded=Image.new('RGBA',(im.width+8,im.height+8));padded.alpha_composite(im,(4,4))
                path=OUT/'sprites'/palette/(ident+'.png');rec=saved(padded,path)
                # Physical width is authored. Native source detail must cover 1440p.
                width=WIDTHS[ident];scale1080=width*22.5/im.width
                native_ratio=im.width/(width*30)
                if native_ratio<1:raise ValueError('INSUFFICIENT_1440_DENSITY:'+palette+':'+ident)
                alpha=np.asarray(padded.getchannel('A'));base=[];top=[]
                for sx in range(0,padded.width,4):
                    yy=np.where(alpha[:,sx:min(sx+4,padded.width)].max(axis=1)>128)[0]
                    base.append([sx,int(yy[-1]+1) if len(yy) else padded.height-4])
                    top.append([sx,int(yy[0]) if len(yy) else padded.height-4])
                rec.update(id=ident,source=frame_job['archive'],sourceSha256=frame_job['sha256'],sourceCrop=rect,trim=bbox,
                  matteRGB=matte,origin='generated object; adaptive matte unmix, connected-component isolation, trim and gutter; no source enlargement',
                  isolation='opaque components assigned to six slots by centroid; translucent pixels partitioned to nearest opaque component, faded 8-16px from opaque support to remove detached matte residue; reviewed cutouts required',
                  anchor=[.5,(padded.height-4)/padded.height],baseLinePx=[[4,padded.height-4],[padded.width-4,padded.height-4]],
                  groundContact='authored lower base plane; not a collision outline',baseProfilePx=base,topProfilePx=top,
                  rimTextureSpanPx=[int(np.where((alpha>128).any(axis=0))[0][0]//4*4),int(math.ceil((np.where((alpha>128).any(axis=0))[0][-1]+1)/4)*4)],
                  designSize1080=[round(padded.width*scale1080,4),round(padded.height*scale1080,4)],
                  physicalWidthMetres=width,nativePixelsPerDisplayPixel1440=round(native_ratio,5),
                  billboard=True,rotateSprite=False,blend='source-over',owner_accepted=False)
                sprites[ident]=rec
                if ident.startswith('rim.'):
                    rec['rimTextureSpanPx']=[int(padded.width*.12)//4*4,int(padded.width*.88)//4*4]
                    rec['rimTextureSelection']='central 76 percent excludes painted end caps from continuous strip mapping; complete sprite remains available'
                source_measurements.append({'id':palette+'.'+ident,'source':frame_job['archive'],'sourceCrop':rect,'metrics':metric,'matteRGB':matte})
        palettes[palette]={'ground':floor,'sprites':sprites}
    manifest={'schemaVersion':1,'id':'covenant-arena-a9','status':'owner-review','paths':'repository-root-relative',
      'cameraContract':'art/scale-contract-v2.json','palettes':palettes,'alpha':'sRGB straight RGBA; linear filtering; no double premultiplication',
      'owner_accepted':False}
    write(OUT/'arena.json',manifest);write(OUT/'source-measurements.json',{'objects':source_measurements})
    return manifest


def layout():
    # Explicitly preserves the current core ellipse; internal wardstones below
    # are decorative nodes, not new collision objects.
    objects=[]
    def put(ident,kind,pos,**kwargs):objects.append({'id':ident,'sprite':kind,'positionMetres':pos,'depthSort':'worldY at base line','collision':'none; presentation only',**kwargs})
    pylons=[(-16,1),(16,-5),(48,1),(-18,40),(50,40)]
    for i,p in enumerate(pylons):put('ward-'+str(i),'pylon',list(p))
    for i,x in enumerate([-24,-4,36,56]):put('banner-'+str(i),'banner',[x,-7 if x in (-4,36) else 0])
    put('north-gate','gate',[16,-9]);put('west-arch','arch',[-28,4]);put('east-arch','arch',[60,4])
    for i,x in enumerate(range(-42,76,10)):
        dx=(x-16)/96;y=62-72*math.sqrt(max(0,1-dx*dx))-3
        put('stand-'+str(i),'stands',[x,round(y,3)])
    for i,p in enumerate([(-22,7),(54,7),(-25,35),(57,35)]):put('brazier-'+str(i),'brazier',list(p))
    for i,p in enumerate([(-25,18),(58,24),(-12,43),(44,43)]):put('rubble-'+str(i),'rubble',list(p))
    for kind,p in [('supplies',(-26,12)),('altar',(55,15)),('column',(-29,29)),('column',(61,31))]:put(kind+'-'+str(len(objects)),kind,list(p))
    segments=[]
    for i in range(64):
        a0=2*math.pi*i/64;a1=2*math.pi*(i+1)/64
        segments.append({'id':'rim-'+str(i),'sprite':'rim.front' if math.sin((a0+a1)/2)<0 else 'rim.back',
          'ellipseAnglesRadians':[a0,a1],'render':'vertical-strip warp along exact ellipse; never rotate upright masonry',
          'sourceBaseProfile':'sprite.baseProfilePx','sourceTopProfile':'sprite.topProfilePx','stripSourceWidthPx':4,'wallHeightMetres':2.2,
          'derivation':'each vertical texture strip fits between explicit top/base curves; true new painted facings are not claimed'})
    data={'schemaVersion':1,'id':'covenant-arena-layout-a9','units':'metres','worldAxes':'X right, Y towards screen bottom',
      'coreBoundary':{'shape':'ellipse','centre':[16,62],'size':[192,144],'authority':'existing game/core geometry; unchanged'},
      'camera':{'elevationDegrees':55,'groundPixelsPerMetre1080':22.5,'proofCentre':[16,14],'entryCentre':[12,10],
                'deadZoneNormalized':[.16,.18,.84,.8],'edgeFollow':'game-owned; preserve D17'},
      'ground':{'tileOriginMetres':[-80,-10],'repeat':'both axes; native unprojected tile, scale by declared worldSizeMetres',
                'clipTo':'coreBoundary ellipse','outside':'same physical floor at 0.45 luminance; stands/rim occlude seam'},
      'objects':objects,'rimSegments':segments,
      'decalPlacements':[{'id':'ward-seal-'+str(i),'kind':'rune.seal','positionMetres':list(p),'sizeMetres':[8,8],'opacity':.56} for i,p in enumerate(pylons)]+
        [{'id':'surface-'+str(i),'kind':kind,'positionMetres':pos,'sizeMetres':[4,4],'opacity':opacity} for i,(kind,pos,opacity) in enumerate([
            ('scorch',[-4,17],.75),('crater',[38,35],.55),('cracks',[24,18],.65),('scorch',[4,36],.7),('rune.glyphs',[37,4],.45)])],
      'renderOrder':['ground','ground decals','base shadows','rim strips and objects and actors sorted by base world Y','effects'],
      'geometryBoundary':'All scenery is presentation. Never create colliders or move existing spawn points from this file.',
      'owner_accepted':False}
    write(OUT/'layout.json',data);return data


def decals(m):
    j=selected('verdigris-decals');source=Image.open(ROOT/j['archive']);rows=[]
    if source.size!=(1280,720):raise ValueError('DECAL_CROP_SOURCE_CHANGED')
    crop_map={'scorch':[826,22,1161,350],'crater':[123,369,458,696],'cracks':[475,369,808,696]}
    base={}
    for kind,rect in crop_map.items():
        raw=source.crop(rect)
        if kind=='crater':im=raw.convert('RGBA');matte=None
        else:
            # Measure tinted panel from its own corner, not the bright surround.
            matte=np.median(np.asarray(raw)[13:23,13:23,:],axis=(0,1)).tolist()
            im,_=adaptive_magenta(raw,matte,minimum_matte_chroma=25)
        im=ImageOps.fit(im,(256,256),Image.Resampling.LANCZOS)
        a=np.asarray(im).copy();yy,xx=np.mgrid[:256,:256]
        radial=np.sqrt(((xx-127.5)/124)**2+((yy-127.5)/124)**2)
        fade=np.clip((1-radial)/.2,0,1)
        a[:,:,3]=np.round(a[:,:,3]*fade).astype('uint8');a[a[:,:,3]==0,:3]=0
        base[kind]=(Image.fromarray(a),rect,matte)
    for palette in PALETTES:
        ground=Image.open(ROOT/m['palettes'][palette]['ground']['file']).convert('L').resize((256,256))
        wear=np.asarray(ground).astype(float);wear=.60+.4*(wear-wear.min())/max(1,wear.max()-wear.min())
        color={'verdigris':(169,144,89),'rust-sand':(217,191,133),'moonlit':(174,204,226)}[palette]
        for kind in ['rune.seal','rune.glyphs','scorch','crater','cracks']:
            if kind.startswith('rune'):
                im=Image.new('RGBA',(256,256));d=ImageDraw.Draw(im)
                if kind=='rune.seal':
                    for r in [115,89]:d.ellipse((128-r,128-r,128+r,128+r),outline=(*color,230),width=2)
                    # Original crescent and open angular marks, no font or alphabet.
                    d.arc((96,91,160,165),70,285,fill=(*color,230),width=5)
                    for ang in np.linspace(0,2*math.pi,11)[:-1]:
                        x=128+101*math.cos(ang);y=128+101*math.sin(ang)
                        d.line([(x-4,y-6),(x+5,y),(x-4,y+6)],fill=(*color,220),width=2)
                        d.ellipse((x-1,y-1,x+1,y+1),fill=(*color,230))
                else:
                    for x,y,r in [(68,120,26),(128,136,34),(192,120,26)]:
                        d.arc((x-r,y-r,x+r,y+r),25,325,fill=(*color,230),width=3)
                        d.polygon([(x,y-15),(x+10,y+5),(x,y+16),(x-10,y+5)],outline=(*color,230),width=2)
                a=np.asarray(im).copy();a[:,:,3]=np.round(a[:,:,3]*wear).astype('uint8');im=Image.fromarray(a)
                origin='authored original glyph stencils with generated ground luminance modulating pigment wear; not generated symbols';rect=None;matte=None
            else:
                im,rect,matte=base[kind];a=np.asarray(im).copy();rgb=a[:,:,:3].astype(float)
                if palette=='rust-sand':rgb=rgb*np.array([1.10,1.03,.85])
                elif palette=='moonlit':rgb=rgb*np.array([.82,.96,1.14])
                a[:,:,:3]=np.clip(rgb,0,255).astype('uint8');im=Image.fromarray(a)
                origin='generated surface texture crop; measured matte removal where applicable, authored elliptical feather mask and palette grade'
            path=OUT/'decals'/palette/(kind+'.png');row=saved(im,path)
            row.update(id=kind,palette=palette,anchor=[.5,.5],blend='source-over',groundPlane=True,
              origin=origin,source=j['archive'] if rect else m['palettes'][palette]['ground']['file'],
              sourceSha256=j['sha256'] if rect else m['palettes'][palette]['ground']['sha256'],sourceCrop=rect,matteRGB=matte,
              render='scale in unprojected world coordinates, then project Y once; draw beneath every actor/prop',owner_accepted=False)
            rows.append(row)
    data={'schemaVersion':1,'rows':rows,'excludedSourceCells':[0,1,5],'noGeneratedTextConsumed':True,'owner_accepted':False}
    write(OUT/'decals.json',data);return data


def ground_canvas(m,lay,palette,w,h,centre):
    record=m['palettes'][palette]['ground'];im=Image.open(ROOT/record['file']).convert('RGB')
    pp=22.5*h/1080;py=pp*math.sin(math.radians(55));origin=lay['ground']['tileOriginMetres']
    # Native source sampled at its declared metre scale, never stretched to a screen.
    sx=((np.arange(w)-w/2)/pp+centre[0]-origin[0])*32
    sy=((np.arange(h)-h/2)/py+centre[1]-origin[1])*32
    a=np.asarray(im);arr=a[np.floor(sy).astype(int)%im.height][:,np.floor(sx).astype(int)%im.width]
    xx=(np.arange(w)-w/2)/pp+centre[0];yy=(np.arange(h)-h/2)/py+centre[1]
    outside=((xx[None,:]-16)/96)**2+((yy[:,None]-62)/72)**2>1
    arr=arr.copy();arr[outside]=(arr[outside]*.45).astype('uint8')
    return Image.fromarray(arr).convert('RGBA')


def render(m,lay,palette,w,h,centre=None):
    centre=centre or lay['camera']['proofCentre'];pp=22.5*h/1080;py=pp*math.sin(math.radians(55));scale=h/1080
    canvas=ground_canvas(m,lay,palette,w,h,centre);records=m['palettes'][palette]['sprites'];drawables=[]
    def screen(p):return (w/2+(p[0]-centre[0])*pp,h/2+(p[1]-centre[1])*py)
    decal_rows=read(OUT/'decals.json')['rows'] if (OUT/'decals.json').exists() else []
    for item in lay['decalPlacements']:
        found=next((r for r in decal_rows if r['palette']==palette and r['id']==item['kind']),None)
        if not found:continue
        pos=screen(item['positionMetres']);dw=round(item['sizeMetres'][0]*pp);dh=round(item['sizeMetres'][1]*py)
        im=Image.open(ROOT/found['file']).resize((dw,dh),Image.Resampling.LANCZOS);im.putalpha(im.getchannel('A').point(lambda a:round(a*item['opacity'])))
        canvas.alpha_composite(im,(round(pos[0]-dw/2),round(pos[1]-dh/2)))
    cache={key:Image.open(ROOT/r['file']).convert('RGBA') for key,r in records.items()}
    for seg in lay['rimSegments']:
        rec=records[seg['sprite']];im=cache[seg['sprite']];a0,a1=seg['ellipseAnglesRadians'];factor=rec['designSize1080'][0]/im.width*scale
        span0,span1=rec['rimTextureSpanPx'];span=span1-span0
        # Each strip remains upright; its lower painted contact is placed on
        # the boundary. This geometry is explicitly derived, not another facing.
        for (sx,base),(_,top) in zip(rec['baseProfilePx'],rec['topProfilePx']):
            if base<=top:continue
            if sx<span0 or sx>=span1:continue
            end=min(sx+4,span1);t=((sx+end)/2-span0)/span;a=a0+(a1-a0)*t
            foot=[16+96*math.cos(a),62+72*math.sin(a)];dest=screen(foot)
            p1=screen([16+96*math.cos(a0+(a1-a0)*(sx-span0)/span),62+72*math.sin(a0+(a1-a0)*(sx-span0)/span)])
            p2=screen([16+96*math.cos(a0+(a1-a0)*(end-span0)/span),62+72*math.sin(a0+(a1-a0)*(end-span0)/span)])
            dw=max(1,math.ceil(abs(p2[0]-p1[0]))+1);dh=max(1,round(seg['wallHeightMetres']*pp))
            if dest[0]<-50 or dest[0]>w+50 or dest[1]<-50 or dest[1]-dh>h:continue
            piece=im.crop((sx,top,end,base)).resize((dw,dh),Image.Resampling.LANCZOS)
            drawables.append((foot[1],piece,(round(min(p1[0],p2[0])),round(dest[1]-dh))))
    for obj in lay['objects']:
        rec=records[obj['sprite']];im=cache[obj['sprite']];foot=screen(obj['positionMetres']);dw,dh=[round(v*scale) for v in rec['designSize1080']]
        if foot[0]+dw<0 or foot[0]-dw>w or foot[1]+dh<0 or foot[1]-dh>h:continue
        im=im.resize((dw,dh),Image.Resampling.LANCZOS);offset=(round(foot[0]-dw*rec['anchor'][0]),round(foot[1]-dh*rec['anchor'][1]))
        # Contact shadow is authored separately; no pink matte or generated floor.
        shadow=Image.new('RGBA',canvas.size);d=ImageDraw.Draw(shadow);r=rec['physicalWidthMetres']*pp*.34
        d.ellipse((foot[0]-r,foot[1]-r*.17,foot[0]+r,foot[1]+r*.17),fill=(2,7,12,100));canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(2*scale)))
        drawables.append((obj['positionMetres'][1],im,offset))
    # Existing review keys witness body scale and sorting; A10 owns new animation.
    fm=read(ART/'delivery/a3c/figures.json')
    positions=[('brennic',[-3,24]),('cassia',[13,33]),('garran',[29,29]),('iskar',[42,24]),('conscript',[3,10]),('shieldman',[28,8]),('thornback',[34,17])]
    for name,p in positions:
        row=next(r for r in fm['frames'] if r['entity']==name);im=Image.open(ROOT/row['file']);factor=40.5*scale/160;im=im.resize((round(512*factor),round(512*factor)),Image.Resampling.LANCZOS);foot=screen(p)
        drawables.append((p[1],im,(round(foot[0]-256*factor),round(foot[1]-400*factor))))
    for _,im,offset in sorted(drawables,key=lambda r:r[0]):canvas.alpha_composite(im,offset)
    # Use actual A8 emission art, not procedural spell lines, in context.
    fx=read(ART/'delivery/a8/effects.json');pages={p['id']:p for p in fx['pages']}
    for school,p,kind in [('fire',[-2,24],'cast'),('water',[14,33],'aura'),('earth',[30,29],'cast'),('air',[43,24],'cast')]:
        clip=fx['clips'][school+'.'+kind];page=Image.open(ROOT/pages[clip['page']]['file']);x,y,fw,fh=clip['frames'][3]['rect'];im=page.crop((x,y,x+fw,y+fh));dw,dh=[round(v*scale) for v in clip['designSize1080']];im=im.resize((dw,dh),Image.Resampling.LANCZOS);foot=screen(p)
        canvas.alpha_composite(im,(round(foot[0]-dw/2),round(foot[1]-dh/2-(20*scale if kind=='cast' else 0))))
    return canvas.convert('RGB')


def proofs(m,lay):
    evidence=[];bible=read(ART/'style-covenant.json');references={'verdigris':'verdigris-covenant-arena','rust-sand':'ragged-oracle-arena','moonlit':'moonchalk-tempest-arena'}
    for palette in PALETTES:
        for w,h in [(1920,1080),(2560,1440)]:
            im=render(m,lay,palette,w,h);p=OUT/'proofs'/f'{palette}-{w}.png';saved(im,p)
            evidence.append(extras(p,f'{palette}-{w}','Layout-driven native capture, 3.75% body witnesses, actual A8 textures. Not gameplay or owner-certified fidelity.'))
        ref_im=Image.open(ROOT/bible['references'][references[palette]]['path']).convert('RGB')
        # Keep the native comparison artifacts linked; board thumbnails are not
        # represented as full-resolution quality measurements.
        sheet=Image.new('RGB',(2560,800),'#111923');d=ImageDraw.Draw(sheet)
        for i,(label,img) in enumerate([('Approved A6 concept / reference',ref_im),('A9 reconstructed layout / candidate',Image.open(OUT/'proofs'/f'{palette}-1920.png'))]):
            im=ImageOps.contain(img,(1260,720),Image.Resampling.LANCZOS);sheet.paste(im,(i*1280+(1280-im.width)//2,65));d.text((i*1280+22,18),label,font=font(28),fill='#ece5d8')
        p=OUT/'proofs'/f'comparison-{palette}.png';saved(sheet,p);evidence.append(extras(p,'comparison-'+palette,'Side-by-side evidence, not a claim that a numeric gate proves no loss. Open linked native files to inspect material and geometry.'))
        tile=Image.open(ROOT/m['palettes'][palette]['ground']['file']);sample=Image.new('RGB',(tile.width*2,tile.height*2))
        for y in range(2):
            for x in range(2):sample.paste(tile,(x*tile.width,y*tile.height))
        p=OUT/'proofs'/f'tiling-{palette}.png';saved(sample,p);evidence.append(extras(p,'tiling-'+palette,'2x2 native-density seam proof. Edge bands are conditioned, the tile interior is unchanged source detail.'))
    contact([(palette+' / '+ident,Image.open(ROOT/r['file'])) for palette,p in m['palettes'].items() for ident,r in p['sprites'].items()],OUT/'object-contact.png','A9 / native keyed structures and props',columns=6,tile=(300,300))
    evidence.append(extras(OUT/'object-contact.png','object-contact','Thirty-six generated object cutouts, native pixels; source crops, baselines and 1440p density in arena.json.'))
    write(OUT/'proofs.json',{'rows':evidence,'bodyHeightFraction':.0375,'camera':lay['camera'],'owner_accepted':False})
    board('A9',evidence)


def check():
    m=read(OUT/'arena.json');lay=read(OUT/'layout.json');errors=[]
    if set(m['palettes'])!=set(PALETTES):errors.append('MISSING_PALETTE')
    if lay['coreBoundary']['size']!=[192,144] or lay['coreBoundary']['centre']!=[16,62]:errors.append('CORE_GEOMETRY_CHANGED')
    for palette,p in m['palettes'].items():
        g=p['ground'];im=Image.open(ROOT/g['file'])
        if sha(ROOT/g['file'])!=g['sha256'] or sha(ROOT/g['source'])!=g['sourceSha256']:errors.append('GROUND_HASH:'+palette)
        if any(seam_metrics(im).values()):errors.append('SEAM:'+palette)
        if min(g['pixelDensity']['1440p'].values())<1:errors.append('DENSITY:'+palette)
        for ident,r in p['sprites'].items():
            im=Image.open(ROOT/r['file'])
            if sha(ROOT/r['file'])!=r['sha256'] or sha(ROOT/r['source'])!=r['sourceSha256']:errors.append('HASH:'+palette+ident)
            if im.mode!='RGBA' or im.getchannel('A').getextrema()[0]!=0:errors.append('ALPHA:'+ident)
            if alpha_metrics(im)['margin_px']<3:errors.append('EXPORT_MARGIN:'+ident)
            if r['nativePixelsPerDisplayPixel1440']<1:errors.append('DENSITY:'+ident)
            if len(r['baseLinePx'])!=2 or not 0<r['anchor'][1]<=1:errors.append('BASELINE:'+ident)
        for obj in lay['objects']:
            if obj['sprite'] not in p['sprites']:errors.append('MISSING_OBJECT:'+obj['id'])
    for row in read(OUT/'proofs.json')['rows']:
        if sha(ROOT/row['file'])!=row['sha256']:errors.append('PROOF_HASH')
    dm=read(OUT/'decals.json')
    for row in dm['rows']:
        if sha(ROOT/row['file'])!=row['sha256']:errors.append('DECAL_HASH')
    report={'status':'fail' if errors else 'pass','errors':errors,'palettes':len(m['palettes']),'objects':sum(len(p['sprites']) for p in m['palettes'].values()),
      'scope':'native density, source/export hashes, periodic edges, alpha, baseline presence, layout and proof integrity; visual equivalence is owner-only',
      'owner_accepted':False}
    write(ART/'reports/a9-delivery-check.json',report);print(report);return report


def build():
    m=export();lay=layout();decals(m);proofs(m,lay)


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('command');a=p.parse_args()
    if a.command=='build':build()
    elif check()['errors']:raise SystemExit(1)
