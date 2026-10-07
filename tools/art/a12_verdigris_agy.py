from common import ART, read, write
from covenant import jobs,review
job=next(j for j in jobs('A12') if j['id']=='a12-verdigris-clean-grok-a02')
review(job,'REJECT: creature removed but multiple raised pale slab islands and bright copper spokes were invented across previously continuous flat floor. Severe environment drift.','reject')
base=read(ART/'briefs/a12/verdigris-clean.json')
base.update(correction_of=job['id'],revision=3,providers=['agy'])
base['prompt']+=' CRITICAL: The large thorn-backed four-legged stone creature at x .63 y .33 is an ANIMAL and must also disappear entirely. Replace it with the same flat worn dark green floor. No raised slab islands. No hovering pebbles, no glowing residual silhouettes.'
write(ART/'briefs/a12/verdigris-clean-agy.json',base)
