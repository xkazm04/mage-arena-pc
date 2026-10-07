"""Deterministic Covenant keying, crop/anchor export and far-camera composites."""
import argparse
import json
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from common import ART, ROOT, read, write, sha, relative
from covenant import board, font, jobs

OUT=ART/'delivery/a3c'


def key_magenta(im, thresholds=(80,150)):
    rgb=np.asarray(im.convert('RGB')).astype(np.float32)
    chroma=np.minimum(rgb[:,:,0]-rgb[:,:,1],rgb[:,:,2]-rgb[:,:,1])
    # Preserve pale lilac and blue pigment. The old 20..55 cutoff erased Air
    # highlights and decontamination turned them green. Only strongly saturated
    # magenta is key material; conservative edges are reviewed on real floors.
    low,high=thresholds
    alpha=np.clip((high-chroma)/(high-low),0,1)
    if not np.any(chroma>180):raise ValueError('NO_KEY_BACKGROUND')
    matte=np.median(rgb[chroma>180],axis=0)
    clean=np.clip((rgb-(1-alpha[:,:,None])*matte)/np.maximum(alpha[:,:,None],.05),0,255)
    clean[alpha==0]=0
    return Image.fromarray(np.concatenate([clean,np.round(alpha[:,:,None]*255)],axis=2).astype('uint8'))


