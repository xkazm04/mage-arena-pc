"""AU3 offline numerical, provenance, browser and budget gates; no provider calls."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import hashlib,json,datetime,subprocess,wave
import numpy as np
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];AUDIO=ROOT/'docs/audio';E=AUDIO/'evidence/r4'
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
M=read(AUDIO/'manifest-au3.json'); B=read(ROOT/'tools/audio/budget.json'); cost=read(E/'cost-audit.json');derivatives=read(E/'derivatives.json')
ledger=[json.loads(s) for s in (ROOT/'tools/audio/ledger.jsonl').read_text(encoding='utf-8').splitlines() if s];au3=[s for s in ledger if s.get('wave')=='AU3']
assert len(au3)==2 and [s['trackId'] for s in au3]==['arena-C-reed-oath','arena-D-lyre-under-iron']
assert B['status']=='closed-owner-review' and B['capCredits']==10000 and B['stopBelowCredits']==1000 and B['reserveCredits']==1000
assert sum(s['chargedCredits'] for s in au3)==9000 and read(ROOT/'tools/audio/state.json')['pending'] is None
assert cost['minimumRequestGapSeconds']>=8 and cost['paidPosts']==2 and all(s==200 for s in cost['statuses'])
assert not (ROOT/'tools/audio/.generation.lock').exists()
for row in ledger:
    raw=ROOT/row['out'];assert digest(raw)==row['sha256'];assert read(Path(str(raw)+'.json'))==row
for t in M['tracks']:
    assert t['ownerChoice'] is None and t['productionApproved'] is False and t['adaptiveReady'] is False and t['verifiedBpm'] is None and t['allowedTransitions']==[]
    assert t['durationSeconds']==150 and t['sampleCount']==7200000 and t['sampleRate']==48000
    assert len(t['cells'])==10 and len(t['sectionMap'])==6
    with wave.open(str(AUDIO/t['file']),'rb') as f:
        assert f.getnframes()==7200000 and f.getframerate()==48000 and f.getnchannels()==2
        whole=np.frombuffer(f.readframes(f.getnframes()),'<i2').reshape(-1,2)
    pieces=[]
    for s in t['sectionMap']:
        with wave.open(str(AUDIO/s['file']),'rb') as f: pieces.append(np.frombuffer(f.readframes(f.getnframes()),'<i2').reshape(-1,2))
        assert len(pieces[-1])==s['endSample']-s['startSample']
    assert np.array_equal(np.concatenate(pieces),whole), 'Section cuts must reconstruct the normalized score exactly'
    for i,c in enumerate(t['cells']):assert c['startSample']==i*720000 and c['endSample']==(i+1)*720000
    assert t['tierMap']=={'1':[0],'2':[1],'3':[2,5],'4':[3,4,6,7,8]}
    assert t['sustainLoop']['approved'] is False and t['sustainLoop']['enabled'] is False
    assert t['sustainLoop']['endSample']==720000 and t['sustainLoop']['numericalScreenPass']
    assert max(t['sustainLoop']['threeRepeatJoinJumpsDbFS'])<=-60 and t['sustainLoop']['adjacentHalfSecondRmsDifferenceDb']<=3
    assert t['sting']['durationSeconds']==5 and t['sting']['measurement']['sampleCount']==240000
    normalized=t['mastering']['measurement'];assert abs(normalized['integratedLufs']+26)<=.3 and normalized['truePeakDbTP']<=-1 and normalized['samplesAtOrAboveFullScale']==0
    index=read((AUDIO/t['file']).parent/'segments.json');assert index['cells']==t['cells']
for row in derivatives:
    file=AUDIO/row['file'];assert digest(file)==row['sha256'] and read(Path(str(file)+'.json'))==row
    assert digest(AUDIO/row['source'])==row['sourceSha256'] and row['additionalPaidCalls']==0 and row['additionalCredits']==0
    assert row['measurement']['truePeakDbTP']<=-1 and row['measurement']['samplesAtOrAboveFullScale']==0
assert len(derivatives)==18
peaks=[t['mastering']['measurement']['truePeakDbTP'] for t in M['tracks']]
sum_bound=20*np.log10(sum(10**(v/20) for v in peaks))
assert sum_bound<=-1 # Conservative two-full-mix peak bound, not a measured combat mix.
result=dict(timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),status='running browser gate',rawProvenanceCount=len(ledger),au3Originals=2,derivativeCount=len(derivatives),rawHashesAndSidecars=True,masteringAndExactSectionReconstruction=True,cellIndices=True,repeatNumericalScreens=True,costAudit=True,twoFullMixPeakUpperBoundDbTP=float(sum_bound),perceptualAcceptance='pending; no auditory review, motif/vocals/real release/grid-downbeats/transition harmony not certified',runtimeIntegration='AU4 pending',browser=[])
# Create the linked evidence before checking relative references.
(E/'validation.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
class References(HTMLParser):
    def __init__(self):super().__init__();self.refs=[];self.ids=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        for key in ['src','href']:
            if a.get(key):self.refs.append(a[key])
        if a.get('id'):self.ids.append(a['id'])
pages=[AUDIO/'audition/r4/index.html',AUDIO/'PROOF-REPORT.html']
for file in pages:
    parser=References();parser.feed(file.read_text(encoding='utf-8'));assert len(parser.ids)==len(set(parser.ids))
    for ref in parser.refs:
        u=urlsplit(ref)
        if not u.scheme and u.path:assert (file.parent/unquote(u.path)).exists(),(file,ref)
with sync_playwright() as pw:
    browser=pw.chromium.launch()
    for width,height,theme in [(1440,1000,'light'),(1440,1000,'dark'),(390,844,'light'),(390,844,'dark')]:
        context=browser.new_context(viewport={'width':width,'height':height},color_scheme=theme)
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        for file in pages:
            page.goto(file.as_uri());page.wait_for_load_state('load')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),f'Overflow: {width} {file}'
            if width==1440 and theme=='light':
                playback=page.evaluate('''async()=>{const results=[];for(const a of document.querySelectorAll('audio')){a.load();await new Promise((resolve,reject)=>{if(a.readyState>=1)return resolve();a.onloadedmetadata=resolve;a.onerror=()=>reject(Error(a.src));setTimeout(()=>reject(Error('metadata timeout '+a.src)),10000)});await a.play();await new Promise(r=>setTimeout(r,80));results.push({src:a.getAttribute('src'),seconds:a.duration,playing:!a.paused,volume:a.volume});a.pause()}return results}''')
                assert len(playback)==22 and all(p['seconds']>0 and p['playing'] and 0<p['volume']<=1 for p in playback)
                result['browser'].append(dict(page=file.relative_to(ROOT).as_posix(),playback=playback))
            page.screenshot(path=str(E/f'{file.stem}-{file.parent.name}-{width}-{theme}.png'),full_page=False)
        page.goto(pages[0].as_uri())
        assert page.locator('[data-direction]').count()==18
        assert page.locator('input[type=radio]:checked').count()==0
        card=page.locator('[data-direction]').first
        card.locator('input[value=maybe]').check();card.locator('textarea').fill('Melody | release\nSecond line')
        page.locator('#theme').select_option('dark');page.reload()
        assert page.locator('input[type=radio]:checked').count()==1 and card.locator('textarea').input_value()=='Melody | release\nSecond line'
        assert page.locator('#theme').input_value()=='dark'
        page.locator('#refresh-export').click();export=page.locator('#export').input_value();assert 'AU3 round 4' in export and 'maybe' in export and 'Melody \\| release<br>Second line' in export
        page.locator('#copy').click();assert 'Markdown' in page.locator('#status').inner_text()
        keys=page.evaluate('Object.keys(localStorage)');assert 'mage-arena.audio.au3.r4.v1' in keys and 'mage-arena.audio.au1.r1.v1' not in keys
        button=page.locator('[data-loop-target]').first;button.click();assert button.get_attribute('aria-pressed')=='true';button.click();assert button.get_attribute('aria-pressed')=='false'
        # Historical rounds retain isolated keys and still initialize correctly.
        for round in ['r1','r2','r3']:
            page.goto((AUDIO/f'audition/{round}/index.html').as_uri());assert page.locator('input[type=radio]:checked').count()==0
        assert not errors,errors
        result['browser'].append(dict(viewport=[width,height],theme=theme,overflow=False,notesPersistence=True,markdownExport=True,roundIsolation=True,historicalInitialization=True,javascriptErrors=errors))
        context.close()
    browser.close()
result['status']='pass technical gates; musical and owner acceptance pending'
(E/'validation.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(status=result['status'],rawFiles=len(ledger),derivatives=18,browserViews=8)))
