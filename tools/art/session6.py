"""Session 6 portable helpers. Generation remains behind the existing guards."""
import argparse
import json
from pathlib import Path
from common import ART, ROOT, read, write, sha, relative, now, digest
from covenant import jobs, inspect, review
from providers import generate


def ref(path, role):
    return {'path': path, 'sha256': sha(ROOT/path), 'role': role}


def brief(wave, ident, prompt, references, pilot=False, providers=None, **extra):
    spec={'wave':wave, 'id':ident, 'pilot':pilot, 'style_hash':sha(ART/'style-covenant.json'),
          'providers':providers or ['agy','grok'], 'aspect_ratio':'3:2',
          'references':references, 'prompt':prompt, **extra}
    suffix='-v'+str(extra['revision']) if 'revision' in extra else ''
    path=ART/'briefs'/wave.lower()/(ident+suffix+'.json')
    if path.exists() and read(path)!=spec: raise ValueError('IMMUTABLE_BRIEF:'+ident)
    write(path,spec)
    return spec


def setup():
    path=ART/'waves/session6-start.json'
    if not path.exists():
        import subprocess
        usage=read(ART/'usage.json')
        preserved={relative(p):sha(p) for folder in ['delivery/a2c','delivery/a4c']
                   for p in (ART/folder).rglob('*') if p.is_file()}
        write(path,{'at':now(),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
                    'jobs':len(usage['jobs']),'charged':sum(j['charged_images'] for j in usage['jobs']),
                    'jobs_digest':digest(usage['jobs']),'preserved_camp_portraits':preserved,
                    'budget_before':read(ART/'budget.json'),'provider_budget_before':read(ART/'providers/budget.json')})
    policy=read(ART/'budget.json')
    for key in ['target_images','wave_hard_cap','weekly_image_cap']:policy[key]=300
    policy['session6_authorization']='Owner session 6: inherited cumulative 223, ceiling 300; agy weekly guard 300; independent provider latches retained. Conservative combined ceiling retained.'
    write(ART/'budget.json',policy)
    policy=read(ART/'providers/budget.json')
    for name in ['agy','grok']:policy['providers'][name]['weekly_image_cap']=300
    write(ART/'providers/budget.json',policy)


def effects_brief(school, pilot=False):
    bible=read(ART/'style-covenant.json')
    refs=[ref(bible['references']['moonchalk-tempest-arena']['path'],'energy/mist/spark painting reference'),
          ref(bible['references']['verdigris-covenant-arena']['path'],'painted effect fidelity and grounded light reference')]
    prompt=f'''Use case: stylized-concept. Asset: real animated VFX spritesheet for a canvas action game.
Reference-1.png and reference-2.png are visual style references only. Study their finely painted energetic magic.
{bible['style_block']}
Produce ONE high-resolution sheet, ideally 3072 x 2560, EXACTLY SIX equal columns and FIVE equal rows, 30 separate frames.
Pure uniform BLACK #000000 background everywhere between effects. No text, no labels, no dividers, no people, no scenery.
Every cell has 12 percent empty black margins on all sides. Do not join energy across cell boundaries.
All five rows are ONLY {school.upper()} magic: {bible['elements'][school]['shape']}, main pigment {bible['elements'][school]['color']}, luminous selected ivory cores. Intricate painted filaments with soft translucent falloff, never thick cartoon outlines or flat logos.
Read LEFT TO RIGHT as SIX genuinely changing consecutive hand-painted animation frames in each row. Camera 55-degree oblique.
ROW 1 CAST: spark gathers, coil forms, compresses, releases, wisps disperse, small last sparks. Center locked.
ROW 2 PROJECTILE/TRAVEL LOOP: one pointed energy head on the right at 68 percent cell width, tapering turbulent trail toward the left, length and center consistent; the internal filaments evolve in six phases that loop. Travels screen-right. No arrows or weapons.
ROW 3 IMPACT: tiny contact spark, compression, bright branching burst, expanded spray or fragments, dissipating cloud, faint residue. Center locked.
ROW 4 HIT SPARK: six stages of one compact sharp contact flicker, much less area than impact; sparse distinct motes.
ROW 5 AURA LOOP: a broken elliptical swirl seen obliquely around an empty center, low mist and orbiting elemental motes, six evenly spaced phases returning toward phase one. Keep the center empty for a character.
Designed to remain legible beside a 40-pixel-tall mage at 1080p. No blurry sheet-wide glow. Each row retains coherent form and palette. Original designs only.'''
    return brief('A8',school+'-animation',prompt,refs,pilot)


