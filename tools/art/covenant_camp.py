"""Data-owned camp exports and slot integrity; no image generation."""
import argparse
import json
from PIL import Image, ImageOps
from common import ART, ROOT, read, write, sha, relative, camp_data
from covenant import jobs

OUT=ART/'delivery/a4c'
STORIES=[
 ('shared-loaf','A shared loaf','A portion waits beside your bowl. Someone has remembered you.'),
 ('empty-bowl','An empty bowl','The meal is over. One place at the table remains untouched.'),
 ('watch-rota','The watch changes','A different pair of boots pauses outside the grille.'),
 ('ward-seam','A seam in the ward','An old fracture catches the light between two stones.'),
 ('quiet-bargain','A quiet bargain','A small token changes hands beneath the awning.'),
 ('before-grille','Before the grille','Beyond the iron, the arena has fallen silent.')]


def current(scene):
    candidates=[j for j in jobs('A4c') if j['scene']==scene]
    if not candidates:raise ValueError('MISSING_SOURCE:'+scene)
    j=candidates[-1];r=read(ART/'waves/A4c/reviews'/(j['id']+'.json'))
    if r['verdict']=='reject':raise ValueError('REJECTED_SOURCE:'+scene)
    return j


def build():
    data=read(ART/'camp-covenant.json');maps=[];backdrops=[];stories=[]
    for slot in data['slots']:
        j=current('camp-'+slot)
        for w,h in [(1920,1080),(2560,1440)]:
            p=OUT/'maps'/f'{slot}-{w}.png';p.parent.mkdir(parents=True,exist_ok=True)
            ImageOps.fit(Image.open(ROOT/j['archive']).convert('RGB'),(w,h),method=Image.Resampling.LANCZOS).save(p)
            maps.append({'slot':slot,'size':[w,h],'file':relative(p),'sha256':sha(p),'source':j['archive'],'source_sha256':j['sha256'],'transform':'center-cover Lanczos','owner_accepted':False})
    for place in data['places']:
        j=current('backdrop-'+place['id']);p=OUT/'backdrops'/(place['id']+'.png');p.parent.mkdir(exist_ok=True)
        ImageOps.fit(Image.open(ROOT/j['archive']).convert('RGB'),(1920,1080),method=Image.Resampling.LANCZOS).save(p)
        backdrops.append({'place':place['id'],'file':relative(p),'sha256':sha(p),'source':j['archive'],'source_sha256':j['sha256'],'transform':'center-cover Lanczos; single authored lighting, not live time simulation','owner_accepted':False})
    j=current('story-sheet');im=Image.open(ROOT/j['archive'])
    for i,(ident,title,body) in enumerate(STORIES):
        crop=data['story_crops'][i]
        p=OUT/'stories'/(ident+'.png');p.parent.mkdir(exist_ok=True);im.crop(crop).save(p)
        stories.append({'id':ident,'title':title,'body':body,'file':relative(p),'sha256':sha(p),'source':j['archive'],'source_sha256':j['sha256'],'crop':crop,'text_origin':'authored thematic sample, not Director output or state facts','owner_accepted':False})
    manifest={'schema':1,'places':data['places'],'slots':data['slots'],'maps':maps,'backdrops':backdrops,'stories':stories,
      'frameKit':'art/ui/kit.json','frameRegions':['card.normal','card.unread','card.selected','card.warning'],
      'ui_contract':'art/ui/README.md','owner_accepted':False,'not_measured':['game integration','live camp-state correctness','runtime performance','owner feel']}
    write(OUT/'manifest.json',manifest);return manifest


def check():
    m=read(OUT/'manifest.json');locs,slots=camp_data();errors=[]
    if m['slots']!=slots:errors.append('SLOTS')
    expected={r['id']:r['open'].split(';') for r in locs};actual={r['id']:r['open'] for r in m['places']}
    if expected!=actual:errors.append('PLACE_OPEN_RULES')
    if len(m['maps'])!=6 or len(m['backdrops'])!=8 or len(m['stories'])!=6:errors.append('DELIVERY_INCOMPLETE')
    for row in m['maps']+m['backdrops']+m['stories']:
        if sha(ROOT/row['file'])!=row['sha256'] or sha(ROOT/row['source'])!=row['source_sha256']:errors.append('HASH:'+row['file'])
        im=Image.open(ROOT/row['file']);im.verify()
    kit=read(ART/'ui/kit.json')
    for name in m['frameRegions']:
        if name not in kit['regions']:errors.append('MISSING_FRAME:'+name)
    result={'status':'fail' if errors else 'pass','errors':errors,'places':len(actual),'maps':len(m['maps']),'backdrops':len(m['backdrops']),'stories':len(m['stories']),'owner_accepted':False}
    write(ART/'reports/a4c-camp-check.json',result);print(json.dumps(result));return result


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('command',choices=['build','check']);a=p.parse_args()
    if a.command=='build':build()
    elif check()['errors']:raise SystemExit(1)
