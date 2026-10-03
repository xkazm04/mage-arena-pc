"""Real browser motion, fill, gate and projection witnesses; no engine FPS claim."""
import functools
import hashlib
import http.server
import threading
from playwright.sync_api import sync_playwright
from common import ART,ROOT,write,sha,relative

def run(board=True):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*args):pass
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    out=ART/'delivery/a13/proofs';out.mkdir(parents=True,exist_ok=True);records=[];files=[]
    try:
      with sync_playwright() as pw:
        browser=pw.chromium.launch(channel='chrome',headless=True)
        for width,height in [(1920,1080),(2560,1440)]:
            page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1);errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(f'http://127.0.0.1:{server.server_port}/art/review/a13/motion.html')
            page.wait_for_function('window.a13Demo?.ready===true',timeout=60000)
            page.evaluate('([w,h])=>{a13Demo.pause();a13Demo.resize(w,h)}',[width,height])
            cases=[]
            for palette in ('verdigris','rust-sand','moonlit'):
                page.evaluate('(p)=>{a13Demo.setPalette(p);a13Demo.setMode("arena");a13Demo.setProgress(.62)}',palette)
                r=page.evaluate('a13Demo.renderAt(1200)');assert not r['missing'],r
                assert abs(r['nominalBodyPx']-height*.05625)<1e-8,r
                first=page.locator('canvas').screenshot()
                page.evaluate('a13Demo.renderAt(1580)');second=page.locator('canvas').screenshot()
                assert first!=second,'FROZEN_ANIMATION'
                page.evaluate('a13Demo.renderAt(1200)')
                for mode in ('arena','before'):
                    page.evaluate('(m)=>{a13Demo.setMode(m);a13Demo.renderAt(1200)}',mode)
                    target=out/f'{palette}-{mode}-{height}.png';page.locator('canvas').screenshot(path=str(target))
                    files.append({'file':relative(target),'sha256':sha(target),'palette':palette,'mode':mode,'viewport':[width,height]})
                cases.append({'palette':palette,'nominalBodyPx':r['nominalBodyPx'],'actors':r['actors'],'animationChanged':True})
            for mode in ('catalogue','progress'):
                page.evaluate('(m)=>{a13Demo.setMode(m);a13Demo.renderAt(1200)}',mode)
                target=out/f'{mode}-{height}.png';page.locator('canvas').screenshot(path=str(target));files.append({'file':relative(target),'sha256':sha(target),'mode':mode,'viewport':[width,height]})
            # Inspect actual rendered alpha, not only metadata or screenshots.
            checks=page.evaluate('''()=>{
              const a=a13Demo.sigils,c=document.createElement('canvas');c.width=c.height=384;const x=c.getContext('2d',{willReadFrequently:true});
              const mass=()=>{const d=x.getImageData(0,0,384,384).data;let n=0;for(let i=3;i<d.length;i+=4)n+=d[i];return n};
              const draw=(id,o={})=>{x.clearRect(0,0,384,384);a.draw(x,id,{x:192,y:192,timeMs:130,frameSizePx:[300,300],...o});return mass()};
              const fill=[0,.25,.5,.75,1].map(p=>draw('threat.fire.ring',{progress:p}));
              const hidden=draw('absorb.window',{perfectWindowActive:false}),shown=draw('absorb.window',{perfectWindowActive:true});
              const releaseEnd=draw('cast.fire.release',{timeMs:600}),start=draw('cast.fire.start',{timeMs:0});
              const missing=(()=>{try{draw('missing');return false}catch{return true}})();
              draw('ward.hold',{arcDegrees:140,angle:0});const d=x.getImageData(0,0,384,384).data;let rear=0,front=0;
              for(let y=0;y<384;y++)for(let xx=0;xx<384;xx++){const v=d[(y*384+xx)*4+3];if(xx<187)rear+=v;else front+=v;}
              const cone=[30,90,145].map(coneDegrees=>draw('threat.water.cone',{coneDegrees,progress:.5}));
              return {fill,hidden,shown,releaseEnd,start,missing,rear,front,cone};
            }''')
            assert checks['fill'][0]>0 and all(a<=b for a,b in zip(checks['fill'],checks['fill'][1:])),checks
            assert checks['hidden']==0 and checks['shown']>0 and checks['releaseEnd']==0 and checks['start']==0,checks
            assert checks['rear']==0 and checks['front']>0 and all(checks['cone']) and checks['missing'],checks
            assert not errors,errors
            records.append({'viewport':[width,height],'cases':cases,'actualPixelChecks':checks,'pageErrors':errors});page.close()
        if board:
            for width,height in [(1920,1080),(2560,1440),(390,844)]:
                page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
                page.goto(f'http://127.0.0.1:{server.server_port}/art/review/a13/index.html')
                page.evaluate("document.querySelectorAll('img').forEach(i=>i.loading='eager')")
                page.wait_for_function("[...document.images].every(i=>i.complete&&i.naturalWidth>0)",timeout=60000)
                r=page.evaluate("({images:document.images.length,overflow:document.documentElement.scrollWidth>innerWidth})")
                assert not r['overflow'],r
                broken=page.evaluate("async()=>{const u=[...new Set([...document.querySelectorAll('a[href]')].map(a=>a.href.split('#')[0]))];return (await Promise.all(u.map(async p=>[p,(await fetch(p,{method:'HEAD'})).status]))).filter(r=>r[1]>=400)}")
                assert not broken,broken;records.append({'boardViewport':[width,height],**r,'brokenLinks':broken});page.close()
        browser.close()
    finally:server.shutdown();server.server_close()
    write(ART/'delivery/a13/browser-check.json',{'status':'pass','scope':'standalone Canvas consumer; not gameplay, GPU performance or owner feel','results':records})
    write(ART/'delivery/a13/proofs.json',{'captures':files,'bodyScale':'1.5 times A10 v2 design canvas; head-to-sole nominal 60.75px/1080p, 81px/1440p','ownerAccepted':False})
    print('A13 browser pass:',len(records),'viewport cases;',len(files),'native captures')

if __name__=='__main__':
    import sys
    run('--no-board' not in sys.argv)
