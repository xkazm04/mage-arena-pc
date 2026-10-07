"""Static owner evidence board; all full-resolution comparisons remain one click away."""
import html
from common import ART,read,write

def build():
    out=ART/'review/a12';m=read(ART/'delivery/a12/arena-plates.json');spend=read(ART/'delivery/a12/spend.json')
    sections=[];rows=[]
    for palette,p in m['palettes'].items():
        metric=read(ART/'delivery/a12/metrics'/f'{palette}.json');review=read(ART/'delivery/a12/reviews'/f'{palette}.json')
        ocr=read(ART/'delivery/a12/ocr'/f'{palette}.json');vision=read(ART/'delivery/a12/semantics'/f'{palette}.json')
        proofs=[]
        for h in (1080,1440):
            proofs.append(f'''<div class="proof"><h3>{h}p · actual pixels</h3>
<a href="../../delivery/a12/proofs/{palette}-comparison-{h}.png"><img loading="lazy" src="../../delivery/a12/proofs/{palette}-comparison-{h}.png" alt="Approved concept and new {palette} plate, identical viewport dimensions"></a>
<p><a href="../../delivery/a12/proofs/{palette}-comparison-{h}.png">Full side-by-side</a> · <a href="../../delivery/a12/proofs/{palette}-native-crops-{h}.png">1:1 detail crops</a> · <a href="../../delivery/a12/proofs/{palette}-plate-{h}.png">Clean viewport</a> · <a href="../../delivery/a12/proofs/{palette}-composite-{h}.png">A10 + A8 composite</a></p>
<a href="../../delivery/a12/proofs/{palette}-native-crops-{h}.png"><img loading="lazy" src="../../delivery/a12/proofs/{palette}-native-crops-{h}.png" alt="Unscaled matching 640 by 352 pixel crops at {h}p"></a></div>''')
        occlusion=''.join(f'<a href="../../delivery/a12/proofs/{palette}-{o["id"]}-occlusion.png"><img loading="lazy" src="../../delivery/a12/proofs/{palette}-{o["id"]}-occlusion.png" alt="{o["id"]} behind and in front proof"></a>' for o in p['occluders'])
        peak=max(a['peak'] for a in metric['autocorrelation']['axes']);old=max(a['peak'] for a in metric['a9ControlAutocorrelation']['axes'])
        sections.append(f'''<section id="{palette}"><div class="eyebrow">SINGLE COHERENT PAINTING · OWNER REVIEW</div><h2>{palette.replace('-',' ').title()}</h2>
<p>{html.escape(review['observation'])}</p><a href="../../delivery/a12/proofs/{palette}-composite-1440.png"><img src="../../delivery/a12/proofs/{palette}-composite-1080.png" loading="lazy" alt="{palette} plate with real A10 characters and A8 effects"></a>
<p class="caption">Authored composition from actual delivery atlases, not a gameplay capture. Bodies: 40.5px at 1080p, 54px at 1440p. Existing effect sizes and blend modes are retained. <a href="../../delivery/a12/plates/{palette}.png">Full 3072×1728 master with overscan</a>.</p>
<div class="two">{''.join(proofs)}</div><details><summary>Measured drift, repetition, text and figure observations</summary>
<p>Mean encoded-luminance drift after whole-plate colour match: {metric['meanLuminanceDelta']:+.4f}. Repetition correlation: {peak:.3f}; A9 control: {old:.3f}. Former guide-boundary discontinuities: {'flagged' if metric['extensionSeams']['flag'] else 'none flagged'}. No assembled extension joins.</p>
<p>OCR: {len(ocr['detections'])} detections, {len(ocr['flagged'])} threshold flags. Local vision: {html.escape(str(vision.get('answers',{})))}. Model observations can miss content; they cannot approve the plate.</p>
<p><a href="../../delivery/a12/metrics/{palette}.json">Measurements</a> · <a href="../../delivery/a12/reviews/{palette}.json">Direct review</a> · <a href="../../delivery/a12/semantics/{palette}.json">Local vision</a> · <a href="../../delivery/a12/ocr/{palette}.json">OCR</a></p></details>
<details><summary>Foreground depth overlays and upscale comparison</summary><p>Exact RGB cut from the same final painting, traced silhouette alpha and measured foot line. Fixed in place; the base painting retains the same object. Sort these overlays with actors by world foot Y.</p>
<div class="two">{occlusion}</div><a href="../../waves/A12/upscaled/{palette}-upscale-comparison.png"><img loading="lazy" src="../../waves/A12/upscaled/{palette}-upscale-comparison.png" alt="Lanczos versus local learned restoration versus 35 percent blend"></a>
<p>Upscale comparison precedes the final whole-image colour match. Learned texture is inferred, not recovered detail. Native wide source: {p['provenance']['generatedNativeSize'][0]}×{p['provenance']['generatedNativeSize'][1]}; delivered master: 3072×1728.</p></details></section>''')
        rows.append({'palette':palette,'plate':p['file'],'sha256':p['sha256'],'review':review,'metrics':metric,'owner_accepted':False})
    attempts=[]
    usage=read(ART/'usage.json')
    for j in usage['jobs']:
        if j.get('wave')!='A12' or j['status']!='generated':continue
        review=read(ART/'waves/A12/reviews'/f'{j["id"]}.json')
        url='../../'+j['archive'].removeprefix('art/')
        attempts.append(f'<li><a href="{url}">{html.escape(j["id"])}</a> — {html.escape(review["verdict"]+": "+review["note"])}</li>')
    page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>A12 · Arena to reference</title>
