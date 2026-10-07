"""Author the AU2b briefs offline. Does not generate audio or open a budget."""
import json
from pathlib import Path

samples=[]
def add(id,category,direction,philosophy,prompt,seconds,kind='sfx',optional=False):
    assert kind != 'sfx' or len(prompt)<=450, (id,len(prompt))
    samples.append(dict(id=id,category=category,direction=direction,philosophy=philosophy,prompt=prompt,seconds=seconds,kind=kind,optional=optional))

families=[
 ('A-pressure-wall','A · Pressure wall','Compressible air: a fast turbulent energy mass brakes against a dense pressure barrier.',
  'An energy projectile hits a dense air barrier: immediate broad pressure impact, turbulent rushing air compresses and slows heavily into a strained low wind rumble.',
  'NORMAL: resistance drags the incoming force to a heavy contained stop; air folds inward and dies.',
  'PERFECT: a firmer, cleaner arrest of the same rushing pressure, then one brief outward decompression burst as captured force is released.'),
 ('B-undertow','B · Undertow','Liquid shear: a forceful current is caught by a wall of water and loses momentum under pressure.',
  'An energy projectile strikes a dense water barrier: a heavy fluid slap, churning water forced through a narrowing throat, dense underwater turbulence slowing under immense resistance.',
  'NORMAL: the rushing current thickens, brakes and closes inward with a short wet pressure decay.',
  'PERFECT: the same current arrests more cleanly and decisively, then releases in one short coherent outward jet with a natural spray tail.'),
 ('C-mineral-drag','C · Mineral drag','Granular friction: energy is arrested by a resisting wall of compressed sand and stone.',
  'An energy projectile hits a barrier of compressed sand and stone: weighty contact, a fast gritty shear slowing into a deep strained mineral grind as the barrier arrests the energy.',
  'NORMAL: sustained friction brakes the force to a dense closed stop; grains settle inward.',
  'PERFECT: the same grit locks in a stronger precise catch, then stored pressure vents outward once in a tight dry gust of mineral dust.')]
for id,direction,idea,base,normal,perfect in families:
    for outcome,ending,seconds in [('normal',normal,2),('perfect',perfect,2.5)]:
        add('absorb-'+id+'-'+outcome,'Absorb / perfect absorb',direction,idea,
            base+' '+ending+' One physical event. No music, voice, bell, chime, boing, cartoon or UI alert.',seconds)

add('title-C-reed-standard','Title / menu','C · Reed standard','The public, solemn melodic bearing of Reed oath, slowed in feeling without becoming camp folk music.',
    'Original instrumental title theme for a brutal Roman-era elemental arena. Thirty seconds, 96 BPM in 4/4 with a spacious half-time feel. A clear double-reed solo sings a memorable five-note rising and falling Dorian melody from the first second; low bowed strings and one restrained hide drum support its grave ceremonial bearing. Calm resolve and latent danger, a broad stone-hall acoustic, dignified melodic foreground. At 0-10 seconds state the full tune; at 10-20 answer it with a quiet low-string counterline; at 20-30 return the melody with a changed ending and a poised sustained close. Restrained dynamics, no battle climax. This is an arena title melody with real thematic development. No rustic camp idyll, breath-flute noodling, ambient drone-only texture, choir, vocals, bells, modern drum kit or electronic beat.',30,'music')
add('title-D-lyre-vow','Title / menu','D · Lyre vow','The distinct descending lyre melody of Lyre under iron becomes a poised ceremonial title statement.',
    'Original instrumental title theme for a Roman-era arena of captive elemental mages. Thirty seconds, 96 BPM in 4/4, calm and deliberate with long breathing phrases. Muted gut-string lyre prominently carries a memorable syncopated descending four-note modal melody with an upward answering phrase; a warm bowed viola only answers phrase endings. Deep sustained strings and widely spaced hide-drum strokes give public ceremonial weight. At 0-10 seconds establish the tune immediately; at 10-20 vary its rhythm over moving low strings; at 20-30 give the complete melodic answer and a restrained resolved ending. Noble tension and calm human defiance, not pastoral comfort. Keep the plucked tune clear and composed, not decorative arpeggios. No camp folk miniature, flute, singing, choir, bells, modern drum kit, electronic beat or battle crescendo.',30,'music')
