"""A11 Tideglass: authored construction with explicitly reused generated paint.

No provider calls. Both latches are retained. Newly generated paintings remain
backlog; these deterministic local assets are a reviewable design candidate.
"""
import argparse,copy,math
import numpy as np
from PIL import Image,ImageDraw,ImageFilter,ImageOps
from scipy.ndimage import distance_transform_edt,gaussian_filter
from common import ART,ROOT,read,write,sha,relative
from restoration_common import adaptive_magenta,alpha_metrics,contact,extras,saved
from covenant import board

OUT=ART/'delivery/a11';UI=ART/'ui';N=512
PHASES=['dawn','midday','dusk','night']


def blank(n=N):return Image.new('RGBA',(n,n))


def mask(n=N):return Image.new('L',(n,n))


def metal(m,colour,bevel=5):
    """Authored relief shading, no generated-geometry or added grain claim."""
    a=np.asarray(m,dtype=float)/255;dist=distance_transform_edt(a>.5)
    surface=gaussian_filter(np.minimum(dist,bevel),.65)
    gy,gx=np.gradient(surface);light=np.clip(.70-.17*gx-.23*gy,.20,1.35)
    yy,xx=np.mgrid[:m.height,:m.width];light+=.09*(1-yy/m.height)-.06*xx/m.width
    rgb=np.clip(np.array(colour)[None,None,:]*light[:,:,None],0,255)
    return Image.fromarray(np.dstack([rgb,a*255]).astype('uint8'))


def ellipse(bounds,fill=255,n=N):
    m=mask(n);ImageDraw.Draw(m).ellipse(bounds,fill=fill);return m


def line_mask(points,width,n=N):
    m=mask(n);ImageDraw.Draw(m).line(points,fill=255,width=width,joint='curve');return m


def polygon(points,n=N):
    m=mask(n);ImageDraw.Draw(m).polygon(points,fill=255);return m


def glow(layer,radius=8,opacity=.5):
    a=layer.filter(ImageFilter.GaussianBlur(radius));alpha=np.asarray(a.getchannel('A'),dtype=float)*opacity
    a.putalpha(Image.fromarray(alpha.astype('uint8')));out=a.copy();out.alpha_composite(layer);return out


def gold():
    im=blank()
    for x,y,rx,ry in [(226,335,142,63),(258,294,142,63),(210,235,148,94)]:
        im.alpha_composite(metal(ellipse((x-rx,y-ry+19,x+rx,y+ry+19)),(115,75,37),9))
        im.alpha_composite(metal(ellipse((x-rx,y-ry,x+rx,y+ry)),(220,181,103),9))
        ring=ellipse((x-rx+16,y-ry+12,x+rx-16,y+ry-12));ImageDraw.Draw(ring).ellipse((x-rx+24,y-ry+19,x+rx-24,y+ry-19),fill=0)
        im.alpha_composite(metal(ring,(124,85,39),2))
        if y==235:
            crescent=ellipse((x-52,y-56,x+43,y+52));ImageDraw.Draw(crescent).ellipse((x-26,y-66,x+70,y+32),fill=0)
            im.alpha_composite(metal(crescent,(254,220,143),6))
            im.alpha_composite(metal(polygon([(288,219),(297,237),(287,251),(276,237)]),(253,223,160),3))
    # Sparse physical edge nicks, not a texture/noise overlay.
    d=ImageDraw.Draw(im)
    for pts in [[(91,267),(104,274)],[(350,255),(339,267)],[(361,328),(348,334)],[(136,387),(148,390)]]:d.line(pts,fill=(83,59,33,220),width=3)
    return im


