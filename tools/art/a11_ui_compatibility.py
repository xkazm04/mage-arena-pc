"""Read-only regression of the pre-existing UI consumer against the extended kit."""
import functools,http.server,threading
from playwright.sync_api import sync_playwright
from common import ART,ROOT,read,write

def check():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*args):pass
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start();rows=[]
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(channel='chrome',headless=True)
            for w,h in [(1920,1080),(2560,1440)]:
                page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1);errors=[];failed=[]
                page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda e:failed.append(e.url))
                page.goto(f'http://127.0.0.1:{server.server_port}/art/ui/preview.html');page.wait_for_function('window.covenantReview?.ready===true')
                for screen in ['menu','arena','camp','board','journal','parley','composition','pause','results','saves','controls']:
                    page.evaluate('(s)=>window.setCovenantScreen(s)',screen)
                    page.wait_for_function('(s)=>window.covenantReview.screen===s',arg=screen)
                    assert page.locator('input,select,button,textarea').count()==0
                    assert page.evaluate('document.fonts.check(\'28px "Source Sans 3"\') && document.fonts.check(\'40px "Cinzel"\')')
                    if screen in ['menu','arena']:page.screenshot(path=str(ART/f'review/a11/legacy-{screen}-{w}.png'))
                page.evaluate("window.setCovenantScreen('menu')");page.keyboard.press('ArrowDown');assert page.evaluate('window.covenantReview.focus')==1
                page.keyboard.press('ArrowUp');assert page.evaluate('window.covenantReview.focus')==0
                count=page.evaluate('window.covenantReview.regions');assert count==len(read(ART/'ui/kit.json')['regions'])==108
                assert not errors and not failed
                rows.append({'viewport':[w,h],'screens':11,'regions':count,'fonts':True,'focus':'pass','errors':errors,'failedRequests':failed});page.close()
            browser.close()
    finally:server.shutdown();server.server_close()
    result={'status':'pass','results':rows,'scope':'old standalone UI consumer with additive A11 extension; old page and region preservation checked separately'}
    write(ART/'reports/a11-ui-compatibility.json',result);print(result)

if __name__=='__main__':check()