def barrier_brief():
    bible=read(ART/'style-covenant.json')
    refs=[ref(bible['references']['verdigris-covenant-arena']['path'],'painted crescent energy and sparks'),
          ref('art/review/sources/a8-water-animation-agy-a01.png','match already generated fine water energy')]
    prompt=f'''Use case: stylized-concept. ONE painted VFX animation spritesheet. {bible['style_block']}
Reference-1.png provides the dark magical arena effect fidelity, reference-2.png provides related mist and spark pigments. No characters or environment in this output.
EXACTLY SIX equal columns and THREE equal rows on pure BLACK #000000. No text, dividers, labels or watermark.
Each cell has 15 percent empty margin, all effects fully isolated. Largest supported high resolution, ideally 3072x1536.
The subject is an ABSORB ENERGY BARRIER, like a curved upright translucent membrane of cool ivory-blue energy supported by fine filaments and mist. It has visible thickness, a curved bright rim and internal flowing threads; not a logo, bell, shield object, bubble or filled disc.
Camera distant 55 degree oblique. Every cell SAME right-facing CRESCENT with open rear on LEFT. The mage position is the empty cell center, barrier curves around its RIGHT side. Tips at upper-right and lower-right, approximately 140 degree forward arc. Keep left half clear. Six consistent successive phases left to right.
ROW ONE HOLD LOOP: gentle irregular energy traveling around a stable curved crescent membrane. Six distinct phases, final near first, steady energy and size.
ROW TWO ABSORB CONTACT: an incoming orange energy bolt from the RIGHT approaches this SAME blue barrier, slows visibly, shortens, compresses against the barrier, fans into filaments ALONG its curved surface, then disappears into small motes. It never passes to the LEFT side. This is resistance and absorption, not reflection. Each cell an instantaneous key, not multiple poses.
ROW THREE PERFECT ABSORB: the same barrier has a sharp tiny ivory contact, intense fine branching filaments running along the arc, one concentrated flare at its RIGHT midpoint, then an elegant halo of droplets breaking away and settling back to the stable blue crescent. No full screen explosion or uniform white disk.
Fine painterly light, subtle mist, separated sparks, selective intense highlights matching the supplied concepts. Original artwork only.'''
    return brief('A8','barrier-animation',prompt,refs)


def earth_impact_brief():
    refs=[ref('art/review/sources/a8-earth-animation-agy-a01.png','earth palette and rock/dust material'),
          ref(read(ART/'style-covenant.json')['references']['ragged-oracle-arena']['path'],'painted stone and dust fidelity')]
    prompt='''Use case: stylized-concept. A replacement six-frame EARTH IMPACT animation sheet.
Reference-1.png supplies the ochre stone, golden energy and dust style. Its impact bursts clipped their cells; fix that technical defect here. Reference-2.png supplies painted material richness.
ONE image, EXACTLY THREE equal columns and TWO equal rows. Six chronological frames in reading order, each isolated on uniform pure BLACK #000000. No text or dividers.
Each effect MUST remain within the central 55 PERCENT of its cell, at least 22 percent empty BLACK margin on EVERY side, including dust. All six centers and canvas scales consistent. Ideally 1536x1024.
Frame 1 tiny earth contact spark; frame 2 bright fissure-like compression; frame 3 peak sharp angular fragments and ochre dust burst; frame 4 outward fragment spray; frame 5 settling translucent dust and a few fading motes; frame 6 faint residual dust.
Original finely hand-painted digital dark fantasy, physical angular stone splinters, smoky natural dust, thin sharp ivory-gold light, no cartoon outline, no smooth vector symbols, no physical ground or environment. Oblique view 55 degrees. No people or objects except the impact fragments. Absolutely no cropping or overlapping adjacent effects.'''
    return brief('A8','earth-impact-isolated',prompt,refs)


