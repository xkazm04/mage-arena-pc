"""Exercise camp slots and visit gates in the actual canvas art consumer."""
import json
import threading
from http.server import ThreadingHTTPServer
from functools import partial
from playwright.sync_api import sync_playwright
from common import ART, ROOT, write, relative, sha
from covenant import board
from covenant_ui_browser import QuietHandler


def main():
    rows=[];results=[]
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    out=ART/'review/a4c';out.mkdir(parents=True,exist_ok=True)
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(channel='chrome',headless=True)
            for w,h in [(1920,1080),(2560,1440)]:
                page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1);errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto(f'http://127.0.0.1:{server.server_port}/art/delivery/a4c/preview.html')
                page.wait_for_function('window.campReview?.ready===true')
                def capture(name):
                    path=out/f'{name}-{w}.png';page.screenshot(path=str(path))
                    rows.append({'id':name+'-'+str(w),'file':relative(path),'sha256':sha(path),'note':'Actual canvas atlas and camp-manifest consumer; opening slots from baseline data. Not game integration.','owner_accepted':False})
                for slot in ['day','dusk','night']:
                    page.evaluate('(s)=>window.setCampReview(s)',slot);capture('camp-'+slot)
                    state=page.evaluate('window.campReview')
                    assert len(state['places'])==8
                    if slot=='night':
                        assert state['openIds']==['tent','edge']
                        assert state['open'] is False
                        target=next(t for t in state['targets'] if t['label']=='Visit')
                        assert target['disabled']
                        page.mouse.click((target['x']+20)*w/1920,(target['y']+20)*h/1080)
                        assert page.evaluate('window.campReview.screen')=='map'
                for i in range(2):
                    page.evaluate('(i)=>window.setCampReview("dusk","board",0,i)',i);capture('hollow-'+str(i+1))
                for i in range(8):
                    page.evaluate('(i)=>window.setCampReview("day","visit",i)',i)
                    if w==1920:capture('backdrop-'+page.evaluate('window.campReview.place'))
                page.evaluate('window.setCampReview("night","map",6)')
                target=next(t for t in page.evaluate('window.campReview.targets') if t['label']=='Visit')
                page.mouse.click((target['x']+20)*w/1920,(target['y']+20)*h/1080)
                assert page.evaluate('window.campReview.screen')=='visit'
                page.keyboard.press('Escape');assert page.evaluate('window.campReview.screen')=='map'
                page.keyboard.press('ArrowRight');assert page.evaluate('window.campReview.focus')==1
                assert page.locator('input,select,button,textarea').count()==0
                assert not errors,errors
                results.append({'viewport':[w,h],'places':8,'slots':3,'stories':6,'closed_visit':'blocked','open_visit':'pass','keyboard':'pass','dom_controls':0,'errors':errors})
                page.close()
            browser.close()
    finally:server.shutdown();server.server_close();thread.join(timeout=5)
    write(ART/'reports/a4c-camp-browser.json',{'status':'pass','results':results,'scope':'canvas art consumer; not live game camp state'})
    board('A4c',rows);print(json.dumps(results))


if __name__=='__main__':main()
