"""Read the actual owner deliverable in a local browser; no application changes."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from common import ART, write


def main():
    review = ART / 'review'
    shots = review / 'browser'
    shots.mkdir(parents=True, exist_ok=True)
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        for name, viewport in [('desktop', {'width': 1600, 'height': 1000}), ('mobile', {'width': 390, 'height': 844})]:
            page = browser.new_page(viewport=viewport, device_scale_factor=1)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto((review / 'index.html').as_uri())
            page.locator('img[loading]').evaluate_all("imgs=>imgs.forEach(i=>i.loading='eager')")
            page.wait_for_function("Array.from(document.querySelectorAll('figure img')).every(i=>i.complete)")
            images = page.locator('figure img').evaluate_all('(imgs)=>imgs.map(i=>({src:i.getAttribute("src"),width:i.naturalWidth,height:i.naturalHeight}))')
            assert all(i['width'] > 0 and i['height'] > 0 for i in images), images
            assert len(images) == len(json.loads((review / 'manifest.json').read_text(encoding='utf-8'))['current'])
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'), 'horizontal overflow'
            page.screenshot(path=str(shots / (name + '.png')), full_page=True)
            page.get_by_role('button', name='Arena comparison', exact=True).click()
            assert page.locator('.tile[data-scene=camp]:visible').count() == 0
            assert page.locator('.tile[data-scene=arena]:visible').count() == len(images) // 2
            page.get_by_role('button', name='Camp comparison', exact=True).click()
            assert page.locator('.tile[data-scene=arena]:visible').count() == 0
            page.get_by_role('button', name='Paired view', exact=True).click()
            page.locator('.zoom').first.click()
            assert page.locator('dialog').is_visible()
            page.wait_for_function('document.querySelector("dialog img").naturalWidth>0')
            page.get_by_role('button', name='Close', exact=True).click()
            assert not page.locator('dialog').is_visible()
            page.goto((review / 'attempts.html').as_uri())
            page.locator('img[loading]').evaluate_all("imgs=>imgs.forEach(i=>i.loading='eager')")
            page.wait_for_function('Array.from(document.querySelectorAll(".archive img")).every(i=>i.complete)')
            assert page.locator('.archive img').evaluate_all('imgs=>imgs.every(i=>i.naturalWidth>0)')
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
            assert not errors, errors
            results.append({'viewport': name, 'size': viewport, 'current_images_loaded': len(images),
                            'archive_images_loaded': page.locator('.archive img').count(), 'page_errors': errors,
                            'horizontal_overflow': False, 'filters_and_zoom': 'pass'})
            page.close()
        browser.close()
    write(ART / 'reports/browser-check.json', {'status': 'pass', 'browser': 'local Chrome, headless', 'label': 'measured browser behavior, not gameplay', 'results': results})
    print(json.dumps(results, indent=2))


if __name__ == '__main__':
    main()
