"""Hash-bound direct observations. These route to the owner; never accept art."""
from common import ART,read,write,sha
EXPECTED={
 'verdigris':'131f18264e43c555c88283f4b70ed00bc40c5de837c6c749007f54d61e8546e6',
 'rust-sand':'9f73f5b60ec9ab14166efcf115de7d8bfc0ad99c90e4c9fd4ecf859d9ced2cac',
 'moonlit':'7fd50f289e694e52db017fa99ac158f27b0ea2c634fbc626f13a65a9a8fef33c'}
notes={
 'moonlit':'No figures, beasts, weapon silhouettes or combat trails visible. Five blue-lit pylons, concentric incisions, rear arched masonry and blue-black fractured surface form one painting. Fine glyph shapes and mineral strata differ from A6; new upper arches are an inferred extension. The learned pass sharpens some fissures and smooths others. No visible repeated floor modules or stand copies.',
 'verdigris':'No figures, thorn-backed creature, embers, water ribbon, air ribbon or floating stones remain. Five pitted green obelisks and copper ring/crescent network remain coherent. Central copper-circle geometry and slab fractures drift from A6; the far silhouette is an invented extension. Some fine etched material is softer than A6, despite the restrained local upscale. No visible repeated floor modules.',
 'rust-sand':'No mages, soldiers, hounds, stone creature or floating earth-spell stones remain. Five cloth-wrapped pylons, slate fields, worn sand, rune circles and ragged banners are integrated. Newly visible rear gate and foreground masonry are extrapolated. Small floor cracks and cloth-edge shapes differ from A6; the quiet sand is still smoother in places. No visible repeated floor modules.'}
def run():
    m=read(ART/'delivery/a12/arena-plates.json')
    # These observations describe inspected bytes, not arbitrary future rebuilds.
    if any(r['sha256']!=EXPECTED[p] or sha(ART/'delivery/a12/plates'/f'{p}.png')!=EXPECTED[p] for p,r in m['palettes'].items()):
        raise ValueError('NEW_DIRECT_REVIEW_REQUIRED_FOR_CHANGED_PIXELS')
    for p,r in m['palettes'].items():
        write(ART/'delivery/a12/reviews'/f'{p}.json',{'imageSha256':r['sha256'],'source':r['file'],
            'verdict':'owner-review','owner_accepted':False,'figuresObserved':False,'combatEffectsObserved':False,'readableTextObserved':False,
            'reviewMethod':'direct inspection of complete selected painting, native 1080p/1440p proof crops and former combatant regions; subjective observation, not mathematical absence proof',
            'observation':notes[p],'belowReference':['generated native detail is 1376x768; export is upscaled','floor cracks and abstract glyphs are not pixel-identical','overscan architecture is inferred','static lighting does not adapt to moving actors'],
            'occluders':'selected wide-image silhouettes traced locally; exact plate RGB, fixed position, floor base line and two-sided actor witnesses'})
        path=ART/'waves/A12/upscaled'/f'{p}.json';up=read(path)
        up['selection']='selected after direct 100% crop comparison: 35% learned retains paint while adding restrained edge clarity; 100% learned looked too smoothed/engraved. Owner acceptance unmeasured.'
        write(path,up)
    # Current proof was generated before transcript monitoring was installed.
    # Attach subsequently recovered visible evidence without changing its charge.
    from generate import Budget
    from providers import ProviderBudget,provider_of
    evidence=read(ART/'waves/A12/provider-evidence/a12-moonlit-proof-agy-agy-a01.json')
    calls=[c for e in evidence['evidence'] for c in e['calls'] if c['name']=='generate_image']
    b=Budget();job=next(j for j in b.load()['jobs'] if j['id']=='a12-moonlit-proof-agy-agy-a01')
    if not job.get('subsequent_audit'):job=b.update('a12-moonlit-proof-agy-agy-a01',{'tool_calls':calls,
        'tool_input_visibility':'subsequently audited exact parent/worker transcripts; see waves/A12/provider-evidence',
        'subsequent_audit':'art/waves/A12/provider-evidence/a12-moonlit-proof-agy-agy-a01.json'})
    write(ART/'attempts'/f'{job["id"]}.json',job)
    usage=b.load();state=ProviderBudget().state();policy=read(ART/'providers/budget.json')
    counts={p:sum(j['charged_images'] for j in usage['jobs'] if provider_of(j)==p) for p in ('agy','grok')}
    wave=[j for j in usage['jobs'] if j.get('wave')=='A12']
    report={'inheritedProjectCharges':285,'newImageReservations':sum(j['charged_images'] for j in wave),
        'newImageJobs':len(wave),'historicalReconciliationCharges':1,'projectTotal':sum(j['charged_images'] for j in usage['jobs']),
        'projectCeiling':345,'providerProjectCharges':counts,'providerPolicy':policy,
        'remainingUnderLocalGuards':{p:policy['providers'][p]['weekly_image_cap']-counts[p]-sum(policy['providers'][p].get('external_known_charges',{}).values()) for p in counts},
        'newImagesByProvider':{p:sum(j['charged_images'] for j in wave if j['provider']==p) for p in counts},
        'providerStops':{p:s['stop'] for p,s in state['providers'].items()},
        'moneyCost':'subscription/account image price not measured; CLI token cost is not image-generation cost',
        'actualAccountAllowance':'unknown; local caps are not account balance','localUpscalePasses':3,
        'grokProbe':'one successful image after old temporarily-at-capacity HTTP 429; consistent with transient capacity, not proof of allowance type',
        'agyDiagnosis':'old provider explicitly copied output.png to source.png; hidden worker made three image calls. Old two charges preserved; missing third charged in separate audit entry.',
        'newAgyGuard':'exact-request-linked transcript monitoring; second image call or first quota/rate error stops; duplicate file aliases recorded separately from distinct output hashes'}
    write(ART/'delivery/a12/spend.json',report);print(report['projectTotal'],report['newImagesByProvider'])

if __name__=='__main__':run()
