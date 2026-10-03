from common import ART,read,write
from covenant import jobs,review
j=jobs('A13')[0]
review(j,'Rejected: the BIND glyph resembles a numeral 3, SEVER reads as paired S letters and ENDURE resembles an E. Twelve separated, softly painted cells are present, but these letter-like silhouettes defeat the original semantic alphabet. A bounded corrective proof will change those silhouettes and deepen chipped brush texture.','reject')
s=read(ART/'briefs/a13/glyph-proof.json')
s['correction_of']=j['id']
s['prompt']=s['prompt'].replace('BIND two unequal hooked strokes cupping a dark cleft','BIND a flattened seed husk with two short offset roots and a torn opening across its belly').replace('SEVER two torn hooked ends pulling apart with a jagged gap','SEVER a split seed husk torn diagonally into two jagged shell shards with a small falling chip between them').replace('ENDURE a heavy bent root supporting a short floating stroke','ENDURE a low knotted root mass with a single upward crooked shoot and two short downward fibres')
s['prompt']+=' Critical correction: abstract botanical or mineral incisions, NEVER shapes resembling Latin letters (especially S, E, M, B), digits or paired repeated letterforms. Deepen irregular chipped pigment, brushed highlights and uneven scarred edges. Avoid uniformly beveled polished icon styling. Inspect the design mentally before the SINGLE generation call; no extra generation or retry.'
write(ART/'briefs/a13/glyph-proof-v2.json',s)
