"""Fail closed on stale pixels/geometry and semantic flags. Never approves art."""
import math
import numpy as np
from PIL import Image
from common import ART,ROOT,read,write,sha,digest
from arena_plates import crop_view,PALETTES,SIN

OUT=ART/'delivery/a12'

def require(value,message):
    if not value:raise ValueError(message)

def semantic_gate(review,vision,ocr):
    fields=('figuresObserved','combatEffectsObserved','readableTextObserved')
    require(not any(review.get(k,True) for k in fields),'DIRECT_REVIEW_REJECTED')
    require(vision.get('verdict')!='reject','LOCAL_VISION_REJECTED')
    require(not ocr.get('flagged'),'OCR_TEXT_FLAG_REQUIRES_REVIEW')
    require(not review.get('owner_accepted') and not vision.get('owner_accepted'),'MODEL_CANNOT_ACCEPT')
    return 'owner-review'

def check():
    m=read(OUT/'arena-plates.json');g=read(ROOT/m['geometry']);rows=[]
    require(sha(ROOT/m['geometry'])==m['geometrySha256'],'GEOMETRY_CHANGED')
    require(sha(ROOT/g['v2Evidence']['file'])==g['v2Evidence']['sha256'],'SCALE_CONTRACT_CHANGED')
    require(set(m['palettes'])==set(PALETTES),'PALETTES_MISSING')
    require(m['paletteForGames']==g['paletteForGames'] and set(m['paletteForGames'])=={'training','1','2','3','4','5','6'},'GAME_MAPPING_MISSING')
    require(m['legacyLayoutCompatible'] is False and g['migration']['required'],'MIGRATION_NOT_DISCLOSED')
    require(not m['owner_accepted'],'OWNER_ACCEPTANCE_NOT_GIVEN')
    require(g['camera']['ground_pixels_per_metre_at_1080p']==22.5,'CAMERA_SCALE_CHANGED')
    for name,p in m['palettes'].items():
        plate=Image.open(ROOT/p['file']).convert('RGB')
        require(list(plate.size)==p['size']==[3072,1728],'PLATE_SIZE')
        require(sha(ROOT/p['file'])==p['sha256'],'PLATE_HASH_CHANGED')
        require(not p['repeat'] and p['preprojected'],'WRONG_RENDER_METHOD')
        for filekey,hashkey in [('concept','conceptSha256'),('generated','generatedSha256')]:
            require(sha(ROOT/p['provenance'][filekey])==p['provenance'][hashkey],'SOURCE_HASH_CHANGED')
        require(sha(ROOT/p['nativeRestoration']['file'])==p['nativeRestoration']['sha256'],'NATIVE_SOURCE_CHANGED')
        require(abs(g['plate']['worldSizeMetres'][0]*30-plate.width)<.001 and abs(g['plate']['worldSizeMetres'][1]*30*SIN-plate.height)<.001,'PROJECTION_MISMATCH')
        for width,height in [(1920,1080),(2560,1440)]:
            for x in [g['camera']['clamp_centre_metres'][i][0] for i in (0,1)]:
                for y in [g['camera']['clamp_centre_metres'][i][1] for i in (0,1)]:
                    require(crop_view(plate,width,height,g,[x,y]).size==(width,height),'CAMERA_EDGE')
            for kind in ('plate','composite'):
                require(Image.open(OUT/'proofs'/f'{name}-{kind}-{height}.png').size==(width,height),'PROOF_SIZE')
            require(Image.open(OUT/'proofs'/f'{name}-comparison-{height}.png').size==(width*2,height+64),'COMPARISON_NOT_NATIVE')
            require(Image.open(OUT/'proofs'/f'{name}-native-crops-{height}.png').size==(1280,1152),'CROP_SIZE')
        for o in p['occluders']:
            sprite=Image.open(ROOT/o['file']).convert('RGBA');x,y,w,h=o['cropMasterPx']
            require(sha(ROOT/o['file'])==o['sha256'] and list(sprite.size)==o['size'],'OCCLUDER_CHANGED')
            require(np.array_equal(np.asarray(sprite)[:,:,:3],np.asarray(plate.crop((x,y,x+w,y+h)))),'OCCLUDER_NOT_SAME_PAINTING')
            require(abs(y+o['anchorPx'][1]-o['baseLineMasterPx'])<.001,'BASELINE_MISMATCH')
            require(abs(g['plate']['worldTopLeftMetres'][1]+o['baseLineMasterPx']/1728*g['plate']['worldSizeMetres'][1]-o['baseWorldMetres'][1])<.001,'WORLD_BASELINE_MISMATCH')
            require(np.any(np.asarray(sprite)[:,:,3]==0) and np.any(np.asarray(sprite)[:,:,3]==255),'MASK_NOT_CUT_OUT')
        r=read(OUT/'reviews'/f'{name}.json');v=read(OUT/'semantics'/f'{name}.json');o=read(OUT/'ocr'/f'{name}.json')
        require(r['imageSha256']==v['sha256']==o['imageSha256']==p['sha256'],'STALE_SEMANTIC_REVIEW')
        semantic_gate(r,v,o)
        metric=read(OUT/'metrics'/f'{name}.json')
        require(not metric['driftFlag'] and not metric['extensionSeams']['flag'] and not metric['autocorrelation']['repetitionFlag'],'DIAGNOSTIC_FLAG_REQUIRES_REVIEW')
        require(metric['a9ControlAutocorrelation']['repetitionFlag'],'REPETITION_POSITIVE_CONTROL_FAILED')
        rows.append({'palette':name,'plateSha256':p['sha256'],'occluders':len(p['occluders']),'technicalGate':'pass','semanticDisposition':'owner-review','belowReference':r['belowReference']})
    require(read(OUT/'ocr/positive-control.json')['pass'],'OCR_POSITIVE_CONTROL_FAILED')
    old=read(ART/'waves/A12/start-snapshot.json');usage=read(ART/'usage.json')
    require(digest(usage['jobs'][:old['jobs']])==old['jobsDigest'],'HISTORICAL_JOBS_REWRITTEN')
    total=sum(j.get('charged_images',1) for j in usage['jobs'])
    require(total==read(OUT/'spend.json')['projectTotal']==297,'SPEND_REPORT_STALE')
    for name in ('agy','grok'):
        require((ART/f'waves/A12/latches/{name}-session6.json').exists(),'OLD_LATCH_MISSING')
    result={'technicalGate':'pass','owner_accepted':False,'palettes':rows,'projectCharges':total,
      'historicalJobsUnchanged':old['jobs'],'caveat':'No deterministic check proves semantic absence or reference quality. Direct review and local models only route to owner.'}
    write(OUT/'checks.json',result);print('A12 technical gates pass; owner review remains open.');return result

if __name__=='__main__':check()
