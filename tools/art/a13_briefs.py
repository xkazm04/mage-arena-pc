"""Reference-bound A13 sibling briefs; provider driver enforces proof gate."""
from common import ART,ROOT,read,write,sha
from covenant import jobs

proof=[j for j in jobs('A13') if j['scene']=='glyph-proof'][-1]
ref=ROOT/proof['archive']
style=read(ART/'style-covenant.json')
base=('Use case: stylized-concept. ONE production decal sprite sheet, on absolutely pure black. '
 'Reference-1.png is the canonical original rune alphabet: use its crooked hooked cut ends, pressure-varied strokes, weathered luminous silver and deliberately broken curves. '
 'Painted dark fantasy with sculpted luminous paint, rich worn edges, controlled glow; NOT vectors, uniform outlines, geometric clip art, diagrams, neon tubing or mathematical symbols. '
 'No text, labels, grid lines, borders, floor, objects, people, paper texture or all-over noise. '
 'Flat orthographic TOP VIEW of ground artwork, circular forms circular before game projection. '
 'Keep the identical centre, scale and facing in EVERY cell. Each whole effect INCLUDING bloom stays in the middle 65 percent of its cell; large empty black gutters. '
 'Do NOT put a bright point or emblem at the exact centre: that area stays empty under the actor. '
 'The game will place the EXACT canonical glyph cutouts into reserved gaps: concentrate on beautiful elemental painted connecting strokes and small fragments, no new pseudo-writing. ')

def brief(name,prompt,cols,rows,kind):
    write(ART/'briefs/a13'/f'{name}.json',{'wave':'A13','id':name,'pilot':False,'style_hash':sha(ART/'style-covenant.json'),
       'providers':['agy','grok'],'aspect_ratio':'4:3','references':[{'path':ref.relative_to(ROOT).as_posix(),'sha256':sha(ref),'role':'canonical glyph grammar and painting treatment'}],
       'sheet':{'columns':cols,'rows':rows,'kind':kind},'prompt':base+prompt})

for element in ('fire','water','earth','air'):
    motif={'fire':'ember-orange forked flame brush tips, dark cinder seams and tiny embers; hot amber-white cuts',
           'water':'cyan-blue crescent brushstrokes, suspended tear drops and a little curling mist; silver-white cuts',
           'earth':'ochre-gold split stone brushstrokes with irregular root ends, compact mineral flecks; pale stone-white cuts',
           'air':'pale lavender split wisps and delicate forked arcs, airy torn ends; silver-white cuts'}[element]
    brief('casting-'+element,
       'Exactly FOUR columns by THREE rows: twelve keys of ONE '+element.upper()+' CASTING SIGIL animation. '
       'A weathered broken circular spell inscription woven from '+motif+'. '
       'Two loose interacting brush circuits with generous gaps for glyphs; an open dark centre occupying half the diameter. '
       'Row 1 START four keys left to right: first dim seed splinters at the perimeter; second awakening quarter; third half-awake curls; fourth a complete awakened inscription. '
       'Row 2 HOLD four keys: complete inscription at stable size, light and small elemental motes travel around it, brightness stays controlled and similar, shift only energy and tiny stroke tips. '
       'Row 3 RELEASE four keys: bright unlocking cuts, then ring opens into broken streaks, then dim falling fragments, finally very faint residue. '
       'Every cell is an independent centred ground decal, all four hold keys aligned. No perspective ellipse. Aim for a large detailed 4:3 image.',4,3,'casting')

for shape in ('ring','cone','line'):
    geometry={'ring':'a complete rough circular perimeter, with an empty middle and a narrow inner band of swept strokes',
       'cone':'a broad fan-shaped wedge aimed RIGHT: its apex near the left, two weathered diverging side strokes and a ragged curved outer edge on the right; open dark inside',
       'line':'a horizontal attack lane aimed RIGHT, two long parallel irregular brush-rails joined by torn hooked endcaps; length about 2.8 times its width; open dark inside'}[shape]
    brief('threat-'+shape,
       'Exactly THREE columns by TWO rows, SIX distinct stable HOLD animation keys of the SAME enemy threat boundary: '+geometry+'. '
       'Neutral ivory-silver luminous underpainting, occasional muted warm weathering, suitable for tinting. Broad cracked calligraphic ribbons, with black cracks inside bright paint, small displaced sparks. '
       'The full perimeter remains visible in ALL six keys, fixed position and size. Only travelling light, tiny sparks and stroke-tip life vary. '
       'Keep generous dark gaps beside the inside edge for canonical rune placement. No generated writing or symbols. No progress pie slice: the game applies a separately authored fill wave. '
       'Exactly one isolated shape per cell. Do not accidentally join adjacent cells.',3,2,'threat')

brief('ward-arc',
 'Exactly THREE columns by TWO rows, SIX stable HOLD keys of ONE protective arc. The RIGHT half of a circular inscription, open all the way to the LEFT; a glowing semicircular barrier stroke, front-facing RIGHT in ground plane. '
 'Two unequal parallel weathered silver-blue brush crescents, interrupted by dark chips and six generous gaps for glyphs; short inward branching energy filaments. '
 'The missing rear half is EMPTY black. Thin membrane shimmer follows the right edge only, no filled shield, bubble, disc or full circle. '
 'All six arcs identical centre/radius, travelling light sweeps from lower tip upward; later keys return to the first energy level. Fully inside cell margins.',3,2,'ward')
brief('perfect-ring',
 'Exactly THREE columns by TWO rows, SIX ordered keys of a perfect-absorb inner ring FLASH: dim awakening, half-lit awakening, full bright silver-white painted broken inner circle, peak prismatic cuts, fading fractured light, dim residue. '
 'Smaller inner oath-ring formed of chunky calligraphic cuts, bright ivory with a faint cyan edge, rich strokes, narrow bloom. Empty dark centre. '
 'NOT a smooth neon ring. Ring breaks are visible, all cells same radius. The game will gate its visibility by the actual perfect window, not by a guessed timer.',3,2,'perfect')
brief('floor-wreaths',
 'Exactly THREE columns by ONE row, THREE distinct quiet FLOOR RUNE WREATH underpaintings, no background surface. '
 'Left: verdigris-tinged aged silver; middle: worn warm bronze and ash; right: pale moon-silver. '
 'One loose irregular circular incised wreath per cell, TWO broken surrounding brush paths, faded chipped edges, branch-like radial cuts and quiet open spaces for canonical runes. '
 'These are old enchantments sunk into stone: dim paint, restrained pale inner cuts, practically NO bloom. Keep centre empty and no invented writing. '
 'Use the entire landscape 3:1 canvas, each wreath round in top view, widest possible EMPTY gutters. Aim for 2048x768 or larger.',3,1,'floor')
print('10 reference-bound sibling briefs ready; not submitted.')
