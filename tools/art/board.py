"""Portable owner board, code-drawn factual UI, source archive and content validation."""
from __future__ import annotations
import html
import json
import shutil
import textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
from common import ART, ROOT, camp_data, config, digest, get_style, input_matches_current, input_record, read, relative, sha, source_path, styles, write
from generate import Budget
from gates import check_job, pixel_gate
from grade import route
from rank import comparison_signature

REVIEW = ART / 'review'


def font(size, bold=False):
    name = 'segoeuib.ttf' if bold else 'segoeui.ttf'
    path = Path('C:/Windows/Fonts') / name
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default(size=size)


def panel(draw, box, fill, outline=None, radius=12):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=2)


def render_screen(job, target):
    cfg = config()
    style = get_style(job['style_id'])
    palette = style['ui']
    width, height = cfg['review_width'], cfg['review_height']
    with Image.open(source_path(job)) as source:
        image = ImageOps.pad(source.convert('RGB'), (width, height), method=Image.Resampling.LANCZOS, color=palette['paper'])
    # Arena proof needs no in-picture HUD. Preserve every source figure and effect;
    # adding header/footer bands here would cover some generated edge subjects.
    if job['scene'] == 'arena':
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target, optimize=True)
        return {'source_sha256': job['sha256'], 'export_sha256': sha(target), 'size': [width, height],
                'method': 'aspect-preserving resize/pad only; entire arena plate visible',
                'renderer_sha256': sha(Path(__file__)), 'config_sha256': sha(ART / 'config-v1.json'),
                'location_source_sha256': None}
    # Exact labels are authored overlays. No repair/repainting of the generated scene.
    draw = ImageDraw.Draw(image)
    panel(draw, (22, 18, width - 22, 96), palette['paper'], palette['ink'])
    if job['scene'] == 'camp':
        draw.text((44, 26), cfg['camp']['heading'], font=font(25, True), fill=palette['ink'])
        draw.text((44, 62), cfg['camp']['calendar_label'], font=font(15), fill=palette['ink'])
        locations, slots = camp_data()
        slot = cfg['camp']['default_slot']
        for index, label in enumerate(slots):
            x = width - 550 + index * 168
            active = label == slot
            panel(draw, (x, 31, x + 150, 81), palette['accent'] if active else palette['paper'], palette['ink'])
            draw.text((x + 19, 41), label.upper(), font=font(21, True), fill=palette['paper'] if active else palette['ink'])
        for location in locations:
            cx, cy = cfg['camp']['positions'][location['id']]
            x, y = round(cx * width), round(cy * height)
            name = location['name'].title()
            opening = location['open'].split(';')
            available = slot in opening
            status = 'OPEN' if available else ' / '.join(s.title() for s in opening)
            name_font = font(21, True)
            half = max(78, int(draw.textlength(name, font=name_font) / 2) + 17)
            draw.line((x, y - 20, x, y), fill=palette['ink'], width=3)
            draw.ellipse((x - 5, y - 26, x + 5, y - 16), fill=palette['accent'], outline=palette['paper'], width=2)
            panel(draw, (x - half, y, x + half, y + 60), palette['paper'], palette['accent'] if available else palette['ink'], radius=7)
            draw.text((x, y + 5), name, font=name_font, fill=palette['ink'], anchor='mt')
            draw.text((x, y + 34), status, font=font(14), fill=palette['ink'], anchor='mt')
        footer = 'CHOOSE A PLACE  /  Day and Dusk visits; Night act after dusk'
    panel(draw, (22, height - 66, width - 22, height - 18), palette['paper'], palette['ink'])
    draw.text((width / 2, height - 58), footer, font=font(20), fill=palette['ink'], anchor='mt')
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, optimize=True)
    return {'source_sha256': job['sha256'], 'export_sha256': sha(target), 'size': [width, height],
            'method': 'aspect-preserving pad + authored UI; no generated scene repair',
            'renderer_sha256': sha(Path(__file__)), 'config_sha256': sha(ART / 'config-v1.json'),
            'location_source_sha256': sha(ROOT / cfg['sources']['locations']) if job['scene'] == 'camp' else None}


