"""Author AU2 briefs offline. Owner CHOICES.md outranks the original bible."""
import json
from pathlib import Path

samples=[]
def add(id,category,direction,philosophy,prompt,seconds,kind='sfx',priority=2):
    samples.append(dict(id=id,category=category,direction=direction,philosophy=philosophy,prompt=prompt,seconds=seconds,kind=kind,priority=priority,scope='AU2-audition' if priority<3 else 'optional-kept-cast-variation'))

arena='Original Roman-era elemental arena instrumental. A dramatic entrance of one deep hide drum and tense bowed low strings, then restrained hide-and-iron percussion beneath a clearly audible, memorable melodic phrase. The melody must begin within the first two seconds and repeat with a small answering variation; do not deliver a texture-only drone. Leave space for combat. No singing, choir, modern drum kit or electronic dance beat. 96 BPM, 4/4 requested. Twenty-second style sketch, keep musical movement alive through the end. '
add('arena-C-reed-oath','Arena music','C · Reed oath','The kept dramatic entrance, with a breathy reed carrying a winding minor melody.',arena+'A soft double-reed solo plays a five-note rising then falling Dorian melody above the drums. It is a subtle intimate instrument, clearly identifiable in the midrange, answered by two plucked lyre notes. Dark courage, restrained menace, melodic rather than bombastic.',20,'music',1)
add('arena-D-lyre-under-iron','Arena music','D · Lyre under iron','A plucked, syncopated melody inside the same hide-and-iron dramatic family.',arena+'A muted gut-string lyre carries a distinct syncopated descending four-note melody, repeating and resolving upward on its answer. Bowed viola quietly doubles only the phrase ending. Percussion opens space for the little plucked instrument to be heard. Human defiance, tightly contained energy.',20,'music',1)

air='Two-second magical air cast: continuous turbine-like rotating wind, subtle but PRESENT from the first instant through the entire two seconds. Steady airy body and pitched magical edge until the last 50 ms. No one-shot, silence, impact, voice or music. '
for letter,name,detail in [
 ('A','silk-rotor','Silky high-speed airflow with a soft stable midrange harmonic slowly bending upward. Smooth and fine-grained, no machine rattle.'),
 ('B','hollow-vortex','Hollow midrange turbine wind in a resonant stone throat, a quiet luminous fifth above. Soft flutter inside an uninterrupted airy body; not bass-only.'),
 ('C','spiral-filament','Fine fast spiralling turbine hiss with two close whistling magical partials gently beating. Slight brightness, no shriek; a steady narrow wind stream.')]:
    add(f'air-{letter}-{name}','Cast · air',f'{letter} · {name.replace("-"," ").title()}','Sustained turbine body replaces the rejected short snap and empty tail.',air+detail,2,priority=1)

# Follow-up to measured early fades in B/C. Preserve the first attempts and make
# the failed control explicit; loop=true is a generation parameter, not DSP repair.
for letter,name,detail in [('B','hollow-vortex','Hollow resonant midrange wind in a stone throat with a soft luminous fifth above.'),('C','spiral-filament','Fine spiralling turbine hiss with two close magical whistling partials gently beating.')]:
    add(f'air-{letter}2-{name}-sustained','Cast · air',f'{letter} · {name.replace("-"," ").title()}','Second attempt after the first faded early: continuous generator loop, no postprocessing.',f'Seamless two-second loop of a steady magical turbine wind. Constant subtle but clearly present airflow from the first sample through the last, same strength at both ends, no attack or decay. {detail} An uninterrupted rotating air column, not a whoosh or an impact. No silence, voice, music or harsh machinery.',2,priority=1)
    samples[-1]['loop']=True
    samples[-1]['scope']='AU2-envelope-repair'

