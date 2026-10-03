"""Actual canvas playback and owner board evidence, no game integration claim."""
import argparse
import functools
import http.server
import threading
from playwright.sync_api import sync_playwright
from common import ART,ROOT,write


def check(wave,page_name='motion.html'):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*args):pass
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();results=[]
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(channel='chrome',headless=True)
            for w,h in [(1920,1080),(2560,1440)]:
                page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
                errors=[];failed=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.on('requestfailed',lambda e:failed.append(e.url))
                page.goto(f'http://127.0.0.1:{server.server_port}/art/review/{wave.lower()}/{page_name}')
                page.wait_for_function('window.__artReady===true',timeout=60000)
                checks=page.evaluate('window.__loaderChecks || {}')
                assert all(checks.values()),checks
                before=page.locator('canvas').screenshot()
                page.wait_for_timeout(420)
                after=page.locator('canvas').screenshot()
                assert before!=after,'FROZEN_CANVAS'
                if page.locator('#pause').count():
                    page.locator('#pause').click();page.wait_for_timeout(50)
                    t=page.evaluate('window.__artTime');page.wait_for_timeout(100)
                    assert t==page.evaluate('window.__artTime'),'PAUSE_FAILED'
                if page.locator('#palette').count():
                    for palette in ['verdigris','rust-sand','moonlit']:
                        page.locator('#palette').select_option(palette);page.wait_for_timeout(50)
                        page.locator('canvas').screenshot(path=str(ART/f'review/{wave.lower()}/motion-{palette}-{w}.png'))
                else:page.locator('canvas').screenshot(path=str(ART/f'review/{wave.lower()}/motion-{w}.png'))
                assert not errors and not failed
                results.append({'viewport':[w,h],'canvas_changed':True,'loader_checks':checks,'errors':errors,'failed_requests':failed})
                page.close()
            browser.close()
    finally:server.shutdown();server.server_close()
    report={'status':'pass','wave':wave,'scope':'standalone art consumer playback and image loading, not game FPS or owner feel','results':results}
    write(ART/f'reports/{wave.lower()}-motion-browser.json',report);print(report)


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('wave');p.add_argument('--page',default='motion.html');a=p.parse_args();check(a.wave,a.page)
