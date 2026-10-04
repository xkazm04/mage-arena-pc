"""Actual atlas playback, merge and indefinite corpse pixel witnesses."""
import functools,http.server,threading
from playwright.sync_api import sync_playwright
from common import ART,ROOT,write,sha,relative

def run(complete=False):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*args):pass
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
    out=ART/'delivery/a14/proofs';out.mkdir(parents=True,exist_ok=True);records=[];captures=[]
    try:
      with sync_playwright() as pw:
        browser=pw.chromium.launch(channel='chrome',headless=True)
        for w,h in [(1920,1080),(2560,1440)]:
            page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(f'http://127.0.0.1:{server.server_port}/art/review/a14/motion.html');page.wait_for_function('window.a14Demo?.ready',timeout=120000)
            page.evaluate('([w,h])=>{a14Demo.pause();a14Demo.resize(w,h)}',[w,h])
            result=page.evaluate('''()=>{
              const a=a14Demo,canvas=document.createElement('canvas');canvas.width=canvas.height=400;const ctx=canvas.getContext('2d',{willReadFrequently:true});
              const pixels=(e,s,d,t)=>{ctx.clearRect(0,0,400,400);const ok=a.drawCharacter(ctx,a.art,e,s,d,t,200,200,2);return [ok,Array.from(ctx.getImageData(0,0,400,400).data).join(',')]};
              let checked=0;const faults=[];
              for(const [e,b] of Object.entries(a.art.manifest.entities))for(const d of ['ne','se','nw','sw']){
                if(!b.clips.corpse?.[d])continue;
                const last=pixels(e,'death',d,10000),corpse=pixels(e,'corpse',d,0),later=pixels(e,'corpse',d,99999999);
                if(!last[0]||last[1]!==corpse[1]||corpse[1]!==later[1])faults.push(e+':'+d+':persistent');
                const early=pixels(e,'hit-light',d,0),peak=pixels(e,'hit-light',d,45);
                if(early[1]===peak[1])faults.push(e+':'+d+':frozen-hit');checked++;
              }
              const absent=pixels('not-an-entity','death','se',0)[0];
              return {checked,faults,missingReturnsFalse:absent===false};
            }''')
            assert not result['faults'] and result['missingReturnsFalse'],result
            if complete:assert result['checked']==48,result
            for palette in ['moonlit','verdigris','rust-sand']:
                page.evaluate('(p)=>a14Demo.setPalette(p)',palette)
                for direction in ['ne','se']:
                    page.evaluate('(d)=>{a14Demo.setFacing(d);a14Demo.setState("death");a14Demo.renderAt(10000)}',direction)
                    path=out/f'{palette}-{direction}-{h}.png';page.locator('canvas').screenshot(path=str(path));captures.append({'file':relative(path),'sha256':sha(path),'viewport':[w,h],'palette':palette,'direction':direction})
            assert not errors,errors;records.append({'viewport':[w,h],**result,'pageErrors':errors});page.close()
        for w,h in [(1920,1080),(2560,1440),(390,844)]:
            page=browser.new_page(viewport={'width':w,'height':h});page.goto(f'http://127.0.0.1:{server.server_port}/art/review/a14/index.html');page.evaluate("document.querySelectorAll('img').forEach(i=>i.loading='eager')")
            page.wait_for_function('[...document.images].every(i=>i.complete&&i.naturalWidth>0)',timeout=60000)
            r=page.evaluate('({images:document.images.length,overflow:document.documentElement.scrollWidth>innerWidth})');assert not r['overflow'],r
            records.append({'boardViewport':[w,h],**r});page.close()
        browser.close()
    finally:server.shutdown();server.server_close()
    write(ART/'delivery/a14/browser-check.json',{'status':'pass','scope':'standalone canvas, not gameplay or owner feel','cases':records});write(ART/'delivery/a14/proofs.json',{'captures':captures,'label':'Actual A14 atlas corpse poses composited on accepted A12 plates at scale v3; no gameplay capture','owner_accepted':False})
    print('A14 browser pass',len(records),'viewport cases,',len(captures),'native captures')

if __name__=='__main__':
    import sys
    run('--complete' in sys.argv)
