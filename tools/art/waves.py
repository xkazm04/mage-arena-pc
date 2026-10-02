"""Later art waves use the original serial transport, ledger and stop latch."""
from __future__ import annotations
import argparse
import html
import json
import shutil
import urllib.request
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps
from common import ART, ROOT, config, digest, get_style, now, read, relative, sha, source_path, write
from generate import Budget, generate
from gates import pixel_gate
from grade import grade_job, route
from board import CSS, font


def brief(wave):
    index = ART / 'waves/brief-index.json'
    name = read(index).get(wave, wave.lower() + '-v1.json') if index.exists() else wave.lower() + '-v1.json'
    return read(ART / 'briefs' / name)


def spec_for(wave, item, b=None):
    b = b or brief(wave)
    parts = [get_style('01-tessera')['style_block'], b['common'], item['prompt']]
    if b.get('prompt_order') == 'camera-first':
        parts = [item['prompt'], b['common']]
    return {'version': b['version'], 'wave': wave, 'style': get_style('01-tessera'),
            'scene': item['id'], 'aspect_ratio': '16:9', 'brief_hash': digest(b),
            'prompt': '\n\n'.join(parts)}


def jobs(wave):
    return [j for j in Budget().load()['jobs'] if j.get('wave') == wave]


def require_proof(spec):
    wave = spec['wave']
    if wave == 'A3' and not (ART / 'CAMERA-OK.md').is_file():
        raise RuntimeError('OWNER_CAMERA_REQUIRED')
    b = brief(wave)
    if wave == 'A3':
        camera = (ART / 'CAMERA-OK.md').read_text(encoding='utf-8')
        if 'camera_ok: true' not in camera:
            raise RuntimeError('OWNER_CAMERA_REQUIRED')
        if b.get('camera_sha256') != sha(ART / 'CAMERA-OK.md') or b.get('scale_sha256') != sha(ART / 'scale-contract-v1.json'):
            raise RuntimeError('STALE_A3_CAMERA_CONTRACT')
    if spec['brief_hash'] != digest(b):
        raise RuntimeError('STALE_WAVE_BRIEF')
    if wave != 'A1b':
        previous = ART / 'reports' / ('A1b-check.json')
        if not previous.exists() or read(previous)['status'] != 'pass':
            raise RuntimeError('A1B_DELIVERY_GATE_REQUIRED')
    if spec['scene'] == b['proof_item']:
        return
    p = ART / 'proofs' / (wave + '.json')
    if not p.exists():
        raise RuntimeError('ONE_IMAGE_PROOF_REQUIRED')
    proof = read(p)
    if wave == 'A3':
        composite = proof.get('composite_review', {})
        files = composite.get('files', {})
        if len(files) != 2 or composite.get('owner_accepted') is not False or not composite.get('note'):
            raise RuntimeError('A3_COMPOSITE_PROOF_REQUIRED')
        if any(not (ROOT / path).exists() or sha(ROOT / path) != value for path, value in files.items()):
            raise RuntimeError('STALE_A3_COMPOSITE')
        cg = read(ROOT / composite['grade'])
        if cg.get('status') != 'graded' or route(cg)[0] == 'reject' or cg.get('image_sha256') not in files.values():
            raise RuntimeError('A3_COMPOSITE_REJECTED_OR_UNGRADED')
    job = next((j for j in jobs(wave) if j['id'] == proof['job']), None)
    if (not job or job['status'] != 'generated' or job['scene'] != b['proof_item'] or proof['brief_hash'] != digest(b)
            or proof['sha256'] != sha(source_path(job)) or proof['verdict'] != 'technical-continuation'
            or proof.get('owner_accepted') is not False):
        raise RuntimeError('STALE_PROOF')
    direct = read(ART / 'waves' / wave / 'reviews' / (job['id'] + '.json'))
    local = read(ART / 'grades' / (job['id'] + '.json'))
    if (direct.get('verdict') == 'reject' or direct.get('sha256') != job['sha256']
            or local.get('status') != 'graded' or local.get('image_sha256') != job['sha256']
            or route(local)[0] == 'reject' or gate(job)['verdict'] != 'technical-pass'):
        raise RuntimeError('PROOF_REJECTED_OR_UNGRADED')


