"""Portable A6 owner comparison and integrity checks; no generation in build/check."""
from __future__ import annotations
import argparse
import html
import json
import shutil
from pathlib import Path
from PIL import Image, ImageDraw
from common import ART, ROOT, digest, read, sha, source_path, write
from generate import Budget
from grade import route
from waves import brief, generated, gate, jobs, require_proof, spec_for
from board import font

FOLDER=ART/'review/a6'
def esc(value): return html.escape(str(value),quote=True)

CSS='''*{box-sizing:border-box}body{margin:0;background:#171b20;color:#dedaca;font:17px/1.55 Georgia,serif}header,main,footer{max-width:1560px;margin:auto;padding:28px}h1{font-size:clamp(34px,5vw,68px);line-height:1.1;margin:12px 0}h2{font-size:30px;margin:8px 0}h3{margin:8px 0}a{color:#9edbdc}nav{display:flex;gap:16px;flex-wrap:wrap}.eyebrow{font:13px Arial;letter-spacing:.18em;color:#dab879}.notice{border-left:4px solid #d8ad68;background:#262a2e;padding:18px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}article{padding:26px 0;border-top:1px solid #666052}figure{margin:0;min-width:0}img{width:100%;height:auto;display:block;background:#0a0b0e}figcaption{font-size:15px;margin-top:10px}.badge{font:12px Arial;text-transform:uppercase;letter-spacing:.08em;color:#edc178}.reject{color:#ffb2a1}.axes{color:#aea997;font-size:16px}details{padding:10px 0;overflow-wrap:anywhere}summary{cursor:pointer;color:#afdbdc}pre{white-space:pre-wrap;font-size:13px}button,select{font:16px Arial;padding:10px;background:#2a3037;color:#eee;border:1px solid #696558}table{border-collapse:collapse;width:100%;font-size:15px}td,th{text-align:left;border-bottom:1px solid #555;padding:10px;vertical-align:top}.scroll{overflow:auto}.archive{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}.archive h3{font-size:18px;overflow-wrap:anywhere}.missing{padding:70px 15px;background:#28252b}dialog{background:#111;color:#eee;border:1px solid #777;max-width:98vw;width:98vw;max-height:96vh;padding:14px}dialog::backdrop{background:#000c}.viewer{overflow:auto;max-height:78vh}.viewer img{max-width:none;width:100%}.controls{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px}[hidden]{display:none!important}@media(max-width:760px){header,main,footer{padding:18px}.pair,.archive{grid-template-columns:1fr}table{font-size:13px}td,th{padding:5px}}'''

def evidence():
    rows=[]
    for j in generated('A6'):
        src=source_path(j); dst=ART/'review/sources'/(j['id']+src.suffix)
        dst.parent.mkdir(parents=True,exist_ok=True)
        if src.resolve()!=dst.resolve(): shutil.copy2(src,dst)
        gp=ART/'grades'/(j['id']+'.json'); rp=ART/'waves/A6/reviews'/(j['id']+'.json')
        g=read(gp) if gp.exists() else {'status':'ungraded'}
        r=read(rp) if rp.exists() else {}
        pixel=gate(j)
        verdict='reject' if pixel['verdict']=='reject' or route(g)[0]=='reject' or r.get('verdict')=='reject' else 'owner-review'
        with Image.open(dst) as im: w,h=im.size
        rows.append(dict(job=j['id'],item=j['scene'],direction=j['style_id'],kind=j['scene'].rsplit('-',1)[-1],
                         source='../sources/'+dst.name,sha256=j['sha256'],gate=pixel,grade=g,review=r,
                         verdict=verdict,owner_accepted=False,brief_version=j['input']['version'],
                         prompt=j['prompt'],correction=j.get('correction'),source_bytes=dst.stat().st_size,
                         size=[w,h],decoded_rgba_mib=w*h*4/1048576))
    return rows

