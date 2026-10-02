"""Original-resolution portrait crops, runtime atlases and portable identity board."""
import argparse
import json
import html
from PIL import Image, ImageOps, ImageDraw, ImageFont
from common import ART, ROOT, read, write, relative, sha
from covenant import board

OUT=ART/'delivery/a2c'


def validate_crop(box,size):
    x,y,r,b=box
    if not (0<=x<r<=size[0] and 0<=y<b<=size[1]):raise ValueError('CROP_BOUNDS')
    if min(r-x,b-y)<128:raise ValueError('CROP_TOO_SMALL')


def build():
    cast=read(ART/'cast-covenant.json');crops=read(ART/'portrait-crops-covenant.json');rows=[];pages=[]
    for c in cast['characters']:
        atlas=Image.new('RGB',(1024,640),'#090f17')
        for i,mood in enumerate(['neutral']+cast['expressions']):
            key=c['id']+'.'+mood
            if key not in crops['regions']:continue
            r=crops['regions'][key];src=ROOT/r['source'];im=Image.open(src).convert('RGB');validate_crop(r['crop'],im.size)
            review=read(ART/'waves/A2c/reviews'/(r['job']+'.json'))
            if review['verdict']=='reject' or review['sha256']!=sha(src):raise ValueError('SOURCE_REJECT_OR_DRIFT:'+key)
            grade=read(ART/'grades'/(r['job']+'.json'))
            if grade['status']!='graded' or grade['verdict']=='reject' or grade['image_sha256']!=sha(src):raise ValueError('SOURCE_LOCAL_GATE:'+key)
            pic=im.crop(r['crop']);p=OUT/'portraits'/c['id']/(mood+'.png');p.parent.mkdir(parents=True,exist_ok=True);pic.save(p)
            thumb=ImageOps.contain(pic,(256,320),method=Image.Resampling.LANCZOS);x=i%4*256;y=i//4*320
            atlas.paste(thumb,(x+(256-thumb.width)//2,y+(320-thumb.height)//2))
            rows.append({'id':key,'character':c['id'],'mood':mood,'file':relative(p),'sha256':sha(p),'size':list(pic.size),'source':r['source'],'source_sha256':sha(src),'crop':r['crop'],'job':r['job'],'atlas':c['id'],'rect':[x,y,256,320],'anchor':[.5,.5],'transform':'exact original crop; atlas uses contain Lanczos with dark matte','owner_accepted':False})
        p=OUT/'atlases'/(c['id']+'.png');p.parent.mkdir(parents=True,exist_ok=True);atlas.save(p)
        pages.append({'id':c['id'],'file':relative(p),'sha256':sha(p),'size':[1024,640],'alpha':False})
    write(OUT/'manifest.json',{'schema':1,'characters':cast['characters'],'expressions':cast['expressions'],'portraits':rows,'pages':pages,'owner_accepted':False,'mood_labels':'authored intended labels, not independently verified emotion recognition','missing':[c['id']+'.'+m for c in cast['characters'] for m in ['neutral']+cast['expressions'] if c['id']+'.'+m not in crops['regions']]})
    out=ART/'review/a2c';out.mkdir(parents=True,exist_ok=True);sheet=Image.new('RGB',(1600,1840),'#0c141b');d=ImageDraw.Draw(sheet);font=ImageFont.truetype(str(ART/'ui/fonts/SourceSans3.ttf'),25)
    for i,c in enumerate(cast['characters']):
        p=OUT/'portraits'/c['id']/'neutral.png'
        if not p.exists():continue
        im=ImageOps.contain(Image.open(p),(374,410));x=i%4*400;y=i//4*460;sheet.paste(im,(x+(400-im.width)//2,y));d.text((x+20,y+420),c['name'],font=font,fill='#e7e5da')
    sheet.save(out/'cast-contact-sheet.jpg',quality=94)
    extras=[{'id':'cast-contact-sheet','file':relative(out/'cast-contact-sheet.jpg'),'sha256':sha(out/'cast-contact-sheet.jpg'),'note':'Sixteen new neutral candidates. Names are authored; supporting sheets preserve separate faces.','owner_accepted':False}]
    cards=[]
    for c in cast['characters']:
        imgs=''.join('<figure><img src="../../delivery/a2c/portraits/'+c['id']+'/'+r['mood']+'.png"><figcaption>'+r['mood']+'</figcaption></figure>' for r in rows if r['character']==c['id'])
        cards.append('<section><h2>'+html.escape(c['name'])+'</h2><p>'+html.escape(c['design'])+'</p><div>'+imgs+'</div></section>')
    (out/'portraits.html').write_text('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Covenant cast</title><style>body{background:#0c141b;color:#ede8db;margin:24px;font:20px Georgia}section{margin:36px 0}section>div{display:flex;flex-wrap:wrap;gap:14px}figure{margin:0;width:220px}img{width:100%;height:290px;object-fit:contain;background:#090f17}h2{font-size:30px}</style><h1>Moonchalk Tempest cast</h1><p>Owner-review candidates. Emotion and identity continuity require human review; no automatic acceptance.</p>'+''.join(cards),encoding='utf-8')
    board('A2c',extras)
    return rows


def check():
    m=read(OUT/'manifest.json');cast=read(ART/'cast-covenant.json');baseline=read(ROOT/cast['source']);errors=[]
    if {c['id'] for c in m['characters']}!={c['id'] for c in baseline['characters']}:errors.append('CAST_IDS')
    for r in m['portraits']:
        if sha(ROOT/r['file'])!=r['sha256'] or sha(ROOT/r['source'])!=r['source_sha256']:errors.append('HASH:'+r['id'])
        src=Image.open(ROOT/r['source']).convert('RGB');validate_crop(r['crop'],src.size)
        if src.crop(r['crop']).tobytes()!=Image.open(ROOT/r['file']).convert('RGB').tobytes():errors.append('CROP_PIXELS:'+r['id'])
        if r['owner_accepted']:errors.append('OWNER_BOUNDARY')
    for p in m['pages']:
        if sha(ROOT/p['file'])!=p['sha256'] or list(Image.open(ROOT/p['file']).size)!=p['size']:errors.append('ATLAS:'+p['id'])
    result={'status':'fail' if errors else 'pass','scope':'file coverage, crop pixels and hashes only','errors':errors,'cast':len(m['characters']),'portraits':len(m['portraits']),'missing':m['missing'],'coverage_complete':not m['missing'],'quality_gate':'owner review required for acting, identity and style','owner_accepted':False}
    write(ART/'reports/a2c-portrait-check.json',result);print(json.dumps(result));return result


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('command',choices=['build','check']);a=p.parse_args()
    if a.command=='build':build()
    elif check()['errors']:raise SystemExit(1)