add('roll-C-sand-plant','Roll','C · Sand plant','One planted sand step; the onset liked in round 2, with no follow-up contact.',
    'Exactly ONE close dry footstep in loose arena sand. A leather sole plants once with a compact weighty sandy crunch and a short grainy settling tail. Immediate onset. One contact only, then silence. No second step, shuffle, bounce, landing, cloth flap, voice, music or other event. Isolated natural sand foley.',0.7)
add('roll-D-sand-cut','Roll','D · Sand cut','One continuous lateral dodge scuff; all motion belongs to the same sand contact.',
    'Exactly ONE short lateral dodge scuff in dry arena sand. One weighted leather sole catches and drags sideways in a single continuous gritty scrape, grains spraying and settling directly from that same contact. Immediate onset, then silence. No second step, separate landing, bounce, cloth flap, voice or music. Natural sand foley.',0.8)
add('crowd-C-hungry-terraces','Crowd','C · Hungry terraces','Near terraces: rough individual throats inside an irregular, menacing human mass.',
    'Three seconds of a raw blood-hungry colosseum crowd demanding a brutal fight. Rough adult throats bellow, snarl and shout wordlessly, close hoarse voices against a dense terrace roar, irregular feet pounding stone. Aggressive anticipation and menace, not celebration. Natural open stone amphitheatre reflections. No football or soccer chants, synchronized slogan, singing, melody, whistles, applause, PA announcer or music.',3)
add('crowd-D-stamping-bowl','Crowd','D · Stamping bowl','The whole stone bowl answers in a deep predatory roar with chaotic stamping.',
    'Three seconds inside a vast brutal colosseum: a hungry mass of rough adult voices surges into a deep predatory roar, ragged angry yells above it and heavy irregular stamping through the stone stands. Raw bloodlust at a violent arena spectacle, threatening and impatient. Wide human wall with natural stone reflections. No sports cheer, soccer chant, unison rhythm, singing, whistles, clapping, announcer, drums or music.',3)
add('collar-C-stone-latch','Collar rune','C · Stone latch','Optional alternative to kept Stone Waking: a compact release of mineral restraint.',
    'One collar rune unlocking: a tiny heavy stone latch releases under pressure with a crisp mineral tick, a short gritty stone-body vibration and a breath of escaping pressure. Compact, tactile, ancient and physically grounded. One event, dry close detail. No bell, chime, melody, UI alert, voice, music or repeated ticks.',1,optional=True)

refs=['arena-A-hide-and-iron','arena-C-reed-oath','arena-D-lyre-under-iron',
      'fire-A-wounded-matter','water-B-bound-radiance','earth-B-bound-radiance','voice-A-george',
      'air-B-hollow-vortex','air-B2-hollow-vortex-sustained',
      'camp-A-day','camp-A-dusk','camp-A-night','hit-A-hide-and-slate','impact-A-hide-and-slate',
      'collar-B-stone-waking',*[f'ui-B-{n}' for n in ('click','confirm','deny','slot','tab')],
      'fire-kept-variation','water-kept-variation']
plan={'wave':'AU2b','round':'r3','capCredits':3000,'references':refs,'samples':samples,
      'note':'References are original bytes. AIR B original and sustained repair are both retained under the owner-kept family; no separate file-level vote is invented. Optional collar is last.'}
Path(__file__).with_name('audition-plan-r3.json').write_text(json.dumps(plan,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print(json.dumps({'samples':len(samples),'estimatedCredits':sum(s['seconds']*(30 if s['kind']=='music' else 20) for s in samples)}))
