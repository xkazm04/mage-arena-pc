"""One-time owner-authorized A12 evidence snapshot and proof briefs."""
import shutil
from common import ART, ROOT, read, write, sha, digest, now

out=ART/'waves/A12'; out.mkdir(parents=True,exist_ok=True)
if not (out/'start-snapshot.json').exists():
    usage=read(ART/'usage.json')
    write(out/'start-snapshot.json',{'at':now(),'jobs':len(usage['jobs']),
        'charged':sum(j['charged_images'] for j in usage['jobs']),
        'jobsDigest':digest(usage['jobs']), 'authorization':'User ART session 7: A12, about 60 new images; agy 400, Grok 330; clear both old latches with evidence; never push.'})
    for name in ('usage.json','budget.json','providers/history.json','providers/budget.json'):
        target=out/'before'/name; target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(ART/name,target)
    state=read(ART/'providers/history.json')
    for provider in ('agy','grok'):
        old=state['providers'][provider]['stop']
        write(out/'latches'/f'{provider}-session6.json',old)
        state['providers'][provider]['events'].append({'at':now(),'event':'owner-authorized-reset','job':'A12','previousStop':old,
            'reason':'Explicit session 7 authorization; archived old latch; one proof per provider before siblings.'})
        state['providers'][provider]['stop']=None
    write(ART/'providers/history.json',state)
    budget=read(ART/'budget.json')
    for key in ('target_images','wave_hard_cap','weekly_image_cap'): budget[key]=345
    budget['session7_authorization']='285 inherited + maximum 60 A12 reservations = 345 combined; independent provider guards agy 400 / Grok 330. No refunds.'
    write(ART/'budget.json',budget)

refs={'moonlit':'a6-moonchalk-tempest-moonchalk-tempest-arena-a02.png',
      'verdigris':'a6-verdigris-covenant-verdigris-covenant-arena-a02.png',
      'rust-sand':'a6-ragged-oracle-ragged-oracle-arena-a03.png'}
for provider in ('agy','grok'):
    p=ART/'review/sources'/refs['moonlit']
    prompt=('Use case: precise-object-edit. Input image reference-1.png is the ORIGINAL APPROVED ARENA PAINTING and edit target. '
      'Deliver ONE coherent painted CLEAN ENVIRONMENT PLATE of this exact scene. Remove ALL four mages, all soldiers, all hounds and the large stone creature. '
      'Remove their staffs, shields, cast shadows, fire, blue water swirl, purple spell ribbons, floating earth rocks, all projectiles, combat sparks and personal auras. '
      'Reconstruct only the exposed floor where they stood using continuous original mineral strata and cracks. '
      'Preserve the original composition, 55-degree elevated oblique camera, framing, architecture, dark blue-black floor, original irregular stone layers, '
      'all FIVE existing wardstone pylons in their original positions, their subtle blue architectural lights, eroded circular rune geometry, '
      'rear masonry wall, banners, cool grazing illumination, rich painterly surface detail and deep nocturnal atmosphere. '
      'Do not invent or rearrange architecture. Do not simplify, tile, repeat, mirror, blur, flatten the lighting, smooth away mineral detail, '
      'add people or statues, or turn the surface into photographic noise. No text, letters, numbers, watermark, HUD or border. '
      'Pylons and masonry remain painted INTO this single scene. No separated object sheet. '
      'No paper grain overlay. Original designs only. Render as large and detailed as available, landscape 16:9; aim for 3840x2160 if supported. '
      'Priority is faithful detailed reference preservation, not an invented new arena.')
    spec={'wave':'A12','id':'moonlit-proof-'+provider,'pilot':True,'style_hash':sha(ART/'style-covenant.json'),
          'providers':[provider],'aspect_ratio':'16:9','references':[{'path':p.relative_to(ROOT).as_posix(),'sha256':sha(p),'role':'edit target: approved concept; preserve environment'}], 'prompt':prompt}
    write(ART/'briefs/a12'/f'moonlit-proof-{provider}.json',spec)