def generated(wave):
    return [j for j in jobs(wave) if j['status'] == 'generated']


def gate(job):
    result = pixel_gate(source_path(job), job['sha256'])
    historical = read(ART / 'briefs' / (job['input']['version'] + '.json'))
    item = next(x for x in historical['items'] if x['id'] == job['scene'])
    if job['input_hash'] != digest(spec_for(job['wave'], item, historical)):
        result['codes'].append('STALE_INPUT')
    calls = job.get('tool_calls', [])
    expected = job['input']['prompt']
    if job.get('correction'):
        expected += '\n\nCORRECTION FROM DIRECT PIXEL REVIEW: ' + job['correction'].strip()
    if (len(calls) != 1 or calls[0]['name'] != 'image_gen' or calls[0]['arguments'].get('prompt') != expected
            or calls[0]['arguments'].get('aspect_ratio') != '16:9' or not job['prompt_verbatim_verified']):
        result['codes'].append('TOOL_CONTRACT')
    result['verdict'] = 'reject' if result['codes'] else 'technical-pass'
    return result


def review(wave, job_id, note, reject=False, proof=False, measurement=None):
    if not note or not note.strip():
        raise ValueError('DIRECT_INSPECTION_NOTE_REQUIRED')
    job = next(j for j in generated(wave) if j['id'] == job_id)
    record = {'job': job_id, 'sha256': job['sha256'], 'note': note, 'at': now(),
              'verdict': 'reject' if reject else 'owner-review', 'owner_accepted': False,
              'reviewer': 'executing-agent', 'label': 'direct pixel observation; not owner feel'}
    if measurement:
        record['measurement'] = measurement
    write(ART / 'waves' / wave / 'reviews' / (job_id + '.json'), record)
    if proof:
        if reject or job['scene'] != brief(wave)['proof_item'] or gate(job)['verdict'] != 'technical-pass':
            raise ValueError('PROOF_MUST_BE_FIRST_ITEM_AND_TECHNICALLY_VALID')
        grade = read(ART / 'grades' / (job_id + '.json'))
        if grade.get('status') != 'graded' or grade.get('image_sha256') != job['sha256'] or route(grade)[0] == 'reject':
            raise ValueError('LOCAL_REJECTION_BLOCKS_PROOF')
        write(ART / 'proofs' / (wave + '.json'), {**record, 'brief_hash': digest(brief(wave)),
              'verdict': 'technical-continuation', 'scope': 'authorize comparison siblings only; no production approval'})


def grade(wave, job_id=None):
    cfg = config()['grader']
    tags = json.load(urllib.request.urlopen(cfg['host'] + '/api/tags', timeout=10))
    model = next(m for m in tags['models'] if m['name'] == cfg['model'])
    for job in generated(wave):
        if job_id is None or job['id'] == job_id:
            grade_job(job, model['digest'])


