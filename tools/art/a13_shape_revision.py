from PIL import Image,ImageDraw
from common import ART,ROOT,read,write,sha,relative
from covenant import jobs,review

ref=ART/'waves/A13/references/painted-ring-key.png'
arc=Image.open(ref).convert('RGB');d=ImageDraw.Draw(arc);d.rectangle((0,0,arc.width//2-1,arc.height),fill='black')
arcpath=ref.with_name('painted-right-half-guide.png');arc.save(arcpath)
write(ART/'waves/A13/references/guide-provenance.json',{'ring':'exact crop of threat-ring first cell','arc':'authored right-half isolation of that generated painting; composition guide, not a new generation'})
for name,guide,prompt in [
 ('ward-arc',arcpath,'Exactly THREE columns by TWO rows, SIX distinct hold keys of this RIGHT HALF ARC. Preserve the reference open-left semicircle: there must be NO paint anywhere in the left half of each cell except the top and bottom tips. A crescent facing RIGHT with opening to LEFT, like a closing parenthesis. Weathered luminous blue-silver brush pigment, broken uneven contours and six generous dark glyph gaps; no solid polished metal. Small energy filaments move along the arc in each key. Keep fixed centre and radius and gentle brightness. Do NOT complete it into a ring. No circle, oval or bubble. '),
 ('threat-cone',ref,'Exactly THREE columns by TWO rows, SIX distinct keys of ONE fan-shaped magical attack mark pointing RIGHT. Transform the reference circle into a QUARTER-DISC wedge: apex at the far LEFT centre of cell, TWO roughly horizontal diagonal brush sides diverge to the RIGHT, a curved convex edge closes the wide RIGHT end. Like a fan opening to the right, NEVER an upward equilateral triangle or rounded triangular frame. All six point RIGHT with fixed shape. Neutral silver-ivory cracked brush strokes, no solid metal; dark pigment fissures and small selected glow. Empty dark middle. The full boundary remains visible in every key while small light and stroke tips vary. ')
]:
    j=[j for j in jobs('A13') if j['scene']==name][-1]
    review(j,'Rejected: wrong shape/layout. Ward returns nine near-full rings rather than six open half arcs; cone returns a rotated triangular metal-like frame rather than a right-facing fan. Prepared one-shape reference correction.','reject')
    s=read(ART/'briefs/a13'/f'{name}.json');s['correction_of']=j['id'];s['references']=[{'path':relative(guide),'sha256':sha(guide),'role':'generated painted pigment; arc has explicitly authored half-mask'}]
    s['prompt']='Original painted dark-fantasy game decal animation sheet. Reference-1.png is the ONLY style/composition guide. '+prompt+' Flat TOP view before game projection. Pure black background with no panels, grid lines, text, symbols or glyphs; canonical glyphs are added separately. Each whole shape including glow must fit the middle 60 percent of its cell. Very large empty gutters and margins. Exactly 3x2. Rich uneven painterly strokes and localized wear, not vectors, neon tubes, photorealism, 3D render or paper noise.'
    write(ART/'briefs/a13'/f'{name}-v2.json',s)
