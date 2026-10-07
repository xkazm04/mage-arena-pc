"""Static owner board, actual A8 comparisons and combined contact sheet."""
import html
import json
import os
from PIL import Image,ImageDraw,ImageOps
from common import ART,ROOT,read,write,sha,relative
from covenant import font,jobs
from restoration_common import contact

OUT=ART/'review/a13';DELIVERY=ART/'delivery/a13'
def clip_image(manifest,ident,index=None):
    c=manifest['clips'][ident];i=index if index is not None else min(2,c['frameCount']-1)
    p=next(p for p in manifest['pages'] if p['id']==c['page']);x,y,w,h=c['frames'][i]['rect']
    return Image.open(ROOT/p['file']).crop((x,y,x+w,y+h))

def board():
    OUT.mkdir(parents=True,exist_ok=True);m=read(DELIVERY/'sigils.json');spend=read(DELIVERY/'spend.json')
    families={
     'casting':[(f'{e} / {p}',clip_image(m,f'cast.{e}.{p}',3 if p!='hold' else 2)) for e in ('fire','water','earth','air') for p in ('start','hold','release')],
     'threats':[(f'{e} / {s}',clip_image(m,f'threat.{e}.{s}')) for e in ('fire','water','earth','air') for s in ('ring','cone','line')]+[(n,clip_image(m,n)) for n in ('warning.normal','warning.unblockable')],
     'ward-status':[(n,clip_image(m,n)) for n in ('ward.hold','absorb.window','absorb.perfect','absorb.contact','selection','target','status.slowed','status.rooted','status.burning','status.wet','status.shielded','inscription.collar','inscription.wardstone','floor.verdigris','floor.rust-sand','floor.moonlit')]}
    for name,rows in families.items():contact(rows,OUT/f'{name}.jpg','A13 / '+name,4,(330,270))
    old=read(ART/'delivery/a8/effects.json');rows=[]
    for school in ('fire','water','earth','air'):
        rows.extend([(school+' / A8 geometric ring',clip_image(old,school+'.telegraph.ring')),
                     (school+' / A13 painted ring',clip_image(m,'threat.'+school+'.ring')),
                     (school+' / A8 geometric cone',clip_image(old,school+'.telegraph.cone')),
                     (school+' / A13 painted fan',clip_image(m,'threat.'+school+'.cone'))])
    rows.extend([('A8 painted barrier / no rune language',clip_image(old,'absorb.hold')),
                 ('A13 ward / canonical runes',clip_image(m,'ward.hold')),
                 ('A8 perfect flare',clip_image(old,'absorb.perfect')),
                 ('A13 perfect window',clip_image(m,'absorb.window'))])
    contact(rows,OUT/'a8-before-after.jpg','ACTUAL A8 ASSETS / A13 / authored comparison, not a game capture',4,(330,270))
    for palette in ('moonlit','verdigris','rust-sand'):
        a=Image.open(DELIVERY/'proofs'/f'{palette}-before-1080.png').convert('RGB');b=Image.open(DELIVERY/'proofs'/f'{palette}-arena-1080.png').convert('RGB')
        pair=Image.new('RGB',(3840,1080));pair.paste(a);pair.paste(b,(1920,0));pair.save(OUT/f'{palette}-before-after.jpg',quality=93)
    combined=[('The twelve shared painted radicals',Image.open(DELIVERY/'glyph-sheet.png'))]
    combined += [(p+' / A12 + A10 at 1.5x',Image.open(DELIVERY/'proofs'/f'{p}-arena-1080.png')) for p in ('moonlit','verdigris','rust-sand')]
    combined += [(name+' / generated paint, authored assembly',Image.open(OUT/f'{name}.jpg')) for name in families]
    combined += [('A8 geometry to A13 painted rune work',Image.open(OUT/'a8-before-after.jpg'))]
    contact(combined,OUT/'contact-sheet.jpg','A13 / THE BROKEN OATH / owner review candidates',2,(800,650))
    def url(path):return os.path.relpath(path,OUT).replace('\\','/')
    def card(title,path,note):
        return f'<article><h2>{html.escape(title)}</h2><a href="{url(path)}"><img loading="lazy" src="{url(path)}" alt="{html.escape(title)}"></a><p>{html.escape(note)}</p></article>'
    cards=[card('One rune language',DELIVERY/'glyph-sheet.png','Original generated paintings; canonical cutouts reused across all assets. Letter-like source warning excluded; the warning uses an authored ligature of painted splinters.')]
    cards += [card(p+' / 1080p, nominal 60.75 px bodies',DELIVERY/'proofs'/f'{p}-arena-1080.png','Standalone A12 plate composite. A10 bodies at 1.5x; A8 travel effect retained. Generated decals, authored assembly/fill/plate cleanup. No gameplay capture or owner acceptance.') for p in ('moonlit','verdigris','rust-sand')]
    cards += [card(name.replace('-',' / '),OUT/f'{name}.jpg','Painted source keys and canonical glyph inlays. Start/release, pulses, playback order and source registration are authored. Manifest distinguishes every derivation.') for name in families]
    cards += [card('Charge and UNBLOCKABLE',DELIVERY/'proofs/progress-1080.png','Always-visible full boundary; 0/25/50/75/100 percent fill. Ivory warning common to all schools; severed binding and paired teeth distinguish UNBLOCKABLE without relying on colour.'),
              card('Actual A8 textures versus A13',OUT/'a8-before-after.jpg','A8 ring/cone geometry is shown from its existing delivery, with its painted barrier separately labelled. A13 uses painted pigment and canonical runes.'),
              card('Floor replacement method',DELIVERY/'floor-cleanup-contact.jpg','Optional local Telea reconstruction removes old linework inside authored masks. This is inferred floor pigment, not generated painting. Faint old scratches and localized softening remain.')]
    cards += [card(p+' / renderer before and painted after',OUT/f'{p}-before-after.jpg','Left reproduces current geometric renderer logic from read-only integration commit 72d0fb7. Right is the A13 art consumer. Same plate, actor positions, larger figure scale and camera. Neither is a gameplay capture.') for p in ('moonlit','verdigris','rust-sand')]
    attempts=[];attempt_records=[]
    for j in jobs('A13'):
        r=read(ART/'waves/A13/reviews'/(j['id']+'.json'));g=read(ART/'grades'/(j['id']+'.json'))
        attempt_records.append({'job':j['id'],'source':j['archive'],'sha256':j['sha256'],'direct':r,'local':g})
        attempts.append(card(j['id']+' / '+r['verdict'],ROOT/j['archive'],r['note'])+f'<details><summary>Prompt and local diagnostic</summary><pre>{html.escape(json.dumps({"prompt":j["prompt"],"local":g},indent=2))}</pre></details>')
    css='body{margin:24px;background:#0c151e;color:#e2e5df;font:18px Georgia;line-height:1.5}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,620px),1fr));gap:24px}article{padding:18px;background:#142530}img{display:block;width:100%;height:auto}a{color:#a9dfe5}h1{font-size:38px}h2{font-size:24px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px monospace}nav{display:flex;gap:18px;flex-wrap:wrap}.note{padding:16px;background:#203333}table{border-collapse:collapse}td,th{padding:8px;border:1px solid #476064}'
    base='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style>'
    (OUT/'attempts.html').write_text(base+'<title>A13 attempt archive</title><h1>A13 / every generated attempt</h1><p><a href="index.html">Owner board</a>. Rejected work stays rejected. The agy extra-call anomaly and its two charges are in <a href="../../delivery/a13/spend.json">spend</a> and <a href="../../waves/A13/provider-final-audit.json">scoped evidence</a>.</p><main>'+''.join(attempts)+'</main></html>',encoding='utf-8')
    links='<nav><a href="motion.html">Live motion + progress</a><a href="contact-sheet.jpg">Combined contact sheet</a><a href="../../delivery/a13/RUNIC-LANGUAGE.md">Rune language</a><a href="../../delivery/a13/README.md">Loader contract</a><a href="../../delivery/a13/sigils.json">Manifest</a><a href="attempts.html">All attempts</a></nav>'
    native='<p>Full-size 1440p composites: '+', '.join(f'<a href="../../delivery/a13/proofs/{p}-arena-1440.png">{p}</a>' for p in ('moonlit','verdigris','rust-sand'))+'.</p>'
    summary=f'<p class="note">44 animated/static clips, 305 frame references, twelve canonical radicals. Generated painting is distinct from authored glyph placement, UV mapping, masks and playback. Owner review pending; local models can only reject or route.</p><p>{spend["sessionCharges"]} charged images this session; {spend["projectCharges"]}/{spend["combinedCap"]} project total. agy is latched after an extra internal image call; Grok is clear. No reset, refund or push. Actual shared-account allowance is unknown.</p>'
    evidence='<p><a href="../../delivery/a13/checks.json">Integrity checks</a> · <a href="../../delivery/a13/browser-check.json">Browser checks</a> · <a href="../../delivery/a13/spend.json">Spend</a> · <a href="../../delivery/a13/source-gates.json">Source/crop/registration gates</a> · <a href="../../waves/A13/before-renderer.json">Before renderer evidence</a></p>'
    evidence+='<p><a href="../../delivery/a13/portable-check.json">74-product offline rebuild</a> · <a href="../../SESSION-8-HANDOFF.md">Session handoff</a></p>'
    limits='<p>The hold contours share a common painted construction; motion lives chiefly in glints and elemental tips. Glyph and modifier readability, floor cleanup softness and combat overlap still require owner judgment. A10 incomplete direction coverage is inherited. No game FPS, balance or owner feel is claimed. The current game loader needs the projection/progress adaptation in the contract.</p>'
    (OUT/'index.html').write_text(base+'<title>A13 · The broken oath</title><h1>A13 / The broken oath</h1><p>Sigils and telegraphs as Covenant art.</p>'+links+summary+native+evidence+limits+'<main>'+''.join(cards)+'</main></html>',encoding='utf-8')
    write(OUT/'manifest.json',{'wave':'A13','attempts':attempt_records,'ownerAccepted':False,'contactSheet':relative(OUT/'contact-sheet.jpg')})
    print('A13 owner board and combined contact sheet built.')

if __name__=='__main__':board()