def build(wave):
    folder = ART / 'review' / wave.lower()
    folder.mkdir(parents=True, exist_ok=True)
    rows = []
    for job in generated(wave):
        src = source_path(job)
        target = ART / 'review/sources' / (job['id'] + src.suffix)
        if src.resolve() != target.resolve():
            shutil.copy2(src, target)
        gp = ART / 'grades' / (job['id'] + '.json')
        rp = ART / 'waves' / wave / 'reviews' / (job['id'] + '.json')
        g = read(gp) if gp.exists() else {'status': 'ungraded'}
        r = read(rp) if rp.exists() else {}
        item = next(x for x in brief(wave)['items'] if x['id'] == job['scene'])
        verdict = 'reject' if gate(job)['verdict'] == 'reject' or route(g)[0] == 'reject' or r.get('verdict') == 'reject' else 'owner-review'
        rows.append({'job': job['id'], 'item': job['scene'], 'source': '../sources/' + target.name,
                     'sha256': job['sha256'], 'gate': gate(job), 'grade': g, 'review': r,
                     'brief_version': job['input']['version'],
                     'comparison': {k: item[k] for k in ('layout', 'density', 'distance', 'target_fraction') if k in item},
                     'verdict': verdict, 'owner_accepted': False})
    manifest = {'wave': wave, 'brief_hash': digest(brief(wave)), 'rows': rows, 'budget': Budget().summary(),
                'owner_accepted': False, 'not_measured': ['owner feel', 'motion readability', 'engine integration']}
    write(folder / 'manifest.json', manifest)
    tw, th, cols = 640, 430, 3
    sheet = Image.new('RGB', (tw * cols, 100 + ((len(rows) + cols - 1) // cols) * th), '#171c23')
    d = ImageDraw.Draw(sheet)
    d.text((20, 15), wave + ' / Tessera & Lime / owner review', font=font(30, True), fill='#f3e6c5')
    d.text((20, 60), 'Unaltered sources. Full size, direct review and local diagnostics in index.html.', font=font(20), fill='#b7c1c7')
    body = '<p class="status">' + html.escape(brief(wave)['description']) + '</p>'
    body += '<p>Wave images: ' + str(len(rows)) + '. Project reserved: ' + str(manifest['budget']['wave_reserved']) + '; local hard-cap remaining: ' + str(manifest['budget']['hard_remaining']) + '. Shared-account remainder not measured.</p>'
    extra = ART / 'waves' / wave / 'board-note.txt'
    if extra.exists():
        body += '<p class="status">' + html.escape(extra.read_text(encoding='utf-8')) + '</p>'
    links = ART / 'waves' / wave / 'links.json'
    if links.exists():
        body += '<nav class="nav">' + ''.join('<a href="' + html.escape(link['href'], quote=True) + '">' + html.escape(link['label']) + '</a>' for link in read(links)) + '</nav>'
    if wave == 'A1b':
        body += '<p><a href="../../SCALE-CONTRACT.md">Scale contract</a> / <a href="../../waves/A1b/camp-recheck.json">Camp re-check</a> / <a href="../screens/01-tessera-camp.png">Camp screen</a></p>'
        body += '<label>Camera target <select id="distance"><option value="all">All distances</option><option>near</option><option>standard</option><option>far</option></select></label> <label><input id="hide-rejects" type="checkbox"> Hide rejected attempts</label><p>Targets are prompt instructions. Observed bounds are approximate manual measurements, not calibrated camera zooms. Click any image for untouched full size.</p>'
    body += '<div class="archive">'
    for i, row in enumerate(rows):
        x, y = i % cols * tw, 100 + i // cols * th
        im = Image.open(folder / row['source']).convert('RGB'); im.thumbnail((620, 349), Image.Resampling.LANCZOS)
        sheet.paste(im, (x + 10, y))
        d.text((x + 10, y + 355), row['item'], font=font(18, True), fill='#f3e6c5')
        d.text((x + 10, y + 385), row['verdict'].upper(), font=font(18), fill='#efc784')
        note = row['review'].get('note', 'Direct review not recorded.')
        diagnostic = row['grade'].get('answers', {}).get('observation', 'Local grading not measured.')
        comparison = row['comparison']
        target = '<p>Prompt target: ' + str(round(comparison['target_fraction'] * 100)) + '% / ' + comparison['distance'] + '</p>' if comparison else ''
        body += '<article data-distance="' + comparison.get('distance', '') + '" data-verdict="' + row['verdict'] + '"><h3>' + html.escape(row['job'].removeprefix('01-tessera-')) + '</h3><a href="' + row['source'] + '"><img src="' + row['source'] + '" alt="' + html.escape(row['item']) + '"></a><p class="badge">' + row['verdict'] + '</p>' + target + '<p>' + html.escape(note) + '</p><details><summary>Local diagnostic</summary>' + html.escape(diagnostic) + '</details></article>'
    body += '</div>'
    if wave == 'A1b':
        body += '''<script>const distance=document.querySelector('#distance'), hide=document.querySelector('#hide-rejects');function filter(){document.querySelectorAll('article').forEach(a=>a.hidden=(distance.value!=='all'&&a.dataset.distance!==distance.value)||(hide.checked&&a.dataset.verdict==='reject'));}distance.onchange=filter;hide.onchange=filter;</script>'''
    sheet.save(folder / 'contact-sheet.jpg', quality=93)
    doc = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + wave + ' owner board</title><style>' + CSS + '\n[hidden]{display:none!important}h3{overflow-wrap:anywhere}select{padding:8px;margin:8px}</style><body><header><div class="eyebrow">MAGE ARENA / ' + wave + '</div><h1>Tessera &amp; Lime</h1><nav class="nav"><a href="contact-sheet.jpg">Contact sheet</a><a href="manifest.json">Evidence manifest</a><a href="../index.html">A1 archive</a></nav></header><main>' + body + '</main><footer>Concepts and authored interface studies. Owner review required; no model acceptance. No claim of motion readability or gameplay performance.</footer></body></html>'
    (folder / 'index.html').write_text(doc, encoding='utf-8')
    print(json.dumps({'wave': wave, 'sources': len(rows), 'rejects': sum(r['verdict'] == 'reject' for r in rows), 'budget': manifest['budget']}), flush=True)


def check(wave):
    from playwright.sync_api import sync_playwright
    build(wave)
    folder = ART / 'review' / wave.lower()
    m = read(folder / 'manifest.json'); errors = []
    expected = {i['id'] for i in brief(wave)['items']}
    if {r['item'] for r in m['rows']} != expected:
        errors.append('DELIVERY_INCOMPLETE')
    for r in m['rows']:
        if sha(folder / r['source']) != r['sha256'] or r['gate']['verdict'] != 'technical-pass':
            errors.append('SOURCE_GATE:' + r['job'])
        if r['grade'].get('status') != 'graded' or r['grade'].get('image_sha256') != r['sha256']:
            errors.append('MISSING_GRADE:' + r['job'])
        if not r['review'].get('note') or r['review'].get('sha256') != r['sha256']:
            errors.append('MISSING_REVIEW:' + r['job'])
        if r['owner_accepted'] or r['grade'].get('verdict') not in ('reject', 'owner-review'):
            errors.append('OWNER_BOUNDARY:' + r['job'])
    for item in brief(wave)['items']:
        if item['id'] != brief(wave)['proof_item']:
            require_proof(spec_for(wave, item))
    browser_results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        for w,h in [(1920,1080),(2560,1440),(390,844)]:
            page=browser.new_page(viewport={'width':w,'height':h}); pe=[]
            page.on('pageerror',lambda e: pe.append(str(e)))
            page.goto((folder/'index.html').as_uri())
            page.wait_for_function('Array.from(document.images).every(i=>i.complete)')
            loaded=page.locator('img').evaluate_all('xs=>xs.every(i=>i.naturalWidth>0)')
            overflow=page.evaluate('document.documentElement.scrollWidth>innerWidth')
            if not loaded or overflow or pe: errors.append('BROWSER:'+str(w))
            browser_results.append({'viewport':[w,h],'loaded':loaded,'overflow':overflow,'errors':pe});page.close()
        browser.close()
    report={'status':'fail' if errors else 'pass','errors':errors,'browser':browser_results,'images':len(m['rows']),
            'semantic_rejects':sum(r['verdict']=='reject' for r in m['rows']), 'budget':Budget().summary(),
            'scope':'delivery integrity; semantic rejections are retained; not owner acceptance'}
    write(ART/'reports'/(wave+'-check.json'),report);print(json.dumps(report,indent=2))
    if errors: raise SystemExit(1)


def main():
    p=argparse.ArgumentParser();p.add_argument('command',choices=['generate','grade','review','build','check']);p.add_argument('wave')
    p.add_argument('--item');p.add_argument('--job');p.add_argument('--note');p.add_argument('--proof',action='store_true');p.add_argument('--reject',action='store_true');p.add_argument('--correction')
    a=p.parse_args()
    if a.command=='generate':
        for item in brief(a.wave)['items']:
            if a.item and item['id']!=a.item: continue
            result=generate('01-tessera',item['id'],a.correction,spec_for(a.wave,item))
            if result['status']!='generated': raise SystemExit(2)
    elif a.command=='grade':grade(a.wave,a.job)
    elif a.command=='review':review(a.wave,a.job,a.note,a.reject,a.proof)
    elif a.command=='build':build(a.wave)
    else:check(a.wave)


if __name__=='__main__':main()