def select(rows):
    path=ART/'waves/A6/selections.json'; explicit=read(path) if path.exists() else {}
    result={}
    for item in brief('A6')['items']:
        found=[r for r in rows if r['item']==item['id']]
        if not found: continue
        if item['id'] in explicit:
            chosen=next(r for r in found if r['job']==explicit[item['id']])
        else:
            candidates=[r for r in found if r['verdict']!='reject']
            chosen=(candidates or found)[-1]
        result[item['id']]=chosen['job']
    return result

def figure(row,kind):
    if row is None: return '<figure><div class="missing">Missing '+esc(kind)+' — no substitute generated.</div></figure>'
    g=row['grade']; r=row['review']; note=r.get('note','Direct inspection pending.')
    prompt='<details><summary>Exact prompt and provenance</summary><p>'+esc(row['job'])+' · '+esc(row['brief_version'])+'</p><pre>'+esc(row['prompt'])+'</pre><p>SHA-256 '+row['sha256']+'</p></details>'
    return '<figure><a class="zoom" href="'+row['source']+'" data-kind="'+kind+'"><img src="'+row['source']+'" alt="'+esc(row['item'])+'"></a><figcaption><span class="badge '+('reject' if row['verdict']=='reject' else '')+'">'+esc(kind+' · '+row['verdict'])+'</span><p>'+esc(note)+'</p><details><summary>Local diagnostic — '+esc(g.get('verdict','ungraded'))+'</summary>'+esc(g.get('answers',{}).get('observation','Not measured'))+'</details>'+prompt+'</figcaption></figure>'

