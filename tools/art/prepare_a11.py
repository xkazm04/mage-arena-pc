"""Prepare immutable generation backlog; deliberately does not invoke providers."""
from common import ART,read,write
from session6 import brief,ref
bible=read(ART/'style-covenant.json')
refs=[ref('art/review/sources/a5b-ui-ornament-proof-agy-a01.png','existing Covenant UI painted material, worn silver and quiet recessed surfaces'),
      ref(bible['references']['moonchalk-tempest-portrait']['path'],'approved selective highlights and sculpted painted volume')]
common=bible['style_block']+' No names, labels, text, watermark or franchise references. Original designs only.'
specs=[]
specs.append(brief('A11','stat-painting-proof',common+'''
ONE proof sheet, exactly THREE columns and ONE row with THREE complete isolated painted stat symbols on flat MAGENTA #FF00FF. Wide blank gutters and outer margins; every symbol fits middle 65 percent of its cell. No panel lines or shadows outside symbols.
Left GOLD: three thick stacked worn gold coins, original crescent-and-small-diamond relief, rich physical hammered edges, no letters or numbers.
Centre REPUTATION: open worn-silver laurel clasp around a cool blue mineral seal, tall central four-point glint carved in the seal. Distinct open wreath silhouette.
Right FATIGUE: short spent ivory candle with irregular melted sides, dark recessed wick, tiny bent guttering amber flame, shallow worn metal drip dish. No skull, person or injury.
Rich hand-painted material at physical edges and broad quiet body surfaces. These must read at 32 pixels in a header and retain fine detail at 128 pixels. Not smooth vector icons or procedural bevels. Largest native output. Same light from upper left and consistent apparent size across all three symbols.''',refs,True,providers=['agy','grok'],aspect_ratio='3:1',submission_status='blocked-both-provider-latches'))
specs.append(brief('A11','tideglass-painted-states',common+'''
ONE sheet, TWO columns by TWO rows, FOUR matching circular inner clock paintings on flat magenta. Wide empty gutters. Same size, camera and composition in all four cells. No frame, dial ticks, pointer, UI labels or numbers: only the round interior diorama with transparent/magenta exterior.
Original ritual water-clock basin, quiet dark sculpted stone lower bowl, worn metallic edges, luminous turquoise water and sparse natural mist. Fine silver light catches water ripples. Beyond the bowl is a tiny distant ruined wardstone skyline, broad quiet sky, finely painted natural light.
Top-left DAWN: warm pale sun low left, cool blue and faded amber sky. Top-right MIDDAY: pale sun high centre, subdued blue sky. Bottom-left DUSK: low amber sun right, plum shadow and warm horizon. Bottom-right NIGHT: small silver crescent high right, very sparse stars and blue-black sky.
Same bowl geometry in all states. Physical painted depth and subtle weathered material, not flat polygon mountains or smooth icon diagrams. Keep all glow inside the circular artwork and away from cell margins. No text or people.''',refs+[ref('art/delivery/a11/clock-contact.png','authored design arrangement only; improve to Covenant painted fidelity')],providers=['agy','grok'],aspect_ratio='1:1',submission_status='blocked; after stat proof passes gates'))
specs.append(brief('A11','tideglass-independent-layers',common+'''
ONE square sheet, exactly THREE columns and TWO rows of SIX independent clock components on uniform magenta. Every whole object centered in its own cell with broad blank margins. All share the same front-facing circular clock design and light. No letters, text, numbers or panels.
Row 1: a complete worn silver ring rim with sparse original non-letter engravings and EMPTY magenta centre; a complete dark shallow round stone basin with physically recessed lower reservoir and EMPTY upper interior; a small elongated faceted turquoise hour bead with silver setting.
Row 2: an isolated low luminous turquoise WATER SURFACE in a shallow curved bowl shape with no physical bowl around it; a thin elliptical water meniscus with bright irregular edge and transparent/magenta centre; a sparse natural pale blue mist curl with all wisps contained.
Physical hand-painted metal, stone, water and light, quiet rich volume, selected fine highlights, no smooth procedural bevels or cartoon outlines. No clock hands, backgrounds, labels or scenery. These separate layers will be clipped, translated and rotated by the game.''',refs,providers=['agy','grok'],aspect_ratio='1:1',submission_status='blocked; after stat proof and clock-state review'))
write(ART/'waves/A11/generation-backlog.json',{'status':'blocked-before-first-proof','newCalls':0,
 'reason':'agy anomaly latch and Grok HTTP 429 latch both retained; local remainder is not provider availability',
 'briefs':[s['id'] for s in specs],'continuation':'Only after a legitimate provider availability/latch resolution, submit one stat proof, run existing pixel/local/direct gates, then serial follow-ups. Never infer approval from this plan.',
 'owner_accepted':False})