def reputation():
    im=blank();branches=[[(238,420),(174,390),(123,332),(95,255),(100,180)],[(274,420),(338,390),(389,332),(417,255),(412,180)]]
    for path in branches:im.alpha_composite(metal(line_mask(path,9),(190,190,160),3))
    for flip in [False,True]:
        for x,y,ang in [(116,191,-.3),(110,246,.08),(131,301,.35),(161,350,.6),(205,386,.85)]:
            for sign in [-1,1]:
                cx=x+sign*20;cy=y-sign*5;theta=ang+sign*.9
                ux,uy=math.sin(theta),-math.cos(theta);vx,vy=-uy,ux
                pts=[(cx-ux*30,cy-uy*30),(cx+vx*16,cy+vy*16),(cx+ux*40,cy+uy*40),(cx-vx*11,cy-vy*11)]
                if flip:pts=[(512-px,py) for px,py in pts]
                im.alpha_composite(metal(polygon(pts),(171,187,169),5))
    im.alpha_composite(metal(polygon([(256,128),(336,221),(312,316),(256,366),(200,316),(176,221)]),(212,215,196),8))
    im.alpha_composite(metal(polygon([(256,151),(310,221),(288,302),(256,330),(224,302),(202,221)]),(59,116,128),8))
    im.alpha_composite(metal(polygon([(256,157),(265,223),(305,222),(268,244),(256,320),(244,244),(207,222),(247,223)]),(195,224,216),4))
    return im


def fatigue():
    im=blank();im.alpha_composite(metal(ellipse((93,354,419,432)),(138,135,108),8))
    im.alpha_composite(metal(ellipse((116,365,396,409)),(51,55,54),4))
    body=polygon([(176,347),(169,256),(175,202),(202,185),(240,194),(267,180),(315,206),(331,349),(304,380),(211,384)])
    im.alpha_composite(metal(body,(214,204,166),12))
    im.alpha_composite(metal(ellipse((174,179,317,228)),(128,113,77),6))
    im.alpha_composite(metal(ellipse((202,185,290,216)),(44,45,39),4))
    for path in [[(194,217),(196,294),(205,305)],[(297,229),(304,336)],[(228,231),(232,268)]]:
        im.alpha_composite(metal(line_mask(path,12),(226,213,174),3))
    d=ImageDraw.Draw(im);d.line([(248,203),(244,183),(252,172)],fill=(40,33,29,255),width=9)
    flame=polygon([(252,179),(229,161),(226,142),(247,129),(274,113),(281,89),(293,123),(280,153)])
    warm=metal(flame,(251,169,75),8);im.alpha_composite(glow(warm,7,.6))
    im.alpha_composite(metal(polygon([(250,174),(247,152),(265,136),(265,161)]),(255,233,164),4))
    # Tiny extinguishing trail communicates low energy without a skull or text.
    trail=line_mask([(287,103),(303,81),(297,60),(277,51)],5)
    smoke=Image.new('RGBA',(N,N),(165,184,190,0));smoke.putalpha(trail.point(lambda v:round(v*.42)).filter(ImageFilter.GaussianBlur(3)));im.alpha_composite(smoke)
    return im


def rim():
    source=read(UI/'source-crops.json');raw=Image.open(ROOT/source['source']).convert('RGB')
    crop=raw.crop(source['primitives']['clock']);keyed,_=adaptive_magenta(crop,[255,0,255])
    im=blank();keyed=keyed.resize((480,480),Image.Resampling.LANCZOS);im.alpha_composite(keyed,(16,16))
    return im,{'source':source['source'],'sha256':source['source_sha256'],'crop':source['primitives']['clock'],
      'origin':'existing A5b generated silver rim; native crop, key, resize and placement only; no new image call'}


