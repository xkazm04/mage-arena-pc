"""Measured browser load, camera, motion and depth evidence; no engine FPS claim."""
import functools
import hashlib
import http.server
import threading
from playwright.sync_api import sync_playwright
from common import ROOT,ART,write

def check():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*args):pass
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    shots=ART/'review/browser/a12';shots.mkdir(parents=True,exist_ok=True);rows=[]
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(channel='chrome',headless=True)
            for width,height in [(1920,1080),(2560,1440),(390,844)]:
                page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
                errors=[];bad=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.on('response',lambda r:bad.append([r.status,r.url]) if r.status>=400 else None)
                base=f'http://127.0.0.1:{server.server_port}/art/review/a12/'
                page.goto(base+'index.html')
                page.evaluate("document.querySelectorAll('img').forEach(i=>i.loading='eager')")
                page.wait_for_function("[...document.images].every(i=>i.complete&&i.naturalWidth>0)",timeout=60000)
                stats=page.evaluate("({images:document.images.length,overflow:document.documentElement.scrollWidth>innerWidth})")
                assert not stats['overflow'],stats
                # All authored local links must resolve, including collapsed evidence.
                links=page.evaluate("async()=>{const u=[...new Set([...document.querySelectorAll('a[href]')].map(a=>a.href.split('#')[0]))];const r=await Promise.all(u.map(async u=>[u,(await fetch(u,{method:'HEAD'})).status]));return r.filter(x=>x[1]>=400)}")
                assert not links,links
                page.screenshot(path=str(shots/f'board-{width}.png'))
                row={'viewport':[width,height],'board':stats,'brokenLinks':links}
                if width>1000:
                    page.goto(base+'canvas-demo.html')
                    page.wait_for_function('window.a12Demo?.ready===true',timeout=60000)
                    cases=[]
                    for palette in ['verdigris','rust-sand','moonlit']:
                        page.evaluate('(p)=>{a12Demo.setPalette(p);a12Demo.setDepth(false);a12Demo.setCamera([16,62]);}',palette)
                        r=page.evaluate('a12Demo.renderAt(100)')
                        assert not r['missingClips'] and r['drawnActors']==8,r
                        assert abs(r['characterNominalPx']-40.5*height/1080)<.001
                        before=page.locator('canvas').screenshot()
                        page.evaluate('a12Demo.renderAt(320)')
                        after=page.locator('canvas').screenshot(path=str(shots/f'{palette}-{width}.png'))
                        assert before!=after,'ANIMATION_FROZEN'
                        clamp=page.evaluate('a12Demo.assets.geometry.camera.clamp_centre_metres')
                        for x in (clamp[0][0],clamp[1][0]):
                            for y in (clamp[0][1],clamp[1][1]):
                                edge=page.evaluate('(c)=>{a12Demo.setCamera(c);return a12Demo.renderAt(100)}',[x,y])['plateBounds']
                                assert edge[0]<=.001 and edge[1]<=.001 and edge[0]+edge[2]>=width-.001 and edge[1]+edge[3]>=height-.001,edge
                        page.evaluate('a12Demo.setDepth(true);a12Demo.renderAt(2500)')
                        front=page.locator('canvas').screenshot()
                        page.evaluate('a12Demo.renderAt(7500)')
                        behind=page.locator('canvas').screenshot(path=str(shots/f'{palette}-occlusion-{width}.png'))
                        assert front!=behind,'DEPTH_WITNESS_FROZEN'
                        cases.append({'palette':palette,'actors':r['drawnActors'],'nominalBodyPx':r['characterNominalPx'],'fourCameraCornersCovered':True,'animationChanged':True,'depthWitnessChanged':True,'screenSha256':hashlib.sha256(after).hexdigest()})
                    follow=page.evaluate('''()=>{const a=a12Demo.assets;return {still:a.followCamera([16,62],[17,62],.05,1920,1080),edge:a.followCamera([16,62],[60,62],.05,1920,1080)}}''')
                    assert follow['still']==[16,62] and follow['edge'][0]>16,follow
                    # Input releases retain player position (regression for reset-to-witness).
                    page.locator('#reset').click();page.keyboard.press('Space');page.keyboard.down('d');page.wait_for_timeout(180);page.keyboard.up('d')
                    pos=page.evaluate('a12Demo.player');page.wait_for_timeout(80)
                    assert pos==page.evaluate('a12Demo.player'),'PLAYER_RESET_ON_KEYUP'
                    row.update(canvas=cases,deadZone=follow,inputReleaseStable=True)
                assert not errors and not bad,{'errors':errors,'httpErrors':bad}
                row.update(errors=errors,httpErrors=bad);rows.append(row);page.close()
            browser.close()
    finally:server.shutdown();server.server_close()
    report={'status':'pass','scope':'standalone art consumer and owner board; not game integration, engine performance or owner acceptance','results':rows}
    write(ART/'delivery/a12/browser-check.json',report);print('A12 browser checks pass:',len(rows),'viewports')

if __name__=='__main__':check()
