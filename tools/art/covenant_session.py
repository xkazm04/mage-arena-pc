"""Combined Covenant owner handoff and conservative end-of-session audit."""
import argparse
import json
import subprocess
import html
import sys
from pathlib import Path
from collections import Counter
from PIL import Image, ImageDraw, ImageOps, ImageFont
from common import ART, ROOT, read, write, relative, sha
from covenant import check as check_wave
from providers import provider_of, ProviderBudget

WAVES=['A7','A3c','A5b','A4c','A2c']
SELECTION=[
 ('A7','Verdigris arena','art/delivery/a7/arena-verdigris-1920.png'),
 ('A7','Rust and sand arena','art/delivery/a7/arena-rust-sand-1920.png'),
 ('A7','Moonlit arena','art/delivery/a7/arena-moonlit-1920.png'),
 ('A3c','Far-camera roster / 1080p','art/delivery/a3c/proofs/moonlit-1920.png'),
 ('A5b','Canvas arena HUD','art/review/a5b/arena-1920.png'),
 ('A5b','Canvas menu','art/review/a5b/menu-1920.png'),
 ('A4c','Day camp','art/review/a4c/camp-day-1920.png'),
 ('A4c','Night camp','art/review/a4c/camp-night-1920.png'),
 ('A4c','Hollow Board','art/review/a4c/hollow-1-1920.png'),
 ('A2c','Moonchalk cast / sixteen identities','art/review/a2c/cast-contact-sheet.jpg')]


