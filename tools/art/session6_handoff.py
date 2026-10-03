"""Build combined review and audit immutable history/preserved owner-approved art."""
import collections,html,json,subprocess
from PIL import Image,ImageDraw,ImageOps
from common import ART,ROOT,read,write,sha,digest,relative
from covenant import font
from providers import provider_of

def audit():
    start=read(ART/'waves/session6-start.json');usage=read(ART/'usage.json');errors=[]
    if digest(usage['jobs'][:start['jobs']])!=start['jobs_digest']:errors.append('INHERITED_JOBS_CHANGED')
    changed=[p for p,h in start['preserved_camp_portraits'].items() if sha(ROOT/p)!=h]
    if changed:errors.append('APPROVED_CAMP_OR_PORTRAIT_CHANGED')
    total=sum(j['charged_images'] for j in usage['jobs']);new=usage['jobs'][start['jobs']:]
    if total!=285 or total>read(ART/'budget.json')['wave_hard_cap']:errors.append('BUDGET')
    latches={k:v['stop'] for k,v in read(ART/'providers/history.json')['providers'].items()}
    if not all(latches.values()):errors.append('PROVIDER_LATCH_CLEARED')
    reports={}
    for wave in ['a8','a9','a10','a11']:
        for suffix in ['delivery-check','covenant-check','covenant-browser','portable']:
            name=wave+'-'+suffix;p=ART/'reports'/(name+'.json')
            if not p.exists():errors.append('MISSING_REPORT:'+name);continue
            r=read(p);status=r.get('status',r.get('technicalStatus',r.get('integrity')));reports[name]=status
            if status!='pass':errors.append('REPORT:'+name)
        if wave!='a9':
            r=read(ART/'reports'/(wave+'-motion-browser.json'));reports[wave+'-motion-browser']=r['status']
            if r['status']!='pass':errors.append('MOTION:'+wave)
    a10=read(ART/'reports/a10-delivery-check.json');a11=read(ART/'reports/a11-delivery-check.json')
    result={'status':'fail' if errors else 'pass','errors':errors,'inheritedJobs':start['jobs'],'inheritedJobsUnchanged':not 'INHERITED_JOBS_CHANGED' in errors,
      'preservedCampPortraitFiles':len(start['preserved_camp_portraits']),'changedApprovedFiles':changed,
      'charged':total,'chargedThisSession':sum(j['charged_images'] for j in new),'localCap':300,'localRemainder':300-total,
      'sessionChargesByWave':dict(collections.Counter({w:sum(j['charged_images'] for j in new if j['wave']==w) for w in ['A8','A9','A10','A11']})),
      'cumulativeChargesByProvider':dict(collections.Counter({p:sum(j['charged_images'] for j in usage['jobs'] if provider_of(j)==p) for p in set(provider_of(j) for j in usage['jobs'])})),
      'providerLatches':latches,'reportStatus':reports,'characterClips':a10['deliveredClips'],'missingCharacterClips':len(a10['missingClips']),
      'newUiRegions':a11['newRegions'],'newGeneratedA11Images':0,'owner_accepted':False,
      'knownUnmet':['A9 approved-concept equivalence unproven; repeated stands and derived rim remain','A10 90 clips absent; repeated leading-leg poses and identity drift remain in candidates','A11 requested new generated paintings blocked; authored candidates do not meet the painted fidelity bar','Game integration and owner feel unmeasured'],
      'historicalFailuresRetained':['A3 STOP_SNAPSHOT_DRIFT','UNRESOLVED_UI:ui-a3-poses.json'],
      'gitBranch':subprocess.check_output(['git','branch','--show-current'],cwd=ROOT,text=True).strip(),'pushed':False}
    write(ART/'reports/session6-audit.json',result);print(json.dumps(result,ensure_ascii=False));return result


def board():
    out=ART/'review/session6';out.mkdir(parents=True,exist_ok=True)
    rows=[('A8','Spell and effect candidates','35 clips / generated paint + authored telegraphs','art/review/a8/motion-verdigris-1920.png'),
      ('A9','Arena restoration candidates','3 palettes / fidelity differences still visible','art/delivery/a9/proofs/comparison-verdigris.png'),
      ('A10','Partial character animation','198 / 288 clips; gait and identity limitations','art/delivery/a10/direction-contact.png'),
      ('A11','Tideglass and stats design','Authored composite; new generation blocked','art/review/a11/motion-1920.png')]
    sheet=Image.new('RGB',(1920,1370),'#101a23');d=ImageDraw.Draw(sheet)
    d.text((26,20),'Mage Arena / ART session 6 / owner review',font=font(34),fill='#eee8d6')
    d.text((26,65),'Camp and portraits preserved. Both providers stopped at 285 charged. No new asset acceptance claimed.',font=font(21),fill='#bdcecf')
    cards=[];manifest=[]
    for i,(wave,title,note,path) in enumerate(rows):
        x=i%2*960;y=120+i//2*620;src=Image.open(ROOT/path).convert('RGB');im=ImageOps.contain(src,(928,500),Image.Resampling.LANCZOS)
        sheet.paste(im,(x+(960-im.width)//2,y+(500-im.height)//2));d.text((x+20,y+516),wave+' / '+title,font=font(26),fill='#eee8d6');d.text((x+20,y+557),note,font=font(21),fill='#a9cbd0')
        panel=sheet.crop((x,y,x+960,y+610));p=out/(wave.lower()+'.png');panel.save(p)
        row={'wave':wave,'file':relative(p),'sha256':sha(p),'source':path,'sourceSha256':sha(ROOT/path),'note':note,'owner_accepted':False};manifest.append(row)
        cards.append(f'<article><h2><a href="../{wave.lower()}/index.html">{html.escape(wave+" — "+title)}</a></h2><a href="../{wave.lower()}/index.html"><img src="{wave.lower()}.png" alt="{html.escape(title)}"></a><p>{html.escape(note)}</p></article>')
    sheet.save(out/'contact-sheet.jpg',quality=95)
    (out/'index.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Mage Arena ART session 6</title><style>body{margin:24px;background:#101a23;color:#eee8d6;font:19px Georgia}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,600px),1fr));gap:24px}article{background:#192b34;padding:18px}img{width:100%}a{color:#a6d5d9}h1{font-size:34px}h2{font-size:25px}p{line-height:1.5}</style><h1>Mage Arena · ART session 6</h1><p>Camp and portraits preserved. A8/A9 candidates; A10 partial animation; A11 authored design with generation blocked. Both providers retain their stop latches at 285 charged reservations. No new owner acceptance or game integration is claimed.</p><p><a href="../../SESSION-6-HANDOFF.md">Handoff and exact remaining work</a> · <a href="contact-sheet.jpg">Combined contact sheet</a> · <a href="../../reports/session6-audit.json">Integrity and budget audit</a></p><main>'''+''.join(cards)+'''</main><p>Open individual boards for native 1080p/1440p proof images, source findings, metadata and canvas playback. Thumbnail scaling is not evidence of equal concept fidelity. The local grader may reject or route; owner feel remains unmeasured.</p></html>''',encoding='utf-8')
    write(out/'manifest.json',{'rows':manifest,'owner_accepted':False})

if __name__=='__main__':
    if audit()['errors']:raise SystemExit(1)
    board()
