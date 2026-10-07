"""Authored combat geometry; transparent sprites, no generated pixels or rules."""
import argparse
import csv
import json
import math
from PIL import Image, ImageDraw
from common import ART, ROOT, read, write, sha, relative
from board import font

OUT=ART/'delivery/a3'
PALETTE={'water':('#226b8b','#c5eee6'),'fire':('#993f2e','#f6c66f'),
         'earth':('#705332','#d9ba68'),'air':('#49675c','#edf0cf'),
         'physical':('#493329','#f1d69a'),'unblockable':('#742d36','#f1d69a')}


def recipes():
    result=[]
    for school in ('water','fire','earth','air'):
        for kind in ('bolt','line'):
            result.append({'id':school+'-'+kind,'kind':kind,'school':school,'scope':'generic school motif; no invented spell line'})
    for kind in ('tide-orb','lash','mire','mend','mirror'):
        result.append({'id':'water-'+kind,'kind':kind,'school':'water','scope':'Water line family motif; tier shape/branch must follow CSV, not this motif alone'})
    for kind,school in [('absorb','water'),('perfect-absorb','water'),('telegraph-ring','water'),('telegraph-ring','physical'),('telegraph-ring','unblockable'),('unblockable-mark','unblockable'),('charge-lane','unblockable'),('net-ring','physical'),('tongue-line','physical'),('ember-burst','fire')]:
        result.append({'id':school+'-'+kind,'kind':kind,'school':school,'scope':'authored visual; collision and timing remain engine data'})
    return result