def assessment(job):
    gate = check_job(job)
    grade_path = ART / 'grades' / (job['id'] + '.json')
    grade = read(grade_path) if grade_path.exists() else {'status': 'ungraded'}
    if grade.get('image_sha256') != job.get('sha256'):
        grade = {'status': 'ungraded', 'error': 'missing or stale image hash'}
    verdict, codes = route(grade)
    codes += gate['codes']
    rejected = ART / 'rejections' / (job['id'] + '.json')
    rejection = read(rejected) if rejected.exists() else None
    if rejection and rejection['sha256'] == job.get('sha256'):
        codes.append('DIRECT_REVIEW_REJECTED')
    if gate['verdict'] == 'reject' or 'DIRECT_REVIEW_REJECTED' in codes:
        verdict = 'reject'
    return {'gate': gate, 'grade': grade, 'verdict': verdict, 'codes': codes, 'rejection': rejection}


def contact(items, path, title):
    cfg = config()
    columns, tw, th = cfg['contact_columns'], cfg['contact_tile_width'], cfg['contact_tile_height']
    image = Image.new('RGB', (columns * tw, 90 + ((len(items) + columns - 1) // columns) * th), '#171c23')
    draw = ImageDraw.Draw(image)
    draw.text((22, 17), title, font=font(25, True), fill='#f0e7d5')
    draw.text((22, 53), 'Authored concept screens / owner choice pending / open HTML for full size and evidence', font=font(15), fill='#aeb9c3')
    for i, item in enumerate(items):
        x, y = i % columns * tw, 90 + i // columns * th
        if item.get('screen'):
            with Image.open(REVIEW / item['screen']) as frame:
                frame.thumbnail((tw - 24, th - 68), Image.Resampling.LANCZOS)
                image.paste(frame, (x + 12, y + 8))
        else:
            draw.text((x + 22, y + 100), 'NOT GENERATED', font=font(23, True), fill='#eda68f')
        draw.text((x + 14, y + th - 61), item['name'] + ' / ' + item['scene'].upper(), font=font(19, True), fill='#f0e7d5')
        draw.text((x + 14, y + th - 32), item.get('verdict', 'missing').upper(), font=font(15), fill='#efc978')
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)


CSS = """
:root{color-scheme:dark;--paper:#f2ead8;--muted:#b7c1c7;--bg:#12191e;--panel:#1b252c;--line:#3b484f;--gold:#efc784}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--paper);font:16px/1.5 'Segoe UI',sans-serif}a{color:#bce5df;text-underline-offset:4px}button,select{font:inherit}button{cursor:pointer;background:#26363e;border:1px solid #60757d;color:var(--paper);padding:10px 18px;border-radius:6px}button:hover,button[aria-pressed=true]{background:#36505a;border-color:var(--gold)}header,main,footer{max-width:1660px;margin:auto;padding:30px}header{padding-top:54px}.eyebrow{letter-spacing:.2em;color:var(--gold);font-size:12px;font-weight:700}h1{font:normal clamp(36px,5vw,70px)/1.08 Georgia,serif;margin:16px 0}h2{font:normal 32px/1.2 Georgia,serif;margin:12px 0}h3{font-size:19px;margin:0 0 10px}p{max-width:960px}.intro{font-size:19px;color:var(--muted)}.toolbar{display:flex;gap:10px;flex-wrap:wrap;margin:25px 0}.meta{color:var(--muted);font-size:14px}.direction{border-top:1px solid var(--line);padding:28px 0 38px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}.tile{margin:0;min-width:0}.tile img{display:block;width:100%;height:auto;border:1px solid var(--line);background:#202a30}.tile a{display:block}.tile figcaption{padding:11px 0;color:var(--muted)}.badge{display:inline-block;font-size:12px;letter-spacing:.06em;color:var(--gold);margin-left:8px}.reject{color:#ffad9b}.axes{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.axes span{border:1px solid var(--line);padding:5px 9px;border-radius:4px;color:var(--muted);font-size:13px}details{background:var(--panel);padding:14px 18px;border-radius:8px;margin:18px 0}summary{cursor:pointer;color:var(--gold)}.evidence{display:grid;grid-template-columns:1fr 1fr;gap:18px}.evidence p{font-size:14px}.nav{display:flex;gap:16px;flex-wrap:wrap}.empty{aspect-ratio:16/9;background:var(--panel);display:grid;place-content:center;color:#ffad9b}.hide{display:none!important}.rank{padding-left:22px}.rank li{padding:8px}.wide .pair{grid-template-columns:1fr}footer{border-top:1px solid var(--line);color:var(--muted);padding-bottom:60px}.archive{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}.archive img{width:100%}dialog{padding:10px;background:var(--bg);border:1px solid var(--line);max-width:96vw;max-height:96vh;color:var(--paper)}dialog img{max-width:92vw;max-height:80vh;object-fit:contain}dialog::backdrop{background:#000c}.dialog-head{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:8px}.status{border-left:3px solid var(--gold);padding:10px 16px;background:var(--panel)}@media(max-width:850px){header,main,footer{padding:20px}.pair,.evidence,.archive{grid-template-columns:1fr}h1{font-size:42px}.toolbar button{flex:1}.axes{gap:5px}}@media print{body{background:white;color:black}.toolbar,dialog{display:none}.direction{break-inside:avoid}.meta,.intro,.axes span{color:#333}a{color:#222}}
"""


def tile(item):
    scene = item['scene'].title()
    if item.get('screen'):
        picture = f'<a class="zoom" href="{item["screen"]}" data-title="{html.escape(item["name"])} / {scene}"><img src="{item["screen"]}" alt="{html.escape(item["name"])} {scene} authored style concept" width="1600" height="900" loading="lazy"></a>'
    else:
        picture = '<div class="empty">Not generated — see spend status</div>'
    return f'<figure class="tile" data-scene="{item["scene"]}">{picture}<figcaption>{scene}<span class="badge {"reject" if item["verdict"] == "reject" else ""}">{item["verdict"].upper()}</span></figcaption></figure>'


def diagnostic(item):
    a = item.get('assessment', {})
    g = a.get('grade', {})
    observation = g.get('answers', {}).get('observation', g.get('error', 'Local grading not measured.'))
    direct = item.get('direct_review', {}).get('note', 'Direct inspection not recorded.')
    rej = a.get('rejection')
    note = ('<p class="reject">Direct rejection: ' + html.escape(rej['note']) + '</p>') if rej else ''
    return f'<div><h3>{item["scene"].title()}</h3><p><b>Agent observation:</b> {html.escape(direct)}</p><p><b>Local diagnostic:</b> {html.escape(observation)}</p>{note}<p class="meta">{html.escape(", ".join(a.get("codes", [])))}</p></div>'


SCRIPT = """
const dialog=document.querySelector('dialog');
document.querySelectorAll('.zoom').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();dialog.querySelector('img').src=a.href;dialog.querySelector('img').alt=a.dataset.title;dialog.querySelector('span').textContent=a.dataset.title;dialog.showModal()}));
document.querySelector('#close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.querySelectorAll('.tile').forEach(t=>t.classList.toggle('hide',b.dataset.filter!=='all'&&t.dataset.scene!==b.dataset.filter));document.body.classList.toggle('wide',b.dataset.filter!=='all')}));
"""


def page(title, body, intro, nav=''):
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + html.escape(title) + '</title><style>' + CSS + '</style></head><body><header><div class="eyebrow">MAGE ARENA / A1 / STYLE STUDY</div><h1>' + html.escape(title) + '</h1><p class="intro">' + intro + '</p><nav class="nav">' + nav + '</nav></header><main>' + body + '</main><footer>Authored concept art and interface studies. Generated scenes with code-drawn labels. Not gameplay screenshots. Machine observations are diagnostic; owner taste, feel and style acceptance remain pending.</footer><dialog><div class="dialog-head"><span></span><button id="close">Close</button></div><img alt="Expanded concept"></dialog><script>' + SCRIPT + '</script></body></html>'


def build():
    REVIEW.mkdir(parents=True, exist_ok=True)
    cfg = config()
    budget = Budget()
    jobs = budget.load()['jobs']
    manual_path = ART / 'direct-reviews.json'
    manual = read(manual_path) if manual_path.exists() else {}
    archive = []
    for job in jobs:
        if job['status'] != 'generated':
            continue
        assessment_record = assessment(job)
        source = source_path(job)
        source_target = REVIEW / 'sources' / (job['id'] + source.suffix)
        source_target.parent.mkdir(parents=True, exist_ok=True)
        if source.resolve() != source_target.resolve():
            shutil.copy2(source, source_target)
        item = {'job': job['id'], 'style_id': job['style_id'], 'name': get_style(job['style_id'])['name'],
                'scene': job['scene'], 'source': source_target.relative_to(REVIEW).as_posix(), 'source_sha256': sha(source_target),
                'verdict': assessment_record['verdict'], 'assessment': assessment_record,
                'direct_review': manual.get(job['id'], {}), 'input_hash': job['input_hash'], 'owner_accepted': False}
        if item['direct_review'] and item['direct_review'].get('sha256') != job['sha256']:
            raise ValueError('STALE_DIRECT_REVIEW: ' + job['id'])
        archive.append(item)
    current = []
    directions = []
    for style in styles():
        pair = []
        for scene in ('arena', 'camp'):
            candidates = [i for i in archive if i['style_id'] == style['id'] and i['scene'] == scene]
            # Latest attempt is shown even if rejected: no silent score-based cherry-pick.
            item = dict(candidates[-1]) if candidates else {'style_id': style['id'], 'name': style['name'], 'scene': scene, 'verdict': 'missing', 'owner_accepted': False}
            if candidates:
                job = next(j for j in jobs if j['id'] == item['job'])
                target = REVIEW / 'screens' / (style['id'] + '-' + scene + '.png')
                item['export'] = render_screen(job, target)
                item['screen'] = target.relative_to(REVIEW).as_posix()
            pair.append(item)
            current.append(item)
        grades = [i.get('assessment', {}).get('grade', {}) for i in pair]
        graded = all(g.get('status') == 'graded' for g in grades)
        scores = [g['answers']['readability'] for g in grades] if graded else []
        directions.append({'style_id': style['id'], 'name': style['name'], 'pair': pair,
                           'complete': all(i.get('screen') for i in pair),
                           'eligible_diagnostic': graded and all(i['verdict'] != 'reject' for i in pair),
                           'weakest_readability': min(scores) if scores else None,
                           'mean_readability': sum(scores) / len(scores) if scores else None})
    ranked = sorted(directions, key=lambda d: (not d['eligible_diagnostic'], -(d['weakest_readability'] or 0), -(d['mean_readability'] or 0), d['style_id']))
    comparative_path = ART / 'reports/comparative-ranking.json'
    comparative = read(comparative_path) if comparative_path.exists() else None
    comparative_valid = (comparative and comparative.get('status') == 'graded'
                         and comparative.get('comparison_signature') == comparison_signature(current))
    if comparative_valid:
        order = comparative['answers']['ranking']
        ranked = sorted(directions, key=lambda d: (not d['eligible_diagnostic'], order.index(d['style_id'])))
    shortlist = [d['style_id'] for d in ranked if d['eligible_diagnostic']][:cfg['grader']['shortlist_count']]
    rank_report = {'label': 'local model diagnostic, not felt or owner preference',
                   'method': 'Eligible pairs first; weakest scene readability descending, then mean; ties by neutral style ID. Rejected and ungraded pairs retained below.',
                   'calibration': 'not human calibrated; agent spot-check found a false-clean absorb/camera judgment in the first proof',
                   'shortlist': shortlist,
                   'comparative_local_grade': comparative if comparative_valid else {'status': 'ungraded-or-stale'},
                   'ranking': [{k: v for k, v in d.items() if k != 'pair'} for d in ranked]}
    if comparative_valid:
        rank_report['method'] = 'Local vision model directly ordered the paired board by both-scene readability and pair coherence. Rejected/ungraded pairs remain ineligible for the shortlist. This is advisory, not owner preference.'
    write(ART / 'reports/ranking.json', rank_report)
    manifest = {'schema': 1, 'label': 'authored concepts; measured files; diagnostic model judgments; felt pending',
                'brief_version': cfg['brief_version'], 'budget': budget.summary(), 'current': current, 'attempts': archive,
                'ranking': rank_report, 'owner_choice': 'pending'}
    write(REVIEW / 'manifest.json', manifest)
    write(ART / 'reports/budget.json', budget.summary())
    for scene in ('arena', 'camp'):
        contact([i for i in current if i['scene'] == scene], REVIEW / 'contact-sheets' / (scene + '.png'), 'Mage Arena / ' + scene.title() + ' directions')
    contact(current, REVIEW / 'contact-sheets/combined.png', 'Mage Arena / paired style directions')
    body = '<div class="status">Owner choice pending. Each direction is shown as an Arena fight and Camp screen. Click any image to inspect it.</div><div class="toolbar"><button data-filter="all" aria-pressed="true">Paired view</button><button data-filter="arena" aria-pressed="false">Arena comparison</button><button data-filter="camp" aria-pressed="false">Camp comparison</button></div>'
    spent = budget.summary()
    body += f'<p class="meta">Images reserved: {spent["wave_reserved"]}. Target remaining: {spent["target_remaining"]}. Hard-cap remaining: {spent["hard_remaining"]}. Videos: {spent["videos"]}. Shared subscription remainder: not measured.</p>'
    if spent['stop']:
        body += '<p class="status reject">Generation stopped: ' + html.escape(spent['stop']['reason']) + '</p>'
    for direction in directions:
        style = get_style(direction['style_id'])
        pair = direction['pair']
        axes = ''.join('<span>' + html.escape(style[k]) + '</span>' for k in ('line', 'palette', 'shading', 'density', 'mood'))
        body += f'<section class="direction" id="{style["id"]}"><div class="eyebrow">DIRECTION {style["id"].split("-")[0]}</div><h2>{html.escape(style["name"])}</h2><div class="axes">{axes}</div><div class="pair">' + ''.join(tile(i) for i in pair) + '</div><details><summary>Read observations and limitations</summary><div class="evidence">' + ''.join(diagnostic(i) for i in pair) + '</div></details></section>'
    body += '<details id="ranking"><summary>Local diagnostic shortlist — optional input for the owner</summary><p>' + html.escape(rank_report['method']) + '</p><p>No model can select or accept a style. Direct review exposed false-clean judgments; these observations are not human calibrated. All directions remain available above for the owner.</p><ol class="rank">'
    for d in ranked:
        scores = 'not measured' if d['weakest_readability'] is None else f'weakest {d["weakest_readability"]}; mean {d["mean_readability"]:g}'
        reason = next((r for r in comparative['answers']['reasons'] if r['style_id'] == d['style_id']), None) if comparative_valid else None
        detail = ('<p>' + html.escape(reason['strength']) + ' <b>Concern:</b> ' + html.escape(reason['concern']) + '</p>') if reason else ''
        body += f'<li><a href="#{d["style_id"]}">{html.escape(d["name"])}</a> — {scores}; {"shortlist input" if d["style_id"] in shortlist else "other direction"}{detail}</li>'
    body += '</ol><p><a href="manifest.json">Complete evidence manifest</a></p></details>'
    nav = '<a href="contact-sheets/combined.png">Combined contact sheet</a><a href="contact-sheets/arena.png">Arena sheet</a><a href="contact-sheets/camp.png">Camp sheet</a><a href="attempts.html">All attempts</a><a href="../../art/OWNER-CHOICE.md">Choice record</a>'
    # Choice record path is one level up from review.
    nav = nav.replace('../../art/OWNER-CHOICE.md', '../OWNER-CHOICE.md')
    (REVIEW / 'index.html').write_text(page('Eight ways into the arena', body, 'One prison, one combat scene, one camp map. Eight hand-drawn directions to compare before a style is chosen.', nav), encoding='utf-8')
    attempts_body = '<div class="archive">'
    for i in archive:
        rejection = i['assessment'].get('rejection')
        attempts_body += f'<article><h3>{i["job"]}</h3><a class="zoom" href="{i["source"]}" data-title="{i["job"]}"><img src="{i["source"]}" alt="Raw attempt {i["job"]}" loading="lazy"></a><p class="badge {"reject" if i["verdict"] == "reject" else ""}">{i["verdict"]}</p><p class="meta">' + html.escape(rejection['note'] if rejection else ', '.join(i['assessment']['codes'])) + '</p></article>'
    attempts_body += '</div>'
    (REVIEW / 'attempts.html').write_text(page('The complete attempt trail', attempts_body, 'Unaltered generated plates, including rejected and superseded attempts. Labels and interface elements appear only in the main comparison screens.', '<a href="index.html">Back to paired board</a>'), encoding='utf-8')
    print(json.dumps({'build': 'complete', 'pairs': sum(d['complete'] for d in directions), 'attempts': len(archive), 'shortlist': shortlist, 'budget': spent}), flush=True)


def validate():
    manifest = read(REVIEW / 'manifest.json')
    errors = []
    cfg = config()
    directions = styles()
    rows = manifest['current']
    jobs = {j['id']: j for j in Budget().load()['jobs']}
    if len(rows) != len(directions) * len(read(ART / cfg['brief_file'])['scenes']):
        errors.append('PAIR_COUNT')
    locations, slots = camp_data()
    if set(cfg['camp']['positions']) != {p['id'] for p in locations} or cfg['camp']['default_slot'] not in slots:
        errors.append('CAMP_DATA_MISMATCH')
    if manifest['owner_choice'] != 'pending' or any(r.get('owner_accepted') for r in rows):
        errors.append('OWNER_DECISION_INFERRED')
    for style in directions:
        pair = [r for r in rows if r['style_id'] == style['id']]
        if sorted(r['scene'] for r in pair) != ['arena', 'camp']:
            errors.append('PAIR_CONTENT:' + style['id'])
        for item in pair:
            if not item.get('screen'):
                errors.append('MISSING_SCREEN:' + style['id'] + ':' + item['scene'])
                continue
            for key, expected in [('source', item['source_sha256']), ('screen', item['export']['export_sha256'])]:
                path = (REVIEW / item[key]).resolve()
                if not path.is_relative_to(REVIEW.resolve()) or not path.exists() or sha(path) != expected:
                    errors.append('ARTIFACT_HASH:' + item[key])
            if not input_matches_current(jobs[item['job']]):
                errors.append('STALE_CURRENT_BRIEF:' + item['job'])
            if item['assessment']['grade'].get('status') != 'graded':
                errors.append('CURRENT_GRADE_MISSING:' + item['job'])
            if not item.get('direct_review', {}).get('note'):
                errors.append('CURRENT_DIRECT_REVIEW_MISSING:' + item['job'])
            if pixel_gate(REVIEW / item['screen'])['verdict'] == 'reject':
                errors.append('EXPORT_GATE:' + item['job'])
    if manifest['budget'] != Budget().summary():
        errors.append('STALE_BUDGET')
    result = {'status': 'pass' if not errors else 'fail', 'errors': errors,
              'current_images': len(rows), 'direction_pairs': len(directions),
              'generated_attempts': len(manifest['attempts']),
              'graded_attempts': sum(a['assessment']['grade'].get('status') == 'graded' for a in manifest['attempts']),
              'current_rejects': sum(r['verdict'] == 'reject' for r in rows),
              'scope': 'delivery integrity; does not turn semantic rejects into acceptance', 'owner_accepted': False}
    write(ART / 'reports/validation.json', result)
    print(json.dumps(result, indent=2))
    if errors:
        raise SystemExit(1)
