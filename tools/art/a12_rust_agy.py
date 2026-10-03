from common import ART, read, write
from covenant import jobs,review
job=next(j for j in jobs('A12') if j['id']=='a12-rust-sand-clean-grok-a02')
review(job,'REJECT: correction still retains the floating earth-spell stones near [.62,.70]; it also changed unrelated floor shapes.','reject')
base=read(ART/'briefs/a12/rust-sand-clean.json')
base.update(correction_of=job['id'],revision=3,providers=['agy'])
base['prompt']+=' CRITICAL: remove the entire floating earth-spell stone cluster and golden glow surrounding the lower-middle-right mage (x .62 y .70). The thorn-backed stone quadruped is also a CREATURE, not architecture. Remove it. The only upright forms remaining are the FIVE existing tall cloth-wrapped pillars. The floor must contain no floating objects or combat residue.'
write(ART/'briefs/a12/rust-sand-clean-agy.json',base)