<style>*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#0b131b;color:#e4e0d3;font:18px/1.6 Georgia,serif}header,main,footer{max-width:1560px;margin:auto;padding:32px}h1{font-size:clamp(38px,5vw,76px);line-height:1.1;margin:12px 0 20px}h2{font-size:40px;margin:8px 0}h3{font-size:22px}.eyebrow{font:13px Arial;letter-spacing:.16em;color:#b5c9c9}a{color:#a9d5ce}nav{display:flex;gap:20px;flex-wrap:wrap}img{width:100%;height:auto;display:block;background:#080d12}.lead,.notice{border-left:3px solid #bcab77;background:#15222a;padding:20px}.two{display:grid;grid-template-columns:1fr 1fr;gap:24px}.two>*{min-width:0}section{padding:36px 0;border-top:1px solid #415354}.caption{font-size:15px;color:#acbdc0}details{padding:15px 0}summary{cursor:pointer;color:#c5dbd1}li{margin:12px 0;overflow-wrap:anywhere}code{overflow-wrap:anywhere}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:10px;border-bottom:1px solid #415354}@media(max-width:800px){header,main,footer{padding:20px}.two{grid-template-columns:1fr}h2{font-size:30px}body{font-size:16px}}</style>
<header><div class="eyebrow">MAGE ARENA / ART SESSION 7</div><h1>Arena to reference</h1><nav><a href="#verdigris">Verdigris</a><a href="#rust-sand">Rust &amp; sand</a><a href="#moonlit">Moonlit</a><a href="contact-sheet.jpg">Contact sheet</a><a href="canvas-demo.html">Live camera / occlusion proof</a></nav>
<p class="lead">Three complete painted arenas, each guided by its approved A6 concept. Characters and combat effects removed; architecture, floor and atmosphere remain a single coherent scene. Native 1080p and 1440p comparisons below show the actual gap. Owner acceptance and game integration remain open.</p>
<a href="contact-sheet.jpg"><img src="contact-sheet.jpg" alt="Three palettes: approved A6, new clean plate, and A10 plus A8 composite"></a></header><main>
<p class="notice"><b>What is still below the reference:</b> all wide scenes were generated at 1376×768. The 3072×1728 masters use a restrained local upscale and whole-image palette match; they do not contain native 1440p detail. Fine cracks, rune shapes and some surface modelling differ from A6. Overscan architecture is inferred. Light is painted and does not react to moving figures.</p>
<p><b>Geometry:</b> the compact proposed arena is 94×62m, with a 102.4×70.3m plate and 20% view overscan. The inherited core is 192×144m: boundary/spawn migration is required. The current game checkout was not changed. <a href="../../delivery/a12/geometry.json">Exact geometry</a> · <a href="../../delivery/a12/arena-plates.json">Runtime manifest</a> · <a href="../../delivery/a12/README.md">Loader and integration notes</a>.</p>
'''+''.join(sections)+f'''<section><h2>Provider diagnosis and spend</h2><p>{spend['newImageReservations']} new images: {spend['newImagesByProvider']['agy']} agy, {spend['newImagesByProvider']['grok']} Grok. One additional historical charge corrects the recovered A10 worker evidence. Project total {spend['projectTotal']}/345. Provider guards: agy 400, Grok 330; real account balances and image money cost are unknown.</p>
<p>agy copied the same output to two filenames, but its old hidden worker also made three image calls. Both facts are preserved; exact-request-linked transcript monitoring now detects extra calls. Grok's one-image probe succeeded after the old HTTP 429. Old latches were archived and cleared under explicit owner authorization. Both providers are currently available under the local guards.</p>
<p><a href="../../delivery/a12/spend.json">Spend ledger</a> · <a href="../../waves/A12/provider-evidence/a10-brennic-north-agy-a01.json">Recovered agy evidence</a> · <a href="../../../docs/waves/A12-arena-plates.md">Design / decision note</a> · <a href="../../waves/A12/upscaling-tools.json">Upscale sources, licence and method</a></p>
<details><summary>All generated attempts and rejected trial</summary><ul>{''.join(attempts)}</ul><p><a href="../../waves/A12/rejected-masked-trial/contact-sheet.jpg">Rejected masked-cleanup trial</a>: uneven patch detail and residual embers. Numeric/local checks missed defects; direct review rejected it. None of that assembled repair enters the delivered plate.</p></details>
<details><summary>Moonlit A6 a01 was also inspected</summary><a href="../sources/a6-moonchalk-tempest-moonchalk-tempest-arena-a01.png"><img loading="lazy" src="../sources/a6-moonchalk-tempest-moonchalk-tempest-arena-a01.png" alt="Earlier approved moonlit a01 reference"></a><p>The active Moonchalk palette anchor is A6 a02, per the Covenant bible. A01's lighter sandy arena remains comparison evidence.</p></details></section>
</main><footer><p>Only the owner decides visual quality. The local grader may reject or route; deterministic checks inspect bytes, geometry and diagnostic signals. They cannot certify atmosphere, feel or absence of every semantic defect.</p><p><a href="../../delivery/a12/checks.json">Delivery gates</a> · <a href="../../delivery/a12/browser-check.json">Browser checks</a> · <a href="../../delivery/a12/portable-check.json">Portable rebuild</a> · <a href="../../SESSION-7-HANDOFF.md">Session handoff</a></p></footer></html>'''
    (out/'index.html').write_text(page,encoding='utf-8')
    write(out/'manifest.json',{'wave':'A12','rows':rows,'owner_accepted':False,'spend':spend})

if __name__=='__main__':build()
