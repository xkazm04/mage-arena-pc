"""Offline integrity gate for the STOPPED, INCOMPLETE A3 handoff.

Passing this command never passes the separate full-wave completeness gate.
"""
import argparse
import math
import json
import numpy as np
from PIL import Image
from common import ART, ROOT, read, write, sha
from figures import OUT
from waves import generated, gate, brief, require_proof, spec_for
from grade import route
from generate import Budget


def check(browser=True):
    errors=[];m=read(OUT/'figures.json');fx=read(OUT/'effects.json');b=brief('A3');stop=read(ART/'waves/A3/stop-report.json')
    budget=Budget().summary();jobs={j['id']:j for j in generated('A3')}
    roster=read(ART/'a3-roster-v1.json')['entities'];der=read(ART/'a3-derivations-v1.json')
    if not budget['stop'] or budget['wave_reserved']!=126 or budget['generated']!=125:errors.append('STOP_SNAPSHOT_DRIFT')
    if len(m['frames'])!=70 or len(m['atlases'])!=9:errors.append('PARTIAL_EXPORT_CENSUS')
    done={j['scene'] for j in jobs.values()}
    missing=sorted(i['id'] for i in b['items'] if i['id'] not in done)
    if missing!=sorted(stop['missing_items']) or len(missing)!=13:errors.append('UNDISCLOSED_MISSING_ART')
    for j in jobs.values():
        if gate(j)['verdict']!='technical-pass':errors.append('SOURCE_GATE:'+j['id'])
        review=read(ART/'waves/A3/reviews'/(j['id']+'.json'));grade=read(ART/'grades'/(j['id']+'.json'))
        if review['sha256']!=j['sha256'] or not review['note']:errors.append('DIRECT_REVIEW:'+j['id'])
        if grade.get('status')!='graded' or grade.get('image_sha256')!=j['sha256']:errors.append('LOCAL_GRADE:'+j['id'])
        if grade['verdict'] not in ('reject','owner-review') or review['owner_accepted'] is not False:errors.append('OWNER_BOUNDARY')
    require_proof(spec_for('A3',b['items'][1]))
    for row in m['frames']:
        path=ROOT/row['file'];im=Image.open(path);alpha=np.asarray(im.getchannel('A'))
        if sha(path)!=row['sha256'] or im.mode!='RGBA' or im.size!=(512,384):errors.append('FRAME_FILE:'+row['file'])
        if np.max(alpha[0]) or np.max(alpha[-1]) or np.max(alpha[:,0]) or np.max(alpha[:,-1]):errors.append('FRAME_CLIPPED:'+row['file'])
        if np.max(alpha)!=255 or np.min(alpha)!=0:errors.append('FRAME_ALPHA:'+row['file'])
        j=jobs[row['source_job']];review=read(ART/'waves/A3/reviews'/(j['id']+'.json'))
        if j['sha256']!=row['source_sha256']:errors.append('FRAME_PROVENANCE')
        if route(read(ART/'grades'/(j['id']+'.json')))[0]=='reject':errors.append('EXPORTED_LOCAL_REJECT')
        if review['verdict']=='reject':
            key=row['entity']+':'+row['state'];salvage=der['salvage'].get(key)
            if not salvage or salvage['job']!=j['id'] or salvage['crop']!=row['source_crop'] or not row['salvage_from_rejected_sheet']:
                errors.append('UNREVIEWED_REJECT_SALVAGE:'+key)
        if row.get('derivation'):
            source=next(r for r in m['frames'] if r['entity']==row['entity'] and r['state']==row['derivation']['from_state'])
            if row['sha256']!=source['sha256']:errors.append('REUSE_NOT_EXACT')
    for atlas in m['atlases']:
        im=Image.open(ROOT/atlas['file'])
        if sha(ROOT/atlas['file'])!=atlas['sha256']:errors.append('ATLAS_HASH')
        for row in [r for r in m['frames'] if r['entity']==atlas['entity']]:
            x,y,w,h=row['atlas_rect'];crop=im.crop((x,y,x+w,y+h))
            if crop.tobytes()!=Image.open(ROOT/row['file']).tobytes():errors.append('ATLAS_FRAME_MISMATCH')
        states={r['state'] for r in m['frames'] if r['entity']==atlas['entity']}
        if any(v and not set(v)<=states for v in atlas['state_map'].values()):errors.append('UNAVAILABLE_STATE_ADVERTISED')
    measurements=[]
    if len(fx['recipes'])!=23 or len(fx['exports'])!=138 or len(fx['water_mappings'])!=24:errors.append('FX_CENSUS')
    for row in fx['exports']:
        im=Image.open(ROOT/row['file']);w,h=row['frame_size'];a=np.asarray(im.getchannel('A'))
        if sha(ROOT/row['file'])!=row['sha256'] or im.mode!='RGBA' or im.size!=(w*4,h):errors.append('FX_FILE')
        for n in range(4):
            cell=a[:,n*w:(n+1)*w]
            if not cell.max() or cell[0].max() or cell[-1].max() or cell[:,0].max() or cell[:,-1].max():errors.append('FX_CLIP_OR_EMPTY:'+row['id'])
        if row['id'].endswith('-bolt'):
            thickness=int(np.sum(a[:,w//2]>127));minimum=4*row['viewport_height']/1080
            if thickness<math.floor(minimum):errors.append('PROJECTILE_CORE_TOO_THIN:'+row['file'])
            measurements.append({'id':row['id'],'height':row['viewport_height'],'distance':row['distance'],'opaque_centre_thickness_px':thickness})
        if row['id']=='water-absorb':
            ys,xs=np.where(a[:,:w]>127);dx=xs-w/2;dy=(ys-h/2)/math.sin(math.radians(55));angles=np.degrees(np.arctan2(dy,dx))
            if min(dx)<0 or np.max(np.abs(angles))>74:errors.append('ABSORB_REAR_NOT_OPEN')
        if row.get('dashed_advisory_diameter_m'):
            ys,xs=np.where(a[:,:w]>127)
            minimum=4*30*row['zoom']*row['viewport_height']/1080
            if xs.max()-xs.min()<minimum-2 or row['solid_footprint_diameter_m']>=4:
                errors.append('SMALL_FOOTPRINT_ADVISORY_CUE')
    for record in read(OUT/'proofs.json')+read(OUT/'encounters.json'):
        im=Image.open(ROOT/record['file'])
        if list(im.size)!=record['size'] or sha(ROOT/record['file'])!=record['sha256']:errors.append('PROOF_EXPORT')
    browsers=[]
    if browser:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            br=p.chromium.launch(channel='chrome',headless=True)
            for width,height in [(1920,1080),(2560,1440),(390,844)]:
                page=br.new_page(viewport={'width':width,'height':height});pe=[];page.on('pageerror',lambda e:pe.append(str(e)))
                page.goto((ART/'review/a3/owner.html').as_uri());page.wait_for_function('Array.from(document.images).every(i=>i.complete)')
                loaded=page.locator('img').evaluate_all('xs=>xs.every(i=>i.naturalWidth>0)');overflow=page.evaluate('document.documentElement.scrollWidth>innerWidth')
                page.select_option('#state','absorb');page.wait_for_function("document.getElementById('status').textContent.includes('absorb')")
                page.select_option('#entity','shieldman');page.wait_for_function("document.getElementById('status').textContent.includes('unavailable')")
                page.select_option('#entity','cassia');page.select_option('#state','cast');page.click('#play')
                page.wait_for_function("document.getElementById('status').textContent.includes('cast-release')")
                page.click('#play');page.select_option('#state','idle');page.select_option('#resolution','1440');page.select_option('#distance','far')
                page.wait_for_function("document.getElementById('status').textContent.includes('57.6 px')")
                page.select_option('#resolution','1080');page.select_option('#distance','near');page.select_option('#state','absorb')
                page.wait_for_function("document.getElementById('status').textContent.includes('cassia / absorb') && document.getElementById('status').textContent.includes('64.8 px')")
                page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
                path=ART/'review/a3'/f'owner-{width}.png';page.screenshot(path=str(path),full_page=False)
                browsers.append({'viewport':[width,height],'loaded':loaded,'overflow':overflow,'errors':pe,'capture':str(path.relative_to(ROOT)),'sha256':sha(path)})
                if not loaded or overflow or pe:errors.append('OWNER_BOARD:'+str(width))
                page.close()
            br.close()
    report={'status':'fail' if errors else 'pass','scope':'integrity of explicitly incomplete stopped handoff, NOT A3 completion',
        'a3_complete':False,'missing_items':missing,'errors':errors,'frames':len(m['frames']),'atlases':len(m['atlases']),
        'effect_sheets':len(fx['exports']),'projectile_measurements':measurements,'browser':browsers,'budget':budget,'owner_accepted':False}
    write(ART/'reports/A3-integrity.json',report);print(json.dumps({k:v for k,v in report.items() if k not in ('projectile_measurements','browser')},indent=2))
    if errors:raise SystemExit(1)


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--skip-browser',action='store_true');a=p.parse_args();check(not a.skip_browser)
