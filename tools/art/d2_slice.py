"""D2 section 5 mastery slice candidates: targets, two bodies, one plate set.

Serial agy calls through providers.generate (reservation first, failed and
uncertain calls stay charged, first quota or rate error latches). A wave cap and
a per-family proof rule sit on top: the first image of each family is reviewed
directly before its siblings. Nothing here picks a winner; the owner does.

  python tools/art/d2_slice.py prepare
  python tools/art/d2_slice.py call <scene>
  python tools/art/d2_slice.py review <scene> <keep|reject> '<direct observation>' [rank]
  python tools/art/d2_slice.py build
  python tools/art/d2_slice.py check
  python tools/art/d2_slice.py plan [--json]   (read-only: next legal action per slot)
"""
import argparse
import html
import json
import shutil
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
from common import ART, ROOT, read, write, sha, now, relative
from covenant_battle import key_magenta
import spend

WAVE = 'D2S'
BASE = ART / 'waves/D2S'
OUT = ART / 'delivery/d2s'
TARGETS = ART / 'targets'
SESSION_CAP = 30
SLOT_ATTEMPTS = 2

STYLE = read(ART / 'style-covenant.json')['style_block']
WORLD = ('Tiro, a walled gladiatorial academy where young mages duel in a sunken stone arena; dark enamel and aged silver, '
         'restrained verdigris, pale layered cloth, worn metal, warm torchlight against cool magic; each element has its own '
         'shape language: fire as forked flames and embers, water as crescents and droplets, air as branching wind and '
         'lightning, earth as angular stone and dust')
NEGATIVE = ('No text, watermark, logo, signature, UI mockup clutter, lens dirt, noisy film grain, paper texture, canvas texture, '
            'stippling, oversaturated neon, full-body glow, chibi, cartoon mascot, photorealistic modern clothing, guns, '
            'sci-fi armour, blurry faces, extra limbs, deformed hands.')

# Verbatim D4 A prompts (docs/concepts/D4-visual-target-prompts.md).
T1A = ("Close three-quarter view, camera about 40 degrees above the ground, of two young mages dueling at arm's length in a sunken circular stone arena. Left: a water mage in pale layered robes raising a curved shield of water crescents that catches a burst of flame. Right: a fire mage in dark ember-trimmed coat lunging forward, a cone of forked flame leaving his open hand, embers streaming. A glowing floor sigil ring under the fire mage telegraphs the next strike in thin silver runes. Clear readable silhouettes, strong rim light, painted illustrative style with sculpted volumes and confident broken contours, hand-painted game art, rich but controlled colour, torchlit arena walls softly out of focus, sand and scorch marks on the floor, dramatic moment of impact, high detail, 16:9")
T2A = ("Wide gameplay view of a magical arena duel at dusk, camera at 45 degrees from a moderate distance, four combatants visible: a water mage in pale cloth, an air mage in grey-blue wrapped garments mid-dash leaving streaks of wind, a fire mage calling down a meteor whose large glowing circular shadow grows on the sand, and an armoured arena soldier with a shield. A crackling beam of lightning crosses the arena, casting light on the stone floor. Readable spell shapes: a filled warning circle, a straight beam, a curving projectile arc. Hand-painted 2.5D game art, painted characters with normal-mapped lighting, dynamic light from spells on bodies and floor, verdigris bronze statues around the arena rim, crowd silhouettes in torchlit balconies, atmospheric dust, deep shadows, cohesive palette of dark enamel, aged silver and warm torchlight, 16:9")

MOONCHALK = 'art/delivery/d2s/references/moonchalk-portrait.png'
MOONCHALK_ORIGIN = Path(r'C:/Users/kazda/kiro/mage-arena-archive/tv/art/review/sources/a6-moonchalk-tempest-moonchalk-tempest-portrait-a02.png')
ROSTER = read(ART / 'covenant-battle-roster.json')['entities']
T1_DESIGN = {
    'water': 'a young water mage in pale layered robes with cool blue accents, raising one open hand',
    'fire': 'a young fire mage in a dark ember-trimmed coat over pale layered cloth, one open hand forward',
}
ROSTER_NAME = {'water': 'cassia', 'fire': 'brennic'}
ELEMENT = {'water': 'small separated water crescents and droplets around the raised hand only',
           'fire': 'a few forked flame tongues and ember flecks at the open hand only'}
PLATE_PALETTE = {
    'verdigris': 'dusk, dark verdigris stone and green-bronze statues, warm torchlight against a cool teal-grey sky',
    'rust': 'late sun, rust and sand masonry, warm ochre floor, dark slate shadows, bronze braziers',
    'moonlit': 'night, moonlit blue-black stone, silver highlights, a few warm torches in the balconies',
}
LAYER = {
    'floor': ('FLOOR LAYER ONLY. A painted sunken circular arena floor of packed sand and worn stone slabs seen from a camera about 40 degrees above the ground, '
              'filling the whole frame edge to edge. Faint old scorch marks and scuffs, quiet broad surfaces for gameplay. No walls, no sky, no people, no statues, no glowing runes.'),
    'wall': ('BACK WALL LAYER ONLY, same camera about 40 degrees above the ground. The far curved arena wall with torchlit crowd balconies and dark crowd silhouettes and the sky above it fill the TOP 45% of the frame. '
             'Everything below the foot of the wall is flat uniform vivid MAGENTA #FF00FF, a clean straight-ish horizontal boundary along the base of the wall. No floor, no fighters.'),
    'rim': ('FOREGROUND RIM LAYER ONLY, same camera. Along the BOTTOM edge of the frame: the near arena parapet, two verdigris bronze statues at the lower left and lower right corners and a lit brazier, seen close and slightly out of focus. '
            'Everything else, the whole middle and upper frame, is flat uniform vivid MAGENTA #FF00FF. No floor, no fighters, no wall.'),
}


