"""Optional localized A12 old-rune removal overlays. Original plates untouched.

Authored region masks + measured bright/chromatic stroke isolation + OpenCV
Telea local reconstruction. This is inferred floor pigment, NOT generated art.
"""
import cv2
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
from common import ART,ROOT,read,write,sha,relative
from restoration_common import saved,contact

OUT=ART/'delivery/a13'
W,H=1400,788
REGIONS={
 'moonlit':[(408,186,103,53),(994,181,99,48),(185,387,130,64),(1206,386,125,60),(726,699,154,79)],
 'rust-sand':[(338,175,120,64),(953,197,107,58),(202,448,102,58),(622,597,135,68),(1062,649,133,66)],
 'verdigris':[(695,418,605,320),(695,418,447,240),(695,418,259,151),(695,418,140,87)]}
PYLONS={
 'moonlit':[(414,177,32,117),(992,181,29,99),(182,390,33,114),(1212,378,31,118),(731,708,40,136)],
 'rust-sand':[(650,152,39,139),(206,279,36,132),(1200,310,37,139),(200,628,42,164),(1196,715,37,135)],
 'verdigris':[(239,185,39,108),(698,136,35,90),(1167,190,35,105),(218,684,37,119),(1186,680,37,135)]}

def build():
    records={};tiles=[]
    for name in REGIONS:
        path=ART/'delivery/a12/plates'/f'{name}.png';original=Image.open(path).convert('RGB');rgb=np.array(original)
        region=Image.new('L',(W,H));d=ImageDraw.Draw(region)
        for x,y,rx,ry in REGIONS[name]:
            if name=='verdigris':d.ellipse((x-rx,y-ry,x+rx,y+ry),outline=255,width=20)
            elif name=='moonlit':d.ellipse((x-rx,y-ry,x+rx,y+ry),fill=255)
            else:
                for scale in (.55,.82,1):d.ellipse((x-rx*scale,y-ry*scale,x+rx*scale,y+ry*scale),outline=255,width=12)
                for i in range(8):
                    angle=i*np.pi/4;d.line((x+rx*.35*np.cos(angle),y+ry*.35*np.sin(angle),x+rx*np.cos(angle),y+ry*np.sin(angle)),fill=255,width=10)
        if name=='verdigris':
            for points in [[(0,407),(1400,414)],[(697,145),(690,788)],[(235,166),(1185,690)],[(1167,184),(220,690)]]:
                d.line(points,fill=255,width=20)
            d.rectangle((641,380,757,450),fill=255)
            for x,y in [(314,174),(696,180),(701,310),(696,549),(687,687),(767,121),(914,410),(477,410),(42,405),(1186,690)]:
                d.ellipse((x-33,y-19,x+33,y+19),fill=255)
        for x,y,half,high in PYLONS[name]:d.rectangle((x-half,y-high,x+half,y+10),fill=0)
        region=region.resize(original.size,Image.Resampling.NEAREST);allowed=np.array(region)>0
        gray=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY)
        local=cv2.medianBlur(gray,15).astype(np.float32)
        if name=='verdigris':
            r,g,b=rgb[:,:,0].astype(float),rgb[:,:,1].astype(float),rgb[:,:,2].astype(float)
            candidate=(r>g*1.025)&(r>b*1.13)&(r>43)&((gray.astype(float)-local)>2)
        elif name=='moonlit':candidate=(gray.astype(float)-local>12)&(gray>62)
        else:candidate=(gray.astype(float)-local>12)&(gray>105)
        mask=(candidate&allowed).astype('uint8')*255
        mask=cv2.dilate(mask,np.ones((3,3),np.uint8));mask[~allowed]=0
        if np.mean(mask>0)>.055:raise ValueError('FLOOR_MASK_TOO_BROAD:'+name)
        restored=cv2.inpaint(rgb,mask,6,cv2.INPAINT_TELEA)
        alpha=Image.fromarray(mask).filter(ImageFilter.GaussianBlur(.65))
        # No reconstruction is exposed outside the authored support mask.
        rgba=Image.fromarray(restored).convert('RGBA');rgba.putalpha(alpha)
        row=saved(rgba,OUT/'floor-cleanup'/f'{name}.png')
        maskrow=saved(Image.fromarray(mask),OUT/'floor-cleanup'/f'{name}-mask.png')
        merged=original.convert('RGBA');merged.alpha_composite(rgba)
        before=original.copy();before.thumbnail((700,394));after=merged.convert('RGB');after.thumbnail((700,394))
        pair=Image.new('RGB',(1400,394));pair.paste(before,(0,0));pair.paste(after,(700,0));tiles.append((name+' / original | local cleanup',pair))
        placements=REGIONS[name] if name!='verdigris' else [(695,418,290,155),(239,191,105,52),(700,149,90,44),(1167,198,95,48),(217,689,115,58),(1186,690,106,54)]
        records[name]={'overlay':row,'mask':maskrow,'plateSource':relative(path),'plateSha256':sha(path),
           'maskCoverage':round(float(np.mean(mask>0)),6),'registration':'full A12 plate UV, preprojected; draw before new floor decals and all actors',
           'origin':'authored region and stroke masks; local Telea inpainting; inferred floor texture; NOT new generated painting',
           'preserved':'all pixels outside overlay alpha, all protected pylon rectangles; A12 source files byte unchanged',
           'limitations':'some faint original scratches remain; local reconstruction can soften mineral microtexture; no claim of perfect inpainting',
           'decals':[{'clip':'floor.'+name,'centreUV':[x/W,y/H],
             'frameSizeMasterPx':[rx*2/0.78*original.width/W,ry*2/0.78*original.height/H],
             'preprojected':True,'opacity':.60 if name!='rust-sand' else .46} for x,y,rx,ry in placements]}
    write(OUT/'floor-placement.json',{'schemaVersion':1,'palettes':records,'ownerAccepted':False})
    contact(tiles,OUT/'floor-cleanup-contact.jpg','A13 / authored removal of old plate marks, before new glyphs',1,(1420,460))
    print('A13 floor overlays:',{k:v['maskCoverage'] for k,v in records.items()})

if __name__=='__main__':build()