for letter,name,material in [
 ('A','warm-rune','a warm rounded bronze-bowl magical tone over a soft leather-tension catch'),
 ('B','liquid-prism','a clear liquid-glass magical note above a soft cushioned inward water curl'),
 ('C','hushed-orbit','a velvety resonant ceramic tone with a fine airy harmonic above a soft inward pressure catch')]:
    common=f'One gentle two-second magical shield catch: {material}. Satisfying soft tactile onset and clear magical pitch. No crack, explosion, distortion, voice or music. '
    add(f'absorb-{letter}-{name}-normal','Absorb',f'{letter} · {name.replace("-"," ").title()}','Normal closes inward on a clear magical note; perfect opens into a small consonant reward.',common+'NORMAL: curl inward, settle on one rounded note with a soft closing pulse and short resonant tail. Calm contained capture, single pitch, no reward flourish.',2,priority=1)
    add(f'absorb-{letter}-{name}-perfect','Absorb',f'{letter} · {name.replace("-"," ").title()}','Normal closes inward on a clear magical note; perfect opens into a small consonant reward.',common+'PERFECT: cushioned catch opens immediately into two consonant rising notes, root then fifth, and warm luminous bloom. A satisfying reward, brighter through harmony, not loudness. Gentle ringing finish.',2,priority=1)

for letter,name,instruments in [
 ('A','thread-and-reed','Intimate gut-string lyre and soft breath flute, sparse human phrasing and quiet low bowed string support'),
 ('B','shadow-and-bow','Soft bowed viola and plucked low strings, an exposed memorable melody with a tiny resonant ceramic-bell answer')]:
    for time,mood in [('day','DAY: fragile warmth under restraint; a gently rising modal phrase, a light slow pulse and room for conversation.'),('dusk','DUSK: the same family grows bittersweet; a descending answer, wider spaces and a low unresolved note.'),('night','NIGHT: secretive and still, a few separated melodic notes with a quiet distant sustained answer; no horror drone or jump scare.')]:
        add(f'camp-{letter}-{time}','Camp music',f'{letter} · {name.replace("-"," ").title()}','Three times of day in one restrained instrumental family; sketches, not seamless beds.',f'Original instrumental music for a guarded Roman-era camp of captive mages. {instruments}. {mood} Twelve seconds with an audible melodic phrase starting immediately. Modest ensemble, no big cinematic percussion, no choir or voice, no spell effects. Hold the established texture to the end rather than fading to silence. A musical style sketch, not a trailer.',12,'music')

add('title-A-unbroken-thread','Title / menu','A · Unbroken thread','A quiet statement of the plucked melodic family.', 'Original ten-second instrumental title-menu theme for captive elemental mages in a Roman world. A muted lyre states a memorable five-note minor melody from the first second, a quiet breath flute answers, and a warm bowed low string leaves the last harmony open. Dignified resolve with sadness, a small human ensemble. Hide drum only once very softly at the opening. No choir, voice, huge trailer percussion or final crash.',10,'music')
add('title-B-oath-in-stone','Title / menu','B · Oath in stone','A bowed melody connects the camp’s restraint with arena resolve.', 'Original ten-second instrumental title-menu theme for captive elemental mages in a Roman world. A soft solo viola immediately sings a simple rising four-note Dorian melody above a low lyre ostinato, answered by one quiet breath flute note. Tense dignity, open space, a restrained hint of dramatic hide-and-iron arena rhythm. No singing, choir, trailer riser or explosive ending.',10,'music')

for letter,name,hit,impact in [
 ('A','hide-and-slate','A compact padded leather-and-linen body hit with a low soft weight and quick cloth compression; physical damage, no magical chime.','One hard slate impact: a dry stone knock, two small chips and a tight grounded low body.'),
 ('B','bronze-and-dust','A close wrapped-armour body hit, muted bronze under thick cloth, short downward pitch and a soft breathless thump, no human voice.','One hard impact against worn masonry and bronze: a crisp hollow tick into sandy falling fragments, short and spatially compact.')]:
    for event,prompt in [('hit',hit),('impact',impact)]:
        add(f'{event}-{letter}-{name}','Hit / impact',f'{letter} · {name.replace("-"," ").title()}','Body damage falls and closes; world collision leaves material fragments.',prompt+' One isolated event at the start, natural short decay within 1.5 seconds, no music, voice, gunshot, repeated strikes or excessive sub bass.',1.5)
for letter,name,prompt in [
 ('A','bronze-unbinding','One collar rune tier unlock: a tiny dry bronze pin release immediately followed by a clear warm rune note, a brief upward opening resonance. Grounded and magical, quieter than a perfect absorb, distinctly fuller than UI slot select.'),
 ('B','stone-waking','One collar rune tier unlock: a small mineral latch clicks open and a smooth hollow ceramic harmonic gently brightens upward. A concise magical awakening, not a warning alarm or damage sound.')]:
    add(f'collar-{letter}-{name}','Collar rune',f'{letter} · {name.replace("-"," ").title()}','One actual tier release; tonal but smaller than the perfect reward.',prompt+' One isolated one-second cue, immediate onset and natural decay, no voice or background music.',1)
