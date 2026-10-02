"""Build camp screens, backdrops, story cards and exact vector Hollow Board frames."""
import argparse
import html
import json
import shutil
from PIL import Image
from common import ART, ROOT, camp_data, read, write, sha, source_path
from waves import generated, gate
from grade import route

DEST = ART / 'delivery/a4'
COPY = {
    'yard':'Staff drills beneath the watch of the Vigil.',
    'cistern':'The basin is dry. Every voice carries.',
    'pit':'Sand, stamina and an audience that remembers.',
    'exchange':'Bread, cloth and whatever the Door lets through.',
    'commons':'A shared table between the tents.',
    'door':'The grille is closed. The arena waits beyond it.',
    'tent':'A patched roof and a place among your own.',
    'edge':'The fog gathers beyond the last wardstone.'
}


def frame_svg(state, style):
    accent=style['frame_states'][state]['accent']; paper=style['palette']['paper']; ink=style['palette']['ink']
    chips=''
    for x,y in [(8,8),(18,8),(8,18),(380,8),(370,8),(380,18),(8,280),(18,280),(8,270),(380,280),(370,280),(380,270)]:
        chips+=f'<path d="M{x} {y}l8 1-1 8-8-1z" fill="{accent}"/>'
    mark = '<path d="M194 8l6 9 6-9" fill="none" stroke="'+accent+'" stroke-width="3"/>' if state=='unread' else ''
    mark += '<path d="M193 17l7-10 7 10z" fill="'+accent+'"/>' if state=='warning' else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300"><rect x="1" y="1" width="398" height="298" rx="3" fill="{paper}" stroke="{ink}" stroke-width="2"/><path d="M30 10H185M215 10H368M390 31V268M370 290H30M10 269V31" stroke="{accent}" stroke-width="{4 if state=="selected" else 2}" fill="none"/>{chips}{mark}</svg>'


def build():
    DEST.mkdir(parents=True,exist_ok=True)
    c=read(ART/'camp-map-v1.json'); style=read(ART/'interface-style-v1.json'); stories=read(ART/'story-cards-v1.json')
    places,slots=camp_data(); all_jobs=generated('A4'); exports=[]; by_item={}
    for item in read(ART/'briefs/a4-v1.json')['items']:
        candidates=[j for j in all_jobs if j['scene']==item['id']]
        if not candidates:raise ValueError('MISSING_SOURCE:'+item['id'])
        job=candidates[-1]; by_item[item['id']]=job
        kind='backdrops' if item['kind']=='backdrop' else 'stories'
        name=item.get('place_id',item.get('story_id'))+'.jpg'
        path=DEST/kind/name;path.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(source_path(job),path)
        review=read(ART/'waves/A4/reviews'/(job['id']+'.json'))
        grade=read(ART/'grades'/(job['id']+'.json'))
        verdict='reject' if review['verdict']=='reject' or route(grade)[0]=='reject' else 'owner-review'
        exports.append({'kind':kind,'id':item.get('place_id',item.get('story_id')),'job':job['id'],'source_sha256':job['sha256'],'path':path.relative_to(ROOT).as_posix(),'sha256':sha(path),'verdict':verdict,'owner_accepted':False})
    for state in style['frame_states']:
        path=DEST/'frames'/('hollow-'+state+'.svg');path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(frame_svg(state,style),encoding='utf-8')
        exports.append({'kind':'frame','id':state,'origin':'authored SVG geometry','path':path.relative_to(ROOT).as_posix(),'sha256':sha(path),'viewbox':style['frame_viewbox'],'safe_inset_px':style['frame_safe_inset_px'],'nine_slice_insets_px':style['nine_slice_insets_px'],'owner_accepted':False})
    data={'places':[{'id':p['id'],'name':p['name'],'open':p['open'].split(';'),'copy':COPY[p['id']]} for p in places],
          'anchors':c['anchors'],'labels':c['labels'],'overlays':c['slot_overlays']}
    template=(ROOT/'tools/art/templates/camp.html').read_text(encoding='utf-8')
    (DEST/'camp.html').write_text(template.replace('__DATA__',json.dumps(data,ensure_ascii=False)),encoding='utf-8')
    cards=''
    for card in stories['cards']:
        state=card['state']; label=style['frame_states'][state]['label']
        cards+=f'<article data-state="{state}" style="border-image-source:url(frames/hollow-{state}.svg)"><span class="state">{label}</span><img src="stories/{card["id"]}.jpg" alt="{html.escape(card["title"])}"><h2>{html.escape(card["title"])}</h2><p>{html.escape(card["text"])}</p></article>'
    board='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The Hollow Board</title><style>*{box-sizing:border-box}body{margin:0;padding:28px 40px;background:#172832;color:#f3e7c7;font-family:'Segoe UI',sans-serif}header{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:24px}h1{font:44px Georgia,serif;margin:0}header p{letter-spacing:.12em;font-size:14px}a{color:#a0d6dd}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;max-width:1560px;margin:auto}article{position:relative;color:#38291e;border:24px solid transparent;border-image-slice:24 fill;border-image-repeat:stretch}article img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}h2{font:25px Georgia,serif;margin:12px 0 8px}article p{font-size:16px;line-height:1.5;margin:0;min-height:48px}.state{display:block;text-transform:uppercase;font-size:12px;letter-spacing:.12em;font-weight:700;margin-bottom:10px}footer{max-width:1560px;margin:22px auto;font-size:14px}@media(max-width:1000px){body{padding:20px}main{grid-template-columns:repeat(2,minmax(0,1fr))}h1{font-size:34px}}@media(max-width:600px){main{grid-template-columns:1fr}header{align-items:start;flex-direction:column}h2{font-size:24px}}</style><header><div><p>CASTRA CLAUSA / FIRST LIGHT</p><h1>The Hollow Board</h1></div><a href="camp.html">Return to camp</a></header><main>'''+cards+'''</main><footer>Messages travel farther than footsteps.</footer></html>'''
    (DEST/'hollow-board.html').write_text(board,encoding='utf-8')
    manifest={'wave':'A4','map_source':c['map_source'],'map_source_sha256':c['map_source_sha256'],'camp_data_sha256':sha(ART/'camp-map-v1.json'),'story_data_sha256':sha(ART/'story-cards-v1.json'),'interface_style_sha256':sha(ART/'interface-style-v1.json'),'exports':exports,'owner_accepted':False,'scope':'art delivery candidate and interactive presentation; not a running game'}
    write(DEST/'manifest.json',manifest)
    return manifest