def earth_impact_correction():
    previous=next(j for j in jobs('A8') if j['scene']=='earth-impact-isolated')
    refs=[ref(read(ART/'style-covenant.json')['references']['ragged-oracle-arena']['path'],'painted ochre stone and dust reference only')]
    prompt='''Create an entirely new VFX sprite sheet using the supplied image only as reference for rich painterly stone and dust. Do NOT retain its scene, characters or floor. Original dark fantasy earth magic.
ONE landscape image with exactly 3 columns and 2 rows, SIX separate sprites on pure flat BLACK. No letters, dividers or captions.
Each sprite is SMALL: fits inside a circle whose diameter is HALF the cell width. All outer edges and all internal cell boundaries have WIDE plain BLACK gutters. Do not fill cells. The brightest peak sprite is no bigger than the others. Absolutely no glow or dust touches any cell edge.
Six consecutive frames of one stone impact, in reading order: 1 gold contact spark; 2 a compressed cracked glowing pebble; 3 concentrated angular stone burst and tight dust puff; 4 small fragmented stones expanding slightly; 5 dissipating dust; 6 faint motes. Shared center and scale. Fine worn ochre mineral surfaces, irregular brush accents, sharp ivory light and soft dusty light falloff. No arrows, no weapon, no ground, no environment, no white outline. Camera 55 degree oblique.
Strong material painting and irregular fine particles matching the supplied reference. Black background for local alpha extraction. This is not a concept scene or a poster.'''
    return brief('A8','earth-impact-isolated',prompt,refs,providers=['grok'],revision=2,correction_of=previous['id'])


def portable(wave):
    import sys
    if wave=='A8':
        from restoration_effects import build
    else:raise ValueError('UNSUPPORTED_WAVE')
    files=[p for p in (ART/'delivery'/wave.lower()).rglob('*') if p.is_file()]
    before={relative(p):sha(p) for p in files};blocked=[];raw=(ART/'raw').resolve()
    def guard(event,args):
        if event=='open' and isinstance(args[0],(str,bytes,Path)):
            path=Path(args[0]).resolve()
            if path==raw or raw in path.parents:
                blocked.append(str(path));raise RuntimeError('RAW_ACCESS_FORBIDDEN')
    sys.addaudithook(guard);build()
    drift=[p for p,h in before.items() if sha(ROOT/p)!=h]
    report={'status':'fail' if drift or blocked else 'pass','wave':wave,'files':len(files),'rawAccessAttempts':blocked,'hashDrift':drift}
    write(ART/'reports'/(wave.lower()+'-portable.json'),report);print(json.dumps(report))
    if drift or blocked:raise SystemExit(1)


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('command');p.add_argument('arg',nargs='?');a=p.parse_args()
    if a.command=='setup':setup()
    elif a.command=='effects-generate':generate(effects_brief(a.arg,pilot=a.arg=='water'))
    elif a.command=='barrier-generate':generate(barrier_brief())
    elif a.command=='earth-impact-generate':generate(earth_impact_brief())
    elif a.command=='earth-impact-correct':generate(earth_impact_correction())
    elif a.command=='check' and a.arg=='A8':
        from restoration_effects import check
        if check()['errors']:raise SystemExit(1)
    elif a.command=='portable':portable(a.arg)
