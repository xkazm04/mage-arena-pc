"""Make the coherent wide plates the only delivery method; preserve rejected trial."""
from common import ART,ROOT,read,write,sha
from covenant import jobs,review

config=read(ART/'waves/A12/restoration-plan.json')
if config.get('mode')!='coherent-wide':
    write(ART/'waves/A12/rejected-masked-trial/restoration-plan.json',config)
    config['mode']='coherent-wide'
    config['method']='reference-guided complete clean scene, followed by ONE coherent wide outpainted painting from a grey overscan guide; no masks, no assembled floor, no repeated parts'
    config.pop('sourceMaskCoordinates',None);config.pop('maskFeatherSourcePx',None)
    for palette,spec in config['palettes'].items():
        spec['generatedJob']=f'a12-{palette}-wide-agy-a01';spec.pop('removalBoxes',None)
    write(ART/'waves/A12/restoration-plan.json',config)
    # Source coordinates from the concept are mapped into the inner 5/6 view.
    occ=read(ART/'waves/A12/occluders.json')
    write(ART/'waves/A12/rejected-masked-trial/occluders.json',occ)
    for rows in occ['palettes'].values():
        for obj in rows:
            obj['baseUV']=[1/12+v*5/6 for v in obj['baseUV']]
            obj['polygonUV']=[[1/12+x*5/6,1/12+y*5/6] for x,y in obj['polygonUV']]
    write(ART/'waves/A12/occluders.json',occ)
    witness=read(ART/'waves/A12/proof-witnesses.json')
    for row in witness['actors']+witness['effects']:row['footUV']=[1/12+v*5/6 for v in row['footUV']]
    write(ART/'waves/A12/proof-witnesses.json',witness)
    # Remove only our superseded trial masks; copies and reason are in rejected trial.
    import shutil
    for path in (ART/'delivery/a12/masks').glob('*-removal.png'):
        assert path.resolve().is_relative_to((ART/'delivery/a12').resolve())
        shutil.move(str(path),str(ART/'waves/A12/rejected-masked-trial'/path.name))

for job in jobs('A12'):
    if job['scene'].endswith('-wide'):
        review(job,'Single coherent expanded painting, original inner composition retained approximately. Clean floor, five architectural pylons, new overscan masonry integrated into same light. No visible figures or spell residues. Native resolution and fine rune/crack drift remain below reference; owner comparison pending.')
