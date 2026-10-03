from common import ART, ROOT, read, write, sha
from covenant import jobs,review

job=next(j for j in jobs('A12') if j['scene']=='verdigris-clean')
review(job,'REJECT: the large thorn-backed quadruped remains at normalized x .63 y .32. All figures must be absent. Local generic grader missed it; direct review takes precedence.','reject')
base=read(ART/'briefs/a12/verdigris-clean.json')
base.update(correction_of=job['id'],revision=2,
    references=[{'path':job['archive'],'sha256':job['sha256'],'role':'edit target; rejected because one quadruped remains'}],
    prompt='Remove the ONE remaining thorn-backed stone animal near x=63 percent from left, y=32 percent from top. '
      'It is a four-legged creature, NOT architectural rubble. Remove its entire spined back, head, legs, feet and cast shadow. '
      'Reconstruct the exposed patch as flat continuous dark green mineral flagstones and thin copper inlays that match the surrounding arena floor. '
      'Preserve absolutely everything else: all five tall green standing obelisks, rear masonry, precise concentric copper rune circles, cracks, '
      'bottle-green and umber material palette, muted grazing illumination, original elevated oblique camera and framing. '
      'The result must be a completely EMPTY arena with ZERO people, beasts, creatures, golems, soldiers, mages, weapons, personal auras or combat effects. '
      'ONE coherent detailed painted environment plate; do not simplify, soften or rearrange it. No text, letters, logos or UI. Original design. Landscape 16:9.')
write(ART/'briefs/a12/verdigris-clean-correction.json',base)

job=next(j for j in jobs('A12') if j['scene']=='moonlit-proof-agy')
review(job,'Clean coherent empty scene retains all five pylons and their rune geometry. 1376x768 native. Fine strata are softened and fine cracks re-rasterized; somewhat brighter centre. Owner comparison pending.')
