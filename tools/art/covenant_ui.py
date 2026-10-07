"""Build/check the published Covenant canvas interchange kit. No paid calls."""
from __future__ import annotations
import argparse
import csv
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageOps
from common import ART, ROOT, read, write, relative, sha
from covenant_battle import key_magenta

UI=ART/'ui'
INK='#101820';SILVER='#b8c4c2';LIGHT='#eee8d6';TEAL='#7ecbbb';GOLD='#d5b978'
REQUIRED={
 'panel':['body','header','tooltip','modal','story'],
 'button':['normal','hover','focus','pressed','disabled'],
 'tab':['normal','hover','focus','selected','disabled'],
 'slot':['normal','hover','focus','selected','locked','cooldown','borrowed'],
 'bar':['track','hp','mana','stamina','cast','cooldown'],
 'clock':['rim','face','hand','pip.off','pip.on'],
 'cursor':['pointer','aim','interact','blocked'],
 'card':['normal','unread','selected','warning']}
ICON_IDS=['fire','water','earth','air','hp','mana','stamina','heat','flow','footing','momentum',
 'water-bolt','water-tide-orb','water-lash','water-mire','water-mend','water-mirror',
 'inventory','journal','knowing','trust','gold','food','day','dusk','night','calendar','camp','arena',
 'save','load','pause','settings','back','next','close','lock','check','warning','absorb','perfect',
 'staff','wardstone','map','parley','results','keyboard','gamepad','mouse']


def nine_slice(im,size,insets):
    w,h=size;l,t,r,b=insets
    if w<l+r or h<t+b:raise ValueError('NINE_SLICE_TOO_SMALL')
    sx=[0,l,im.width-r,im.width];sy=[0,t,im.height-b,im.height]
    dx=[0,l,w-r,w];dy=[0,t,h-b,h];out=Image.new('RGBA',size)
    for y in range(3):
        for x in range(3):
            crop=im.crop((sx[x],sy[y],sx[x+1],sy[y+1]));dest=(dx[x+1]-dx[x],dy[y+1]-dy[y])
            if min(dest)>0:out.alpha_composite(crop.resize(dest,Image.Resampling.LANCZOS),(dx[x],dy[y]))
    return out