def sky(phase):
    colours={'dawn':[(31,51,76),(153,117,91),(229,168,96)],'midday':[(37,75,101),(81,128,148),(167,187,173)],
      'dusk':[(44,36,70),(112,70,100),(208,117,77)],'night':[(10,19,43),(25,47,72),(53,78,100)]}[phase]
    y,x=np.mgrid[:N,:N];t=np.clip((y-80)/255,0,1);rgb=np.zeros((N,N,3))
    for k in range(3):rgb[:,:,k]=np.interp(t,[0,.7,1],[c[k] for c in colours])
    im=Image.fromarray(np.dstack([rgb,np.asarray(ellipse((85,85,427,427)))]).astype('uint8'))
    # Original carved skyline; large quiet planes, intentionally authored.
    d=ImageDraw.Draw(im)
    d.polygon([(78,325),(111,287),(145,308),(166,272),(188,285),(216,267),(238,291),(276,268),(299,300),(325,268),(350,289),(394,262),(433,310),(433,435),(78,435)],fill=(24,43,51,255))
    for bx,by in [(141,275),(188,265),(347,272)]:
        d.polygon([(bx-7,by+37),(bx-5,by),(bx,by-7),(bx+6,by),(bx+8,by+37)],fill=(17,32,41,255))
        d.line([(bx-3,by),(bx-3,by+22)],fill=(107,144,147,180),width=2)
    if phase=='night':
        moon=ellipse((284,131,349,196));ImageDraw.Draw(moon).ellipse((308,121,358,182),fill=0)
        layer=Image.new('RGBA',(N,N),(207,224,226,0));layer.putalpha(moon);im.alpha_composite(glow(layer,7,.28))
        for sx,sy,size in [(155,158,2),(191,125,2),(239,155,1),(354,218,2),(211,203,2),(385,173,1)]:
            ImageDraw.Draw(im).ellipse((sx-size,sy-size,sx+size,sy+size),fill=(205,226,233,255))
    else:
        cx,cy,r={'dawn':(163,256,31),'midday':(260,152,30),'dusk':(347,264,32)}[phase]
        sun=Image.new('RGBA',(N,N),(253,224,174,0));sun.putalpha(ellipse((cx-r,cy-r,cx+r,cy+r)));im.alpha_composite(glow(sun,13,.4))
    # A few broad translucent cloud strokes, deterministic authored forms.
    clouds=blank();d=ImageDraw.Draw(clouds)
    for xx,yy,ww in [(140,221,90),(244,196,112),(305,238,102)]:d.ellipse((xx,yy,xx+ww,yy+8),fill=(180,205,211,30 if phase=='night' else 45))
    im.alpha_composite(clouds.filter(ImageFilter.GaussianBlur(3)))
    im.putalpha(ellipse((85,85,427,427)));return im


def clock_layers():
    ring,provenance=rim();layers={'rim':ring}
    for phase in PHASES:layers['face.'+phase]=sky(phase)
    basin=blank();shell=ellipse((84,84,428,428));ImageDraw.Draw(shell).ellipse((91,91,421,421),fill=0)
    basin.alpha_composite(metal(shell,(72,94,98),5))
    # A recessed lower reservoir with a separate water fill and moving meniscus.
    cup=polygon([(103,302),(409,302),(398,347),(367,382),(312,409),(256,418),(198,409),(145,382),(116,345)])
    basin.alpha_composite(metal(cup,(32,55,63),8));layers['basin']=basin
    water=blank();yy,xx=np.mgrid[:N,:N];level=np.clip((yy-300)/120,0,1)
    rgb=np.stack([38+level*6,119-level*55,141-level*64],axis=2);wm=np.asarray(cup).copy();wm[:307]=0
    water=Image.fromarray(np.dstack([rgb,wm*.90]).astype('uint8'));d=ImageDraw.Draw(water)
    for row in range(317,407,13):
        pts=[(x,row+round(3*math.sin(x/37+row/30))) for x in range(111,405,4)]
        d.line(pts,fill=(109,198,205,90),width=2)
    water.putalpha(Image.fromarray((wm*.90).astype('uint8')));layers['water']=water
    meniscus=blank();d=ImageDraw.Draw(meniscus)
    d.ellipse((111,298,401,313),fill=(102,187,194,100),outline=(172,226,220,225),width=2);layers['meniscus']=meniscus
    ticks=blank();d=ImageDraw.Draw(ticks)
    for i in range(24):
        a=i*math.tau/24-math.pi/2;r0=177 if i%6 else 172;r1=185
        d.line([(256+math.cos(a)*r0,256+math.sin(a)*r0),(256+math.cos(a)*r1,256+math.sin(a)*r1)],fill=(213,211,177,235),width=3 if i%6 else 4)
        if i%6==0:d.polygon([(256+math.cos(a)*165+math.sin(a)*4,256+math.sin(a)*165-math.cos(a)*4),(256+math.cos(a)*160,256+math.sin(a)*160),(256+math.cos(a)*165-math.sin(a)*4,256+math.sin(a)*165+math.cos(a)*4)],fill=(168,199,196,255))
    layers['ticks']=ticks
    pointer=blank();pointer.alpha_composite(metal(polygon([(256,54),(268,71),(256,88),(244,71)]),(150,227,222),4));layers['pointer']=glow(pointer,5,.5)
    glass=blank();d=ImageDraw.Draw(glass);d.arc((96,96,416,416),195,252,fill=(221,239,235,85),width=4);d.arc((110,109,402,403),199,233,fill=(221,239,235,35),width=9)
    d.arc((98,98,414,414),20,57,fill=(206,230,228,45),width=2);layers['glass']=glass
    # Existing generated A8 mist, not a newly generated clock painting.
    fx=read(ART/'delivery/a8/effects.json');clip=fx['clips']['water.aura'];pg=next(p for p in fx['pages'] if p['id']==clip['page'])
    x,y,w,h=clip['frames'][2]['rect'];paint=Image.open(ROOT/pg['file']).crop((x,y,x+w,y+h)).resize((300,165),Image.Resampling.LANCZOS)
    mist=blank();mist.alpha_composite(paint,(106,242));a=np.asarray(mist.getchannel('A'),dtype=float)*.32;mist.putalpha(Image.fromarray(a.astype('uint8')));layers['mist']=mist
    return layers,{'rim':provenance,'mist':{'manifest':'art/delivery/a8/effects.json','page':pg['file'],'pageSha256':pg['sha256'],'clip':'water.aura','frame':2,
      'origin':'existing generated A8 emission keys; crop, anisotropic resize and opacity derived'},'otherLayers':'original authored masks, relief shading, gradients and compositing; NOT newly generated imagery'}