def build():
    out=ART/'review/covenant';out.mkdir(parents=True,exist_ok=True);rows=[];cards=[]
    sheet=Image.new('RGB',(2400,3500),'#0c141b');d=ImageDraw.Draw(sheet)
    f=ImageFont.truetype(str(ART/'ui/fonts/SourceSans3.ttf'),30)
    for i,(wave,title,file) in enumerate(SELECTION):
        p=ROOT/file;im=ImageOps.contain(Image.open(p).convert('RGB'),(1168,620));x=i%2*1200;y=i//2*700
        sheet.paste(im,(x+(1200-im.width)//2,y+62));d.text((x+24,y+18),wave+' / '+title,font=f,fill='#ece8dc')
        url='../../'+file.removeprefix('art/');rows.append({'wave':wave,'title':title,'file':file,'sha256':sha(p),'owner_accepted':False})
        cards.append(f'<article><h2>{html.escape(wave+" / "+title)}</h2><a href="{url}"><img src="{url}"></a><p><a href="../{wave.lower()}/index.html">Open wave board and evidence</a></p></article>')
    sheet.save(out/'contact-sheet.jpg',quality=94)
    write(out/'manifest.json',{'schema':1,'rows':rows,'owner_accepted':False})
    (out/'index.html').write_text('''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Mage Arena / Covenant family</title><style>body{margin:28px;background:#0c141b;color:#ece8dc;font:20px Georgia}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,650px),1fr));gap:24px}article{padding:16px;background:#17212a}img{width:100%;max-height:760px;object-fit:contain}a{color:#b6d8d4}h2{font-size:24px}p{max-width:1100px;line-height:1.5}</style><h1>Mage Arena / Covenant family</h1><p>Session 5 owner-review handoff. New assets are candidates, not accepted art. A3c is a partial pose delivery: excluded attacks, camera/fidelity drift and unfinished animation remain documented. Source rejections stay visible on each wave board.</p><p><a href="contact-sheet.jpg">Combined contact sheet</a> · <a href="../../ui/README.md">Unchanged UI loading contract</a> · <a href="../../ui/DELIVERY.md">UI kit handoff</a> · <a href="../a2c/portraits.html">Portrait and expression gallery</a> · <a href="../../SESSION-5-HANDOFF.md">Status, budget and backlog</a></p><main>'''+''.join(cards)+'</main>',encoding='utf-8')


def audit():
    usage=read(ART/'usage.json');old=json.loads(subprocess.check_output(['git','show','a0c77b7:art/usage.json'],cwd=ROOT));errors=[]
    legacy_ok=usage['jobs'][:159]==old['jobs'][:159]
    contract_ok=(ART/'ui/README.md').read_bytes()==subprocess.check_output(['git','show','06cd5e4:art/ui/README.md'],cwd=ROOT)
    if not legacy_ok:errors.append('LEGACY_LEDGER_CHANGED')
    if not contract_ok:errors.append('EARLY_UI_CONTRACT_CHANGED')
    total=sum(j['charged_images'] for j in usage['jobs']);counts=Counter();new=usage['jobs'][159:]
    for j in new:
        counts[provider_of(j)]+=j['charged_images']
        if j['status']=='generated':
            if sha(ROOT/j['archive'])!=j['sha256']:errors.append('SOURCE_DRIFT:'+j['id'])
            raw=ROOT/j['source']
            if raw.exists() and sha(raw)!=j['sha256']:errors.append('RAW_DRIFT:'+j['id'])
            if not (ART/'providers/runs'/j['id']/'request.txt').is_file():errors.append('MISSING_REQUEST:'+j['id'])
    if total>240:errors.append('PROJECT_CAP')
    integrity=[]
    for wave in WAVES:
        r=check_wave(wave);integrity.append(r)
        if r['errors']:errors.append('WAVE:'+wave)
    for r in read(ART/'review/covenant/manifest.json')['rows']:
        if sha(ROOT/r['file'])!=r['sha256']:errors.append('COMBINED_HASH:'+r['file'])
    history=ProviderBudget().state();policy=read(ART/'providers/budget.json');known={}
    from common import week
    for name in history['providers']:
        count=sum(j['charged_images'] for j in usage['jobs'] if provider_of(j)==name and j['week']==week())+policy['providers'][name].get('external_known_charges',{}).get(week(),0)
        known[name]=count
        if count>policy['providers'][name]['weekly_image_cap']:errors.append('PROVIDER_CAP:'+name)
    result={'status':'fail' if errors else 'pass','errors':errors,'project_charged':total,'project_remaining':240-total,'session_charged':sum(counts.values()),'session_by_provider':dict(counts),'known_week_by_provider':known,'provider_stops':{k:v['stop'] for k,v in history['providers'].items()},'legacy_159_unchanged':legacy_ok,'ui_contract_unchanged':contract_ok,'waves':integrity,'historical_global_failures':['A3 STOP_SNAPSHOT_DRIFT','UNRESOLVED_UI:ui-a3-poses.json'],'owner_accepted':False,'engine_motion_performance_feel':'not measured'}
    write(ART/'reports/covenant-session-audit.json',result);print(json.dumps(result));return result


def portable():
    """Rebuild delivery with all access to ignored raw folders forbidden."""
    from covenant_battle import export, effects, painted_effects, composites
    from covenant_ui import build as ui_build
    from covenant_camp import build as camp_build
    from covenant_portraits import build as portraits_build
    roots=[ART/'delivery'/w.lower() for w in WAVES if w!='A5b']+[ART/'ui']
    files=[p for root in roots for p in root.rglob('*') if p.is_file() and p.suffix in ('.png','.json')]
    before={relative(p):sha(p) for p in files};blocked=[];raw=(ART/'raw').resolve()
    def guard(event,args):
        if event=='open' and isinstance(args[0],(str,bytes,Path)):
            path=Path(args[0]).resolve()
            if path==raw or raw in path.parents:
                blocked.append(str(path));raise RuntimeError('RAW_ACCESS_FORBIDDEN')
    sys.addaudithook(guard)
    for row in read(ART/'delivery/a7/manifest.json')['exports']:
        ImageOps.fit(Image.open(ROOT/row['source']).convert('RGB'),tuple(row['size']),method=Image.Resampling.LANCZOS).save(ROOT/row['file'])
    figures=export();effects();painted_effects();composites(figures)
    ui_build();camp_build();portraits_build()
    drift=[file for file,h in before.items() if sha(ROOT/file)!=h]
    result={'status':'fail' if blocked or drift else 'pass','scope':'all five delivery builders with ignored raw access forbidden; no generation','checked_files':len(before),'raw_access_attempts':blocked,'hash_drift':drift}
    write(ART/'reports/covenant-portable-rebuild.json',result);print(json.dumps(result));return result


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('command',choices=['build','audit','portable']);a=p.parse_args()
    if a.command=='build':build()
    elif a.command=='portable':
        if portable()['status']!='pass':raise SystemExit(1)
    elif audit()['errors']:raise SystemExit(1)