def native_symbol(name,size=128):
    """Original editable-by-code geometry; never imports superseded icon pixels."""
    k=4;im=Image.new('RGBA',(size*k,size*k));d=ImageDraw.Draw(im)
    def line(points,fill=LIGHT,width=6):d.line([(int(x*size*k/128),int(y*size*k/128)) for x,y in points],fill=fill,width=round(width*size*k/128),joint='curve')
    def ellipse(box,fill=None,outline=LIGHT,width=5):d.ellipse(tuple(int(v*size*k/128) for v in box),fill=fill,outline=outline,width=round(width*size*k/128))
    def poly(points,fill=LIGHT):d.polygon([(int(x*size*k/128),int(y*size*k/128)) for x,y in points],fill=fill)
    def rect(box,fill=None,outline=LIGHT,width=5):d.rectangle(tuple(int(v*size*k/128) for v in box),fill=fill,outline=outline,width=round(width*size*k/128))
    school=next((s for s in ('fire','water','earth','air') if name==s or name.startswith(s+'-')),None)
    color=read(ART/'style-covenant.json')['elements'][school]['color'] if school else TEAL
    if name in ('fire','heat'):
        poly([(62,15),(53,48),(35,39),(27,77),(46,105),(81,108),(103,81),(86,49),(77,65)],'#a44d29');line([(63,20),(55,51),(39,47),(35,78),(50,99),(80,100),(95,79),(83,60)],'#ffbb68',5)
        poly([(66,57),(51,82),(61,99),(78,88)],LIGHT)
    elif name in ('water','mana','water-tide-orb','flow'):
        line([(65,18),(33,60),(30,78),(43,99),(65,108),(90,98),(100,77),(95,57),(65,18)],color if school else '#83d8ea',6)
        line([(41,77),(52,87),(72,85),(83,72)],LIGHT,4)
        if name=='flow':ellipse((50,53,70,73),fill=LIGHT)
    elif name in ('earth','footing'):
        poly([(29,46),(61,20),(99,43),(108,81),(77,107),(31,94),(18,67)],'#907a50')
        line([(29,46),(61,20),(99,43),(108,81),(77,107),(31,94),(18,67),(29,46)],'#e1c78c',5)
        line([(29,46),(63,61),(99,43),(63,61),(77,107)],LIGHT,4)
    elif name in ('air','momentum'):
        line([(20,46),(84,46),(97,36),(89,24),(75,27)],'#c5b8f1',6)
        line([(14,65),(107,65),(96,77),(74,75)],LIGHT,5)
        line([(28,85),(65,85),(81,101),(66,109)],'#c5b8f1',5)
    elif name in ('water-bolt','next'):
        line([(20,89),(97,33)],color,9);poly([(77,28),(108,23),(104,55)],LIGHT)
    elif name=='water-lash':
        line([(22,86),(45,49),(81,33),(103,49),(86,68),(51,64),(36,80)],color,8)
    elif name=='water-mire':
        ellipse((20,61,109,101),outline=color,width=5);line([(28,45),(48,36),(68,44),(94,31)],LIGHT,6)
    elif name in ('water-mend','hp'):
        poly([(52,25),(78,25),(78,51),(104,51),(104,77),(78,77),(78,103),(52,103),(52,77),(26,77),(26,51),(52,51)],'#edb3a1' if name=='hp' else color)
        rect((57,30,72,97),fill=LIGHT,outline=None)
    elif name in ('water-mirror','absorb'):
        pts=[(50+44*math.cos(math.radians(a)),64+44*math.sin(math.radians(a))) for a in range(-70,71,4)]
        line(pts,color if school else TEAL,7);line([(22,64),(64,64)],LIGHT,5)
    elif name=='save':
        poly([(38,18),(86,18),(102,39),(95,105),(31,105),(24,39)],SILVER)
        rect((39,34,87,76),fill=INK,outline=GOLD,width=4);line([(48,53),(61,66),(80,43)],TEAL,5)
    elif name=='inventory':
        line([(38,38),(42,20),(82,20),(90,38)],GOLD,6)
        poly([(30,38),(98,38),(107,104),(20,104)],'#38484c');line([(30,38),(98,38),(107,104),(20,104),(30,38)],SILVER,6)
        line([(30,61),(98,61)],LIGHT,5);rect((55,53,74,77),fill=GOLD,outline=None)
    elif name=='lock':
        rect((28,53,101,106),fill='#24343b',outline=LIGHT,width=6)
        line([(40,55),(40,32),(49,20),(77,20),(88,31),(88,55)],GOLD,6)
        ellipse((59,69,71,81),fill=TEAL)
    elif name in ('journal','knowing','inventory','load'):
        rect((27,22,100,108),fill='#24343b',outline=SILVER,width=6)
        line([(40,24),(40,107)],GOLD,5)
        for y in (46,65,84):line([(51,y),(86,y)],LIGHT,4)
        if name=='knowing':ellipse((54,46,84,76),outline=TEAL,width=5)
        if name=='load':line([(94,44),(111,61),(96,78)],TEAL,7)
    elif name in ('day','dusk','night','calendar'):
        if name=='night':
            ellipse((22,20,106,106),fill=LIGHT,outline=None);ellipse((51,11,116,82),fill=INK,outline=None)
        else:
            ellipse((40,37,88,85),fill=GOLD,outline=None)
            for a in range(0,360,45):
                t=math.radians(a);line([(64+34*math.cos(t),61+34*math.sin(t)),(64+46*math.cos(t),61+46*math.sin(t))],LIGHT,4)
            if name=='dusk':rect((12,81,118,114),fill=INK,outline=None);line([(20,84),(108,84)],TEAL,5)
            if name=='calendar':rect((15,13,113,115),outline=SILVER,width=4)
    elif name in ('close','check','back','pause'):
        if name=='close':line([(31,31),(97,97)]);line([(97,31),(31,97)])
        elif name=='check':line([(23,67),(51,96),(105,30)],TEAL,9)
        elif name=='back':line([(91,27),(40,64),(91,101)],LIGHT,8)
        else:rect((34,24,51,106),fill=LIGHT,outline=None);rect((78,24,95,106),fill=LIGHT,outline=None)
    elif name in ('warning','perfect','results'):
        if name=='warning':
            line([(64,16),(112,106),(16,106),(64,16)],GOLD,6);line([(64,45),(64,77)],LIGHT,7);ellipse((60,89,68,97),fill=LIGHT)
        else:
            poly([(64,13),(76,48),(112,64),(76,78),(64,113),(51,78),(16,64),(51,49)],GOLD)
            ellipse((51,51,77,77),fill=LIGHT,outline=None)
    elif name in ('camp','map','arena','wardstone'):
        if name=='wardstone':poly([(49,20),(78,13),(95,109),(30,109)],SILVER);line([(63,33),(58,67),(75,88)],TEAL,5)
        elif name=='arena':ellipse((17,28,112,104),outline=SILVER,width=8);ellipse((36,43,93,86),outline=GOLD,width=4)
        elif name=='camp':line([(15,104),(62,26),(112,104),(15,104)],LIGHT,6);line([(62,26),(69,104),(88,104)],TEAL,6)
        else:line([(16,31),(44,18),(79,32),(112,20),(112,101),(80,113),(44,99),(16,110),(16,31)],LIGHT,5);line([(44,20),(44,98),(79,112),(79,32)],TEAL,4)
    elif name in ('trust','parley'):
        ellipse((18,23,107,91),outline=TEAL,width=6);line([(44,87),(36,110),(69,90)],TEAL,5)
        for x in (41,63,85):ellipse((x-3,52,x+3,58),fill=LIGHT)
    elif name in ('gold','food','stamina','staff'):
        if name=='gold':ellipse((27,24,103,105),fill='#826b40',outline=GOLD,width=7);line([(64,39),(45,65),(66,91),(85,65),(64,39)],LIGHT,5)
        elif name=='food':ellipse((26,32,104,105),fill='#957f55',outline=GOLD,width=5);line([(49,42),(42,75)],LIGHT,5);line([(71,41),(62,79)],LIGHT,5)
        elif name=='staff':line([(31,110),(82,22)],GOLD,8);ellipse((72,12,103,43),outline=TEAL,width=5)
        else:poly([(73,14),(32,70),(58,70),(48,114),(102,50),(72,50)],GOLD)
    elif name in ('keyboard','gamepad','mouse'):
        if name=='mouse':
            ellipse((34,19,94,110),outline=LIGHT,width=6);line([(64,21),(64,53)],TEAL,6);line([(38,58),(90,58)],SILVER,4)
        else:
            rect((16,34,113,96),fill='#23333d',outline=SILVER,width=5)
            if name=='keyboard':
                for y in (48,66):
                    for x in (28,48,68,88):rect((x,y,x+10,y+8),fill=LIGHT,outline=None)
            else:
                line([(29,63),(56,63)],LIGHT,6);line([(42,50),(42,76)],LIGHT,6);ellipse((81,49,93,61),fill=TEAL);ellipse((96,64,108,76),fill=GOLD)
    else:
        # Settings: broken gear with central opening.
        ellipse((33,33,97,97),outline=SILVER,width=9);ellipse((53,53,77,77),outline=TEAL,width=5)
        for a in range(0,360,45):
            t=math.radians(a);line([(64+32*math.cos(t),64+32*math.sin(t)),(64+46*math.cos(t),64+46*math.sin(t))],LIGHT,8)
    return im.resize((size,size),Image.Resampling.LANCZOS)


