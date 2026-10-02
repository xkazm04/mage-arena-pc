"""Authored native interface assets. No image generation, acceptance or A3 work."""
import argparse
import base64
import csv
import html
import json
import math
import xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image
from common import ART, ROOT, read, write, sha, digest, now

DEST = ART/'delivery/a5'
REVIEW = ART/'review/a5'
BRIEF = ART/'briefs/a5-native-v1.json'
PILOT = {'id':'water-tide-orb','label':'Tide Orb','category':'Water lines','school':'water',
         'fill':'#236d84','drawing':'<path d="M32 9C28 19 14 27 14 38a18 17 0 0 0 36 0C50 27 37 18 32 9Z"/><path d="M19 39q7-7 14 0t12 0" fill="none" stroke="#f3e7c7"/><path d="M33 20l6 9-6 3-4-7z" fill="#f3e7c7" stroke="none"/>'}


def svg(icon):
    b=read(BRIEF)
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" '
            'role="img" aria-labelledby="title"><title>'+html.escape(icon['label'])+'</title>'
            '<g stroke="#f3e7c7" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" '
            'fill="'+icon['fill']+'">'+icon['drawing']+'</g>'
            '<g stroke="'+b['ink']+'" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" '
            'fill="'+icon['fill']+'">'+icon['drawing']+'</g></svg>')


def proof():
    from playwright.sync_api import sync_playwright
    REVIEW.mkdir(parents=True,exist_ok=True)
    source=REVIEW/'proof.svg';source.write_text(svg(PILOT),encoding='utf-8')
    strips=''.join('<section style="background:'+bg+';color:'+fg+'"><h2>'+label+'</h2>'+''.join(
        f'<figure><img src="proof.svg" width="{size}" height="{size}"><figcaption>{size} px</figcaption></figure>'
        for size in read(BRIEF)['export_sizes'])+'</section>' for bg,fg,label in
        [('#f3e7c7','#38291e','Lime surface'),('#172832','#f3e7c7','Night surface')])
    page=REVIEW/'proof.html';page.write_text('<!doctype html><html lang="en"><meta charset="utf-8"><title>Tide Orb proof</title><style>body{margin:0;background:#ded0ac;color:#38291e;font:18px Segoe UI,sans-serif}header{padding:24px 40px}h1{margin:0}section{padding:24px 40px;display:flex;gap:40px;align-items:center}h2{width:200px;font-size:22px}figure{margin:0;width:145px;text-align:center}figcaption{margin-top:14px}</style><header><h1>Tide Orb / single-icon proof</h1><p>Authored SVG · owner review pending</p></header>'+strips+'</html>',encoding='utf-8')
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome');view=browser.new_page(viewport={'width':1120,'height':650},device_scale_factor=1)
        view.goto(page.as_uri());view.locator('img').evaluate_all('(imgs)=>Promise.all(imgs.map(i=>i.decode()))')
        view.screenshot(path=str(REVIEW/'proof.png'),full_page=True);browser.close()
    print('Single icon proof rendered; inspect and grade before batch.')


def proof_inputs():
    return {'brief_sha256':sha(BRIEF),'style_sha256':sha(ART/read(BRIEF)['style'].removeprefix('art/')),
            'svg_sha256':sha(REVIEW/'proof.svg'),'capture_sha256':sha(REVIEW/'proof.png')}


def require_proof():
    record=read(ART/'proofs/A5.json');grade=read(ART/'grades/ui-a5-proof.json')
    if record['inputs']!=proof_inputs():raise ValueError('STALE_NATIVE_PROOF')
    if (record['verdict']!='owner-review' or record['owner_accepted'] is not False
        or grade['status']!='graded' or grade['verdict']=='reject'
        or grade['owner_accepted'] is not False
        or grade['image_sha256']!=sha(REVIEW/'proof.png')
        or record['grade_sha256']!=sha(ART/'grades/ui-a5-proof.json')
        or svg(PILOT)!=(REVIEW/'proof.svg').read_text(encoding='utf-8')):raise ValueError('NATIVE_PROOF_GATE')
    if read(ART/'reports/A1b-check.json')['status']!='pass':raise ValueError('A1B_REQUIRED')


