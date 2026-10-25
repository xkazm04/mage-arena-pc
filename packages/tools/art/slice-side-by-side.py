"""Side-by-side sheet for the D2 slice: a probe screenshot of the slice next to a target stand-in, at equal height.

Run from the repo root: python packages/tools/art/slice-side-by-side.py <slice.png> <target.png> <out.png> [label]
Deterministic, no generation. The sheets go to docs/waves/D2-evidence/ (PNG there is git-ignored).
"""
import sys
from PIL import Image, ImageDraw

slice_path, target_path, out_path = sys.argv[1:4]
label = sys.argv[4] if len(sys.argv) > 4 else ""
height = 720
a = Image.open(slice_path).convert("RGB")
b = Image.open(target_path).convert("RGB")
a = a.resize((round(a.width * height / a.height), height), Image.LANCZOS)
b = b.resize((round(b.width * height / b.height), height), Image.LANCZOS)
gap, band = 16, 40
sheet = Image.new("RGB", (a.width + gap + b.width, height + band), (22, 24, 28))
sheet.paste(a, (0, band))
sheet.paste(b, (a.width + gap, band))
d = ImageDraw.Draw(sheet)
d.text((8, 12), f"slice (provisional pick) {label}", fill=(220, 220, 220))
d.text((a.width + gap + 8, 12), target_path.replace("\\", "/").split("/")[-1], fill=(220, 220, 220))
sheet.save(out_path)
print(out_path, sheet.size)