def body_prompt(school, variant):
    who = T1_DESIGN[school] if variant != 'roster' else ROSTER[ROSTER_NAME[school]]['design']
    lead = {
        'target': 'Reference-1.png is the TARGET painting: match its painting style, value range, rim light and the look of the matching mage in it. Reference-2.png is a Covenant painting bar for brushwork only, never copy its person or framing. ',
        'roster': 'Reference-1.png is the exact CHARACTER IDENTITY, costume and staff: keep that person. Reference-2.png is the TARGET painting: paint at its richer illustrative finish, rim light and closer camera. ',
        'covenant': 'Reference-1.png is PAINTING STYLE ONLY from the Covenant bible, never copy its person, framing or pose. Reference-2.png is the TARGET mood and camera only. ',
    }[variant]
    return (f'Use case: stylized-concept. ONE original painted game character, full body, on uniform vivid MAGENTA #FF00FF. {lead}'
            f'Character: {who}. School accent: {ELEMENT[school]}; no aura over the body. '
            'View: FRONT-RIGHT three-quarter, body turned toward image right and slightly toward viewer, face partly visible, camera about 40 degrees above the ground (closer than a top-down view), '
            'upright figure with shoulders, some face and foreshortened legs. Ready stance, both feet on the ground, whole body and staff inside the middle 80% of the frame, '
            'body about 75% of the frame height. One figure only. No floor, no shadow, no scenery, no text, no frame. '
            f'{STYLE} Strong readable silhouette and a clear rim light from the upper left. Smooth opaque paint so the body can be lit by a normal map. {NEGATIVE} Aspect 1:1.')


def normal_prompt():
    return ('Paint a TANGENT-SPACE NORMAL MAP of the exact character in Reference-1.png, pixel-aligned to it: same framing, same silhouette, same size, same pose. '
            'Standard OpenGL convention: flat surfaces facing the viewer are #8080FF lavender blue, surfaces facing right are redder, facing up are greener, facing left cyan, facing down purple. '
            'Encode the sculpted volumes of face, hood, cloth folds, staff and hands as smooth normal shading. No lighting, no colour of the costume, no shadows, no outline, no text. '
            'Background outside the silhouette is flat uniform vivid MAGENTA #FF00FF. Aspect 1:1.')


def ref(path, role):
    p = ROOT / path
    return {'path': relative(p), 'sha256': sha(p), 'role': role}


def scenes():
    """Every planned slot. Order is the call order; proof slot of a family first."""
    out = {}
    for t, prompt in (('t1a', T1A), ('t2a', T2A)):
        out[f'target-{t}'] = {'family': 'target', 'aspect_ratio': '16:9', 'references': [],
                              'prompt': prompt + '. ' + WORLD + '. ' + NEGATIVE}
    for school in ('water', 'fire'):
        for variant in ('target', 'roster', 'covenant'):
            if variant == 'target':
                refs = [('art/targets/T1-A-standin.png', 'target painting'), (MOONCHALK, 'Covenant brushwork bar')]
            elif variant == 'roster':
                refs = [(f'art/delivery/d2s/references/{ROSTER_NAME[school]}-se.png', 'roster identity'), ('art/targets/T1-A-standin.png', 'target finish')]
            else:
                refs = [(MOONCHALK, 'Covenant painting style'), ('art/targets/T1-A-standin.png', 'target mood and camera')]
            out[f'body-{school}-{variant}'] = {'family': 'body', 'aspect_ratio': '1:1', 'school': school, 'variant': variant,
                                               'references': refs, 'prompt': body_prompt(school, variant)}
    for palette in PLATE_PALETTE:
        for layer in ('floor', 'wall', 'rim'):
            refs = [('art/targets/T2-A-standin.png', 'target camera and finish')]
            if layer != 'floor':
                refs.insert(0, (f'{{floor:{palette}}}', 'same arena floor, palette continuity'))
            out[f'plate-{palette}-{layer}'] = {'family': 'plate', 'aspect_ratio': '16:9', 'palette': palette, 'layer': layer,
                'references': refs,
                'prompt': (f'Use case: stylized-concept. One layer of a layered 2.5D painted arena plate set for a mage dueling game. {LAYER[layer]} '
                           f'Mood and palette: {PLATE_PALETTE[palette]}. Reference images are for camera, finish and palette only; never copy figures or effects. '
                           f'{WORLD}. {STYLE} {NEGATIVE} Aspect 16:9.')}
    return out


def source(job):
    """Committed exact-byte copy; art/review/sources is ignored in this repo."""
    return 'art/delivery/d2s/sources/' + job['id'] + Path(job['archive']).suffix


def publish(job):
    if job['status'] != 'generated': return
    target = ROOT / source(job); target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists(): shutil.copy2(ROOT / job['archive'], target)
    assert sha(target) == job['sha256']


def generated(scene):
    """Ledger rows of a scene; a recovered row reads as generated (the ledger row itself is never edited)."""
    jobs = [j for j in read(ART / 'usage.json')['jobs'] if j.get('wave') == WAVE and j['scene'] == scene]
    out = []
    for j in jobs:
        rec = BASE / 'recovered' / (j['id'] + '.json')
        out.append({**j, 'status': 'generated', 'sha256': read(rec)['sha256'], 'archive': read(rec)['archive']} if rec.exists() else j)
    return out