def inputs():
    return {name:sha(ART/name) for name in ['briefs/a5-native-v1.json','interface-style-v1.json','icon-catalogue-v1.json','hud-v1.json']}


def catalogue_html(data, contact=False):
    cards=''
    for i in data['icons']:
        cards+=('<article data-category="'+i['category']+'"><div class="samples"><span class="light"><img src="../../delivery/a5/icons/'+i['id']+'.svg" alt=""></span>'
                '<span class="dark"><img src="../../delivery/a5/icons/'+i['id']+'.svg" alt=""></span></div><h2>'+html.escape(i['label'])+'</h2>'
                '<div class="category">'+i['category']+'</div><a href="../../delivery/a5/icons/'+i['id']+'.svg">'+i['id']+'</a></article>')
    options=''.join('<option>'+c+'</option>' for c in dict.fromkeys(i['category'] for i in data['icons']))
    filters='' if contact else '<nav><label>Category <select id="category"><option value="all">All 46 symbols</option>'+options+'</select></label><label>Size <select id="size"><option>32</option><option>48</option><option selected>64</option><option>128</option></select></label><a href="../../delivery/a5/hud.html">Open HUD study</a><a href="contact-sheet.png">Contact sheet</a><a href="../../delivery/a5/manifest.json">Manifest</a><a href="proof.html">Single-icon proof</a></nav>'
    mapping=''
    if not contact:
        for school,rows in [('Water',data['water_bindings']),('Fire reference',data['fire_reference_bindings'])]:
            mapping+='<details><summary>'+school+' mappings ('+str(len(rows))+')</summary><table><thead><tr><th>Spell</th><th>Tier</th><th>Branch</th><th>Icon</th></tr></thead><tbody>'+''.join('<tr><td>'+html.escape(r['name'])+'</td><td>'+str(r['tier'])+'</td><td>'+str(r.get('branch') or '—')+'</td><td>'+r['icon']+'</td></tr>' for r in rows)+'</tbody></table></details>'
        mapping+='<p>Pending W8: Fire line migration, Earth and Air line-specific glyphs. Those catalogues are absent from this checkout. School and resource symbols are included.</p>'
    return '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tessera &amp; Lime · icon board</title><style>
    *{box-sizing:border-box}body{margin:0;background:#e8dbb8;color:#38291e;font:16px/1.4 "Segoe UI",sans-serif;padding:28px}header{border-bottom:2px solid #38291e;padding-bottom:20px;margin-bottom:24px}h1{font:36px Georgia,serif;margin:0 0 10px}p{max-width:1100px;margin:10px 0}nav{display:flex;gap:22px;align-items:center;flex-wrap:wrap;margin-top:22px}label{display:flex;gap:8px;align-items:center}select{min-height:44px;font:inherit;background:#f3e7c7;padding:7px;border:1px solid #38291e}a{color:#174f61}a:focus-visible,select:focus-visible{outline:3px solid #236d84;outline-offset:3px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:14px}article{padding:12px;background:#f3e7c7;border:1px solid #b6a87f;min-width:0}article[hidden]{display:none}.samples{display:flex;justify-content:center;align-items:center;gap:12px}.samples span{padding:6px;display:flex;align-items:center;justify-content:center}.dark{background:#172832;border-radius:4px}img{width:var(--icon-size,64px);height:var(--icon-size,64px)}h2{font-size:17px;margin:8px 0 0}.category{font-size:13px;color:#685437}article a{font-size:11px;overflow-wrap:anywhere}details{margin:25px 0}summary{cursor:pointer;min-height:44px;font-weight:700}table{border-collapse:collapse;width:100%;font-size:14px}td,th{border-bottom:1px solid #b6a87f;padding:8px;text-align:left}footer{margin-top:26px;font-size:14px}@media(max-width:500px){body{padding:15px}h1{font-size:28px}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.samples{gap:3px}.samples span{padding:3px}article{padding:8px}.samples img{width:min(var(--icon-size,64px),55px);height:min(var(--icon-size,64px),55px)}table{font-size:11px}td,th{padding:4px}h2{font-size:15px}}''' + ('body{padding:24px}.grid{grid-template-columns:repeat(8,1fr)}article{padding:10px}h1{font-size:32px}header{margin-bottom:16px;padding-bottom:12px}' if contact else '') + '</style><header><h1>Tessera &amp; Lime / 46 interface symbols</h1><p>Original authored SVG · light and night surfaces · owner review pending. Four schools, four resources, five Water lines plus bolt, ten Fire reference spells and 22 interface marks.</p>'+filters+'</header><main class="grid">'+cards+'</main>'+mapping+'<footer>Zero image-generation calls in A5. SVG and transparent PNG: 32 / 48 / 64 / 128 px. Fire reference spells are not approved spell lines. A3 figures and effects remain blocked pending the owner camera file.</footer>'+('' if contact else '<script>document.querySelector("#category").onchange=e=>document.querySelectorAll("article").forEach(a=>a.hidden=e.target.value!=="all"&&a.dataset.category!==e.target.value);document.querySelector("#size").onchange=e=>{document.documentElement.style.setProperty("--icon-size",e.target.value+"px");document.querySelector(".grid").style.gridTemplateColumns=e.target.value==="128"?"repeat(auto-fit,minmax(310px,1fr))":"";};</script>')+'</html>'


def validate_data():
    data=read(ART/'icon-catalogue-v1.json');hud=read(ART/'hud-v1.json')
    for source in data['source_data'].values():
        if sha(ROOT/source['path'])!=source['sha256']:raise ValueError('SOURCE_DATA_DRIFT:'+source['path'])
    if sha(ROOT/hud['plate']['path'])!=hud['plate']['sha256']:raise ValueError('PLATE_DRIFT')
    combat=read(ROOT/hud['combat_source']['path'])
    if (sha(ROOT/hud['combat_source']['path'])!=hud['combat_source']['sha256']
        or len(hud['slots'])!=combat['lines']['slots']
        or hud['tier_unlock_seconds']!=combat['tierClock']['unlockAtSeconds']
        or hud['flow_max']!=combat['flow']['max'] or hud['absorb_arc_degrees']!=combat['absorb']['arcDeg']):raise ValueError('HUD_RULE_DRIFT')
    with (ROOT/data['source_data']['water']['path']).open(encoding='utf-8-sig',newline='') as f:water=list(csv.DictReader(f))
    expected=[(r['line'],int(r['tier']),r['branch'] or None,r['name']) for r in water]
    if expected!=[(r['line'],r['tier'],r['branch'],r['name']) for r in data['water_bindings']]:raise ValueError('WATER_MAPPING_DRIFT')
    with (ROOT/data['source_data']['fire_reference']['path']).open(encoding='utf-8-sig',newline='') as f:fire=list(csv.DictReader(f))
    if [(r['id'],r['name'],int(r['tier'])) for r in fire]!=[(r['id'],r['name'],r['tier']) for r in data['fire_reference_bindings']]:raise ValueError('FIRE_MAPPING_DRIFT')
    ids=[i['id'] for i in data['icons']]
    if len(set(ids))!=len(ids) or len(ids)!=46:raise ValueError('ICON_ID_COVERAGE')
    for mapping in data['water_bindings']+data['fire_reference_bindings']+hud['slots']:
        if mapping['icon'] not in ids:raise ValueError('MISSING_ICON:'+mapping['icon'])
    if next(i for i in data['icons'] if i['id']==PILOT['id'])!=PILOT:raise ValueError('PILOT_DRIFT')
    for i in data['icons']:
        root=ET.fromstring(svg(i))
        for node in root.iter():
            if node.tag.split('}')[-1] not in ('svg','title','g','path','circle','rect','ellipse','polygon','line','polyline'):raise ValueError('UNSAFE_SVG_TAG')
            if any(k.lower().startswith('on') or 'href' in k or 'url(' in v for k,v in node.attrib.items()):raise ValueError('UNSAFE_SVG_ATTRIBUTE')
    return data,hud


def build():
    from playwright.sync_api import sync_playwright
    require_proof();data,hud=validate_data();exports=[]
    for folder in ('icons','png','screens'):(DEST/folder).mkdir(parents=True,exist_ok=True)
    def entry(path,**metadata):exports.append({'path':path.relative_to(ROOT).as_posix(),'sha256':sha(path),**metadata})
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome');page=browser.new_page()
        for i in data['icons']:
            text=svg(i);path=DEST/'icons'/(i['id']+'.svg');path.write_text(text,encoding='utf-8');entry(path,icon=i['id'],format='svg')
            for size in read(BRIEF)['export_sizes']:
                # Browser rasterizes the authored vector directly onto a transparent canvas.
                encoded=page.evaluate('''async ({svg,size})=>{let img=new Image();img.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)));await img.decode();let c=document.createElement('canvas');c.width=size;c.height=size;let ctx=c.getContext('2d');ctx.drawImage(img,0,0,size,size);return c.toDataURL('image/png').split(',')[1];}''',{'svg':text,'size':size})
                path=DEST/'png'/str(size)/(i['id']+'.png');path.parent.mkdir(exist_ok=True);path.write_bytes(base64.b64decode(encoded));entry(path,icon=i['id'],format='png',size=size)
        page.close();browser.close()
    (REVIEW/'index.html').write_text(catalogue_html(data),encoding='utf-8')
    (REVIEW/'contact.html').write_text(catalogue_html(data,True),encoding='utf-8')
    payload={'hud':hud,'bindings':data['water_bindings']}
    template=(ROOT/'tools/art/templates/hud.html').read_text(encoding='utf-8')
    (DEST/'hud.html').write_text(template.replace('__DATA__',json.dumps(payload,ensure_ascii=False)).replace('__PLATE__',Path(hud['plate']['path']).name),encoding='utf-8')
    for path in [REVIEW/'index.html',REVIEW/'contact.html',DEST/'hud.html']:entry(path,format='html')
    write(DEST/'manifest.json',{'wave':'A5','origin':'authored native SVG and browser compositions','inputs':inputs(),'exports':exports,'icons':len(data['icons']),'water_spell_mappings':len(data['water_bindings']),'fire_reference_spell_mappings':len(data['fire_reference_bindings']),'pending':data['pending'],'image_generation_calls':0,'owner_accepted':False,'arc_glyph_geometry':{'center':[32,32],'radius':24,'start_degrees':200,'end_degrees':340,'sweep_degrees':140,'scope':'UI glyph only; no arena effect or acceptance'}})
    print(json.dumps({'icons':len(data['icons']),'png_exports':len(data['icons'])*4,'owner_accepted':False}))


def contrast(a,b):
    def luminance(c):
        channels=[int(c[x:x+2],16)/255 for x in (1,3,5)]
        linear=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in channels]
        return sum(v*w for v,w in zip(linear,[.2126,.7152,.0722]))
    a,b=sorted([luminance(a),luminance(b)])
    return round((b+.05)/(a+.05),2)


