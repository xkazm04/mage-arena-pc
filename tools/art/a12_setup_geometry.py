"""A12 explicit compact mapping; v2 and game checkout remain evidence."""
import math
from common import ART, ROOT, read, write, sha

def setup():
    v2=read(ART/'scale-contract-v2.json'); s=math.sin(math.radians(55))
    width=102.4;height=1728/(30*s)
    camera={**v2['camera'],'plate_projection':'already projected; never multiply plate Y by sin(55) again',
        'nominal_centre_metres':[16,62], 'clamp_centre_metres':[[16-8.533333333333333,62-height/12],[16+8.533333333333333,62+height/12]],
        'proof_centre_metres':[16,62],'proof_body_height_px':{'1080':40.5,'1440':54}}
    geometry={'schemaVersion':1,'id':'a12-compact-single-plate','status':'art integration proposal; owner instruction, not game implementation',
      'v2Evidence':{'file':'art/scale-contract-v2.json','sha256':sha(ART/'scale-contract-v2.json'),'ellipseCentre':[16,62],'ellipseSize':[192,144]},
      'arena':{'shape':'ellipse','centreMetres':[16,62],'sizeMetres':[94,62],
        'visualAuthority':'conservative authored playable footprint; generated image is not metre-accurate geometry'},
      'plate':{'masterSizePx':[3072,1728],'worldSizeMetres':[width,height],
        'worldTopLeftMetres':[16-width/2,62-height/2],
        'screenSize1080':[2304,1296], 'screenSize1440':[3072,1728],
        'normalViewCropMasterPx':[256,144,2560,1440],
        'overscan':'single complete painting, 20 percent wider/taller than 16:9 viewport; no extension panels, repeats or join lines'},
      'camera':camera,
      'migration':{'required':True,'oldEllipseCentreMetres':[16,62],'oldEllipseSizeMetres':[192,144],
        'newEllipseCentreMetres':[16,62],'newEllipseSizeMetres':[94,62],
        'positionTransform':'xNew=16+(xOld-16)*94/192; yNew=62+(yOld-62)*62/144',
        'scaleActorBodies':False,'scaleCombatDistances':False,
        'spawnPolicy':'Do not blindly scale tightly spaced formations. Re-author spawns around [16,62] at >=6m centre separation; proof witnesses are not balance data.',
        'oldGameSpawnsOutsideNewEllipse':[[8,10],[24,10],[12,10]],
        'gameWorkRequired':['apply compact core boundary','move initial spawns into compact arena','recheck waves, range, timing, collisions and save migration','clamp soft-follow camera to plate coverage','load A12 preprojected plate and fixed-position depth overlays'],
        'oldLayoutDropInCompatible':False},
      'paletteForGames':{'training':'verdigris','1':'verdigris','2':'verdigris','3':'rust-sand','4':'rust-sand','5':'moonlit','6':'moonlit'},
      'sourcePaletteMapping':'mage-arena-int/packages/game/data/covenant.json, read-only inspection',
      'owner_accepted':False,'engineMotionAndPerformance':'not measured'}
    write(ART/'delivery/a12/geometry.json',geometry)
    masks={
      'moonlit':[[.10,.40,.23,.63],[.31,.50,.47,.72],[.60,.58,.74,.78],[.77,.47,.90,.65],
        [.375,.15,.43,.265],[.585,.23,.64,.35],[.185,.278,.35,.40],[.70,.325,.79,.43],[.46,.18,.565,.34]],
      'verdigris':[[.22,.297,.302,.411],[.716,.349,.853,.50],[.20,.565,.291,.727],[.714,.622,.832,.811],
        [.338,.145,.485,.312],[.54,.178,.608,.26],[.474,.242,.55,.332],[.58,.269,.67,.422]],
      'rust-sand':[[.177,.52,.287,.667],[.352,.588,.48,.771],[.568,.591,.701,.793],[.741,.519,.842,.719],
        [.405,.231,.475,.355],[.52,.20,.578,.306],[.273,.307,.383,.428],[.35,.392,.442,.513],[.583,.334,.697,.487]]}
    cfg={'schemaVersion':1,'method':'preserve approved coherent painting outside authored removal masks; reference-guided generated scene supplies hidden floor only; local feather and colour match',
      'sourceMaskCoordinates':'normalized approved concept rectangle x0,y0,x1,y1; full replacement inside, 14px exterior feather',
      'maskFeatherSourcePx':14,'palettes':{}}
    refs={'moonlit':'moonchalk-tempest','verdigris':'verdigris-covenant','rust-sand':'ragged-oracle'}
    for p,ident in refs.items():
        concept=ART/'review/sources'/f'a6-{ident}-{ident}-arena-a{3 if p=="rust-sand" else 2:02}.png'
        cfg['palettes'][p]={'concept':concept.relative_to(ROOT).as_posix(),'conceptSha256':sha(concept),'removalBoxes':masks[p],
            'generatedJob':{'moonlit':'a12-moonlit-proof-agy-agy-a01','verdigris':'a12-verdigris-clean-agy-a03','rust-sand':'a12-rust-sand-clean-agy-a03'}[p]}
    write(ART/'waves/A12/restoration-plan.json',cfg)

if __name__=='__main__':setup()
