"""Extract the exact AU3 prose into v1 payloads; no network or generation."""
from pathlib import Path
import json, re
ROOT = Path(__file__).resolve().parents[2]
text = (ROOT / 'docs/audio/AU3-FULL-TRACKS-PLAN.md').read_text(encoding='utf-8')
positive = re.search(r'Shared positive global styles.*?\n> (.+)', text, re.S).group(1).split('\n')[0]
negative = re.search(r'Shared negative global styles.*?\n> (.+)', text, re.S).group(1).split('\n')[0]
tracks = []
for letter, slug, title in [('C','reed-oath','Reed oath'), ('D','lyre-under-iron','Lyre under iron'), ('A','hide-and-iron','Hide and iron')]:
    part = text.split(f'### {letter} — {title}')[1].split('\n### ')[0].split('\nFor a 120')[0]
    identity = re.search(r'\n> (.+)', part).group(1)
    sections = []
    for name, ms, prompt in re.findall(r'^\| ([^|]+?) / (\d+) \| (.+?) \|$', part, re.M):
        sections.append(dict(section_name=name, duration_ms=int(ms), positive_local_styles=[prompt], negative_local_styles=['vocals','tempo change'], lines=[]))
    assert len(sections) == 6 and sum(s['duration_ms'] for s in sections) == 150000
    tracks.append(dict(id=f'arena-{letter}-{slug}', title=title, seconds=150, request=dict(model_id='music_v1', respect_sections_durations=True, store_for_inpainting=True, composition_plan=dict(positive_global_styles=[positive,identity], negative_global_styles=negative.rstrip('.').split(', '), sections=sections))))
out = ROOT / 'tools/audio/composition-plan-r4.json'
out.write_text(json.dumps(dict(wave='AU3', tracks=tracks), ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('Prepared three exact six-section 150 s plans; zero API calls.')