def check():
    from playwright.sync_api import sync_playwright
    m=build(); c=read(ART/'camp-map-v1.json'); locations,slots=camp_data(); errors=[]; evidence=[]
    if set(c['anchors'])!={p['id'] for p in locations} or c['slots']!=slots:
        errors.append('MAP_DATA_MISMATCH')
    if sha(ROOT/c['map_source'])!=c['map_source_sha256'] or sha(ROOT/c['location_source'])!=c['location_source_sha256']:
        errors.append('SOURCE_DRIFT')
    if {e['id'] for e in m['exports'] if e['kind']=='backdrops'}!={p['id'] for p in locations}:
        errors.append('BACKDROP_COVERAGE')
    if {e['id'] for e in m['exports'] if e['kind']=='stories'}!={p['id'] for p in read(ART/'story-cards-v1.json')['cards']}:
        errors.append('STORY_COVERAGE')
    if {e['id'] for e in m['exports'] if e['kind']=='frame'}!={'ordinary','unread','selected','warning'}:
        errors.append('FRAME_COVERAGE')
    jobs={j['id']:j for j in generated('A4')}
    for e in m['exports']:
        if sha(ROOT/e['path'])!=e['sha256'] or e['owner_accepted']:errors.append('EXPORT:'+e['id'])
        if 'job' in e and (gate(jobs[e['job']])['verdict']!='technical-pass' or e['sha256']!=e['source_sha256']):errors.append('SOURCE:'+e['id'])
    screens=DEST/'screens';screens.mkdir(exist_ok=True);screen_records=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',headless=True)
        for w,h in [(1920,1080),(2560,1440),(390,844)]:
            page=browser.new_page(viewport={'width':w,'height':h});page_errors=[]
            page.on('pageerror',lambda e:page_errors.append(str(e)))
            page.goto((DEST/'camp.html').as_uri())
            for slot in slots:
                page.locator('nav button[data-slot='+slot+']').click()
                expected=[loc['id'] for loc in locations if slot in loc['open'].split(';')]
                actual=page.evaluate('campState()')
                enabled=page.locator('.place-list button:enabled').evaluate_all('xs=>xs.map(x=>x.dataset.place)')
                if actual['open']!=expected or enabled!=expected or actual['selected'] not in expected:errors.append('AVAILABILITY:'+slot)
                page.wait_for_function('Array.from(document.images).filter(i=>i.getAttribute("src")).every(i=>i.complete&&i.naturalWidth>0)')
                if page.evaluate('document.documentElement.scrollWidth>innerWidth'):errors.append('OVERFLOW:'+str(w))
                for loc in expected:
                    page.locator('.place-list button[data-place='+loc+']').click()
                    page.locator('.enter').click()
                    page.locator('dialog .scene').evaluate('(i)=>i.decode()')
                    if not page.locator('dialog').is_visible():errors.append('DIALOG:'+loc)
                    page.keyboard.press('Escape')
                page.locator('.place-list button[data-place='+expected[0]+']').click()
                page.locator('.place-art').evaluate('(i)=>i.decode()')
                if w>1000:
                    file=screens/f'camp-{slot}-{w}x{h}.png';page.screenshot(path=str(file))
                    screen_records.append({'path':file.relative_to(ROOT).as_posix(),'sha256':sha(file),'viewport':[w,h],'slot':slot,'origin':'authored browser composition; unchanged map source plus code UI'})
                evidence.append({'viewport':[w,h],'slot':slot,'open':expected,'closed_controls_disabled':True})
            page.goto((DEST/'hollow-board.html').as_uri());page.wait_for_function('Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)')
            if page.locator('article').count()!=6 or page.evaluate('document.documentElement.scrollWidth>innerWidth'):errors.append('HOLLOW_BOARD:'+str(w))
            if w==1920:
                file=screens/'hollow-board-1920x1080.png';page.screenshot(path=str(file),full_page=True)
                screen_records.append({'path':file.relative_to(ROOT).as_posix(),'sha256':sha(file),'viewport':[w,h],'origin':'authored story card composition'})
            if page_errors:errors.extend(page_errors)
            page.close()
        browser.close()
    for record in screen_records:
        with Image.open(ROOT/record['path']) as image:record['output_dimensions']=list(image.size)
    write(DEST/'screens/manifest.json',screen_records)
    report={'status':'fail' if errors else 'pass','errors':errors,'places':8,'slots':slots,'backdrops':8,'story_cards':6,'frames':4,'screens':len(screen_records),'browser':evidence,'owner_accepted':False,'not_measured':['engine integration','owner feel','final production acceptance']}
    write(ART/'reports/A4-camp-check.json',report);print(json.dumps(report,indent=2))
    if errors:raise SystemExit(1)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('command',choices=['build','check']);args=parser.parse_args()
    check() if args.command=='check' else build()
