"""Read-only raster measurement. Rebuilds the GAME footprint witness; no image edits."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path('assets/accepted/covenant')
manifest = json.loads((ROOT / 'a13/sigils.json').read_text())

def hull(points):
    points = sorted(set(points))
    def cross(o, a, b):
        return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lower, upper = [], []
    for chain, sequence in [(lower, points), (upper, reversed(points))]:
        for p in sequence:
            while len(chain) >= 2 and cross(chain[-2], chain[-1], p) <= 0:
                chain.pop()
            chain.append(p)
    return lower[:-1] + upper[:-1]

result = {}
for name, clip in manifest['clips'].items():
    if not name.startswith('threat.'):
        continue
    spec = next(p for p in manifest['pages'] if p['id'] == clip['page'])
    path = ROOT / spec['file'].replace('art/delivery/', '')
    image = Image.open(path).convert('RGBA')
    frames = []
    for frame in clip['frames']:
        x,y,w,h = frame['rect']
        alpha = image.crop((x,y,x+w,y+h)).getchannel('A')
        # Pixel corners conservatively describe the visible pigmented envelope.
        points = []
        for row in range(h):
            xs = [col for col in range(w) if alpha.getpixel((col,row)) >= 40]
            if xs:
                points.extend([(xs[0],row),(xs[-1]+1,row),(xs[0],row+1),(xs[-1]+1,row+1)])
        frames.append(hull(points))
    result[name] = {'sha256':hashlib.sha256(path.read_bytes()).hexdigest(), 'frames':frames}
out = ROOT / 'a13/footprints.json'
out.write_text(json.dumps({'alphaThreshold':40,'meaning':'convex envelope of painted pigment, not a filled collision mask','clips':result},separators=(',',':'))+'\n')
print(f'Measured {len(result)} threat clips / {sum(len(c["frames"]) for c in result.values())} frame envelopes -> {out}')
