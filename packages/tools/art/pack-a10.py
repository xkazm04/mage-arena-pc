"""Losslessly pack accepted A10 pixels; original 384px coordinates stay in orig/trim.

No generation, resampling, discarded pixels with nonzero alpha, or art-worktree IO.
Run: python packages/tools/art/pack-a10.py
"""
import copy
import hashlib
import json
import math
from pathlib import Path
from PIL import Image

ROOT = Path("assets/accepted/covenant")
manifest = json.loads((ROOT / "manifest.json").read_text())
original = json.loads((ROOT / "a10/characters.json").read_text())
packed = copy.deepcopy(original)
stats = []


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def output(file, key, metadata):
    path = ROOT / file
    sha = digest(path)
    manifest["entries"][key] = {"file": file, "sha256": sha}
    if "size" in metadata:
        manifest["entries"][key]["size"] = metadata["size"]
    path.with_name(path.name + ".json").write_text(json.dumps({
        **metadata, "sha256": sha, "integration": "U4 lossless engine atlas packing",
        "derivation": "common alpha bounding box across every entity key; 2px gutters; no resampling",
        "sourceManifestSha256": digest(ROOT / "a10/characters.json"),
    }, indent=2) + "\n", encoding="utf-8", newline="\n")


for page in packed["pages"]:
    source = ROOT / page["file"].removeprefix("art/delivery/")
    assert digest(source) == page["sha256"]
    source_hash = page["sha256"]
    image = Image.open(source).convert("RGBA")
    frames = [f for body in packed["entities"].values()
              for states in body["clips"].values() for clip in states.values()
              if clip["page"] == page["id"] for f in clip["frames"]]
    rects = sorted(set(tuple(f["rect"]) for f in frames))
    cells = {r: image.crop((r[0], r[1], r[0] + r[2], r[1] + r[3])) for r in rects}
    bounds = [cell.getchannel("A").getbbox() for cell in cells.values()]
    assert all(bounds)
    left, top = min(b[0] for b in bounds), min(b[1] for b in bounds)
    right, bottom = max(b[2] for b in bounds), max(b[3] for b in bounds)
    width, height = right - left, bottom - top
    columns = min(8, len(rects))
    size = (columns * (width + 4), math.ceil(len(rects) / columns) * (height + 4))
    atlas = Image.new("RGBA", size)
    mapping = {}
    for index, rect in enumerate(rects):
        x, y = index % columns * (width + 4) + 2, index // columns * (height + 4) + 2
        crop = cells[rect].crop((left, top, right, bottom))
        atlas.paste(crop, (x, y))  # Copy straight RGBA bytes; do not composite alpha twice.
        assert atlas.crop((x, y, x + width, y + height)).tobytes() == crop.tobytes()
        mapping[rect] = [x, y, width, height]
    for frame in frames:
        rect = tuple(frame["rect"])
        frame.update(rect=mapping[rect], orig=[rect[2], rect[3]], trim=[left, top, width, height], sourceRect=list(rect))
    file = f"a10/packed/{page['id']}.png"
    path = ROOT / file
    path.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(path)
    stats.append({"page": page["id"], "keys": len(rects), "originalBytes": image.width * image.height * 4,
                  "packedBytes": atlas.width * atlas.height * 4, "crop": [left, top, width, height],
                  "pixelEquality": True, "nonzeroAlphaDiscarded": 0})
    output(file, f"a10.packed.{page['id']}", {"sourceDelivery": str(source).replace("\\", "/"), "sourceSha256": source_hash, "size": list(size)})
    page.update(file=file, size=list(size), sha256=digest(path))

packed["packing"] = "U4 lossless common-bounds packing; orig/trim preserve the unrotated 384px contract"
(ROOT / "a10/packed/characters.json").write_text(json.dumps(packed, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
output("a10/packed/characters.json", "a10.packed.manifest", {"sourceDelivery": "a10/characters.json"})
(ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
report = {"pages": stats, "originalBytes": sum(s["originalBytes"] for s in stats), "packedBytes": sum(s["packedBytes"] for s in stats)}
Path("docs/waves/U4-evidence/packing.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8", newline="\n")
print(json.dumps({k: v for k, v in report.items() if k != "pages"}))
