"""Export six rectangular portrait panels per cast sheet; no image calls or painting."""
import argparse
import html
import json
from PIL import Image, ImageDraw
from common import ART, ROOT, read, write, sha, source_path
from waves import brief, generated, gate
from grade import route
from board import CSS, font


def build():
    cast = read(ART / 'cast-v1.json')
    target = ART / 'delivery/a2/portraits'
    target.mkdir(parents=True, exist_ok=True)
    rows = []
    body = '<p>Six expressions in reading order: calm, proud, afraid, angry, scheming, grieving. Opaque rectangular exports from unchanged source sheets; owner identity review pending.</p><label>Expression <select id="mood"><option value="all">All</option>' + ''.join('<option>' + m + '</option>' for m in cast['expressions']) + '</select></label>'
    contacts = Image.new('RGB', (1600, 1320), '#171c23')
    draw = ImageDraw.Draw(contacts)
    draw.text((20, 15), 'A2 / original cast / calm portraits / owner review', font=font(28, True), fill='#f3e6c5')
    for index, character in enumerate(cast['characters']):
        candidates = [j for j in generated('A2') if j['scene'] == 'portrait-' + character['id']]
        if not candidates:
            continue
        job = candidates[-1]
        review = read(ART / 'waves/A2/reviews' / (job['id'] + '.json'))
        grade = read(ART / 'grades' / (job['id'] + '.json'))
        verdict = 'reject' if review['verdict'] == 'reject' or route(grade)[0] == 'reject' else 'owner-review'
        body += '<section><h2>' + html.escape(character['name']) + '</h2><p>' + html.escape(character['role'] + ' / ' + character['school']) + ' / ' + verdict + '</p><div class="panels">'
        with Image.open(source_path(job)) as image:
            w, h = image.size
            for n, mood in enumerate(cast['expressions']):
                col, row = n % 3, n // 3
                rect = [round(col * w / 3), round(row * h / 2), round((col + 1) * w / 3), round((row + 1) * h / 2)]
                panel = image.crop(rect).convert('RGB')
                path = target / (character['id'] + '-' + mood + '.png')
                panel.save(path)
                record = {'character_id': character['id'], 'mood': mood, 'job': job['id'],
                          'source_sha256': job['sha256'], 'crop_px': rect, 'dimensions': list(panel.size),
                          'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path),
                          'verdict': verdict, 'owner_accepted': False, 'alpha': 'opaque source background retained'}
                rows.append(record)
                body += '<figure data-mood="' + mood + '"><img src="../../delivery/a2/portraits/' + path.name + '" alt="' + html.escape(character['name'] + ' / ' + mood) + '"><figcaption>' + mood.title() + '</figcaption></figure>'
                if n == 0:
                    panel.thumbnail((380, 270), Image.Resampling.LANCZOS)
                    x, y = (index % 4) * 400, 70 + (index // 4) * 310
                    contacts.paste(panel, (x + 10, y))
                    draw.text((x + 10, y + 274), character['name'], font=font(19, True), fill='#f3e6c5')
        body += '</div><p>' + html.escape(review['note']) + '</p></section>'
    manifest = {'wave': 'A2', 'cast_sha256': sha(ART / 'cast-v1.json'), 'portraits': rows,
                'transform': 'equal 3-column 2-row source-cell crop; no recolouring, repainting, retouching or alpha fabrication',
                'owner_accepted': False}
    write(ART / 'delivery/a2/manifest.json', manifest)
    folder = ART / 'review/a2'
    folder.mkdir(parents=True, exist_ok=True)
    contacts.save(folder / 'cast-contact-sheet.jpg', quality=94)
    document = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cast expressions</title><style>' + CSS + '.panels{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.panels figure{margin:0}.panels img{width:100%}figcaption{padding:8px}select{padding:8px;margin:8px}[hidden]{display:none!important}@media(max-width:850px){.panels{grid-template-columns:repeat(2,minmax(0,1fr))}}</style><header><div class="eyebrow">MAGE ARENA / A2</div><h1>The people behind the collars</h1><nav><a href="index.html">Source sheets</a> / <a href="cast-contact-sheet.jpg">Cast contact sheet</a> / <a href="../../delivery/a2/manifest.json">Export manifest</a></nav></header><main>' + body + '</main><script>document.querySelector("#mood").onchange=e=>document.querySelectorAll("figure[data-mood]").forEach(f=>f.hidden=e.target.value!=="all"&&f.dataset.mood!==e.target.value);</script></html>'
    (folder / 'portraits.html').write_text(document, encoding='utf-8')
    return manifest


def check():
    from playwright.sync_api import sync_playwright
    manifest = build()
    cast = read(ART / 'cast-v1.json')
    errors = []
    expected = {(c['id'], m) for c in cast['characters'] for m in cast['expressions']}
    actual = {(r['character_id'], r['mood']) for r in manifest['portraits']}
    if actual != expected or len(manifest['portraits']) != 96:
        errors.append('CAST_OR_MOOD_COVERAGE')
    source = read(ROOT / cast['source'])
    if sha(ROOT / cast['source']) != cast['source_sha256'] or {c['id'] for c in source['characters']} != {c['id'] for c in cast['characters']}:
        errors.append('CAST_SOURCE_DRIFT')
    if brief('A2')['cast_sha256'] != sha(ART / 'cast-v1.json'):
        errors.append('CAST_BRIEF_DRIFT')
    jobs = {j['id']: j for j in generated('A2')}
    for row in manifest['portraits']:
        job = jobs[row['job']]
        if gate(job)['verdict'] != 'technical-pass' or row['source_sha256'] != job['sha256']:
            errors.append('SOURCE:' + row['job'])
        path = ROOT / row['path']
        with Image.open(path) as image, Image.open(source_path(job)) as source:
            if image.tobytes() != source.crop(row['crop_px']).convert('RGB').tobytes() or list(image.size) != row['dimensions']:
                errors.append('CROP:' + row['path'])
        if sha(path) != row['sha256'] or row['owner_accepted']:
            errors.append('EXPORT:' + row['path'])
    browsers = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        for width, height in [(1920,1080),(390,844)]:
            page = browser.new_page(viewport={'width': width, 'height': height})
            page.goto((ART / 'review/a2/portraits.html').as_uri())
            page.wait_for_function('Array.from(document.images).every(i=>i.complete)')
            loaded = page.locator('img').evaluate_all('xs=>xs.length===96&&xs.every(i=>i.naturalWidth>0)')
            overflow = page.evaluate('document.documentElement.scrollWidth>innerWidth')
            page.select_option('#mood','angry')
            filtered = page.locator('figure:visible').count() == 16
            if not loaded or overflow or not filtered:
                errors.append('BROWSER:' + str(width))
            browsers.append({'viewport':[width,height], 'images_loaded':loaded, 'overflow':overflow, 'mood_filter':filtered})
            page.close()
        browser.close()
    report = {'status':'fail' if errors else 'pass','errors':errors,'characters':len(cast['characters']),
              'expression_exports':len(manifest['portraits']),'browser':browsers,'owner_accepted':False,
              'not_measured':['owner identity approval','human mood-recognition accuracy','engine integration']}
    write(ART / 'reports/A2-portraits-check.json',report)
    print(json.dumps(report,indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('command',choices=['build','check']);args=parser.parse_args()
    check() if args.command=='check' else build()