def draw_effect(spec,frame,h=1080,zoom=1.2,facing=0):
    """Rotate in world XY BEFORE projecting y by sin(elevation)."""
    c=read(ART/'scale-contract-v1.json');rs=h/1080;ss=3
    size=(round(640*rs),round(400*rs));im=Image.new('RGBA',(size[0]*ss,size[1]*ss))
    d=ImageDraw.Draw(im);cx,cy=size[0]/2,size[1]/2
    ppm=c['camera']['standard_ground_pixels_per_metre_at_1080p']*zoom*rs
    tilt=math.sin(math.radians(c['camera']['elevation_above_ground_degrees']))
    angle=math.radians(facing);a,b=math.cos(angle),math.sin(angle)
    dark,light=PALETTE[spec['school']];kind=spec['kind'];phase=frame/3
    def point(x,y):return ((cx+(x*a-y*b)*ppm)*ss,(cy+(x*b+y*a)*ppm*tilt)*ss)
    def line(points,colour,width=3):d.line([point(*p) for p in points],fill=colour,width=max(1,round(width*rs*ss)),joint='curve')
    def polygon(points,colour):d.polygon([point(*p) for p in points],fill=colour)
    def arc(radius,start,end,colour,width=3):
        line([(radius*math.cos(math.radians(t)),radius*math.sin(math.radians(t))) for t in range(start,end+1)],colour,width)
    def ring(radius,colour,width=3):arc(radius,0,360,colour,width)
    def star(x,y,r,colour):polygon([(x-r,y),(x-r*.23,y-r*.23),(x,y-r),(x+r*.23,y-r*.23),(x+r,y),(x+r*.23,y+r*.23),(x,y+r),(x-r*.23,y+r*.23)],colour)
    if kind=='absorb':
        radius=c['absorb']['visual_radius_metres'];half=c['absorb']['angle_degrees']//2
        arc(radius,-half,half,dark,7);arc(radius,-half,half,light,3)
        for t in (-60,-30,0,30,60):
            r=radius-.13-.04*frame;polygon([(r*math.cos(math.radians(t)),r*math.sin(math.radians(t))),((r-.13)*math.cos(math.radians(t+2)),(r-.13)*math.sin(math.radians(t+2))),((r-.13)*math.cos(math.radians(t-2)),(r-.13)*math.sin(math.radians(t-2)))],dark)
    elif kind=='perfect-absorb':
        # Contact flash at forward edge, never a full-circle bubble.
        x=c['absorb']['visual_radius_metres'];r=[.18,.42,.3,.12][frame]
        star(x,0,r+.13,dark);star(x,0,r,light)
        for sign in (-1,1):line([(x+sign*.5,-.4),(x+sign*(.65+phase*.2),-.65)],dark,3)
    elif kind=='bolt':
        length=1.1+phase*.2
        if spec['school']=='water':points=[(-length,0),(.24,-.1),(.48,0),(.24,.1)]
        elif spec['school']=='fire':points=[(-length,.08),(-.5,-.15),(-.7,-.28),(.3,-.14),(.55,0),(.2,.22)]
        elif spec['school']=='earth':points=[(-.6,0),(-.2,-.28),(.4,-.14),(.55,.1),(.1,.3)]
        else:points=[(-length,-.17),(.25,-.17),(.55,0),(.25,.17),(-length,.17),(-.55,0)]
        polygon(points,dark);line([(-.42,0),(.27,0)],light,4)
    elif kind in ('line','tongue-line'):
        points=[(-3,0),(-1,.06 if frame%2 else -.06),(1,0),(3,0)]
        line(points,dark,8);line(points,light,4)
        if spec['school']=='earth':
            for x in (-2,-1,0,1,2):polygon([(x,-.17),(x+.2,.05),(x,.2)],dark)
        elif spec['school']=='air':line([(-2.5,-.3),(-1.5,-.3),(-1.2,-.15)],dark,3)
        elif spec['school']=='fire':
            for x in (-2,-.5,1):polygon([(x,-.12),(x+.35,-.45),(x+.7,0)],dark)
    elif kind=='tide-orb':
        radius=.3+phase*.1;ring(radius,dark,6);arc(radius,-100,20,light,4);line([(-1,0),(-.55,0)],dark,4)
    elif kind=='lash':
        # Tier I is a 90 degree cone, not an absorb lookalike.
        r=1.8+phase*1.2;arc(r,-45,45,dark,6);arc(r-.12,-45,45,light,3)
        line([(0,0),(r*math.cos(math.pi/4),-r*math.sin(math.pi/4))],dark,3)
        line([(0,0),(r*math.cos(math.pi/4),r*math.sin(math.pi/4))],dark,3)
    elif kind=='mire':
        ring(2.5,dark,3)
        for r in (1,1.6,2.1):arc(r,20+frame*15,145+frame*15,light,4);arc(r,195,310,dark,3)
    elif kind=='mend':
        for x,y in ((-.6,0),(.6,.1),(0,-.9-phase*.4)):star(x,y,.18,dark);star(x,y,.09,light)
        arc(.9,0,180,dark,3)
    elif kind=='mirror':
        polygon([(0,-1),(.65,0),(0,1),(-.65,0)],dark)
        line([(0,-.8),(-.45,0),(0,.8)],light,4);line([(.25,-.35),(.25,.35)],light,3)
    elif kind in ('telegraph-ring','net-ring','ember-burst'):
        radius=2 if kind=='telegraph-ring' else 1.25 if kind=='net-ring' else 1.5
        if radius<2:
            # Contract-sized advisory cue around the smaller true footprint.
            # Dashed outer ring must never be interpreted as collision radius.
            for start in range(0,360,30):arc(2,start,start+12,dark,3)
        ring(radius,dark,4);arc(radius-.13,0,90*(frame+1),light,3)
        if kind=='net-ring':
            # 2.5 m is interpreted as diameter for this REVIEW recipe; ambiguity flagged.
            for x in (-.6,0,.6):line([(x,-.65),(x,.65)],dark,3)
            for y in (-.6,0,.6):line([(-.65,y),(.65,y)],dark,3)
        if kind=='ember-burst':
            for t in range(0,360,60):star(math.cos(math.radians(t))*(.4+phase),math.sin(math.radians(t))*(.4+phase),.12,dark)
        if spec['school']=='physical':
            for x in (-.3,.3):line([(x,-2.2),(x,-1.8)],dark,4)
        if spec['school']=='unblockable':
            for x in (-.45,.1):line([(x-.25,-2.45),(x+.25,-1.75)],dark,5)
    elif kind=='unblockable-mark':
        # Crossed slash + broken diamond distinguish it without colour.
        for pts in [[(-.7,0),(0,-.7),(.25,-.45)],[(.7,0),(0,.7),(-.25,.45)]]:line(pts,dark,4)
        line([(-.35,-.45),(.35,.45)],dark,6);line([(.35,-.45),(-.35,.45)],dark,6)
        star(0,0,.12,light)
    elif kind=='charge-lane':
        # True baseline footprint: 12m by 2m, entirely inside this 640px cell.
        line([(-6,-1),(6,-1),(6,1),(-6,1),(-6,-1)],dark,4)
        for x in (-4,-2,0,2,4):line([(x-.35,-.4),(x+.35,0),(x-.35,.4)],dark,4)
        line([(-5.5,-.8),(-5.5+11*phase,-.8)],light,3)
    else:raise ValueError(kind)
    return im.resize(size,Image.Resampling.LANCZOS)


