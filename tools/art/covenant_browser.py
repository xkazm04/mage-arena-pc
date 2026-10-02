"""Portable owner-board browser integrity; never a game performance claim."""
import argparse
import json
from playwright.sync_api import sync_playwright
from common import ART, read, write


def check(wave):
    folder=ART/'review'/wave.lower();rows=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',headless=True)
        for w,h in [(1920,1080),(2560,1440),(390,844)]:
            page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto((folder/'index.html').as_uri())
            page.locator('img').evaluate_all("imgs=>imgs.forEach(i=>i.loading='eager')")
            page.wait_for_function("[...document.images].every(i=>i.complete&&i.naturalWidth>0)")
            count=page.locator('img').count()
            assert count==len(read(folder/'manifest.json')['rows'])
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
            assert not errors
            page.screenshot(path=str(folder/f'board-{w}.png'))
            rows.append({'size':[w,h],'loaded_images':count,'page_errors':errors,'horizontal_overflow':False})
            page.close()
        browser.close()
    result={'wave':wave,'status':'pass','scope':'owner board only, not game UI','results':rows}
    write(ART/'reports'/(wave.lower()+'-covenant-browser.json'),result);print(json.dumps(result))


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('wave');a=p.parse_args();check(a.wave)