def check():
    from playwright.sync_api import sync_playwright
    require_proof();data,hud=validate_data();manifest=read(DEST/'manifest.json');errors=[];browser_rows=[];screens=[]
    if manifest['inputs']!=inputs():errors.append('STALE_MANIFEST')
    for item in manifest['exports']:
        path=ROOT/item['path']
        if sha(path)!=item['sha256']:errors.append('EXPORT_HASH:'+item['path'])
        if item['format']=='png':
            with Image.open(path) as im:
                if im.size!=(item['size'],item['size']) or im.mode!='RGBA':errors.append('PNG_FORMAT:'+item['path'])
                alpha=im.getchannel('A');box=alpha.getbbox()
                if not box or alpha.getextrema()!=(0,255):errors.append('PNG_ALPHA:'+item['path'])
                if box and (box[0]<1 or box[1]<1 or box[2]>im.width-1 or box[3]>im.height-1):errors.append('ICON_CLIPPING:'+item['path'])
    palette=read(ART/'interface-style-v1.json')['palette'];ratios={key:contrast(palette[key],palette['paper']) for key in ['ink','blue','clay']}
    if min(ratios.values())<4.5:errors.append('TEXT_CONTRAST')
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome')
        def capture(page,path,**metadata):
            page.screenshot(path=str(path),full_page=metadata.pop('full_page',False))
            with Image.open(path) as im:dimensions=list(im.size)
            screens.append({'path':path.relative_to(ROOT).as_posix(),'sha256':sha(path),'dimensions':dimensions,**metadata})
        for width,height in [(1920,1080),(2560,1440),(390,844)]:
            page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1,reduced_motion='reduce');js=[];page.on('pageerror',lambda e:js.append(str(e)))
            page.goto((REVIEW/'index.html').as_uri());page.locator('img').evaluate_all('(xs)=>Promise.all(xs.map(i=>i.decode()))')
            if page.locator('article').count()!=46:errors.append('BOARD_COVERAGE')
            page.locator('#category').select_option(label='Water lines')
            if page.locator('article:visible').count()!=6:errors.append('CATEGORY_FILTER')
            page.locator('#category').select_option('all')
            for size in ['32','48','64','128']:
                page.locator('#size').select_option(size)
                if page.evaluate('document.documentElement.scrollWidth>innerWidth'):errors.append('BOARD_OVERFLOW:'+str(width)+':'+size)
            page.goto((DEST/'hud.html').as_uri());page.locator('img').evaluate_all('(xs)=>Promise.all(xs.map(i=>i.decode()))')
            if page.locator('.slot').count()!=3:errors.append('SLOT_COUNT')
            for seconds,tier in [(0,'I'),(14,'I'),(15,'II'),(29,'II'),(30,'III'),(44,'III'),(45,'IV'),(50,'IV')]:
                page.locator('#clock').fill(str(seconds));page.locator('#clock').dispatch_event('input')
                if page.locator('#tier-name').inner_text()!='Tier '+tier:errors.append('TIER_BOUNDARY:'+str(seconds))
            page.locator('#reset').click();page.locator('body').click(position={'x':3,'y':3});page.keyboard.press('3')
            if page.locator('.slot[aria-pressed=true]').get_attribute('data-slot')!='2':errors.append('NUMBER_KEY_SELECT')
            page.locator('#loadout').dispatch_event('wheel',{'deltaY':1})
            if page.locator('.slot[aria-pressed=true]').get_attribute('data-slot')!='0':errors.append('WHEEL_SELECT')
            for state in ['cooldown','locked','borrowed','ready']:
                page.locator('#state').select_option(state)
                if state not in page.locator('.slot[aria-pressed=true]').get_attribute('class'):errors.append('STATE:'+state)
            page.locator('#flow-input').select_option('5')
            if page.locator('.pip.filled').count()!=5:errors.append('FLOW_COUNT')
            page.locator('#reset').click();page.evaluate('scrollTo(0,0)')
            if page.evaluate('document.documentElement.scrollWidth>innerWidth'):errors.append('HUD_OVERFLOW:'+str(width))
            geometry=page.locator('.panel').evaluate_all('(xs)=>xs.map(x=>{let r=x.getBoundingClientRect();return {id:x.id,x:r.x,y:r.y,width:r.width,height:r.height};})')
            coverage=round(100*sum(r['width']*r['height'] for r in geometry)/(width*height),2)
            if width>=1920:
                for r in geometry:
                    if r['x']<0 or r['y']<0 or r['x']+r['width']>width or r['y']+r['height']>height:errors.append('PANEL_OUTSIDE:'+r['id'])
                    if r['x']<width*.7 and r['x']+r['width']>width*.3 and r['y']<height*.75 and r['y']+r['height']>height*.2:errors.append('CENTRAL_FIGHT_OCCLUDED:'+r['id'])
                if coverage>18:errors.append('HUD_COVERAGE')
                capture(page,DEST/'screens'/f'hud-ready-{width}x{height}.png',state='ready',viewport=[width,height],panel_coverage_percent=coverage)
                for state in ['cooldown','locked','borrowed']:
                    page.locator('#state').select_option(state);page.evaluate('scrollTo(0,0)')
                    if width==1920:capture(page,DEST/'screens'/f'hud-{state}-{width}x{height}.png',state=state,viewport=[width,height])
            else:capture(page,DEST/'screens'/'hud-mobile-390.png',state='ready',viewport=[width,height],full_page=True)
            browser_rows.append({'viewport':[width,height],'js_errors':js,'panel_coverage_percent':coverage if width>=1920 else None,'reduced_motion':True,'tier_boundaries':8,'slot_states':4,'keyboard_and_wheel':True})
            errors.extend(js);page.close()
        page=browser.new_page(viewport={'width':1600,'height':1100},device_scale_factor=1)
        page.goto((REVIEW/'contact.html').as_uri());page.locator('img').evaluate_all('(xs)=>Promise.all(xs.map(i=>i.decode()))')
        capture(page,REVIEW/'contact-sheet.png',full_page=True,origin='browser render of all authored vector glyphs')
        browser.close()
    write(DEST/'screens/manifest.json',screens)
    report={'status':'fail' if errors else 'pass','errors':errors,'icons':len(data['icons']),'png_exports':len(data['icons'])*4,'water_mappings':24,'fire_reference_mappings':10,'contrast_on_lime':ratios,'browser':browser_rows,'screens':len(screens),'owner_accepted':False,'image_generation_calls':0,'not_measured':['combat integration','readability in motion','owner feel','production acceptance']}
    write(ART/'reports/A5-check.json',report);print(json.dumps(report,indent=2))
    if errors:raise SystemExit(1)


