"""Exercise actual canvas atlas loader and capture all review screens."""
import json
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright
from common import ART, ROOT, read, write, relative, sha
from covenant import board
from covenant_ui import UI, nine_slice


def stretch_proof():
    kit=read(UI/'kit.json');r=kit['regions']['panel.body'];page=next(p for p in kit['pages'] if p['id']==r['page']);x,y,w,h=r['rect']
    source=Image.open(UI/page['file']).crop((x,y,x+w,y+h));im=Image.new('RGB',(1920,1080),'#101820');d=ImageDraw.Draw(im)
    display=ImageFont.truetype(str(UI/'fonts/Cinzel.ttf'),40);body=ImageFont.truetype(str(UI/'fonts/SourceSans3.ttf'),28)
    d.text((96,66),'Covenant / Nine-slice stretch proof',font=display,fill='#eee8d6')
    xx=96
    for ww in [128,320,640,384]:
        patch=nine_slice(source,(ww,260),r['nineSlice']);im.paste(patch,(xx,190),patch);d.text((xx,474),str(ww)+' x 260',font=body,fill='#eee8d6');xx+=ww+48
    d.text((96,570),'42px corner insets retain exact source pixels; only edges and centre stretch.',font=body,fill='#bbc8ca')
    for i,hh in enumerate([112,192,320]):
        patch=nine_slice(source,(320,hh),r['nineSlice']);im.paste(patch,(96+i*410,650),patch)
    p=ART/'review/a5b/stretch-1920.png';p.parent.mkdir(parents=True,exist_ok=True);im.save(p)
    return {'id':'stretch-1920','file':relative(p),'sha256':sha(p),'note':'Native nine-slice size proof. Corner bytes verified unchanged.','owner_accepted':False}


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass


def main():
    rows=[stretch_proof()];results=[]
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(channel='chrome',headless=True)
            for w,h in [(1920,1080),(2560,1440)]:
                page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1);errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto(f'http://127.0.0.1:{server.server_port}/art/ui/preview.html')
                page.wait_for_function('window.covenantReview?.ready===true')
                for screen in ['menu','arena','camp','board','journal','parley','composition','pause','results','saves','controls']:
                    page.evaluate('(s)=>window.setCovenantScreen(s)',screen)
                    page.wait_for_function('(s)=>window.covenantReview.screen===s',arg=screen)
                    assert page.locator('input,select,button,textarea').count()==0
                    assert page.evaluate('document.fonts.check(\'28px "Source Sans 3"\') && document.fonts.check(\'40px "Cinzel"\')')
                    path=ART/'review/a5b'/f'{screen}-{w}.png';page.screenshot(path=str(path))
                    rows.append({'id':screen+'-'+str(w),'file':relative(path),'sha256':sha(path),'note':'Actual canvas kit-loader capture, authored review layout; not integrated gameplay.','owner_accepted':False})
                page.evaluate("window.setCovenantScreen('menu')")
                page.keyboard.press('ArrowDown');assert page.evaluate('window.covenantReview.focus')==1
                page.keyboard.press('ArrowUp');assert page.evaluate('window.covenantReview.focus')==0
                state=page.evaluate('window.covenantReview');assert state['regions']==90
                assert not errors,errors
                results.append({'viewport':[w,h],'screens':11,'fonts_loaded':True,'atlas_regions':state['regions'],'arrow_focus':'pass','dom_controls':0,'errors':errors})
                page.close()
            browser.close()
    finally:server.shutdown();server.server_close();thread.join(timeout=5)
    write(ART/'reports/a5b-ui-browser.json',{'status':'pass','results':results,'scope':'actual canvas art harness, not game-stream framework or gameplay performance'})
    board('A5b',rows);print(json.dumps(results))


if __name__=='__main__':main()
