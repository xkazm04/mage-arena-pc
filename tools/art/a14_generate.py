"""Explicit, serial A14 calls. One proof before siblings; no automatic repair."""
import argparse
from common import ART,ROOT,read,write,sha,relative
from providers import generate

def make(entity,direction,kind='reaction',pilot=False,provider='agy',revision=None):
    bible=read(ART/'style-covenant.json');design=read(ART/'covenant-battle-roster.json')['entities'][entity]
    refs=[ART/'waves/A14/references'/f'{entity}-{direction}.png',ROOT/bible['references']['moonchalk-tempest-portrait']['path']]
    endpoint=ART/'waves/A14/references'/f'{entity}-{direction}-ground.png'
    if kind=='collapse' and endpoint.exists():refs.append(endpoint)
    facing=('REAR-RIGHT three-quarter view, head and torso facing diagonally AWAY from viewer and toward image RIGHT, back surfaces visible' if direction=='ne' else
            'FRONT-RIGHT three-quarter view, head and torso facing diagonally TOWARD viewer and image RIGHT, face and front surfaces clearly visible')
    creature=design['kind']=='creature'
    subject=('This is an ANIMAL ONLY. No human body, no clothes, no weapon or staff, no hands. Keep its exact creature anatomy. ' if creature else 'Keep the same face, headwear, clothes and single set of equipment. ')
    if entity=='hush_moth':subject+='Four moth wings, one thorax and two antennae. Reaction bends thorax and sweeps wings; collapse folds intact wings low against the ground. No human limbs. '
    if direction=='ne':subject+='For ALL poses the camera sees BACK surfaces. During collapse fall FORWARD AWAY from the camera, finally FACE-DOWN with the back uppermost and the face HIDDEN. Never turn to face the viewer, never roll onto the back. '
    if kind=='reaction':
        content=('Exactly FOUR columns and FOUR rows, 16 separate complete poses of ONE SAME character. Read left to right, top to bottom. '
        'Row 1: four keys of a QUICK FLINCH AND RECOVERY: 1 ready upright pose; 2 sharp unmistakable recoil with shoulders and head pulled BACK by one head-width and torso bent back 25 degrees; 3 shoulders returning and braced bent legs; 4 upright recovered ready pose. These four poses MUST visibly differ, not four standing duplicates. '
        'Row 2: first four keys of a BIGGER STAGGER: 5 upright ready; 6 abrupt backward bend of upper body; 7 deepest backward bend, arms pulled close, balance visibly lost; 8 lower body catches the weight, bent knees or legs. '
        'Row 3: 9 pushing back upright, visibly struggling; 10 upright recovered. Then begin COLLAPSE: 11 ready upright; 12 legs buckle and body drops. '
        'Row 4: continue COLLAPSE: 13 body very low, leaning toward ground; 14 torso falls sideways nearly horizontal; 15 body settles FULLY LYING on its side, head and entire torso on ground; 16 body completely still FULLY LYING ON GROUND, legs extended or naturally folded, equipment resting beside it. '
        'The final TWO poses must be completely horizontal resting bodies, never crouching, kneeling, sitting or getting back up. '
        'Treat collapse as a harmless theatrical fall/rest pose, fully intact. No blood, gore, wounds or injury detail. No attacker, impact flash or effects. ')
    elif kind=='collapse':
        content=('Exactly THREE columns by TWO rows, SIX complete sequential poses of this same figure collapsing. '
        'Row 1: 1 upright ready; 2 knees/legs buckle, torso drops; 3 body low and leaning to the ground. '
        'Row 2: 4 torso falls forward or sideways, nearly horizontal; 5 entire torso and head touch ground; 6 completely still fully LYING ON GROUND with equipment resting beside the body. '
        'Last pose must be fully lying, never sitting, crouching or kneeling. A harmless theatrical fall/rest, intact body, no blood, gore, wounds or injury detail. '
        'Each complete pose occupies ONLY HALF its spacious cell. Entire feet, staff and all equipment stay far from the image boundary. ')
    else:raise ValueError(kind)
    if creature and kind=='reaction':
        if entity=='hush_moth':
            content=('Exactly FOUR columns by FOUR rows, 16 complete poses of the SAME MOTH. '
            'Row 1 quick recoil: 1 hovering ready with four wings open; 2 thorax jerks back and wings sweep forward; 3 wings counter-sweep to catch balance; 4 hovering ready recovered. '
            'Row 2 heavy struggle first four keys: 5 hovering ready; 6 thorax bends sharply backward and wings crumple inward; 7 deepest thorax recoil, four wings visibly folded inward; 8 forceful low wing sweep catches descent. '
            'Row 3: 9 opening wings and lifting thorax; 10 recovered hover. Begin descent: 11 hovering ready; 12 loses lift and sinks, wings droop. '
            'Row 4 collapse: 13 thorax drops very low; 14 thorax contacts ground with wings half-folded; 15 abdomen and thorax REST FLAT on ground, four wings folded low beside them; 16 fully still resting moth, body and wings lying flat on ground. '
            'The last two keys cannot hover. Keep six fine insect legs, four intact wings, two antennae. No person, face, hands, human arms, weapon or garment. Intact non-graphic animal, no blood, gore or injury detail. ')
        else:
            content=('Exactly FOUR columns by FOUR rows, 16 complete QUADRUPED ANIMAL poses of this same creature. '
            'Row 1 quick flinch: 1 all four paws planted in animal ready stance; 2 head/neck pull sharply back and shoulders hunch; 3 crouched forelegs catch the recoil; 4 returns to ready. '
            'Row 2 heavy struggle first four keys: 5 four-paw ready; 6 neck jerks backward and spine arches, all four paws remain on ground; 7 deepest hunched back and head recoil, belly visibly compressed; 8 forelegs splay and hind legs bend to catch balance. '
            'Row 3: 9 pushes back up on all four legs; 10 recovered four-paw stance. Begin collapse: 11 four-paw ready; 12 legs fold and chest drops. '
            'Row 4 collapse: 13 belly and chest very low to ground; 14 animal tips onto its side; 15 head, belly and chest FULLY REST ON GROUND with legs folded or relaxed; 16 animal motionless LYING FLAT ON ITS SIDE, head on ground and four relaxed legs. '
            'No rearing on two legs, no biped stance, no human torso, arms or hands, no clothes, equipment or weapon. FOUR animal legs only. Last two poses must fully lie on the ground, never stand, sit or crouch. Intact non-graphic animal, no blood, gore or injury detail. ')
    prompt=('Use case: stylized-concept. Original painted game character ANIMATION SHEET on uniform vivid MAGENTA #FF00FF. '
        'Reference-1.png is the exact character identity and equipment reference. Reference-2.png is PAINTING STYLE ONLY, never copy its person, framing or pose. '
        +subject+design['design']+' '+facing+'. Maintain this anatomical view for every pose, including resting body; do not rotate a flat upright sprite. '
        'Camera elevated 55-degree orthographic, not eye-level. '+content+
        'Each equal cell contains ONE entire body at IDENTICAL anatomical scale. Each body and all equipment fit within middle 60% of the cell, including lying poses. Wide completely empty magenta gutters. '
        'No text, numbers, labels, panel borders, shadows, floor, scene, magic aura, extra figures or chopped anatomy. Do not let staff, tail, wing or foot cross a cell boundary. '
        +bible['style_block']+' Smooth opaque painted cloth and metal, rich physical volume, no heavy cartoon outline. Sheet aspect 1:1. Original designs only.')
    if len(refs)>2:
        prompt+=' Reference-3.png supplies the final LYING BODY posture only: torso and head resting completely against ground. Keep reference-1 identity and requested rear view. Lay the staff down too. Use this fully grounded endpoint to guide the last two keys, no hovering or propping torso up.'
    spec={'wave':'A14','id':f'{entity}-{direction}-{kind}','pilot':pilot,'style_hash':sha(ART/'style-covenant.json'),
        'providers':[provider],'aspect_ratio':'1:1','references':[{'path':relative(p),'sha256':sha(p),'role':['identity','Moonchalk painting bar','lying posture endpoint'][i]} for i,p in enumerate(refs)],'prompt':prompt,'entity':entity,'direction':direction,'kind':kind,'grid':[3,2] if kind=='collapse' else [4,4],
        'referenceConsumption':'agy receives both image references; Grok wrapper consumes first identity image only, Covenant style block is textual'}
    if revision:
        old=[j for j in read(ART/'usage.json')['jobs'] if j.get('wave')=='A14' and j['scene']==spec['id']]
        spec['correction_of']=old[-1]['id'];spec['prompt']+=' CORRECTION: '+revision
    write(ART/'briefs/a14'/(spec['id']+('-revision' if revision else '')+'.json'),spec)
    return spec

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('entity');p.add_argument('direction');p.add_argument('--provider',default='agy');p.add_argument('--kind',default='reaction');p.add_argument('--pilot',action='store_true');p.add_argument('--revision');a=p.parse_args()
    snapshot=read(ART/'waves/A14/start-snapshot.json');usage=read(ART/'usage.json')
    if sum(j['charged_images'] for j in usage['jobs'])-snapshot['charged']>=snapshot['sessionImageCap']:raise RuntimeError('SESSION_CAP')
    generate(make(a.entity,a.direction,kind=a.kind,pilot=a.pilot,provider=a.provider,revision=a.revision))
