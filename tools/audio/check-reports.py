"""File/provenance and Playwright file:// gates. No provider calls."""
import hashlib, json, re, datetime
import runpy
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
if json.loads((ROOT/'tools/audio/budget.json').read_text())['wave']=='AU3':
    runpy.run_path(str(Path(__file__).with_name('check-r4-reports.py')),run_name='__main__')
    raise SystemExit(0)
if json.loads((ROOT/'tools/audio/budget.json').read_text())['wave']=='AU2b':
    runpy.run_path(str(Path(__file__).with_name('check-r3-reports.py')),run_name='__main__')
    raise SystemExit(0)
OUT = ROOT / 'docs/audio/evidence/r2'
pages = [ROOT/'docs/audio/audition/r1/index.html', ROOT/'docs/audio/audition/r2/index.html', ROOT/'docs/audio/PROOF-REPORT.html']
class References(HTMLParser):
    def __init__(self): super().__init__(); self.refs=[]; self.ids=[]; self.audio=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        for key in ('src', 'href'):
            if a.get(key): self.refs.append(a[key])
        if a.get('id'): self.ids.append(a['id'])
        if tag=='audio': self.audio.append(a.get('src'))
ledger = [json.loads(x) for x in (ROOT/'tools/audio/ledger.jsonl').read_text().splitlines() if x]
budget = json.loads((ROOT/'tools/audio/budget.json').read_text())
by_path = {row['out']:row for row in ledger}
assert len(by_path)==len(ledger)
measurements = json.loads((ROOT/'docs/audio/evidence/measurements.json').read_text())
new = [e for e in ledger if e.get('wave')=='AU2']
expected = {pages[0]:15,pages[1]:len(new)+5,pages[2]:len(ledger)}
assert len(measurements)==len(ledger)
for row in ledger:
    source=ROOT/row['out']
    assert source.is_file(), source
    assert json.loads(Path(str(source)+'.json').read_text())==row
    assert hashlib.sha256(source.read_bytes()).hexdigest()==row['sha256']
    assert next(m for m in measurements if m['source']==row['out'])['sourceSha256']==row['sha256']
assert {p.relative_to(ROOT).as_posix() for p in (ROOT/'docs/audio/audition').glob('r*/*.mp3')}==set(by_path)
assert sum(e['chargedCredits'] for e in new)<=budget['capCredits']
assert all(e['accountBefore']['remaining']-e['reservedCredits']>=budget['reserveCredits'] for e in ledger)
assert budget['capCredits']==5000
assert budget['stopBelowCredits']==14000
assert budget['status'] in ['closed-owner-review','stopped-provider-rate-limit','stopped-account-floor']
assert json.loads((ROOT/'tools/audio/state.json').read_text())['pending'] is None
assert min(e['accountBefore']['remaining'] for e in new)>=14000
http=[json.loads(x) for x in (ROOT/'tools/audio/http.jsonl').read_text().splitlines() if x]
balances=[json.loads(x) for x in (ROOT/'tools/audio/balances.jsonl').read_text().splitlines() if x]
stamp=lambda s:datetime.datetime.fromisoformat(s.replace('Z','+00:00'))
gaps=[(stamp(b['startedAt'])-stamp(a['completedAt'])).total_seconds() for a,b in zip(http,http[1:])]
assert min(gaps)>=7.99, 'All API requests, including balance reads, must be paced and serial'
assert min(e['remaining'] for e in balances)>=14000
assert len([h for h in http if h['method']=='POST' and h['status']==200])==len(new)
assert hashlib.sha256((ROOT/'docs/audio/evidence/r1-final/STOP.json').read_bytes()).hexdigest()=='dad0c9e773f9e86d209cb695097cbe54d7dbda90bad825606506f8a560859591', 'Old STOP must be preserved exactly'

for row in ledger:
    assert row['chargedCredits']==max(row['accountDelta'] or 0,row.get('settledDelta') or 0,row['estimatedCredits'],row['measuredCredits'] or 0)
    assert row['documentedEstimateCredits']>0
    assert row['accountAfter']['remaining']>=budget['reserveCredits']
for page in pages:
    parser=References(); parser.feed(page.read_text(encoding='utf-8'))
    assert len(parser.ids)==len(set(parser.ids)), 'Duplicate HTML IDs'
    assert len(parser.audio)==expected[page], 'Expected originals and reference family on each page'
    assert len(parser.audio)==len(set(parser.audio)), 'No duplicate audio on one page'
    for ref in parser.refs:
        url=urlsplit(ref)
        if url.scheme: continue
        target=(page.parent/unquote(url.path)).resolve() if url.path else page
        assert target.is_file(), (page, ref)
        if not url.path and url.fragment: assert url.fragment in parser.ids