def export():
    spec=read(ART/'covenant-battle-crops.json');rows=[];atlases=[]
    for entity in spec['entities']:
        job=next(j for j in jobs('A3c') if j['id']==entity['job'])
        direct=read(ART/'waves/A3c/reviews'/(job['id']+'.json'))
        if direct['verdict']=='reject':raise ValueError('REJECTED_SOURCE:'+job['id'])
        source=Image.open(ROOT/job['archive']);atlas=Image.new('RGBA',(1024,1024))
        for i,frame in enumerate(entity['frames']):
            crop=frame['crop'];piece=key_magenta(source.crop(crop));bbox=piece.getbbox()
            if not bbox:raise ValueError('EMPTY_SPRITE')
            top,sole=frame['body_y'];body=sole-top
            scale=160/body
            # Keep a fixed 512px cell. Ground contact is explicitly authored, not aura bounds.
            piece=piece.resize((round(piece.width*scale),round(piece.height*scale)),Image.Resampling.LANCZOS)
            anchor=frame['foot'];offset=(round(256-(anchor[0]-crop[0])*scale),round(400-(anchor[1]-crop[1])*scale))
            cell=Image.new('RGBA',(512,512));cell.alpha_composite(piece,offset)
            bounds=cell.getbbox()
            if not bounds or min(bounds[:2])<3 or max(bounds[2:])>509:raise ValueError('SPRITE_CLIP:'+entity['id']+frame['state'])
            p=OUT/'frames'/(entity['id']+'-'+frame['state']+'.png');p.parent.mkdir(parents=True,exist_ok=True);cell.save(p)
            x=(i%2)*512;y=(i//2)*512;atlas.alpha_composite(cell,(x,y))
            rows.append({'entity':entity['id'],'kind':entity['kind'],'state':frame['state'],'file':relative(p),'sha256':sha(p),
              'source':job['archive'],'source_sha256':job['sha256'],'source_crop':crop,'body_y_source':frame['body_y'],
              'body_measurement':'authored pixel head-to-sole estimate, excluding staff and aura','foot_source':anchor,
              'master_body_px':160,'size':[512,512],'anchor':[.5,400/512],'atlas_rect':[x,y,512,512],
              'keying':'magenta chroma 80..150, matte edge decontamination; preserves pale lilac','owner_accepted':False})
        p=OUT/'atlases'/(entity['id']+'.png');p.parent.mkdir(exist_ok=True);atlas.save(p)
        atlases.append({'entity':entity['id'],'file':relative(p),'sha256':sha(p),'size':[1024,1024],
                        'states':[f['state'] for f in entity['frames']],'animation':'four static keys; no in-between or full walk cycle'})
    manifest={'schema':1,'scale_contract':'art/scale-contract-v2.json','frames':rows,'atlases':atlases,
              'owner_accepted':False,'unsupported':['additional facings','in-between animation','complete locomotion cycles'],'rgba':'straight alpha; linear filtering; no mipmaps'}
    write(OUT/'figures.json',manifest);return manifest


def effect(kind,school,size=256,facing_degrees=0):
    """Native exact geometry; textures are separate from mechanical boundary."""
    colors=read(ART/'style-covenant.json')['elements'];color=colors[school]['color']
    im=Image.new('RGBA',(size,size));d=ImageDraw.Draw(im);cx=cy=size/2
    if kind=='absorb':
        # Screen-right facing; inverse projection recovers exactly +/-70 degrees.
        r=size*.37;sy=math.sin(math.radians(55))
        points=[(cx+r*math.cos(math.radians(a)),cy+r*sy*math.sin(math.radians(a))) for a in np.linspace(facing_degrees-70,facing_degrees+70,141)]
        d.line(points,fill='#111a25',width=13);d.line(points,fill=color,width=7);d.line(points,fill='#f1f7ed',width=3)
    elif kind=='bolt':
        d.line([(24,128),(216,128)],fill='#0c1520',width=14);d.line([(24,128),(216,128)],fill=color,width=8)
        d.line([(54,128),(220,128)],fill='#ffffef',width=4);d.polygon([(222,119),(239,128),(222,137)],fill=color)
    elif kind=='telegraph':
        d.ellipse((22,48,234,208),outline='#111a25',width=12)
        d.ellipse((22,48,234,208),outline=color,width=5)
        for x,y in [(22,128),(234,128),(128,48),(128,208)]:d.polygon([(x,y-8),(x+8,y),(x,y+8),(x-8,y)],fill='#fff1c8')
    elif kind=='perfect':
        for a in range(0,360,45):
            r=96 if a%90==0 else 52;t=math.radians(a)
            d.line([(128,128),(128+math.cos(t)*r,128+math.sin(t)*r)],fill=color,width=9)
        d.ellipse((115,115,141,141),fill='#ffffef')
    elif kind=='aura':
        for i in range(14):
            a=i*2.399;x=128+math.cos(a)*(52+i*3);y=154+math.sin(a)*(22+i)
            if school=='earth':d.polygon([(x,y-5),(x+5,y),(x,y+4),(x-4,y)],fill=color)
            elif school=='air':d.line([(x-6,y+6),(x,y),(x+6,y+2),(x+3,y-7)],fill=color,width=2)
            elif school=='fire':d.polygon([(x-3,y+4),(x+1,y-7),(x+4,y+4)],fill=color)
            else:d.ellipse((x-2,y-4,x+2,y+3),fill=color)
    return im


def effects():
    rows=[]
    for school in ('fire','water','earth','air'):
        for kind in ('aura','bolt','absorb','perfect','telegraph'):
            im=effect(kind,school);p=OUT/'effects'/(school+'-'+kind+'.png');p.parent.mkdir(parents=True,exist_ok=True);im.save(p)
            rows.append({'id':school+'.'+kind,'file':relative(p),'sha256':sha(p),'size':[256,256],'anchor':[.5,.5],
             'origin':'authored native geometry','absorb_angle_degrees':140 if kind=='absorb' else None,
             'use':'visual only; game owns timing and hitbox','blend':'normal','owner_accepted':False})
    write(OUT/'effects.json',{'schema':1,'effects':rows,'school_identity':'shape and colour','minimum_projectile_core_px_at_1080p':4})
    return rows


def painted_effects():
    found=[j for j in jobs('A3c') if j['scene']=='elemental-effects']
    if not found:return []
    job=found[-1];im=Image.open(ROOT/job['archive']);rows=[]
    for y,school in enumerate(('fire','water','earth','air')):
        for x,kind in enumerate(('bolt','impact','aura')):
            crop=[x*im.width//4,y*im.height//4,(x+1)*im.width//4,(y+1)*im.height//4]
            piece=key_magenta(im.crop(crop));box=piece.getbbox()
            if not box:raise ValueError('EMPTY_EFFECT')
            # These are tintable game VFX masks: map RGB to the authored school
            # pigment after keying, retaining alpha and painted light variation.
            # This prevents magenta-matte spill from changing elemental identity.
            rgba=np.asarray(piece).copy();rgb=rgba[:,:,:3].astype(np.float32)
            value=rgb.max(axis=2)/255
            color=read(ART/'style-covenant.json')['elements'][school]['color']
            base=np.array([int(color[k:k+2],16) for k in (1,3,5)],dtype=np.float32)
            hot=np.clip((rgb.min(axis=2)-175)/80,0,1)
            mapped=base[None,None,:]*value[:,:,None]
            mapped=mapped*(1-hot[:,:,None])+255*hot[:,:,None]
            rgba[:,:,:3]=np.clip(mapped,0,255).astype('uint8');piece=Image.fromarray(rgba)
            # Preserve source-cell aspect and position; never infer mechanical geometry from pixels.
            piece=piece.resize((256,256),Image.Resampling.LANCZOS)
            p=OUT/'effects'/('painted-'+school+'-'+kind+'.png');piece.save(p)
            rows.append({'id':school+'.painted.'+kind,'file':relative(p),'sha256':sha(p),'size':[256,256],
              'anchor':[.5,.5],'source':job['archive'],'source_sha256':job['sha256'],'crop':crop,
              'origin':'generated painted motif, locally keyed and mapped to school pigment; painted alpha/light retained','use':'decorative texture only; exact arc/hitbox uses native geometry','owner_accepted':False})
    write(OUT/'painted-effects.json',{'schema':1,'effects':rows});return rows


def contact(manifest):
    rows=manifest['frames'];canvas=Image.new('RGB',(1536,math.ceil(len(rows)/6)*260),'#142029');d=ImageDraw.Draw(canvas)
    for i,r in enumerate(rows):
        im=Image.open(ROOT/r['file']).resize((256,256),Image.Resampling.LANCZOS)
        x=(i%6)*256;y=(i//6)*260;canvas.paste(im,(x,y),im)
        d.text((x+8,y+235),r['entity']+' / '+r['state'],font=font(16),fill='#e9e6d9')
    p=OUT/'key-contact.png';canvas.save(p)
    return {'id':'key-contact','file':relative(p),'sha256':sha(p),'note':'Exported keys only; excluded source cells do not appear. Enlarged review, not native game scale.','owner_accepted':False}


def paste_body(canvas,row,foot,body_height):
    scale=body_height/row['master_body_px'];im=Image.open(ROOT/row['file']).convert('RGBA')
    im=im.resize((round(512*scale),round(512*scale)),Image.Resampling.LANCZOS)
    shadow=Image.new('RGBA',canvas.size);d=ImageDraw.Draw(shadow)
    d.ellipse((foot[0]-body_height*.32,foot[1]-body_height*.08,foot[0]+body_height*.32,foot[1]+body_height*.08),fill=(0,0,0,120))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(1)))
    canvas.alpha_composite(im,(round(foot[0]-256*scale),round(foot[1]-400*scale)))


def composites(manifest):
    rows=[];frames=manifest['frames'];names=['brennic','cassia','garran','iskar','conscript','shieldman','slinger','netter','cinder_hound','mire_maw','thornback','hush_moth']
    positions=[(.29,.64),(.44,.69),(.59,.63),(.73,.69),(.29,.37),(.41,.33),(.57,.34),(.71,.36),(.35,.47),(.53,.44),(.66,.47),(.78,.52)]
    for palette in ('verdigris','rust-sand','moonlit'):
        for w,h in [(1920,1080),(2560,1440)]:
            canvas=Image.open(ART/'delivery/a7'/f'arena-{palette}-{w}.png').convert('RGBA');placements=[]
            for entity,pos in zip(names,positions):
                found=[r for r in frames if r['entity']==entity]
                if not found:continue
                row=found[0];foot=(round(pos[0]*w),round(pos[1]*h));height=round(h*.0375)
                if entity in names[:4]:
                    school=('fire','water','earth','air')[names.index(entity)]
                    aura_path=OUT/'effects'/('painted-'+school+'-aura.png')
                    aura=effect('aura',school) if school=='earth' or not aura_path.exists() else Image.open(aura_path).convert('RGBA')
                    side=round(82*h/1080);aura=aura.resize((side,side),Image.Resampling.LANCZOS)
                    aura.putalpha(aura.getchannel('A').point(lambda a:round(a*.65)))
                    canvas.alpha_composite(aura,(round(foot[0]-side/2),round(foot[1]-side*.52)))
                paste_body(canvas,row,foot,height);placements.append({'entity':entity,'body_px':height,'screen_fraction':height/h,'foot':foot})
            # Exact forward ward and outgoing bolt live separately from the sprite's decorative aura.
            factor=h/1080;foot=(.44*w,.69*h)
            arc=effect('absorb','water',facing_degrees=-50).resize((round(146*factor),round(146*factor)),Image.Resampling.LANCZOS)
            canvas.alpha_composite(arc,(round(foot[0]-73*factor),round(foot[1]-73*factor)))
            # A short projectile core in flight, not a detached full-length beam.
            d=ImageDraw.Draw(canvas);d.line([(int(.49*w),int(.58*h)),(int(.51*w),int(.54*h))],fill='#102637',width=round(8*factor));d.line([(int(.49*w),int(.58*h)),(int(.51*w),int(.54*h))],fill='#a9efff',width=round(4*factor))
            p=OUT/'proofs'/f'{palette}-{w}.png';p.parent.mkdir(exist_ok=True);canvas.convert('RGB').save(p)
            rows.append({'id':palette+'-'+str(w),'file':relative(p),'sha256':sha(p),'size':[w,h],'placements':placements,'note':'Native-resolution authored composite. No generated background figures. Nominal body 3.75%; not gameplay or animation.','owner_accepted':False})
    strip=Image.new('RGB',(1920,650),'#223039');d=ImageDraw.Draw(strip)
    for index,entity in enumerate(names[:4]):
        found=[r for r in frames if r['entity']==entity]
        if not found:continue
        for n,fraction in enumerate([.03,.0375,.045]):
            x=150+index*460+n*115;rgba=strip.convert('RGBA');paste_body(rgba,found[0],(x,320),round(1080*fraction));strip=rgba.convert('RGB');d=ImageDraw.Draw(strip)
            d.text((x-36,355),f'{fraction*100:g}%',font=font(24),fill='#eee6d6')
        d.text((100+index*460,230),entity.title(),font=font(28),fill='#eee6d6')
    d.text((80,60),'COVENANT / BODY SCALE AT 1080p',font=font(38),fill='#eee6d6');d.text((80,120),'Head to sole excludes staff, shadow and aura. View at 100%.',font=font(28),fill='#b8cacd')
    p=OUT/'proofs/scale-strip-1920.png';strip.save(p);rows.append({'id':'scale-strip','file':relative(p),'sha256':sha(p),'note':'Native 3 / 3.75 / 4.5 percent scale comparison.','owner_accepted':False})
    write(OUT/'proofs.json',{'proofs':rows,'scale_contract_sha256':sha(ART/'scale-contract-v2.json')});return rows


def check():
    m=read(OUT/'figures.json');errors=[]
    ids={r['entity'] for r in m['frames']};expected=set(read(ART/'covenant-battle-roster.json')['entities'])
    for missing in expected-ids:errors.append('MISSING:'+missing)
    for r in m['frames']:
        p=ROOT/r['file'];im=Image.open(p)
        if sha(p)!=r['sha256'] or sha(ROOT/r['source'])!=r['source_sha256']:errors.append('HASH:'+r['file'])
        if im.mode!='RGBA' or im.getchannel('A').getextrema()!=(0,255):errors.append('ALPHA:'+r['file'])
        if im.size!=(512,512):errors.append('SIZE:'+r['file'])
    for r in read(OUT/'proofs.json')['proofs']:
        if sha(ROOT/r['file'])!=r['sha256']:errors.append('PROOF_HASH')
        for p in r.get('placements',[]):
            if not .03<=p['screen_fraction']<=.045:errors.append('BODY_SCALE')
    result={'status':'fail' if errors else 'pass','errors':errors,'entities':len(ids),'frames':len(m['frames']),
            'scope':'file/alpha/crop/scale integrity only','animation_and_feel':'not measured','owner_accepted':False}
    write(ART/'reports/a3c-battle-check.json',result);print(json.dumps(result));return result


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('command',choices=['build','check']);a=p.parse_args()
    if a.command=='build':
        m=export();effects();painted_effects();proofs=composites(m);board('A3c',proofs+[contact(m)])
    elif check()['errors']:raise SystemExit(1)
