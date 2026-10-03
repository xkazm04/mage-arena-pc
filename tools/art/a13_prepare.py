"""Session snapshot and the single paid proof brief. No generation here."""
import shutil
from common import ART, ROOT, read, write, sha, digest, now

out=ART/'waves/A13'
out.mkdir(parents=True,exist_ok=True)
if not (out/'start-snapshot.json').exists():
    usage=read(ART/'usage.json')
    protected={str(p.relative_to(ROOT)).replace('\\','/'):sha(p)
               for folder in ('delivery/a2c','delivery/a4c','delivery/a8','delivery/a10','delivery/a12','ui')
               for p in (ART/folder).rglob('*') if p.is_file()}
    write(out/'start-snapshot.json',{'at':now(),'jobs':len(usage['jobs']),
       'charged':sum(j['charged_images'] for j in usage['jobs']),
       'jobsDigest':digest(usage['jobs']),'protected':protected,'sessionImageCap':40,
       'authorization':'User ART session 8 A13, agy first, one proof, serial, no resets, no push.'})
    for name in ('usage.json','budget.json','providers/history.json','providers/budget.json'):
        target=out/'before'/name;target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(ART/name,target)

refs=[ART/'review/sources/a6-moonchalk-tempest-moonchalk-tempest-arena-a02.png',
      ART/'review/sources/a6-moonchalk-tempest-moonchalk-tempest-portrait-a02.png',
      ART/'ui/sources/clock.png']
prompt=('Use case: stylized-concept. Create ONE original game-asset GLYPH MASTER SHEET, exactly FOUR columns by THREE rows, twelve isolated glyphs, black background. '
 'Input reference-1.png supplies weathered luminous wardstone incisions and magical atmosphere; reference-2.png supplies hand-painted silver/collar craftsmanship; reference-3.png supplies worn UI metal. '
 'These are visual style references only, not layouts to copy. Paint luminous ivory-silver calligraphic rune strokes with very faint cool bloom, dark worn inner edges, thick-to-thin pressure, chipped physical stroke ends, confident uneven hand. '
 'The twelve abstract magical radicals share hooked cut ends and one deliberate break in every curve. Original symbols, NOT existing alphabets, letters, numerals, mathematical notation, religious symbols, vector icons, clean geometric clip art or circles drawn with a compass. '
 'Row 1 left to right: FIRE a crooked three-tongued ember split from one hooked root; WATER a cupped breaking wave with a hanging tear; EARTH an uneven cleft stone-tooth with two short root cuts; AIR an unfurling forked wisp with a detached breath nick. '
 'Row 2: BIND two unequal hooked strokes cupping a dark cleft; OPEN a broken bowl with an escaping tip; GATHER three short swept splinters leaning into a hollow; RELEASE a long curling stroke ending in two outward sparks. '
 'Row 3: WITNESS a watchful broken eye with an offset short scar; DANGER two uneven downward tooth strokes pierced by a short sideways nick; SEVER two torn hooked ends pulling apart with a jagged gap; ENDURE a heavy bent root supporting a short floating stroke. '
 'The glyphs should feel carved by a battle mage and awakened by light, each boldly legible at 24 pixels, with rich painterly edge variation at larger sizes. '
 'All twelve upright and centred in equal grid cells. Exactly one glyph per cell. Every glyph INCLUDING its soft glow fits within the middle 60 percent of its cell. Wide EMPTY black gutters and outer margins; NO grid lines, panels, labels, decorative border, floor, objects or people. '
 'Neutral ivory with subtle silver-blue shading, no colored background. No grain, paper or noise. Flat orthographic front view for clean extraction, no perspective. Aim for 1536x1152 or larger 4:3 sheet. No text or watermark.')
write(ART/'briefs/a13/glyph-proof.json',{'wave':'A13','id':'glyph-proof','pilot':True,
 'style_hash':sha(ART/'style-covenant.json'),'providers':['agy','grok'],'aspect_ratio':'4:3',
 'references':[{'path':p.relative_to(ROOT).as_posix(),'sha256':sha(p),'role':'Covenant style reference'} for p in refs],
 'prompt':prompt})
print('A13 snapshot and single proof ready; existing budgets and latches unchanged.')
