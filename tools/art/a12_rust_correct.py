from common import ART, read, write
from covenant import jobs,review
job=next(j for j in jobs('A12') if j['scene']=='rust-sand-clean')
review(job,'REJECT: floating earth-spell pebbles and faint gold haze remain at x .62 y .70, where the Earth mage stood. The scene also shifted warmer and smoothed floor texture.','reject')
base=read(ART/'briefs/a12/rust-sand-clean.json')
base.update(correction_of=job['id'],revision=2,
    references=[{'path':job['archive'],'sha256':job['sha256'],'role':'edit target; remaining floating magic stones at lower middle-right'}],
    prompt='Precisely clean this environment painting. Remove the entire cluster of floating brown pebble-like stones, their little shadows and the pale golden spell haze '
      'at x=62 percent from the left and y=70 percent from the top (just LEFT of the lower-right reddish scorch patch). These airborne stones are magical combat effects, not terrain. '
      'Paint flat continuous weathered pale warm sand and worn limestone in their place, matching the neighbouring ground. No isolated hovering rocks remain. '
      'Preserve the five tall existing cloth-wrapped pylons, all floor sun-circle geometrical designs, irregular broad slate patches, existing rear walls and banners, '
      'elevated oblique camera, framing, diffuse light and subtle physical cracks. No new objects. No changes elsewhere. '
      'Empty arena: zero people, animals, stone creatures, warriors, staffs, projectiles, personal auras or combat effects. '
      'One coherent detailed painting. No text, lettering, logo, border, UI or all-over texture overlay. Original designs. Landscape 16:9.')
write(ART/'briefs/a12/rust-sand-clean-correction.json',base)