def composite(layers,phase,fraction):
    im=blank();im.alpha_composite(layers['face.'+phase]);im.alpha_composite(layers['basin'])
    water=layers['water'].copy();cut=round(307+max(0,min(1,fraction))*104);a=np.asarray(water.getchannel('A')).copy();a[:cut]=0;water.putalpha(Image.fromarray(a));im.alpha_composite(water)
    # Reservoir narrows physically towards its rounded bottom.
    men=layers['meniscus'].copy();factor=max(.10,math.sqrt(max(0,1-fraction*fraction)))
    men=men.crop((100,290,412,321)).resize((max(1,round(312*factor)),31),Image.Resampling.LANCZOS)
    if fraction<.995:im.alpha_composite(men,(round(256-men.width/2),cut-17))
    im.alpha_composite(layers['mist']);im.alpha_composite(layers['glass']);im.alpha_composite(layers['rim']);im.alpha_composite(layers['ticks'])
    im.alpha_composite(layers['pointer'].rotate(-fraction*360,resample=Image.Resampling.BICUBIC,center=(256,256)))
    return im


def build():
    baseline=read(ART/'waves/A11/baseline-ui.json');kit=copy.deepcopy(baseline['kit']);icons=copy.deepcopy(baseline['icons'])
    frames=[];metadata={};source_icons={'gold':gold(),'reputation':reputation(),'fatigue':fatigue()}
    for ident,im in source_icons.items():
        saved(im,OUT/'icons'/f'{ident}-master.png')
        for variant,size,design in [('header',64,32),('large',256,128)]:
            sprite=im.resize((size,size),Image.Resampling.LANCZOS);key=f'icon.stat.{ident}.{variant}'
            frames.append((key,sprite));metadata[key]={'anchor':[.5,.5],'designSize':[design,design],'origin':'authored relief geometry and shading; no new generated icon','owner_accepted':False}
            saved(sprite,OUT/'icons'/f'{ident}-{variant}.png')
        icons['icons']['stat.'+ident]={'region':f'icon.stat.{ident}.header','largeRegion':f'icon.stat.{ident}.large','origin':'authored A11 candidate; requested generated painting remains backlog'}
    layers,provenance=clock_layers()
    for ident,im in layers.items():
        saved(im,OUT/'clock'/f'{ident}.png');key='clock.daily.'+ident;frames.append((key,im))
        metadata[key]={'anchor':[.5,.5],'designSize':[240,240],'origin':provenance.get(ident,provenance['otherLayers']),'owner_accepted':False}
    # Simple stable shelf pack. Existing A5b pages and regions stay untouched.
    atlas=Image.new('RGBA',(4096,2048));x=y=2;rowh=0
    for key,im in frames:
        if x+im.width+2>atlas.width:x=2;y+=rowh+4;rowh=0
        if y+im.height+2>atlas.height:raise ValueError('A11_ATLAS_OVERFLOW')
        atlas.alpha_composite(im,(x,y));kit['regions'][key]={'page':'daily-stats','rect':[x,y,im.width,im.height],**metadata[key]}
        x+=im.width+4;rowh=max(rowh,im.height)
    target=UI/'atlases/daily-stats.png';atlas.save(target)
    kit['pages'].append({'id':'daily-stats','file':'atlases/daily-stats.png','size':list(atlas.size),'sha256':sha(target)})
    kit['components']['dailyClock']={'id':'tideglass','states':{i:'clock.daily.'+i for i in layers},'layers':{i:'clock.daily.'+i for i in layers},'designSize':[240,240],
      'headerSize':[96,96],'pivot':[.5,.5],'hourMarkers':24,'phaseArt':{p:'clock.daily.face.'+p for p in PHASES},
      'waterClipSource':[103,307,306,104],'meniscusSourceCrop':[100,290,312,31],
      'progressMeaning':'game-supplied elapsed day fraction in [0,1]; water drains downward, pointer rotates clockwise from top',
      'phaseMeaning':'game supplies phaseFrom, phaseTo and phaseMix; no art-owned schedule',
      'drawOrder':['phase plates','basin','clipped water','translated/scaled meniscus','mist','glass','rim','ticks','rotated pointer'],
      'blend':'source-over except optional mist lighter at low opacity','reducedMotion':'direct phase/progress updates; omit mist and idle shimmer',
      'status':'partial-authored-candidate','owner_accepted':False}
    kit['components']['stats']={'states':{i+'.'+v:f'icon.stat.{i}.{v}' for i in source_icons for v in ['header','large']},'items':{i:{'header':f'icon.stat.{i}.header','large':f'icon.stat.{i}.large'} for i in source_icons}}
    kit['extensions']=kit.get('extensions',[])+[{'id':'a11-tideglass-stats','status':'partial-authored-candidate','provenance':'../delivery/a11/provenance.json'}]
    write(UI/'kit.json',kit);write(UI/'icons.json',icons)
    write(OUT/'provenance.json',{'status':'partial','newProviderCalls':0,'newGeneratedImages':0,'clock':provenance,
      'statIcons':'original authored geometry, relief shading and sparse physical edge nicks; not generated icons',
      'backlog':['Generate new gold, reputation and fatigue paintings after a provider is legitimately available','Generate Tideglass painted state/layer sheet and compare against this authored design','Owner approval and game integration'],
      'providerStops':{k:v['stop'] for k,v in read(ART/'providers/history.json')['providers'].items()},'owner_accepted':False})
    evidence=[]
    for i,phase in enumerate(PHASES):
        p=OUT/'proofs'/f'{phase}.png';saved(composite(layers,phase,[.05,.4,.72,.94][i]),p);evidence.append(extras(p,phase,'Authored Tideglass state using existing generated A5b rim and A8 mist; not a newly generated clock painting.'))
    rows=[(p,Image.open(OUT/'proofs'/f'{p}.png')) for p in PHASES]
    contact(rows,OUT/'clock-contact.png','Tideglass / dawn, midday, dusk, night / authored composite',columns=4,tile=(400,460))
    evidence.append(extras(OUT/'clock-contact.png','clock-contact','Four composited states, with independent water, meniscus, glass, hour marks and pointer.'))
    contact([(i,im) for i,im in source_icons.items()],OUT/'stat-contact.png','A11 / coins, laurel seal, guttering candle / authored candidates',columns=3,tile=(420,460))
    evidence.append(extras(OUT/'stat-contact.png','stat-contact','Header 32px and large 128px design sizes have separate atlas regions; source rasters are 2x. New generated icon requirement remains pending.'))
    for r in evidence:
        if r['id'] in ['stat-contact','clock-contact']:
            gp=ART/'grades'/('a11-authored-'+r['id']+'.json')
            if gp.exists() and read(gp)['image_sha256']==r['sha256']:r['local']=read(gp)
            r['direct']={'verdict':'owner-review','owner_accepted':False,'note':
                'Clear distinct stat silhouettes, but regular beveled geometry does not meet the painted Covenant bar. Design reference only; replace with generated paintings after provider availability.' if r['id']=='stat-contact' else
                'Four readable light states and coherent shared rim. The sky is visibly geometric and water is regular authored linework; generated painting remains needed. Reused rim and mist preserve source painting, not new generation.'}
    write(OUT/'proofs.json',{'rows':evidence,'owner_accepted':False});board('A11',evidence)
    p=ART/'review/a11/index.html';s=p.read_text(encoding='utf-8').replace('<main>','<p><strong>PARTIAL: no new generation; both providers stopped.</strong> <a href="motion.html">Open actual clock and header-size canvas preview</a>. All stat geometry and sky plates are authored. Existing generated A5b rim and A8 mist are reused with provenance.</p><main>');p.write_text(s,encoding='utf-8')


