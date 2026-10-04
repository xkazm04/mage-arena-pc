"""Verify the stage-2 review page without rewriting stage-1 products."""
import functools,http.server,threading
from playwright.sync_api import sync_playwright
from common import ART,ROOT,write

def run():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*args):pass
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start();cases=[]
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(channel='chrome',headless=True)
            for w,h in [(1920,1080),(2560,1440),(390,844)]:
                page=browser.new_page(viewport={'width':w,'height':h});errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto(f'http://127.0.0.1:{server.server_port}/art/review/a14/stage2.html')
                page.wait_for_function('[...document.images].every(i=>i.complete&&i.naturalWidth>0)')
                result=page.evaluate('({images:document.images.length,overflow:document.documentElement.scrollWidth>innerWidth})')
                assert result['images']==18 and not result['overflow'] and not errors,result
                for link in page.locator('a').evaluate_all('(els)=>els.map(e=>e.href)'):
                    assert page.request.get(link).ok,link
                page.screenshot(path=str(ART/f'review/a14/gaits/board-{w}.png'))
                cases.append({'viewport':[w,h],**result,'pageErrors':errors,'links':'pass'});page.close()
            browser.close()
    finally:server.shutdown();server.server_close()
    write(ART/'delivery/a14/stage2/browser-check.json',{'status':'pass','cases':cases,'scope':'review board only; no gameplay acceptance'})
    print('Stage-2 board pass: three viewports, 18 images and all links each')

if __name__=='__main__':run()
