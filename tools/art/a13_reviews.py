"""Persist direct observations after source pixel inspection; never owner approval."""
from common import ART,read
from covenant import jobs,review
notes={
 'casting-fire':'Six coherent painted ember circuits with travelling fire tips and cinders; broad cracked brush pigment. Small baseline/centre differences remain. Canonical glyphs are separate inlays; start/release are authored from these keys.',
 'casting-water':'Six coherent cyan circuits with wet pale cuts and curling mist. Internal contour is largely static and motion is in glints/mist; canonical Water cups supply the distinct rune silhouette.',
 'casting-earth':'Six gold mineral-pigment circuits, cracked brush edges and orbiting grains. Some grains resemble drops/flames; the canonical cleft-stone glyph is retained as the stable Earth cue. Owner motion review remains.',
 'casting-air':'Six lavender painted circuits with displaced forks and wind wisps. Similar shared contour to sibling schools is intentional language; changing sparks provide motion, not rotating the whole inscription.',
 'threat-ring':'Six painted wide worn brush circuits, dark cracks and changing sparks. Neutral paint is tinted per school and inlaid with exact canonical glyphs. Heavy body is reduced in display opacity; shape remains authored-data-independent artwork.',
 'threat-line':'Six long paired painted rails with broken hooked ends, chipped silver surfaces and travelling selected highlights. Regular straight section is surrounded by canonical glyph inlays; arbitrary length uses documented texture stretch/repeat guidance.',
 'ward-arc':'Six right-facing broad brush crescents. Generated arc is longer than a semicircle; export explicitly isolates its right half and places six canonical glyphs. Exact 140-degree gameplay clip is applied only by the consumer.',
 'perfect-ring':'Six bright inner-circle keys with controlled cold bloom and fractured prismatic peak. Smoother than base ward pigment and intentionally bright; canonical OPEN/GATHER inlays unify it. Event-gated, never claims an independent perfect timer.',
 'floor-wreaths':'Three subdued green/bronze/moon pigment wreaths, no embedded alphabet. Two white generated cell separators are explicitly excluded by authored 5px inner crop before alpha extraction. Canonical glyphs unify floor and combat.'}
for name,note in notes.items():
    j=[j for j in jobs('A13') if j['scene']==name][-1]
    review(j,note)
print('Selected A13 direct pixel reviews written; rejected attempts preserved.')