def state_frame(base,state,overlay_only=False):
    im=Image.new('RGBA',base.size) if overlay_only else base.copy();d=ImageDraw.Draw(im);w,h=im.size
    if state=='hover':
        rgb=ImageEnhance.Brightness(base.convert('RGB')).enhance(1.18);im=rgb.convert('RGBA');im.putalpha(base.getchannel('A'));d=ImageDraw.Draw(im)
        d.line([(16,h-9),(w-16,h-9)],fill=TEAL,width=3)
    elif state=='focus':
        for inset in (5,10):
            for xx0,xx1 in [(inset,w//2-7),(w//2+7,w-inset-1)]:
                d.line((xx0,inset,xx1,inset),fill=LIGHT,width=2);d.line((xx0,h-inset-1,xx1,h-inset-1),fill=LIGHT,width=2)
            for yy0,yy1 in [(inset,h//2-5),(h//2+5,h-inset-1)]:
                d.line((inset,yy0,inset,yy1),fill=LIGHT,width=2);d.line((w-inset-1,yy0,w-inset-1,yy1),fill=LIGHT,width=2)
        for x,y,dx,dy in [(13,13,1,1),(w-14,13,-1,1),(13,h-14,1,-1),(w-14,h-14,-1,-1)]:
            d.polygon([(x,y),(x+dx*12,y),(x,y+dy*12)],fill=TEAL)
    elif state=='pressed':
        rgb=ImageEnhance.Brightness(base.convert('RGB')).enhance(.68);im=rgb.convert('RGBA');im.putalpha(base.getchannel('A'));d=ImageDraw.Draw(im)
        d.line([(20,12),(w-20,12)],fill=GOLD,width=3)
    elif state in ('disabled','locked'):
        rgb=ImageOps.grayscale(base).convert('RGB');rgb=ImageEnhance.Brightness(rgb).enhance(.6);im=rgb.convert('RGBA');im.putalpha(base.getchannel('A'));d=ImageDraw.Draw(im)
        for x in range(20,w-20,18):d.line([(x,h-15),(x+7,h-22)],fill='#7a878b',width=2)
        if state=='locked':
            mark=native_symbol('lock',36);im.alpha_composite(mark,((w-36)//2,(h-36)//2))
    elif state in ('selected','unread'):
        d.rectangle((9,9,w-10,h-10),outline=GOLD,width=3)
        d.polygon([(w//2-8,h-14),(w//2,h-23),(w//2+8,h-14)],fill=GOLD)
        if state=='unread':d.ellipse((w-32,18,w-18,32),fill=TEAL)
    elif state=='borrowed':
        for x in range(15,w-15,15):d.line([(x,9),(x+7,9)],fill='#c9b9ed',width=3)
        d.polygon([(w-27,h-27),(w-15,h-21),(w-27,h-15),(w-39,h-21)],fill='#c9b9ed')
    elif state=='cooldown':
        d.arc((12,12,w-12,h-12),-90,100,fill='#87969e',width=5)
    elif state=='warning':
        d.rectangle((9,9,w-10,h-10),outline='#dcaa71',width=3)
        mark=native_symbol('warning',32);im.alpha_composite(mark,(w-51,17))
    return im


def build():
    source=read(UI/'source-crops.json');assert sha(ROOT/source['source'])==source['source_sha256']
    raw=Image.open(ROOT/source['source']);primitives={}
    for name,crop in source['primitives'].items():
        im=key_magenta(raw.crop(crop),thresholds=(20,65));im=im.crop(im.getbbox());target=(256,96) if name=='button' else ((192,192) if name=='clock' else (256,256))
        contained=ImageOps.contain(im,(target[0]-4,target[1]-4),Image.Resampling.LANCZOS);im=Image.new('RGBA',target);im.alpha_composite(contained,((target[0]-contained.width)//2,(target[1]-contained.height)//2));primitives[name]=im
        p=UI/'sources'/(name+'.png');p.parent.mkdir(exist_ok=True);im.save(p)
    items={};meta={}
    def add(name,im,**kw):items[name]=im;meta[name]={'anchor':[0,0],**kw}
    for state in REQUIRED['panel']:
        im=primitives['panel'].copy();add('panel.'+state,im,nineSlice=[42]*4,minSize=[112,112],contentInsets=[50]*4)
    for kind in ('button','tab'):
        for state in REQUIRED[kind]:
            im=state_frame(primitives['button'],state,overlay_only=kind=='tab' and state=='focus')
            add(kind+'.'+state,im,nineSlice=[34,25,34,25],minSize=[112,64],contentInsets=[38,20,38,20])
    base=primitives['slot'].resize((128,128),Image.Resampling.LANCZOS)
    for state in REQUIRED['slot']:
        add('slot.'+state,state_frame(base,state,overlay_only=state=='focus'),nineSlice=[22]*4,minSize=[64,64],contentInsets=[26]*4)
    for state in REQUIRED['card']:
        add('card.'+state,state_frame(primitives['panel'],state),nineSlice=[42]*4,minSize=[112,112],contentInsets=[50]*4)
    track=Image.new('RGBA',(256,32));d=ImageDraw.Draw(track);d.polygon([(8,1),(248,1),(255,16),(248,31),(8,31),(1,16)],fill=INK,outline=SILVER);d.line([(12,6),(244,6)],fill='#556669',width=2)
    add('bar.track',track,nineSlice=[16,8,16,8],minSize=[40,20],contentInsets=[9,7,9,7])
    colors={'hp':'#b35d50','mana':'#579cb5','stamina':'#bfac6d','cast':'#a4d6c6','cooldown':'#697c8c'}
    for name,c in colors.items():
        im=Image.new('RGBA',(256,18));d=ImageDraw.Draw(im);d.rectangle((0,1,255,16),fill=c);d.line((0,2,255,2),fill=LIGHT,width=1)
        add('bar.'+name,im,anchor=[0,.5])
    add('clock.rim',primitives['clock'],anchor=[.5,.5])
    im=Image.new('RGBA',(192,192));d=ImageDraw.Draw(im);d.ellipse((29,29,163,163),fill=INK,outline='#4d676b',width=2)
    for a in range(0,360,30):
        t=math.radians(a);d.line([(96+55*math.cos(t),96+55*math.sin(t)),(96+61*math.cos(t),96+61*math.sin(t))],fill=SILVER,width=2)
    add('clock.face',im,anchor=[.5,.5]);im=Image.new('RGBA',(192,192));d=ImageDraw.Draw(im);d.polygon([(91,98),(96,39),(101,98),(96,112)],fill=GOLD);d.ellipse((91,91,101,101),fill=LIGHT);add('clock.hand',im,anchor=[.5,.5])
    for state,c in [('off','#344349'),('on',GOLD)]:
        im=Image.new('RGBA',(24,24));d=ImageDraw.Draw(im);d.polygon([(12,2),(22,12),(12,22),(2,12)],fill=c,outline=SILVER);add('clock.pip.'+state,im,anchor=[.5,.5])
    for kind in REQUIRED['cursor']:
        im=Image.new('RGBA',(64,64));d=ImageDraw.Draw(im)
        if kind=='pointer':d.polygon([(7,5),(13,52),(25,37),(40,49),(45,41),(31,31),(48,27)],fill=LIGHT,outline=INK);anchor=[7/64,5/64]
        else:
            d.ellipse((14,14,50,50),outline=TEAL if kind!='blocked' else '#de9b7d',width=3)
            for x,y,x1,y1 in [(32,3,32,19),(32,45,32,61),(3,32,19,32),(45,32,61,32)]:d.line((x,y,x1,y1),fill=LIGHT,width=2)
            if kind=='blocked':d.line((17,47,47,17),fill='#de9b7d',width=4)
            if kind=='interact':d.polygon([(32,22),(42,32),(32,42),(22,32)],fill=GOLD)
            anchor=[.5,.5]
        add('cursor.'+kind,im,anchor=anchor)
    for name in ICON_IDS:add('icon.'+name,native_symbol(name),anchor=[.5,.5])
    pages=[];regions={}
    for page_id,keys in [('frames',[k for k in items if not k.startswith('icon.')]),('icons',[k for k in items if k.startswith('icon.')])]:
        atlas=Image.new('RGBA',(2048,2048));x=y=2;row_h=0
        for name in keys:
            im=items[name]
            if x+im.width+2>2048:x=2;y+=row_h+4;row_h=0
            if y+im.height+2>2048:raise ValueError('ATLAS_OVERFLOW')
            atlas.alpha_composite(im,(x,y));regions[name]={'page':page_id,'rect':[x,y,im.width,im.height],**meta[name]}
            x+=im.width+4;row_h=max(row_h,im.height)
        p=UI/'atlases'/(page_id+'.png');p.parent.mkdir(exist_ok=True);atlas.save(p)
        pages.append({'id':page_id,'file':'atlases/'+page_id+'.png','size':[2048,2048],'sha256':sha(p)})
    components={kind:{'states':{state:kind+'.'+state for state in states}} for kind,states in REQUIRED.items()}
    kit={'schemaVersion':1,'id':'covenant-ui-v1','status':'owner-review','designSize':[1920,1080],'safeArea':[96,54,96,54],
      'pages':pages,'regions':regions,'components':components,'tokens':{'text':LIGHT,'mutedText':'#bbc8ca','focus':TEAL,'selected':GOLD,'panel':INK,'minimumTarget':[64,64],'targetGap':16,'statePriority':['disabled','locked','pressed','focus','hover','selected','normal']},
      'typography':{'display':{'family':'Cinzel','file':'fonts/Cinzel.ttf','weight':600,'size':64,'license':'fonts/cinzel-OFL.txt'},'heading':{'family':'Cinzel','file':'fonts/Cinzel.ttf','weight':600,'size':40,'license':'fonts/cinzel-OFL.txt'},'body':{'family':'Source Sans 3','file':'fonts/SourceSans3.ttf','weight':400,'size':28,'license':'fonts/sourcesans3-OFL.txt'},'secondary':{'family':'Source Sans 3','file':'fonts/SourceSans3.ttf','weight':400,'size':24,'license':'fonts/sourcesans3-OFL.txt'},'policy':'wrap or paginate; never shrink to fit'},
      'motion':{'hoverMs':100,'pressMs':70,'focusPulseMs':1200,'tooltipDelayMs':450,'panelRevealMs':160,'reducedMotion':'disable translations and pulses, retain immediate state changes'},
      'sampling':{'colourSpace':'sRGB','alpha':'straight','filter':'linear','mipmaps':False,'gutterPx':2,'rotation':False,'trim':False},'ownerAccepted':False}
    write(UI/'kit.json',kit)
    spells=read(ART/'delivery/a3c/spell-mappings.json')['spells'];line_map={'bolt':'water-bolt','tide_orb':'water-tide-orb','lash':'water-lash','mire':'water-mire','mend':'water-mend','mirror':'water-mirror'}
    write(UI/'icons.json',{'schemaVersion':1,'icons':{name:{'region':'icon.'+name,'origin':'original native geometry'} for name in ICON_IDS},'waterSpells':[{**{k:r[k] for k in ['line','tier','branch','name']},'region':'icon.'+line_map[r['line']]} for r in spells],'otherSchools':'school/resource marks only; detailed line catalogue remains game-stream input'})
    write(UI/'provenance.json',{'source':source,'source_hash':sha(UI/'source-crops.json'),'generator':'tools/art/covenant_ui.py','states':'native deterministic overlays','icons':'original native geometry, no superseded A5 image reuse','fonts':read(UI/'fonts/provenance.json'),'owner_accepted':False})
    return kit


def validate(kit,root=UI):
    errors=[];pages={}
    if kit.get('schemaVersion')!=1:return ['SCHEMA_VERSION']
    for p in kit['pages']:
        path=root/p['file']
        if not path.exists():errors.append('MISSING_PAGE:'+p['id']);continue
        if sha(path)!=p['sha256']:errors.append('PAGE_HASH:'+p['id'])
        im=Image.open(path);im.load();pages[p['id']]=im
        if im.mode!='RGBA' or list(im.size)!=p['size']:errors.append('PAGE_FORMAT:'+p['id'])
    for kind,states in REQUIRED.items():
        for state in states:
            if kind+'.'+state not in kit['regions']:errors.append('MISSING_REGION:'+kind+'.'+state)
    occupied={p:[] for p in pages}
    for name,r in kit['regions'].items():
        if r['page'] not in pages:continue
        im=pages[r['page']];x,y,w,h=r['rect']
        if min(x,y)<2 or x+w+2>im.width or y+h+2>im.height:errors.append('BOUNDS:'+name);continue
        for ox,oy,ow,oh in occupied[r['page']]:
            if x<ox+ow+4 and x+w+4>ox and y<oy+oh+4 and y+h+4>oy:errors.append('GUTTER_OVERLAP:'+name)
        occupied[r['page']].append((x,y,w,h))
        a=im.getchannel('A')
        for box in [(x-2,y-2,x+w+2,y),(x-2,y+h,x+w+2,y+h+2),(x-2,y,x,y+h),(x+w,y,x+w+2,y+h)]:
            if a.crop(box).getextrema()[1]!=0:errors.append('DIRTY_GUTTER:'+name)
        if 'nineSlice' in r:
            l,t,rr,b=r['nineSlice']
            if l+rr>=w or t+b>=h or r['minSize'][0]<l+rr or r['minSize'][1]<t+b:errors.append('INSETS:'+name)
        if any(v<0 or v>1 for v in r['anchor']):errors.append('ANCHOR:'+name)
    for token in kit['typography'].values():
        if isinstance(token,dict):
            for k in ['file','license']:
                if not (root/token[k]).exists():errors.append('MISSING_FONT_OR_LICENSE:'+token[k])
    for comp in kit['components'].values():
        for region in comp['states'].values():
            if region not in kit['regions']:errors.append('STATE_REGION:'+region)
    return errors


def check():
    kit=read(UI/'kit.json');errors=validate(kit)
    # Reconstruct actual nine-slices and verify corner bytes never stretch.
    for name,r in kit['regions'].items():
        if 'nineSlice' not in r:continue
        page=next(p for p in kit['pages'] if p['id']==r['page']);x,y,w,h=r['rect'];source=Image.open(UI/page['file']).crop((x,y,x+w,y+h));l,t,rr,b=r['nineSlice']
        for dest in [r['minSize'],[max(800,r['minSize'][0]),max(300,r['minSize'][1])]]:
            out=nine_slice(source,tuple(dest),r['nineSlice'])
            if out.crop((0,0,l,t)).tobytes()!=source.crop((0,0,l,t)).tobytes():errors.append('STRETCHED_CORNER:'+name)
    result={'status':'fail' if errors else 'pass','errors':errors,'regions':len(kit['regions']),'pages':len(kit['pages']),'icons':len(ICON_IDS),'owner_accepted':False,'runtime_performance_and_sofa_feel':'not measured'}
    write(ART/'reports/a5b-ui-check.json',result);print(json.dumps(result));return result


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('command',choices=['build','check']);a=p.parse_args()
    if a.command=='build':build()
    elif check()['errors']:raise SystemExit(1)
