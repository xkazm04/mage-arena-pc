"""Compile original A3 authored descriptions before any paid call."""
from common import ART, ROOT, read, write, sha


def main():
    cast = read(ART/'cast-v1.json')['characters'][:4]
    enemies = read(ROOT/'docs/design/baseline-fourteen-nights/design/data/enemies.json')
    designs = {
        'conscript': 'Adult Roman conscript, compact iron cap without crest, russet short tunic, small round bronze shield on left arm, a single long ash spear in right hand, bare calves and brown sandals. Strong narrow spear silhouette. No prisoner collar.',
        'shieldman': 'Stocky adult Roman scutum bearer, plain low iron helmet without crest, dark ochre short tunic, broad rectangular oxblood-red scutum shield with one plain bronze central boss, short sword, bare calves and brown sandals. Shield dominates silhouette. No lettering or borrowed insignia.',
        'slinger': 'Lean adult Roman funditor with olive skin, curly cropped dark hair, no helmet, short faded ochre tunic with diagonal dark belt and small hip pouch, brown sandals. One simple cord sling with stone cradle, no bow, no spear, no shield.',
        'netter': 'Adult arena net thrower with deep brown skin, short black hair, short desaturated brick linen tunic, bare arms and calves, brown sandals. One loosely folded ochre cord fishing net with broad coarse diamond mesh over left forearm, right hand grips its cord; no trident, no armour.',
        'cinder_hound': 'Original compact lean dog-like quadruped, charcoal-umber angular body, blunt canine snout, two pointed ears, four sturdy legs, short upward curling tail. Small flat terracotta ember cracks at shoulder and flank, no flames, no glow cloud, no armour. Dog anatomy, not a dragon.',
        'mire_maw': 'Original broad squat amphibious quadruped, dull olive-ochre leathery body, very broad horizontal dark mouth, two small mineral-blue eyes atop head, four short splayed limbs and no tail. Sparse dark mud plates on back. Bulky low wedge silhouette; no horns or copied monster.',
        'thornback': 'Original heavy boar-like quadruped, umber body with ochre angular back plates, three large blunt triangular thorn ridges along spine, short wedge snout with two small tusks, four short powerful legs, tiny tail. Clearly distinct large ridged silhouette; no rhinoceros horn.',
        'hush_moth': 'Original small moth creature, two broad paired dusty-chalk wings with dark umber margins and one muted sage oval on each upper wing, narrow charcoal body, two short antennae and tiny legs. Four wings total, broad simple silhouette, matte pigment, no glow or decorative symbols.'
    }
    entities=[]
    for c in cast:
        entities.append({'id':c['id'],'name':c['name'],'kind':'mage','school':c['school'],
            'design':c['visual_identity']+' Full body: knee-length belted linen tunic, bare calves, plain brown leather sandals. No staff, no weapon, no hat. Keep the same garment and plain bronze neck collar in every pose.',
            'portrait':'art/delivery/a2/portraits/'+c['id']+'-calm.png','height_ratio':1.0})
    for kind in ('soldiers','creatures'):
        for e in enemies[kind]:
            entities.append({'id':e['id'],'name':e['name'],'kind':kind,'design':designs[e['id']],
                'height_ratio':{'cinder_hound':.62,'mire_maw':.85,'thornback':.95,'hush_moth':.48}.get(e['id'],1),
                'attacks':e['attacks']})
    common = ('Use case: stylized-concept. Asset: TWO key-pose sprites of the SAME original character side by side in one horizontal sheet. '
        'Camera is an elevated OBLIQUE game view, 55 degrees above ground, looking down at upright bodies: visible top of head and shoulders AND face, shortened legs. '
        'Never a straight-down 90-degree plan view, never eye-level front portrait. Both subjects face diagonally toward the viewer and screen RIGHT (southeast). '
        'Exactly two separate full bodies, LEFT body centred at 25% width and RIGHT body at 75% width, standing at the same scale, approximately 65% of image height, with generous clear margins on every side. '
        'The image will be cropped into equal left and right halves. Each body and every prop must fit entirely inside its own half. '
        'Pure flat solid vivid MAGENTA #ff00ff background ONLY, with no paper texture, ground, shadow, horizon, border or divider. Magenta is a removable technical matte, never part of the design. '
        'Apply Tessera & Lime paint ONLY inside the character: flat chalk-lime, umber contours, terracotta, mineral blue or ochre planes, sparse chipped pigment at cloth edges. '
        'Strong simple silhouette and dark umber boundary for readability when body is 43 to 65 pixels high; broad costume colour blocks, no minute ornament. '
        'No text, labels, numerals, logo, watermark, realistic 3D shading, scenery, magic halo, arc or projectiles. No duplicated limbs. No other figures. Original designs only.')
    items=[]
    for e in entities:
        humanoid=e['kind']!='creatures'
        stance=('LEFT: relaxed upright idle, hands apart at waist, feet planted. RIGHT: active directional absorb stance, knees flexed, both open palms held forward at chest height, elbows clearly separated from torso. No drawn magic shield or arc.' if e['kind']=='mage' else
                'LEFT: neutral idle stance. RIGHT: alert guarded stance with lowered centre of gravity, ready to move, keeping all equipment visible. This enemy has no magical absorb ability; draw no magic.')
        run=('LEFT: running with left leg forward and right leg back, opposite arms counter-swing. RIGHT: running with right leg forward and left leg back, opposite arms counter-swing. Torso leans forward, feet clearly separated; identical scale and camera.' if humanoid else
             'LEFT: moving forward with forelegs extended and rear legs tucked. RIGHT: moving with forelegs tucked and rear legs extended. Keep the same four-legged anatomy and body scale.' if e['id']!='hush_moth' else
             'LEFT: flying with four wings spread wide. RIGHT: flying with wings raised and foreshortened, same body centre and same anatomy.')
        attack = ('LEFT: cast anticipation, knees bent, right hand drawn back to shoulder, left hand aimed ahead. RIGHT: cast release, right open palm thrust forward to screen right, torso follows through, left hand withdrawn. No generated spell effects.' if e['kind']=='mage' else {
            'conscript':'LEFT: spear lunge anticipation, spear drawn back. RIGHT: spear lunge release, spear extended low toward screen right; shield stays on left arm.',
            'shieldman':'LEFT: shield bash anticipation, rectangular shield drawn close. RIGHT: bash release, broad shield thrust forward to screen right, feet planted.',
            'slinger':'LEFT: sling windup with cord extended beside head. RIGHT: sling release follow-through with right arm extended, empty sling trailing; no projectile.',
            'netter':'LEFT: net throw windup with bundled net drawn beside body. RIGHT: release with net fanning ahead but still inside the right half, broad diamond mesh readable.',
            'cinder_hound':'LEFT: bite anticipation crouched low. RIGHT: short lunging bite with mouth open, four canine limbs only; no flame effect.',
            'mire_maw':'LEFT: bog glob anticipation with mouth swollen shut. RIGHT: bog glob release with very broad mouth open, head raised; no projectile. Tongue attack reuses this open-mouth pose with a separate procedural line.',
            'thornback':'LEFT: charge anticipation with head low and feet braced. RIGHT: charge release leaning forward, ridge plates unchanged, forelegs reaching.',
            'hush_moth':'LEFT: contact approach with wings swept back. RIGHT: contact cling with wings partly folded and legs extended; no magic spell.'
        }[e['id']])
        injury=('LEFT: hit reaction recoiling, torso tilted back, arms close, feet retain ground contact. RIGHT: fallen defeated body lying sideways on ground, head at left and feet at right, relaxed limbs and closed eyes, SAME body length as upright body height. Non-gory, no blood, no disappearance.' if humanoid else
            'LEFT: hit reaction recoiling with body hunched and legs tucked. RIGHT: fallen body lying on its side, limbs relaxed, same body length, no blood, no gore, no particle effects.')
        for pair, prompt, frames in [('stance',stance,['idle','absorb' if e['kind']=='mage' else 'alert']),('run',run,['run-a','run-b']),('action',attack,['cast-windup','cast-release'] if e['kind']=='mage' else ['attack-windup','attack-release']),('injury',injury,['hit','death'])]:
            items.append({'id':'figure-'+e['id']+'-'+pair,'entity':e['id'],'pair':pair,'frames':frames,'prompt':'IDENTITY: '+e['design']+'\nPOSES: '+prompt})
    write(ART/'a3-roster-v1.json',{'version':'a3-roster-v1','entities':entities,'enemy_source_sha256':sha(ROOT/'docs/design/baseline-fourteen-nights/design/data/enemies.json'),
        'ai_mages':'reuse four school atlases; competence does not change appearance','echo':'excluded: season plan removes Echo; baseline prescribes player shadow tint, no image'})
    write(ART/'briefs/a3-v1.json',{'version':'a3-v1','wave':'A3','description':'Oblique 55-degree paired key poses. Text-conditioned originals; extracted alpha and procedural effects are separately disclosed. Owner review only.',
        'proof_item':'figure-cassia-stance','common':common,'camera_sha256':sha(ART/'CAMERA-OK.md'),'scale_sha256':sha(ART/'scale-contract-v1.json'),'items':items})
    budget=read(ART/'budget.json');budget['target_images']=149
    budget['a3_authorization']='Owner third ART session: 89 spent, about 60 new images, hard cap 180. 48 planned sources plus up to 12 corrections. All prior charges and stop latch preserved.'
    write(ART/'budget.json',budget)


if __name__=='__main__':main()