errors=[]; browsers=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for width,height,label in [(1440,1000,'desktop'),(390,844,'phone')]:
        context=browser.new_context(viewport={'width':width,'height':height}, color_scheme='dark')
        page=context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda msg: errors.append(msg.text) if msg.type=='error' else None)
        for source in pages:
            page.goto(source.as_uri(), wait_until='load')
            assert '\u00c2\u00b7' not in page.locator('body').inner_text(), 'Mojibake in direction labels'
            assert page.locator('audio').count()==expected[source]
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Page overflow'
            page.locator('details').evaluate_all('(items)=>items.forEach(d=>d.open=true)')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Expanded details overflow'
            page.locator('details').evaluate_all('(items)=>items.forEach(d=>d.open=false)')
            # Decode every file from disk and exercise native playback (muted for test host).
            media=page.evaluate('''async () => {
              const results=[];
              for(const a of document.querySelectorAll('audio')) {
                a.muted=true;
                await new Promise((resolve,reject)=>{
                  const timeout=setTimeout(()=>reject(Error('Audio metadata timeout')),10000);
                  a.onloadedmetadata=()=>{clearTimeout(timeout);resolve();};
                  a.onerror=()=>{clearTimeout(timeout);reject(Error('Audio decode failed'));};
                  a.preload='auto';a.load();
                });
                await a.play();
                await new Promise(r=>setTimeout(r,150));
                results.push({src:a.getAttribute('src'),duration:a.duration,currentTime:a.currentTime,volume:a.volume});
                a.pause();a.currentTime=0;a.muted=false;
              }
              return results;
            }''')
            assert all(m['duration']>0 and m['currentTime']>0 and 0<m['volume']<=1 for m in media)
            for theme in ['light','dark']:
                page.select_option('#theme',theme)
                assert page.locator('html').get_attribute('data-theme')==theme
                page.screenshot(path=str(OUT/f'{"proof" if "PROOF" in source.name else source.parent.name+'-triage'}-{label}-{theme}.png'),full_page=False)
            browsers.append({'page':source.relative_to(ROOT).as_posix(),'viewport':label,'media':media,'themes':['light','dark'],'noOverflow':True})
        # Triage persistence + export, using synthetic test notes in an isolated browser context.
        page.goto(pages[1].as_uri())
        assert page.locator('input[type=radio]:checked').count()==0
        first=page.locator('[data-direction]').first
        first.locator('input[value=maybe]').check()
        first.locator('textarea').fill('Test note | literal\nsecond line')
        page.reload()
        assert page.locator('[data-direction]').first.locator('input[value=maybe]').is_checked()
        assert page.locator('[data-direction]').first.locator('textarea').input_value()=='Test note | literal\nsecond line'
        page.click('#refresh-export')
        exported=page.locator('#export').input_value()
        assert 'maybe' in exported and 'Test note \\| literal<br>second line' in exported
        page.click('#copy')
        page.wait_for_function("document.querySelector('#status').textContent.includes('Markdown')")
        assert page.locator('#export').input_value()==exported
        assert '<script' not in exported
        assert 'AU2 round 2' in exported
        page.goto(pages[0].as_uri())
        assert page.locator('input[type=radio]:checked').count()==0, 'AU2 choices must not change round 1'
        page.goto(pages[1].as_uri())
        assert page.locator('[data-direction]').first.locator('input[value=maybe]').is_checked()
        page.locator('[data-loop-target]').first.click()
        assert page.locator('[data-loop-target]').first.get_attribute('aria-pressed')=='true'
        assert page.locator('audio').first.evaluate('(a)=>a.loop')
        # Starting a second clip must pause the first, preserving clean comparisons.
        assert page.evaluate('''async () => {
          const [a,b]=document.querySelectorAll('audio');
          a.muted=b.muted=true;
          await a.play(); await b.play();
          const ok=a.paused&&!b.paused;
          b.pause();return ok;
        }''')
        context.close()
    browser.close()
assert not errors, errors
result={'status':'pass','generatedSamples':len(ledger),'newSamples':len(new),'plannedNewSamples':len(json.loads((ROOT/'tools/audio/audition-plan-r2.json').read_text())['samples']),'coverageGate':'Actual coverage is explicit; missing directions never count as quality failures','relativeReferences':'all exist','sidecarsAndLedger':'one per original; exact match; hashes verified','budgetDebit':sum(e['chargedCredits'] for e in new),'cumulativeDebit':sum(e['chargedCredits'] for e in ledger),'cap':budget['capCredits'],'reserve':budget['reserveCredits'],'accountFloor':budget['stopBelowCredits'],'minimumObservedAccountBalance':min(e['remaining'] for e in balances),'minimumRequestGapSeconds':min(gaps),'HTTP429Count':sum(e['status']==429 for e in http),'browserErrors':errors,'checks':browsers,'persistenceAndExport':'pass: radio, multiline note, pipe escape, reload, copy/fallback, loop toggle','ownerListening':'not measured'}
(OUT/'validation.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k!='checks'},indent=2))
