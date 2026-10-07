"""Reject phase-incoherent casts and prepare six-key painted contour corrections."""
from PIL import Image
from common import ART,ROOT,read,write,sha,relative
from covenant import jobs,review

source=[j for j in jobs('A13') if j['scene']=='threat-ring'][-1]
im=Image.open(ROOT/source['archive']);ref=ART/'waves/A13/references/painted-ring-key.png';ref.parent.mkdir(parents=True,exist_ok=True)
im.crop((0,0,im.width//3,im.height//2)).save(ref)
for element in ('fire','water','earth','air'):
    j=[j for j in jobs('A13') if j['scene']=='casting-'+element][-1]
    review(j,'Rejected full sheet: phase continuity and/or treatment fail. Start/release cells change into unrelated emblem objects; tiny repeated pseudo-writing does not follow the canonical alphabet. Fire is additionally locally rejected for clean vector-like strokes; Earth resembles a physical engraved ring. Correction uses one painted contour as reference and six coherent hold keys; start/release will be explicit authored reveal/dissolve of those paintings.','reject')
    s=read(ART/'briefs/a13'/('casting-'+element+'.json'))
    s['correction_of']=j['id'];s['references']=[{'path':relative(ref),'sha256':sha(ref),'role':'ONE painted cracked brush circle; keep pigment texture, transform element'}]
    s['sheet']={'columns':3,'rows':2,'kind':'casting-hold'}
    motif={'fire':'ember-orange broken flame ribbons, dark charcoal seams, small orange cinders and hot selected ivory cuts',
           'water':'cyan and deep blue breaking wave crescents, silver wet cuts and detached droplets, very restrained curling mist',
           'earth':'ochre and weathered pale gold mineral-pigment strokes, root-like broken tips, small angular stone and dust flecks',
           'air':'lavender-silver torn wind brushstrokes, split ends and thin branching lightning accents, lightly drifting wisps'}[element]
    s['prompt']=('Paint ONE sprite sheet, exactly THREE columns by TWO rows, SIX animation keys of the SAME '+element.upper()+' enchanted ground circle. '
      'Reference-1.png is ONE brush-painted circle, use its BROAD PAINTERLY STROKES and irregular cracked pigment as the visual anchor. '
      'Transform the medium into '+motif+'. No solid metal object: these are luminous painted incisions and elemental energy on an invisible ground plane. '
      'Richly brushed dark-fantasy painting, irregular thickness, broken layered stroke edges, strong dark paint crevices, small selected glow. '
      'Each key shows the entire identical centred enchantment at fixed radius: outer shape stable while different small flames/drops/grains/wisps travel around the strokes. '
      'Leave six asymmetrical open gaps in the painted circle for separate glyph inlays. DO NOT paint ANY letters, runes, words, symbols, squiggle-writing or emblems. Glyphs will be composited separately from the canonical alphabet. '
      'All six cells are HOLD frames, not emergence or dissipation. No copying of glyph sheets. The empty centre is at least 55 percent of diameter. '
      'Flat orthographic TOP view, circles round not perspective ovals. Exactly 3x2, pure black background, no panels or grid lines. Each complete shape including glow fits in the middle 65 percent of its cell. '
      'Large EMPTY gutters and outer margins. No paper/canvas/noise overlays, clip art, clean vector linework, smooth neon tubes, people, objects, text or watermarks. Original magical art only.')
    write(ART/'briefs/a13'/('casting-'+element+'-v2.json'),s)
