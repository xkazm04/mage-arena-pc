"""Reference-bound coherent clean plates; no assembled arena generation."""
from common import ART, ROOT, read, write, sha

def make():
    base=read(ART/'briefs/a12/moonlit-proof-grok.json')
    palettes={
      'verdigris':('a6-verdigris-covenant-verdigris-covenant-arena-a02.png',
       'deep bottle-green mineral flagstones, malachite glaze, pitted bronze-copper inlays, five green eroded obelisks, '
       'the large central concentric copper ring-and-crescent and the fine interconnected copper geometrical floor network, '
       'rear worn masonry, muted warm grazing light and deep green shadows'),
      'rust-sand':('a6-ragged-oracle-ragged-oracle-arena-a03.png',
       'warm muted ochre sand and pale weathered limestone, broad irregular dark slate patches, fine cracks, '
       'five irregular cloth-wrapped stone pylons, all existing ragged blue and rust-red banners painted into the architecture, '
       'weathered radial sun-circle designs in slate, rear masonry, dusty warm daylight and cool slate shadows')}
    for palette,(filename,invariants) in palettes.items():
        path=ART/'review/sources'/filename
        spec={**base,'id':palette+'-clean','pilot':False,'providers':['grok'],
          'references':[{'path':path.relative_to(ROOT).as_posix(),'sha256':sha(path),'role':'approved A6 scene; edit target, preserve entire environment'}],
          'prompt':('Use case: precise-object-edit. The supplied image is the ORIGINAL APPROVED ARENA PAINTING and edit target. '
            'Make ONE coherent clean painted background of this exact scene. Remove every living figure: all four mages, all soldiers, '
            'both hounds, the large thorn-backed stone creature. Remove all their equipment, cast shadows, personal auras and combat effects: '
            'fire streams, embers from characters, water swirl, purple air ribbon, floating rocks, sparks, projectiles. '
            'Reconstruct the exposed stone or sand below their former positions with continuous matching painted surface. '
            'LOCK the original camera, composition and framing. Preserve ALL existing architecture, objects and lighting: '+invariants+'. '
            'Keep the exact pylon positions, rune layout and irregular distribution of stone, floor seams and material wear. '
            'Preserve subtle surface detail and painted physical material richness. Do not invent new objects, broaden the floor cracks, '
            'smooth away detail, change the hue, flatten the atmosphere or add repetitive texture. '
            '55-degree elevated oblique view, no perspective change. One continuous painting, no separated parts, no grid or modular arena. '
            'No text, letters, numbers, logos, watermark, UI, portrait, statues, creatures or people. '
            'Retain abstract nonlinguistic rune geometry. No paper or canvas noise overlay. Original designs only. '
            'Largest available detailed landscape 16:9 image; target 3840x2160 if supported. Faithful preservation is the priority.')}
        write(ART/'briefs/a12'/f'{palette}-clean.json',spec)

if __name__=='__main__':make()
