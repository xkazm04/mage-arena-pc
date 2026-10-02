"""Load every portrait, exercise native canvas and capture dialogue studies."""
import json
import threading
from http.server import ThreadingHTTPServer
from functools import partial
from playwright.sync_api import sync_playwright
from common import ART, ROOT, read, write, relative, sha
from covenant import board
from covenant_ui_browser import QuietHandler


def main():
    out=ART/'review/a2c';rows=[r for r in read(out/'manifest.json')['rows'] if r['id']=='cast-contact-sheet'];results=[]
    manifest=read(ART/'delivery/a2c/manifest.json')
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(channel='chrome',headless=True)
            for w,h in [(1920,1080),(2560,1440)]:
                page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1);errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto(f'http://127.0.0.1:{server.server_port}/art/delivery/a2c/preview.html')
                page.wait_for_function('window.portraitReview?.ready===true')
                assert page.evaluate('window.portraitReview.loaded')==len(manifest['portraits'])
                for r in manifest['portraits']:
                    page.evaluate('([id,m])=>window.setPortraitReview(id,m)',[r['character'],r['mood']])
                    assert page.evaluate('window.portraitReview.portraitKey')==r['id']
                for who,mood in [('cassia','neutral'),('brennic','proud'),('garran','grieving'),('iskar','angry')]:
                    if not any(r['id']==who+'.'+mood for r in manifest['portraits']):mood='neutral'
                    page.evaluate('([id,m])=>window.setPortraitReview(id,m)',[who,mood])
                    path=out/f'parley-{who}-{w}.png';page.screenshot(path=str(path))
                    rows.append({'id':f'parley-{who}-{w}','file':relative(path),'sha256':sha(path),'note':'Native canvas portrait/atlas-kit study with authored dialogue, not game integration.','owner_accepted':False})
                page.evaluate('window.setPortraitReview("cassia")');page.keyboard.press('ArrowRight')
                assert page.evaluate('window.portraitReview.character')=='brennic'
                page.keyboard.press('ArrowDown');assert page.evaluate('window.portraitReview.focus')==1
                assert page.locator('button,input,select,textarea').count()==0
                assert not errors,errors
                results.append({'viewport':[w,h],'loaded_portraits':len(manifest['portraits']),'all_ids_selected':True,'keyboard':'pass','errors':errors});page.close()
            for w,h in [(1920,1080),(2560,1440),(390,844)]:
                page=browser.new_page(viewport={'width':w,'height':h});page.goto((out/'portraits.html').as_uri())
                page.wait_for_function('[...document.images].every(i=>i.complete&&i.naturalWidth>0)')
                assert page.locator('img').count()==len(manifest['portraits'])
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth');page.close()
            browser.close()
    finally:server.shutdown();server.server_close();thread.join(timeout=5)
    write(ART/'reports/a2c-portrait-browser.json',{'status':'pass','results':results,'gallery_viewports':3,'scope':'art consumers only; identity, mood and game feel not automatically accepted'})
    board('A2c',rows);print(json.dumps(results))


if __name__=='__main__':main()
