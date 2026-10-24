"""Derive a tangent-space normal map from a painted colour page. Deterministic, local, no generation.

Height is the page luminance (alpha-weighted), box-blurred, then a Sobel pass gives the slope.
Pixels with no alpha get the flat normal (0, 0, 1). Output is RGBA: RGB = normal * 0.5 + 0.5, A = source alpha.
Also writes a lit proof strip: the same body under a point light at four positions, using the exact
lambert + falloff of packages/game/src/lighting/lighting-math.ts.

Run: python packages/tools/art/derive-normal-map.py [page] [out_name]
Default: assets/accepted/covenant/a10/packed/cassia.png -> packages/game/public/normal-maps/cassia.png
"""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

STRENGTH = 2.5
BLUR_RADIUS = 2
AMBIENT = 0.35
LIGHT_COLOR = (1.0, 0.62, 0.3)
LIGHT_Z = 90.0
LIGHT_RADIUS = 260.0
OUT = Path("packages/game/public/normal-maps")


def box_blur(a, r):
    if r <= 0:
        return a
    pad = np.pad(a, r, mode="edge")
    k = 2 * r + 1
    c = np.cumsum(np.pad(pad, ((1, 0), (0, 0))), axis=0)
    rows = (c[k:] - c[:-k]) / k
    c = np.cumsum(np.pad(rows, ((0, 0), (1, 0))), axis=1)
    return (c[:, k:] - c[:, :-k]) / k


def derive(rgba):
    rgb = rgba[..., :3].astype(np.float64) / 255.0
    alpha = rgba[..., 3].astype(np.float64) / 255.0
    lum = (0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]) * alpha
    h = box_blur(lum, BLUR_RADIUS)
    p = np.pad(h, 1, mode="edge")
    gx = (p[:-2, 2:] + 2 * p[1:-1, 2:] + p[2:, 2:]) - (p[:-2, :-2] + 2 * p[1:-1, :-2] + p[2:, :-2])
    gy = (p[2:, :-2] + 2 * p[2:, 1:-1] + p[2:, 2:]) - (p[:-2, :-2] + 2 * p[:-2, 1:-1] + p[:-2, 2:])
    n = np.stack([-gx * STRENGTH, -gy * STRENGTH, np.ones_like(gx)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    n[alpha <= 0] = (0.0, 0.0, 1.0)
    return n, rgba[..., 3]


def light(color, normal, alpha, lx, ly):
    h, w = alpha.shape
    ys, xs = np.mgrid[0:h, 0:w]
    d = np.stack([lx - xs, ly - ys, np.full((h, w), LIGHT_Z)], axis=-1)
    dist = np.linalg.norm(d, axis=-1)
    lam = np.clip(np.sum(normal * d / dist[..., None], axis=-1), 0, 1)
    fall = np.clip(1 - dist / LIGHT_RADIUS, 0, 1) ** 2
    lit = AMBIENT + lam * fall
    out = color[..., :3] / 255.0 * lit[..., None] + np.array(LIGHT_COLOR) * (lam * fall)[..., None] * 0.35
    return np.dstack([np.clip(out, 0, 1) * 255, alpha]).astype(np.uint8)


def main():
    page = Path(sys.argv[1] if len(sys.argv) > 1 else "assets/accepted/covenant/a10/packed/cassia.png")
    name = sys.argv[2] if len(sys.argv) > 2 else page.stem
    rgba = np.array(Image.open(page).convert("RGBA"))
    normal, alpha = derive(rgba)
    OUT.mkdir(parents=True, exist_ok=True)
    enc = np.dstack([np.round((normal * 0.5 + 0.5) * 255), alpha]).astype(np.uint8)
    path = OUT / f"{name}.png"
    Image.fromarray(enc, "RGBA").save(path, optimize=False)
    h, w = alpha.shape
    # Proof: a crop of the page lit from four points sweeping across it.
    cx, cy = w // 2, h // 2
    crop = slice(0, 344), slice(0, 868)
    tiles = []
    for i in range(4):
        lx = 868 * (0.15 + 0.23 * i)
        tiles.append(light(rgba[crop], normal[crop], alpha[crop], lx, 120))
    Image.fromarray(np.vstack(tiles), "RGBA").save(OUT / f"{name}-lit-proof.png")
    meta = {
        "source": str(page).replace("\\", "/"),
        "sourceSha256": hashlib.sha256(page.read_bytes()).hexdigest(),
        "size": [w, h],
        "method": "luminance height, box blur, Sobel",
        "strength": STRENGTH,
        "blurRadius": BLUR_RADIUS,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    }
    (OUT / f"{name}.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(path, meta["sha256"])


if __name__ == "__main__":
    main()