def build():
    FOLDER.mkdir(parents=True,exist_ok=True)
    b=brief('A6'); rows=evidence(); selected=select(rows); lookup={r['job']:r for r in rows}
    display_directions=sorted(b['directions'],key=lambda d:d['id'] in ('a6-coal-salt','a6-cinder-veil'))
    summary=Budget().summary(); spend=sum(j['charged_images'] for j in jobs('A6'))
    recommendations=ART/'waves/A6/recommendation.json'
    rec=read(recommendations) if recommendations.exists() else {'note':'Recommendation pending direct comparison.','owner_accepted':False}
    manifest=dict(wave='A6',brief_hash=digest(b),current=selected,rows=rows,budget=summary,wave_spent=spend,
                  incidents=[{'job':j['id'],'status':j['status'],'error':j.get('error'),'results':j.get('tool_results')} for j in jobs('A6') if j['status']!='generated'],
                  recommendation=rec,owner_accepted=False,
                  not_measured=['owner feel','exact painted camera angle','engine motion','engine frame time','shared-account allowance'])
    manifest['ui_diagnostics']=[read(ART/'grades'/('ui-a6-'+name+'.json')) for name in ('board','contact')
                                if (ART/'grades'/('ui-a6-'+name+'.json')).exists()]
    write(FOLDER/'manifest.json',manifest)
    body='<div class="notice"><b>Identity choice — owner review only.</b> A2 portraits and A3 figures were discarded. The near oblique camera remains binding. No candidate is approved, and A2b / A3b / A4b remain blocked.<p>'+str(spend)+' images charged this session; '+str(summary['wave_reserved'])+' / 240 project total; '+str(summary['hard_remaining'])+' remain. Shared-account allowance is not measured.</p>'
    if summary['stop']: body+='<p class="reject">SPENDING STOP: '+esc(summary['stop']['reason'])+'</p>'
    body+='</div><p>Six current arena candidates, followed by two capped camera failures. Exactly two current images per named direction: arena battle and a painted Cassia bust. Click an image for full resolution or a 1080p / 1440p scene read. Body scale is approximate; individual deviations are recorded below. These are generated look studies, not gameplay captures. Rejected attempts remain visible in the archive.</p><p class="notice"><b>For the owner:</b> '+esc(rec['note'])+'</p><label>Direction <select id="direction"><option value="all">All eight</option>'+''.join('<option value="'+d['id']+'">'+esc(d['name'])+'</option>' for d in display_directions)+'</select></label>'
    tilew=800; rowh=545
    sheet=Image.new('RGB',(1600,140+len(b['directions'])*rowh),'#171b20'); draw=ImageDraw.Draw(sheet)
    draw.text((24,20),'MAGE ARENA / A6 / EIGHT IDENTITIES',font=font(34,True),fill='#e6dcc5')
    draw.text((24,70),'Arena + Cassia portrait. Owner review only; visible rejects are held. Full evidence in index.html.',font=font(21),fill='#bcb7ac')
    costs=[]
    for i,d in enumerate(display_directions):
        pair=[lookup.get(selected.get(d['id'][3:]+'-'+kind,'')) for kind in ('arena','portrait')]
        y=140+i*rowh
        draw.text((24,y),f'{i+1:02}  '+d['name'],font=font(30,True),fill='#e8cc96')
        body+='<article class="direction" data-direction="'+d['id']+'"><h2>'+f'{i+1:02} · '+esc(d['name'])+'</h2><p class="axes">'+esc(' / '.join(d[k] for k in ('line','shading','silhouette','mood')))+'</p><div class="pair">'
        for col,(kind,row) in enumerate(zip(('arena','portrait'),pair)):
            body+=figure(row,kind)
            if row:
                with Image.open(FOLDER/row['source']) as im:
                    im=im.convert('RGB'); im.thumbnail((776,437),Image.Resampling.LANCZOS)
                    sheet.paste(im,(col*tilew+12,y+48))
                draw.text((col*tilew+14,y+488),kind.upper()+' / '+row['verdict'].upper(),font=font(20,True),fill='#e8cc96' if row['verdict']!='reject' else '#ffac9a')
            else: draw.text((col*tilew+14,y+130),'NOT GENERATED',font=font(26),fill='#ffac9a')
        body+='</div></article>'
        totalbytes=sum(r['source_bytes'] for r in pair if r)
        costs.append(dict(direction=d['name'],preview_encoded_bytes=totalbytes,preview_decoded_rgba_mib=round(sum(r['decoded_rgba_mib'] for r in pair if r),3),
                          hypothetical_game='Wear/line/shading baked into shared figure and ground atlases: 0 extra material passes. Local auras use one shared effect atlas; overdraw depends on sprite area.',
                          game_texture_mib='not measured',draw_calls='not measured',fill_rate='not measured',frame_time_delta_ms='not measured'))
    manifest['cost_lines']=costs; write(FOLDER/'manifest.json',manifest)
    sheet.save(FOLDER/'contact-sheet.jpg',quality=94)
    body+='<h2>Cost lines</h2><p>Measured preview storage only. These full scenes are comparison plates, not proposed runtime textures. Authored implementation hypothesis: bake wear and mark language into atlases; keep all four auras local. Runtime memory, draw calls, fill and frame-time delta require a later engine test.</p><div class="scroll"><table><thead><tr><th>Direction</th><th>Two source files</th><th>RGBA preview memory</th><th>Extra style passes (authored estimate)</th><th>Engine delta</th></tr></thead><tbody>'
    for c in costs:
        body+='<tr><td>'+esc(c['direction'])+'</td><td>'+f"{c['preview_encoded_bytes']/1048576:.2f} MiB"+'</td><td>'+str(c['preview_decoded_rgba_mib'])+' MiB</td><td>0 if all surface marks are baked; aura draw/fill not measured</td><td>Not measured</td></tr>'
    body+='</tbody></table></div><p>Camera authority: <a href="../../CAMERA-OK.md">owner camera</a> · <a href="../../scale-contract-v1.json">scale contract</a>. Target body height: 64.8 px at 1080p, 86.4 px at 1440p, excluding staff/shadow/aura. Direct observations distinguish generated scale from this target.</p>'
    modal='''<dialog id="viewer"><div class="controls"><button id="close">Close</button><button data-width="fit">Fit</button><button data-width="1920">1080p scene width</button><button data-width="2560">1440p scene width</button><a id="original" href="#">Open original</a><span id="viewlabel"></span></div><div class="viewer"><img id="large" alt="Selected identity proof"></div></dialog><script>const dlg=document.querySelector('#viewer'),large=document.querySelector('#large');document.querySelectorAll('a.zoom').forEach(a=>a.onclick=e=>{e.preventDefault();large.src=a.href;large.style.width='100%';document.querySelector('#original').href=a.href;document.querySelector('#viewlabel').textContent=a.dataset.kind;dlg.showModal()});document.querySelector('#close').onclick=()=>dlg.close();document.querySelectorAll('[data-width]').forEach(b=>b.onclick=()=>large.style.width=b.dataset.width==='fit'?'100%':b.dataset.width+'px');document.querySelector('#direction').onchange=e=>document.querySelectorAll('article.direction').forEach(a=>a.hidden=e.target.value!=='all'&&e.target.value!==a.dataset.direction);</script>'''
    page('index.html','Eight identities',body+modal)
    archive='<p>All paid attempts. Rejected images stay rejected; selection cannot override a local or direct veto. Corrections and immutable prompt revisions are shown per image.</p><div class="archive">'
    for r in rows: archive+='<section><h3>'+esc(r['job'])+'</h3>'+figure(r,r['kind'])+'</section>'
    archive+='</div>'
    if manifest['incidents']: archive+='<h2>Provider findings</h2><pre>'+esc(json.dumps(manifest['incidents'],indent=2))+'</pre>'
    page('attempts.html','Attempt archive',archive)
    print(json.dumps(dict(current=len(selected),attempts=len(rows),charged=spend,project=summary['wave_reserved'],remaining=summary['hard_remaining'])))
    return manifest