def clear_latch(job_id, diagnosis):
    """A failed call with no image whose cause is a local reference-path defect, not quota or rate.
    The charge and ledger row stay; only the agy latch this job set is archived and cleared."""
    job = next(j for j in read(ART / 'usage.json')['jobs'] if j['id'] == job_id)
    log = (ROOT / job['invocation_evidence'] / 'cli-output.txt').read_text(encoding='utf-8', errors='replace')
    assert job['status'] == 'error-unknown-spend' and job['unique_output_images'] == 0
    assert 'failed to read image file' in log and 'cannot find the file' in log, 'NOT_A_LOCAL_REFERENCE_FAILURE'
    # Quota/rate refusal, the latch archive and the clear itself run under providers/.lock in spend.
    spend.clear_latch(ART, 'agy', job_id, diagnosis, session=WAVE,
        reason='D2S: local reference-path failure diagnosed; old latch in art/waves/D2S/latches; quota and rate errors still latch')
    print('latch cleared', job_id)


def recover(job_id):
    """A local archive failure after exactly one completed image call (WinError 3: art/review/sources
    is absent in a fresh checkout). Keeps the charge and the ledger row; records the verified image and
    clears only the agy latch that this local failure set, with the old latch archived."""
    job = next(j for j in read(ART / 'usage.json')['jobs'] if j['id'] == job_id)
    assert job['status'] == 'error-unknown-spend' and job['error'].startswith('[WinError 3]'), 'NOT_A_LOCAL_ARCHIVE_FAILURE'
    assert len(job['tool_calls']) == 1 and job['unique_output_images'] == 1 and job['charged_images'] >= 1
    raw = ART / 'raw' / job_id / '_driver' / 'source.jpg'
    assert sha(raw) == job['output_files'][0]['sha256'], 'OUTPUT_HASH'
    archive = ART / 'review/sources' / (job_id + '.jpg'); archive.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(raw, archive)
    record = {'job': job_id, 'at': now(), 'sha256': sha(raw), 'archive': relative(archive), 'charged_images': job['charged_images'],
              'diagnosis': 'One visible generate_image call and one distinct output; the driver then failed to copy it into art/review/sources, '
                           'which a fresh worktree lacks (ignored folder). Not a quota, rate or moderation result. Charge kept; ledger row unchanged.',
              'fix': 'd2_slice.call creates art/review/sources before every call.'}
    write(BASE / 'recovered' / (job_id + '.json'), record)
    stop = read(ART / 'providers/history.json')['providers']['agy']['stop']
    if stop and stop['job'] == job_id:
        spend.clear_latch(ART, 'agy', job_id, record['diagnosis'], session=WAVE,
            reason='D2S: local archive path failure diagnosed; old latch in art/waves/D2S/latches; quota and rate errors still latch')
    publish({**job, 'status': 'generated', 'archive': record['archive'], 'sha256': record['sha256']})
    print('recovered', job_id)


def kept(scene):
    for j in reversed(generated(scene)):
        rp = BASE / 'reviews' / (j['id'] + '.json')
        if j['status'] == 'generated' and rp.exists() and read(rp)['verdict'] == 'keep' and read(rp)['sha256'] == j['sha256']:
            return j
    return None


def prepare():
    if (BASE / 'start.json').exists():
        print('D2S baseline already retained'); return
    charged = spend.open_session(ART, WAVE, SESSION_CAP, SLOT_ATTEMPTS,
        authorization='Operator day standup 2026-10-24: image generation authorized up to the remaining 450 hard cap, providers per PROVIDER-LEDGER (agy). '
                      'The brief said 86 left; the ledger holds 382 charged, so 68 remain. This wave reserves at most 30.')['charged']
    policy = read(ART / 'budget.json')
    policy['target_images'] = policy['wave_hard_cap']
    policy.setdefault('wave_image_caps', {})[WAVE] = SESSION_CAP
    policy['d2s_authorization'] = ('Operator 2026-10-24: D2 section 5 mastery slice candidates; target raised 398 to the 450 hard cap; '
                                   f'{charged} inherited; D2S wave cap {SESSION_CAP}; agy only, serial; first quota or rate error latches; no refunds.')
    write(ART / 'budget.json', policy)
    bar = ROOT / MOONCHALK; bar.parent.mkdir(parents=True, exist_ok=True)
    expected = read(ART / 'style-covenant.json')['references']['moonchalk-tempest-portrait']['sha256']
    assert sha(MOONCHALK_ORIGIN) == expected, 'MOONCHALK_HASH'
    shutil.copy2(MOONCHALK_ORIGIN, bar)
    references()
    print(json.dumps({'inherited': charged, 'cap': SESSION_CAP}))