def review_check():
    require_proof();data,hud=validate_data();errors=[]
    if read(ART/'reports/A5-check.json')['status']!='pass':errors.append('TECHNICAL_CHECK_FAILED')
    record=read(ART/'waves/A5/direct-review.json')
    if record['owner_accepted'] is not False:errors.append('OWNER_BOUNDARY')
    expected={'a5-icons':REVIEW/'contact-sheet.png','a5-hud':DEST/'screens/hud-ready-1920x1080.png',
              'a5-hud-borrowed':DEST/'screens/hud-borrowed-1920x1080.png'}
    for name,path in expected.items():
        grade=read(ART/'grades'/('ui-'+name+'.json'));direct=next((r for r in record['artifacts'] if r['name']==name),{})
        if (grade['image_sha256']!=sha(path) or grade['status']!='graded'
            or grade['verdict']=='reject' or grade['owner_accepted'] is not False):errors.append('LOCAL_REVIEW:'+name)
        if (direct.get('sha256')!=sha(path) or direct.get('verdict')!='owner-review'
            or not direct.get('observation')):errors.append('DIRECT_REVIEW:'+name)
    for item in read(DEST/'manifest.json')['exports']:
        if sha(ROOT/item['path'])!=item['sha256']:errors.append('STALE_EXPORT:'+item['path'])
    if read(DEST/'manifest.json')['inputs']!=inputs():errors.append('STALE_INPUTS')
    report={'status':'fail' if errors else 'pass','errors':errors,'reviewed_artifacts':len(expected),
            'scope':'review integrity; local models and agent do not approve owner feel',
            'pending':data['pending'],'owner_accepted':False,'image_generation_calls':0}
    write(ART/'reports/A5-review-check.json',report);print(json.dumps(report,indent=2))
    if errors:raise SystemExit(1)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('command',choices=['proof','build','check','review-check']);args=parser.parse_args()
    {'proof':proof,'build':build,'check':check,'review-check':review_check}[args.command]()