def build():
    exports=[];specs=recipes();c=read(ART/'scale-contract-v1.json')
    for h in (1080,1440):
        for distance in c['distances']:
            folder=OUT/'effects'/str(h)/distance['id'];folder.mkdir(parents=True,exist_ok=True)
            for spec in specs:
                frames=[draw_effect(spec,n,h,distance['zoom']) for n in range(4)]
                w,hh=frames[0].size;atlas=Image.new('RGBA',(w*4,hh))
                for n,im in enumerate(frames):atlas.alpha_composite(im,(n*w,0))
                path=folder/(spec['id']+'.png');atlas.save(path)
                exports.append({'id':spec['id'],'file':relative(path),'sha256':sha(path),'viewport_height':h,
                    'distance':distance['id'],'zoom':distance['zoom'],'frame_size':[w,hh],'frames':4,'anchor':[w/2,hh/2],
                    'preview_frame_ms':[100]*4,'timing_authority':'presentation only; engine must use data',
                    'facing_degrees':0,'rotation':'rotate world geometry before projection; do not rotate this raster for a different heading',
                    'min_outline_px':3*h/1080,'min_projectile_core_px':4*h/1080,'provenance':'authored procedural geometry; zero image calls'})
                if spec['kind'] in ('net-ring','ember-burst'):
                    exports[-1]['solid_footprint_diameter_m']=2.5 if spec['kind']=='net-ring' else 3
                    exports[-1]['dashed_advisory_diameter_m']=4
                    exports[-1]['advisory_scope']='readability only; never use outer dashed ring as collision footprint'
    with (ROOT/'docs/design/baseline-fourteen-nights/design/data/spells-water.csv').open(encoding='utf-8-sig',newline='') as f:water=list(csv.DictReader(f))
    mappings=[{'line':r['line'],'tier':r['tier'],'branch':r['branch'],'name':r['name'],'shape_authority':r['shape'],
        'family_motif':'water-'+r['line'].replace('_','-'),'blockable':r['blockable'],
        'warning_motif':'unblockable-unblockable-mark' if r['blockable']=='UNBLOCKABLE' else None,
        'scope':'family look only; branches, fans, decoys, grabs and footprints require engine composition from CSV'} for r in water]
    write(OUT/'effects.json',{'version':'a3-effects-v1','recipes':specs,'exports':exports,'water_mappings':mappings,
        'source_sha256':sha(ROOT/'docs/design/baseline-fourteen-nights/design/data/spells-water.csv'),
        'scale_sha256':sha(ART/'scale-contract-v1.json'),'owner_accepted':False,
        'limitations':['Water family motifs are not 24 complete spell animations','Fire/Earth/Air generic only pending W8 catalogues',
            'net 2.5m baseline telegraph is ambiguous; review assumes diameter, integration must resolve',
            'net and ember solid footprint cues remain baseline-sized; outer dashed 4m cue is advisory only, never an enlarged hitbox']})
    contact=Image.new('RGB',(1600,100+math.ceil(len(specs)/4)*230),'#eee0bd');d=ImageDraw.Draw(contact)
    d.text((24,18),'A3 / AUTHORED EFFECTS / 1080p NEAR / FRAME 2',font=font(27,True),fill='#38261f')
    d.text((24,57),'Contact panels fit large shapes; native exports retain stroke widths. Four phases per transparent sheet. Preview timing is not combat data.',font=font(17),fill='#38261f')
    for n,spec in enumerate(specs):
        x=n%4*400;y=100+n//4*230
        im=draw_effect(spec,1);box=im.getbbox();piece=im.crop(box)
        # Contact sheet may fit large footprints; labelled above, native exports remain authoritative.
        piece.thumbnail((375,175),Image.Resampling.LANCZOS)
        contact.paste(piece,(x+(400-piece.width)//2,y+5+(175-piece.height)//2),piece)
        d.text((x+12,y+185),spec['id'],font=font(17,True),fill='#38261f')
    path=OUT/'effects-contact.png';contact.save(path)
    print(json.dumps({'effects':len(specs),'sheets':len(exports),'water_rows':len(mappings)}))


if __name__=='__main__':build()