def references():
    for name in ('cassia', 'brennic'):
        meta = read(ART / f'waves/A14/references/{name}-se.json')
        assert sha(ROOT / meta['source']) == meta['sha256']
        x, y, w, h = meta['rect']
        crop = Image.open(ROOT / meta['source']).convert('RGBA').crop((x, y, x + w, y + h))
        crop = crop.crop(crop.getchannel('A').getbbox())
        side = round(max(crop.size) / 0.8)
        flat = Image.new('RGBA', (side, side), (255, 0, 255, 255))
        flat.alpha_composite(crop, ((side - crop.width) // 2, (side - crop.height) // 2))
        path = OUT / 'references' / f'{name}-se.png'; path.parent.mkdir(parents=True, exist_ok=True)
        flat.convert('RGB').resize((768, 768), Image.Resampling.LANCZOS).save(path)
        write(path.with_suffix('.json'), {'source': meta['source'], 'sha256': meta['sha256'], 'rect': meta['rect'],
              'origin': 'A10 master se cutout, trimmed to alpha, body 80% of a magenta square, Lanczos to 768'})


def spec_for(scene):
    item = scenes()[scene]
    refs = []
    for path, role in item['references']:
        if '{floor:' in path:
            palette = path.split('{floor:')[1].rstrip('}')
            floor = kept(f'plate-{palette}-floor')
            if not floor: raise RuntimeError('FLOOR_LAYER_REQUIRED_FIRST')
            png = OUT / 'references' / (floor['id'] + '.png')
            if not png.exists():
                with Image.open(ROOT / source(floor)) as im: im.convert('RGB').save(png)
            path = relative(png)
        refs.append(ref(path, role))
    spec = {'wave': WAVE, 'id': scene, 'pilot': True, 'providers': ['agy'], 'aspect_ratio': item['aspect_ratio'],
            'references': refs, 'prompt': item['prompt'], 'family': item['family'],
            'proofGate': 'D2S family proof: first image of each family directly reviewed before siblings (local grader has no model loaded)'}
    for k in ('school', 'variant', 'palette', 'layer'):
        if k in item: spec[k] = item[k]
    return spec


def preflight(scene):
    """Activate the D2S session so Budget.reserve enforces its caps for every caller, and fail before
    any brief is written when spend.headroom already blocks. The reservation re-checks under the lock."""
    spend.activate(ART, WAVE)
    blocked = spend.headroom(ART, wave=WAVE, provider='agy', scene=scene)
    if blocked: raise RuntimeError(blocked[0])


def call(scene, correction=None):
    from providers import generate
    preflight(scene)
    (ART / 'review/sources').mkdir(parents=True, exist_ok=True)
    previous = generated(scene)
    item = scenes()[scene]
    family = [s for s, v in scenes().items() if v['family'] == item['family']]
    if scene != family[0] and item['family'] != 'target' and not kept(family[0]):
        raise RuntimeError('FAMILY_PROOF_REQUIRED: review ' + family[0] + ' first')
    spec = spec_for(scene)
    if previous:
        rp = BASE / 'reviews' / (previous[-1]['id'] + '.json')
        if not correction or not rp.exists() or read(rp)['verdict'] != 'reject': raise RuntimeError('REJECTION_AND_CORRECTION_REQUIRED')
        spec['prompt'] += ' CORRECTION: ' + correction
        spec['correction_of'] = previous[-1]['id']
        # providers.generate looks for the hash-bound rejection under the wave folder.
        write(ART / 'waves' / WAVE / 'reviews' / (previous[-1]['id'] + '.json'), read(rp))
    write(BASE / 'briefs' / (scene + (f'-a{len(previous)+1:02}' if previous else '') + '.json'), spec)
    job = generate(spec); publish(job)
    print(json.dumps({'scene': scene, 'id': job['id'], 'status': job['status'], 'charged': job['charged_images']}))
    return job


def normal_scene(body_scene):
    return 'normal-' + body_scene.split('body-', 1)[1]


def call_normal(body_scene, correction=None):
    """Provider-painted normal map from a kept body candidate (one call)."""
    from providers import generate
    body = kept(body_scene)
    if not body: raise RuntimeError('KEPT_BODY_REQUIRED')
    scene = normal_scene(body_scene)
    preflight(scene)
    (ART / 'review/sources').mkdir(parents=True, exist_ok=True)
    previous = generated(scene)
    pilot = 'normal-water-target'
    if scene != pilot and not kept(pilot): raise RuntimeError('FAMILY_PROOF_REQUIRED: review ' + pilot + ' first')
    # agy names references Reference-N.<ext> and the prompt says .png: keep every reference a PNG.
    png = OUT / 'references' / (body['id'] + '.png')
    if not png.exists():
        with Image.open(ROOT / source(body)) as im: im.convert('RGB').save(png)
    spec = {'wave': WAVE, 'id': scene, 'pilot': True, 'providers': ['agy'], 'aspect_ratio': '1:1',
            'references': [ref(png, 'colour body to encode (lossless PNG of the kept source)')], 'prompt': normal_prompt(), 'family': 'normal',
            'body': body['id'], 'proofGate': 'D2S family proof'}
    if previous:
        if correction: spec['prompt'] += ' CORRECTION: ' + correction
        spec['correction_of'] = previous[-1]['id']
        if (BASE / 'reviews' / (previous[-1]['id'] + '.json')).exists():
            write(ART / 'waves' / WAVE / 'reviews' / (previous[-1]['id'] + '.json'), read(BASE / 'reviews' / (previous[-1]['id'] + '.json')))
    write(BASE / 'briefs' / (scene + '.json'), spec)
    job = generate(spec); publish(job)
    print(json.dumps({'scene': scene, 'id': job['id'], 'status': job['status'], 'charged': job['charged_images']}))
    return job


def review(scene, verdict, note, rank=None):
    assert verdict in ('keep', 'reject')
    j = [x for x in generated(scene) if x['status'] == 'generated'][-1]
    write(BASE / 'reviews' / (j['id'] + '.json'), {'job': j['id'], 'scene': scene, 'sha256': j['sha256'], 'verdict': verdict,
        'note': note, 'rank': rank, 'at': now(), 'method': 'direct pixel inspection by the builder, side by side with the target', 'owner_accepted': False})
    if scene.startswith('target-') and verdict == 'keep':
        name = {'target-t1a': 'T1-A-standin', 'target-t2a': 'T2-A-standin'}[scene]
        TARGETS.mkdir(parents=True, exist_ok=True)
        with Image.open(ROOT / source(j)) as im: im.convert('RGB').save(TARGETS / (name + '.png'))
    print(verdict, j['id'])


def plan_blocker(scene, body, previous, rejected, usage, provider_state):
    """(code, provider): what call()/call_normal() would raise first, or (None, provider) for a legal call."""
    import plan
    from providers import decide, wave_reviews
    if body and not kept(body): return 'KEPT_BODY_REQUIRED', None
    try:
        with plan.would_activate(ART, WAVE):
            codes = spend.headroom(ART, wave=WAVE, provider='agy', scene=scene, usage=usage)
            if codes: return codes[0], None
            if body:
                if scene != 'normal-water-target' and not kept('normal-water-target'):
                    return 'FAMILY_PROOF_REQUIRED: review normal-water-target first', None
            else:
                item = scenes()[scene]
                family = [s for s, v in scenes().items() if v['family'] == item['family']]
                if scene != family[0] and item['family'] != 'target' and not kept(family[0]):
                    return 'FAMILY_PROOF_REQUIRED: review ' + family[0] + ' first', None
                for path, _ in item['references']:
                    if '{floor:' in path:
                        if not kept('plate-' + path.split('{floor:')[1].rstrip('}') + '-floor'): return 'FLOOR_LAYER_REQUIRED_FIRST', None
                    elif not (ROOT / path).is_file(): return 'REFERENCE_MISSING: ' + path, None
                if previous and not rejected: return 'REJECTION_AND_CORRECTION_REQUIRED', None
            # The spec's prompt only matters for resume/rewrite matching, which a D2S call never reaches.
            spec = {'wave': WAVE, 'id': scene, 'pilot': True, 'providers': ['agy'], 'prompt': '<plan>'}
            if previous: spec['correction_of'] = previous[-1]['id']
            old = [j for j in usage['jobs'] if j.get('wave') == WAVE and j['scene'] == scene]
            d = decide(spec, old, wave_reviews(ART, WAVE), provider_state)
            if d['state'] != 'ready': return d['code'], None
            return plan.reserve_code(ART, WAVE, scene, d['provider'], len(old) + 1, usage), d['provider']
    except RuntimeError as exc:
        return str(exc), None


def plan_rows(cli=None):
    """Read-only twin of call()/call_normal() for `plan D2S`: per slot the next legal action, in their
    check order. Takes no lock, writes nothing and never activates the session."""
    import plan
    from providers import provider_cli
    usage = spend.load_usage(ART); state = plan.provider_state(ART, usage, cli or provider_cli)
    cmd = 'python tools/art/d2_slice.py '; items = scenes(); rows = []
    for scene, body in [(s, None) for s in items] + [(normal_scene(s), s) for s, v in items.items() if v['family'] == 'body']:
        previous = generated(scene); last = previous[-1] if previous else None
        rp = BASE / 'reviews' / (last['id'] + '.json') if last else None
        bound = bool(last) and last['status'] == 'generated' and rp.exists() and read(rp)['sha256'] == last['sha256']
        done = kept(scene)
        if done:
            rows.append(plan.row(scene, state='kept', job=done['id'], action='kept by direct review; no call')); continue
        if last and last['status'] == 'generated' and not bound:
            rows.append(plan.row(scene, state='needs-review', code='REJECTION_AND_CORRECTION_REQUIRED', job=last['id'],
                                 next_command=cmd + f"review {scene} <keep|reject> '<direct observation>'",
                                 action='review ' + last['id'] + ' side by side with the target')); continue
        rejected = bound and read(rp)['verdict'] == 'reject'
        code, provider = plan_blocker(scene, body, previous, rejected, usage, state)
        call = cmd + ('normal ' + body if body else 'call ' + scene) + (" '<correction>'" if previous else '')
        if code:
            rows.append(plan.row(scene, state='blocked', code=code, provider=provider, job=last['id'] if last else None))
        else:
            rows.append(plan.row(scene, state='needs-correction' if previous else 'ready', provider=provider, new_calls=1,
                                 job=last['id'] if last else None, next_command=call, action='one ' + provider + ' call'))
    return rows


# ---------- offline build: keys, normal maps, lit proofs, plates, pick sheet ----------

STRENGTH, BLUR, AMBIENT, LIGHT_COLOR = 2.5, 2, 0.35, (1.0, 0.62, 0.3)


def box_blur(a, r):
    pad = np.pad(a, r, mode='edge'); k = 2 * r + 1
    c = np.cumsum(np.pad(pad, ((1, 0), (0, 0))), axis=0); rows = (c[k:] - c[:-k]) / k
    c = np.cumsum(np.pad(rows, ((0, 0), (1, 0))), axis=1); return (c[:, k:] - c[:, :-k]) / k


def derive_normal(rgba):
    """Same method as packages/tools/art/derive-normal-map.py (luminance height, blur, Sobel)."""
    rgb = rgba[..., :3] / 255.0; alpha = rgba[..., 3] / 255.0
    h = box_blur((0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]) * alpha, BLUR)
    p = np.pad(h, 1, mode='edge')
    gx = (p[:-2, 2:] + 2 * p[1:-1, 2:] + p[2:, 2:]) - (p[:-2, :-2] + 2 * p[1:-1, :-2] + p[2:, :-2])
    gy = (p[2:, :-2] + 2 * p[2:, 1:-1] + p[2:, 2:]) - (p[:-2, :-2] + 2 * p[:-2, 1:-1] + p[:-2, 2:])
    n = np.stack([-gx * STRENGTH, -gy * STRENGTH, np.ones_like(gx)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True); n[alpha <= 0] = (0, 0, 1)
    return n


def decode_normal(rgb, alpha):
    n = rgb[..., :3] / 127.5 - 1.0
    n /= np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-6); n[alpha <= 0] = (0, 0, 1)
    return n


def lit(rgba, normal, lx, ly, lz, radius):
    h, w = rgba.shape[:2]; ys, xs = np.mgrid[0:h, 0:w]
    d = np.stack([lx - xs, ly - ys, np.full((h, w), lz)], axis=-1); dist = np.linalg.norm(d, axis=-1)
    lam = np.clip(np.sum(normal * d / dist[..., None], axis=-1), 0, 1)
    fall = np.clip(1 - dist / radius, 0, 1) ** 2
    out = rgba[..., :3] / 255.0 * (AMBIENT + lam * fall)[..., None] + np.array(LIGHT_COLOR) * (lam * fall)[..., None] * 0.35
    return np.dstack([np.clip(out, 0, 1) * 255, rgba[..., 3]]).astype(np.uint8)


def alignment(body_path, normal_path):
    """Best integer shift between the body's alpha edges and the painted normal map's edges
    (FFT cross-correlation), and the share of silhouette edge that lands on a normal edge."""
    with Image.open(body_path) as b, Image.open(normal_path) as n:
        alpha = key_magenta(b).getchannel('A').filter(ImageFilter.GaussianBlur(2))
        normal = n.convert('RGB').resize(b.size, Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(2))
    def edges(a):
        gy, gx = np.gradient(a.astype(np.float64)); return np.hypot(gx, gy)
    ea = edges(np.asarray(alpha)); en = sum(edges(np.asarray(normal)[..., c]) for c in range(3))
    ea /= ea.std() + 1e-9; en /= en.std() + 1e-9
    c = np.real(np.fft.ifft2(np.fft.fft2(ea) * np.conj(np.fft.fft2(en))))
    dy, dx = np.unravel_index(np.argmax(c), c.shape)
    dy = int(dy - c.shape[0]) if dy > c.shape[0] // 2 else int(dy); dx = int(dx - c.shape[1]) if dx > c.shape[1] // 2 else int(dx)
    return {'shiftPx': [dx, dy], 'edgeAgreement': round(float((en[ea > 2] > 1).mean()), 3)}


def cutout(job):
    with Image.open(ROOT / source(job)) as im: keyed = key_magenta(im)
    box = keyed.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    if not box: raise ValueError('EMPTY_KEY')
    pad = 8; box = (max(0, box[0] - pad), max(0, box[1] - pad), min(keyed.width, box[2] + pad), min(keyed.height, box[3] + pad))
    return keyed.crop(box), box


def checker(size, a=(58, 58, 64), b=(74, 74, 82), cell=16):
    im = Image.new('RGB', size, a); d = ImageDraw.Draw(im)
    for y in range(0, size[1], cell):
        for x in range((y // cell % 2) * cell, size[0], cell * 2): d.rectangle((x, y, x + cell - 1, y + cell - 1), fill=b)
    return im


def build():
    from covenant import font
    OUT.mkdir(parents=True, exist_ok=True); records = {'bodies': [], 'plates': [], 'targets': []}
    start = read(BASE / 'start.json'); usage = read(ART / 'usage.json'); recent = usage['jobs'][start['jobs']:]
    for name in ('T1-A-standin', 'T2-A-standin'):
        p = TARGETS / (name + '.png')
        if p.exists(): records['targets'].append({'name': name, 'path': relative(p), 'sha256': sha(p)})
    # Bodies: cutout, height at the new scale, derived normal, painted normal where one exists.
    for school in ('water', 'fire'):
        for variant in ('target', 'roster', 'covenant'):
            scene = f'body-{school}-{variant}'; jobs = generated(scene); body = kept(scene)
            rec = {'slot': f'{school} mage', 'scene': scene, 'variant': variant,
                   'calls': sum(j['charged_images'] for j in jobs), 'attempts': [j['id'] for j in jobs]}
            if not body:
                rec['status'] = 'no kept candidate'; records['bodies'].append(rec); continue
            rv = read(BASE / 'reviews' / (body['id'] + '.json'))
            cut, box = cutout(body); folder = OUT / 'bodies' / scene; folder.mkdir(parents=True, exist_ok=True)
            cut.save(folder / 'color.png')
            rgba = np.asarray(cut).astype(np.float64)
            dn = derive_normal(rgba)
            Image.fromarray(np.dstack([np.round((dn * 0.5 + 0.5) * 255), rgba[..., 3]]).astype(np.uint8), 'RGBA').save(folder / 'normal-derived.png')
            normals = {'derived': dn}; steps = ['magenta key (key_magenta 80/150)', 'alpha bbox crop + 8 px pad', 'derived normal (luminance/blur/Sobel)']
            ns = normal_scene(scene); njob = kept(ns); njobs = generated(ns)
            rec['normalCalls'] = sum(j['charged_images'] for j in njobs)
            if njob:
                with Image.open(ROOT / source(njob)) as im:
                    src = im.convert('RGB').resize(Image.open(ROOT / source(body)).size, Image.Resampling.LANCZOS)
                painted = np.asarray(src.crop(box)).astype(np.float64)
                pn = decode_normal(painted, rgba[..., 3])
                Image.fromarray(np.dstack([np.round((pn * 0.5 + 0.5) * 255), rgba[..., 3]]).astype(np.uint8), 'RGBA').save(folder / 'normal-painted.png')
                normals['painted'] = pn; steps += ['painted normal: resize to body source, crop to body box, renormalize, body alpha']
                rec['normalReview'] = read(BASE / 'reviews' / (njob['id'] + '.json'))['note']
                rec['normalAlignment'] = alignment(ROOT / source(body), ROOT / source(njob))
            # Lit proof: unlit, then a warm point light swept left to right, per normal source.
            h, w = cut.height, cut.width; rows = []
            for kind, n in normals.items():
                tiles = [np.asarray(cut)] + [lit(rgba, n, w * f, h * 0.3, 0.12 * h, 0.8 * h) for f in (0.05, 0.5, 0.95)]
                rows.append(np.hstack(tiles))
            proof = Image.fromarray(np.vstack(rows), 'RGBA'); bg = checker(proof.size); bg.paste(proof, mask=proof.getchannel('A'))
            bg.save(folder / 'lit-proof.jpg', quality=90)
            # New scale: 140-200 px at 1080p (D2 4.1); preview at 170 px and at the old 60.75 px.
            for px in (170, 61):
                cut.resize((max(1, round(w * px / h)), px), Image.Resampling.LANCZOS).save(folder / f'at-{px}px.png')
            rec.update(status='candidate', job=body['id'], source=source(body), sha256=body['sha256'], rank=rv.get('rank'), review=rv['note'],
                       size=[w, h], normals=sorted(normals), cleanupSteps=steps, files=sorted(relative(p) for p in folder.iterdir()))
            records['bodies'].append(rec)
    # Plates: layered set and its composite.
    for palette in PLATE_PALETTE:
        layers = {l: kept(f'plate-{palette}-{l}') for l in ('floor', 'wall', 'rim')}
        calls = sum(j['charged_images'] for l in layers for j in generated(f'plate-{palette}-{l}'))
        rec = {'slot': 'arena plate set', 'palette': palette, 'calls': calls, 'layers': {l: (j['id'] if j else None) for l, j in layers.items()}}
        if not layers['floor']:
            rec['status'] = 'no kept floor'; records['plates'].append(rec); continue
        folder = OUT / 'plates' / palette; folder.mkdir(parents=True, exist_ok=True)
        size = (1920, 1080)
        with Image.open(ROOT / source(layers['floor'])) as im: floor = im.convert('RGBA').resize(size, Image.Resampling.LANCZOS)
        floor.convert('RGB').save(folder / 'floor.jpg', quality=90); comp = floor.copy(); parallax = []
        for name, shift in (('wall', -24), ('rim', 36)):
            if not layers[name]: continue
            with Image.open(ROOT / source(layers[name])) as im: keyed = key_magenta(im).resize(size, Image.Resampling.LANCZOS)
            keyed.save(folder / f'{name}.png'); comp.alpha_composite(keyed); parallax.append(name)
        comp.convert('RGB').save(folder / 'composite.jpg', quality=90)
        # A parallax proof: the same set with the camera panned right; layers move by depth.
        pan = floor.copy().crop((16, 0, size[0], size[1])).resize(size)
        for name, shift in (('wall', 8), ('rim', 48)):
            if (folder / f'{name}.png').exists():
                layer = Image.open(folder / f'{name}.png'); pan.alpha_composite(layer.crop((shift, 0, size[0], size[1])).resize(size))
        pan.convert('RGB').save(folder / 'composite-panned.jpg', quality=90)
        rec.update(status='candidate', rank=max([read(BASE / 'reviews' / (j['id'] + '.json')).get('rank') or 0 for j in layers.values() if j]) or None,
                   review={l: read(BASE / 'reviews' / (j['id'] + '.json'))['note'] for l, j in layers.items() if j},
                   cleanupSteps=['floor resized to 1920x1080', 'wall/rim magenta key (key_magenta 80/150)', 'stacked floor < wall < rim'],
                   files=sorted(relative(p) for p in folder.iterdir()))
        records['plates'].append(rec)
    charges = sum(j['charged_images'] for j in recent); hard = read(ART / 'budget.json')['wave_hard_cap']
    records['spend'] = {'inherited': start['charged'], 'wave': charges, 'total': start['charged'] + charges, 'hardCap': hard,
                        'remaining': hard - start['charged'] - charges, 'calls': [{'id': j['id'], 'scene': j['scene'], 'status': j['status'], 'charged': j['charged_images'],
                        'seconds': j.get('elapsed_seconds'), 'evidence': j.get('invocation_evidence')} for j in recent]}
    records['ownerPick'] = 'pending'
    write(OUT / 'candidates.json', records)
    sheet(records)
    print(json.dumps(records['spend'] | {'jobs': len(records['spend']['calls'])}))


def sheet(records):
    """Owner pick sheet: each slot's candidates next to its target."""
    t = {r['name']: r['path'] for r in records['targets']}
    def img(path, w=None):
        rel = '../../../' + path
        return f'<img src="{html.escape(rel)}"' + (f' style="max-width:{w}px"' if w else '') + '>'
    rows = []
    for slot, target in (('water mage', 'T1-A-standin'), ('fire mage', 'T1-A-standin')):
        cands = sorted([b for b in records['bodies'] if b['slot'] == slot and b.get('status') == 'candidate'], key=lambda b: b.get('rank') or 9)
        cells = ''.join(f'<div class="c"><h3>#{b.get("rank")} {b["variant"]}</h3>{img(b["files"][[f.endswith("color.png") for f in b["files"]].index(True)], 260)}'
                        f'{img([f for f in b["files"] if f.endswith("lit-proof.jpg")][0], 520)}<p>{html.escape(b["review"])}</p>'
                        f'<p class="m">{b["calls"]} body call(s), {b.get("normalCalls", 0)} normal-map call(s); cleanup: {html.escape("; ".join(b["cleanupSteps"]))}</p>'
                        f'<p>at 170 px {img([f for f in b["files"] if f.endswith("at-170px.png")][0])} at today\'s 61 px {img([f for f in b["files"] if f.endswith("at-61px.png")][0])}</p></div>' for b in cands)
        rows.append(f'<section><h2>{slot}</h2><div class="row"><div class="c t"><h3>target</h3>{img(t[target], 520) if target in t else "missing"}</div>{cells}</div></section>')
    cands = sorted([p for p in records['plates'] if p.get('status') == 'candidate'], key=lambda p: p.get('rank') or 9)
    cells = ''.join(f'<div class="c"><h3>#{p.get("rank")} {p["palette"]}</h3>{img([f for f in p["files"] if f.endswith("/composite.jpg")][0], 520)}'
                    f'<p>layers: {" ".join(img(f, 160) for f in p["files"] if f.split("/")[-1] in ("floor.jpg", "wall.png", "rim.png"))}</p>'
                    f'<p>{html.escape(" | ".join(f"{k}: {v}" for k, v in p["review"].items()))}</p><p class="m">{p["calls"]} call(s)</p></div>' for p in cands)
    rows.append(f'<section><h2>arena plate set</h2><div class="row"><div class="c t"><h3>target</h3>{img(t["T2-A-standin"], 520) if "T2-A-standin" in t else "missing"}</div>{cells}</div></section>')
    s = records['spend']
    page = ('<!doctype html><meta charset="utf-8"><title>D2 slice: owner pick sheet</title><style>body{background:#16181c;color:#ddd;font:14px system-ui;margin:24px}'
            '.row{display:flex;gap:16px;overflow-x:auto}.c{background:#22252b;padding:10px;border-radius:6px;min-width:280px}.t{outline:2px solid #c9a86a}'
            'img{display:block;margin:4px 0;max-width:100%}p img{display:inline;vertical-align:bottom}.m{color:#9aa}</style>'
            '<h1>D2 section 5 mastery slice: owner pick sheet</h1>'
            '<p class="m">Body lit proofs: column 1 unlit, columns 2-4 a warm point light at left, centre, right. Row 1 uses the derived normal map (0 calls), row 2 the provider-painted one (1 call).</p>'
            '<p>Pick one candidate per slot. Ranks are the builder\'s side-by-side reading against the target; the owner decides. '
            'The targets are agy stand-ins regenerated from the verbatim D4 A prompts, because the owner\'s Leonardo picks are not on disk; replace them in art/targets/ if you have them.</p>'
            f'<p class="m">Spend: {s["wave"]} calls this wave, project {s["total"]}/{s["hardCap"]}, {s["remaining"]} left.</p>' + ''.join(rows))
    (OUT / 'pick-sheet.html').write_text(page, encoding='utf-8')


def check():
    start = read(BASE / 'start.json'); usage = read(ART / 'usage.json')
    codes = spend.verify_session(ART, start)  # inherited digest, session cap, hard cap, unresolved rows
    assert not codes, codes
    recent = usage['jobs'][start['jobs']:]
    assert all(j['wave'] == WAVE and j.get('provider') == 'agy' for j in recent), 'FOREIGN_JOB'
    for j in recent:
        if j['status'] == 'generated': assert sha(ROOT / source(j)) == j['sha256'], 'SOURCE_CHANGED:' + j['id']
    data = read(OUT / 'candidates.json')
    assert data['ownerPick'] == 'pending'
    for rec in data['bodies'] + data['plates']:
        for f in rec.get('files', []): assert (ROOT / f).exists(), f
    print('D2S check ok', len(recent), 'jobs')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('cmd'); ap.add_argument('args', nargs='*'); ap.add_argument('--json', action='store_true'); a = ap.parse_args()
    if a.cmd == 'prepare': prepare()
    elif a.cmd == 'call': call(a.args[0], a.args[1] if len(a.args) > 1 else None)
    elif a.cmd == 'normal': call_normal(a.args[0], a.args[1] if len(a.args) > 1 else None)
    elif a.cmd == 'review': review(a.args[0], a.args[1], a.args[2], int(a.args[3]) if len(a.args) > 3 else None)
    elif a.cmd == 'recover': recover(a.args[0])
    elif a.cmd == 'clear-latch': clear_latch(a.args[0], a.args[1])
    elif a.cmd == 'build': build()
    elif a.cmd == 'check': check()
    elif a.cmd == 'plan':
        from plan import main as plan_main
        plan_main([WAVE] + (['--json'] if a.json else []))
    else: raise SystemExit('unknown command')