def check():
    k=read(UI/'kit.json');b=read(ART/'waves/A11/baseline-ui.json');errors=[]
    from covenant_ui import validate
    errors.extend(validate(k))
    for path,h in b['files'].items():
        if sha(ROOT/path)!=h:errors.append('A5B_PAGE_CHANGED:'+path)
    for key,rec in b['kit']['regions'].items():
        if k['regions'].get(key)!=rec:errors.append('A5B_REGION_CHANGED:'+key)
    pages={p['id']:p for p in k['pages']}
    for p in pages.values():
        if sha(UI/p['file'])!=p['sha256']:errors.append('PAGE_HASH:'+p['id'])
    fresh={i:r for i,r in k['regions'].items() if i not in b['kit']['regions']};boxes=[]
    for key,r in fresh.items():
        im=Image.open(UI/pages[r['page']]['file']);x,y,w,h=r['rect'];boxes.append((key,x,y,w,h))
        if x<2 or y<2 or x+w+2>im.width or y+h+2>im.height:errors.append('RECT:'+key)
        crop=im.crop((x,y,x+w,y+h));metric=alpha_metrics(crop)
        if metric['empty'] or metric['margin_px']<2:errors.append('ALPHA_MARGIN:'+key)
        if min(w/r['designSize'][0],h/r['designSize'][1])<4/3:errors.append('1440_DENSITY:'+key)
        gutter=np.asarray(im.crop((x-2,y-2,x+w+2,y+h+2)).getchannel('A')).copy();gutter[2:-2,2:-2]=0
        if gutter.max():errors.append('GUTTER:'+key)
    for i,(key,x,y,w,h) in enumerate(boxes):
        for key2,x2,y2,w2,h2 in boxes[i+1:]:
            if x<x2+w2+2 and x+w+2>x2 and y<y2+h2+2 and y+h+2>y2:errors.append('OVERLAP:'+key+key2)
    for phase in PHASES:
        if 'clock.daily.face.'+phase not in fresh:errors.append('PHASE:'+phase)
    provenance=read(OUT/'provenance.json')['clock']
    for field in ['rim','mist']:
        rec=provenance[field];path=rec.get('source',rec.get('page'));expected=rec.get('sha256',rec.get('pageSha256'))
        if sha(ROOT/path)!=expected:errors.append('REUSED_SOURCE_HASH:'+field)
    for name in ['stat-contact','clock-contact']:
        gp=ART/'grades'/('a11-authored-'+name+'.json')
        if not gp.exists() or read(gp)['image_sha256']!=sha(OUT/(name+'.png')):errors.append('LOCAL_REVIEW:'+name)
        elif read(gp)['verdict']=='reject':errors.append('LOCAL_REJECT:'+name)
    if read(OUT/'provenance.json')['newGeneratedImages']!=0:errors.append('FALSE_GENERATION_CLAIM')
    report={'status':'fail' if errors else 'pass','errors':errors,'preservedRegions':len(b['kit']['regions']),'newRegions':len(fresh),
      'generatedRequirementComplete':False,'owner_accepted':False,'scope':'hashes, preserved A5b data, bounds, alpha, gutters, density and layer coverage; owner feel unmeasured'}
    write(ART/'reports/a11-delivery-check.json',report);print(report);return report


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('command');a=p.parse_args()
    if a.command=='build':build()
    elif check()['errors']:raise SystemExit(1)
