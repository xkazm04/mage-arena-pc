from common import ART,read,write,sha,relative
from covenant import jobs,review
j=[j for j in jobs('A13') if j['scene']=='floor-wreaths'][-1]
review(j,'Rejected: the floor rings contain geometric engraved letter-like runes outside the canonical alphabet and resemble stone hardware. Replace with quiet broken pigment wreaths with NO glyphs, then assemble only canonical glyph cutouts.','reject')
s=read(ART/'briefs/a13/floor-wreaths.json');s['correction_of']=j['id']
p=ART/'waves/A13/references/painted-ring-key.png';s['references']=[{'path':relative(p),'sha256':sha(p),'role':'painted broken contour only; no writing'}]
s['prompt']=('ONE game decal asset sheet: THREE columns in ONE row, three large isolated circular worn paint inscriptions on PURE BLACK. '
 'Use reference-1.png brush texture and cracked pigment, but make each wreath much more fragmentary, thin, quiet and weathered, old pigment scratches sunk into stone rather than a physical stone or metal object. '
 'Left grey-green verdigris pigment; middle warm ochre-bronze pigment; right cold blue-grey moon-silver pigment. '
 'Each wreath has two broken curling brush paths, uneven pressure and deeply eroded edges with many gaps. Open black centre occupies 70 percent of diameter. '
 'ABSOLUTELY NO GLYPHS, RUNES, LETTERS, SYMBOLS, GEOMETRIC MARKS, NUMBERS OR WRITING ANYWHERE. Canonical rune cutouts will be added in a separate art assembly step. '
 'Low glow, painterly uneven incisions, no thick polished ring, no masonry blocks, no uniform annulus. Flat top view, circular before projection. '
 'Exactly three isolated decals, one per equal square cell, whole mark within middle 70 percent of cell, generous pure black gutters. No panels, borders, floor surface, paper grain or noise. Landscape 3:1. Original work.')
write(ART/'briefs/a13/floor-wreaths-v2.json',s)