for letter,name,prompt in [
 ('A','linen-and-grit','One agile human roll over dry arena sand: fast linen and leather sweep, soft body weight and a brief gritty sandal scuff, one continuous movement.'),
 ('B','cloak-and-stone','One quick human dodge roll across dusty stone: a tight coarse-cloak swish, muted shoulder contact then a light two-grain scraping finish, one continuous movement.')]:
    add(f'roll-{letter}-{name}','Roll',f'{letter} · {name.replace("-"," ").title()}','Physical movement; no teleport or magical success cue.',prompt+' Immediate start, complete in 1.5 seconds. No voice, music, magic, repeated rolls or dramatic boom.',1.5)
for letter,name,prompt in [
 ('A','stone-bowl','A distant Roman arena crowd gives one broad wordless roar of approval, human voices spread across stone terraces. A restrained rising mass then settling murmur, diffuse open air, no individual intelligible words.'),
 ('B','low-thunder','A distant Roman arena crowd reacts with a compact collective breath of astonishment opening into a low warm cheering roar, layered across a wide space. Human nonverbal mass, not angry shouting.')]:
    add(f'crowd-{letter}-{name}','Crowd',f'{letter} · {name.replace("-"," ").title()}','Distant event swell leaves the player’s immediate feedback clear.',prompt+' Three seconds, no sports chant, whistle, announcer, applause rhythm, music or modern stadium horn.',3)

for letter,name,material in [('A','cut-bronze','dry worn bronze and slate, tactile and rounded'),('B','rune-ceramic','soft tuned ceramic with a restrained magical mineral overtone, rounded and clear')]:
    for event,shape in [('click','one tiny muted contact, single and dry'),('confirm','two tiny settling contacts with a gentle upward harmonic answer, affirmative'),('deny','one damped downward contact that closes, informative and gentle, never a harsh buzzer'),('slot','one very small precise tick with a short quiet ring, weaker than confirm or collar unlock'),('tab','a short soft slate-and-cloth slide into a muted stop, quieter than confirm')]:
        add(f'ui-{letter}-{event}','UI',f'{letter} · {name.replace("-"," ").title()}','Five independent cues share one material family; repetition comfort needs owner listening.',f'One isolated fantasy game interface {event} sound: {material}; {shape}. Exactly one brief gesture at the start of a half-second file, ending cleanly. Subtle and comfortable for repeated use. No voice, music, bass boom, extra sequence or computer beep.',0.5)

for school,direction,prompt in [
 ('fire','Kept fire A variation','One authentic fire spell cast: resin ignites with a compact dry snap, a small furnace breath drives forward and ember grit quickly settles. Tangible heat and power; avoid a generic explosion or electronic laser.'),
 ('water','Kept water B variation','One mysterious magical water cast: a clear tiny droplet attack opens into circling liquid-crystal harmonics and a coiling mist ribbon. Audible magical pitch woven through real liquid movement; not a rock dropping into a lake.'),
 ('earth','Kept earth B variation','One magical earth cast: a compact mineral crack opens into resonant stone partials and a few hovering grains, protective grounded body with an uncanny harmonic glow. No huge earthquake or exploding debris.')]:
    add(f'{school}-kept-variation','Kept cast variations',direction,'One extra take within the selected family, only after all mandatory categories.',prompt+' One isolated two-second event, immediate readable onset, natural short decay, no voice or music.',2,priority=3)

out=Path(__file__).with_name('audition-plan-r2.json')
for sample in samples:
    if sample['kind']=='sfx' and len(sample['prompt'])>450:
        raise ValueError(f'{sample["id"]}: {len(sample["prompt"])} characters exceeds SFX limit')
out.write_text(json.dumps({'wave':'AU2','ownerAuthority':'docs/audio/CHOICES.md','references':['arena-A-hide-and-iron','fire-A-wounded-matter','water-B-bound-radiance','earth-B-bound-radiance','voice-A-george'],'samples':samples},indent=2)+'\n')
print(json.dumps({'samples':len(samples),'required':sum(s['priority']<3 for s in samples),'conservativeEstimate':sum(s['seconds']*(30 if s['kind']=='music' else 20) for s in samples)}))