def page(filename,title,body):
    (FOLDER/filename).write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>A6 — '+title+'</title><style>'+CSS+'</style><header><div class="eyebrow">MAGE ARENA / ART / FOURTH SESSION</div><h1>'+title+'</h1><nav><a href="index.html">Eight pairs</a><a href="contact-sheet.jpg">Combined contact sheet</a><a href="attempts.html">All attempts</a><a href="manifest.json">Evidence</a><a href="../../../docs/waves/A6-identity-reset.md">Design note</a></nav></header><main>'+body+'</main><footer>Original generated identity studies. Local grader may only reject or route to owner. No owner acceptance or production integration.</footer></html>',encoding='utf-8')

def check():
    from playwright.sync_api import sync_playwright
    m=build(); errors=[]; b=brief('A6'); before=read(ART/'waves/A6/start-snapshot.json')
    if len(m['current'])!=len(b['items']): errors.append('DELIVERY_INCOMPLETE')
    for r in m['rows']:
        if sha(FOLDER/r['source'])!=r['sha256'] or r['gate']['verdict']!='technical-pass': errors.append('SOURCE_GATE:'+r['job'])
        if r['grade'].get('status')!='graded' or r['grade'].get('image_sha256')!=r['sha256']: errors.append('GRADE:'+r['job'])
        if r['review'].get('sha256')!=r['sha256'] or not r['review'].get('note'): errors.append('DIRECT_REVIEW:'+r['job'])
        if r['owner_accepted'] or r['grade'].get('verdict') not in ('reject','owner-review'): errors.append('OWNER_BOUNDARY:'+r['job'])
    for path,key in [('OWNER-CHOICE.md','owner_choice_sha256'),('CAMERA-OK.md','camera_sha256'),('scale-contract-v1.json','scale_sha256')]:
        if sha(ART/path)!=before[key]: errors.append('OWNER_AUTHORITY_CHANGED:'+path)
    if digest(Budget().load()['jobs'][:126])!=before['inherited_jobs_digest']: errors.append('INHERITED_JOBS_CHANGED')
    try:
        for item in b['items']: require_proof(spec_for('A6',item,b))
    except Exception as exc: errors.append('PROOF:'+str(exc))
    for kind in ('arena','portrait'):
        skeletons={spec_for('A6',i,b)['prompt'].replace(spec_for('A6',i,b)['style']['style_block'],'{DIRECTION}') for i in b['items'] if i['kind']==kind}
        if len(skeletons)!=1: errors.append('COMPARISON_SKELETON_DRIFT:'+kind)
    browser=[]
    with sync_playwright() as p:
        bro=p.chromium.launch(channel='chrome',headless=True)
        for width,height in [(1920,1080),(2560,1440),(390,844)]:
            page=bro.new_page(viewport=dict(width=width,height=height)); pe=[]
            page.on('pageerror',lambda e:pe.append(str(e)))
            page.goto((FOLDER/'index.html').as_uri()); page.wait_for_function('Array.from(document.images).filter(i=>i.id!=="large").every(i=>i.complete)')
            loaded=page.locator('figure img').evaluate_all('xs=>xs.every(i=>i.naturalWidth>0)') and page.locator('figure img').count()==len(b['items'])
            overflow=page.evaluate('document.documentElement.scrollWidth>innerWidth')
            page.select_option('#direction',b['directions'][2]['id'])
            filtered=page.locator('article.direction:visible').count()==1
            page.select_option('#direction','all'); page.locator('a.zoom').first.click(); page.wait_for_function('document.querySelector("#large").naturalWidth>0')
            page.locator('[data-width="1920"]').click(); zoom=page.locator('#large').evaluate('i=>i.getBoundingClientRect().width===1920')
            page.locator('#close').click()
            page.evaluate('window.scrollTo(0,0)')
            page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
            page.screenshot(path=str(FOLDER/f'board-{width}.png'),full_page=False)
            if not loaded or overflow or not filtered or not zoom or pe: errors.append('BROWSER:'+str(width))
            browser.append(dict(viewport=[width,height],loaded=loaded,overflow=overflow,filter=filtered,zoom=zoom,errors=pe)); page.close()
        page=bro.new_page(); page.goto((FOLDER/'attempts.html').as_uri()); page.wait_for_function('Array.from(document.images).every(i=>i.complete)')
        if not page.locator('img').evaluate_all('xs=>xs.every(i=>i.naturalWidth>0)'): errors.append('ARCHIVE_IMAGES')
        for doc in ('index.html','attempts.html'):
            page.goto((FOLDER/doc).as_uri())
            for href in page.locator('a[href]').evaluate_all('xs=>xs.map(x=>x.getAttribute("href"))'):
                if href=='#': continue
                if not (FOLDER/href).resolve().exists(): errors.append('LINK:'+href)
        bro.close()
    for name,source in [('board',FOLDER/'board-1920.png'),('contact',FOLDER/'contact-sheet.jpg')]:
        path=ART/'grades'/('ui-a6-'+name+'.json')
        g=read(path) if path.exists() else {}
        if (g.get('status')!='graded' or g.get('image_sha256')!=sha(source)
                or g.get('verdict') not in ('reject','owner-review') or g.get('owner_accepted') is not False):
            errors.append('UI_DIAGNOSTIC:'+name)
    current=[r for r in m['rows'] if r['job'] in m['current'].values()]
    report=dict(status='fail' if errors else 'pass',errors=errors,current_images=len(current),attempts=len(m['rows']),
                current_rejects=[r['job'] for r in current if r['verdict']=='reject'],browser=browser,budget=m['budget'],
                owner_accepted=False,scope='Portable delivery integrity, not style/scale acceptance. Semantic rejects remain held.')
    write(ART/'reports/A6-check.json',report); print(json.dumps(report,indent=2))
    if errors: raise SystemExit(1)

if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('command',choices=['build','check']); a=p.parse_args()
    build() if a.command=='build' else check()
