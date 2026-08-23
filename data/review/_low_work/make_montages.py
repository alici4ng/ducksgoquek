#!/usr/bin/env python3
"""Build montage views from annotated tiles to reduce vision calls.
Each montage groups geographically adjacent annotated tiles with labels."""
import os
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
T = os.path.join(BASE, "tiles")
OUT = os.path.join(BASE, "montages")
os.makedirs(OUT, exist_ok=True)
TS = 256

try:
    font = ImageFont.truetype("arial.ttf", 15)
except Exception:
    font = ImageFont.load_default()

# name -> grid of tile keys (None = blank), row-major
MONTAGES = {
    # G006+G008 cluster (L-shape)
    "m01_G006_G008": [[(410108, 257678), (410109, 257678)],
                      [None, (410109, 257679)]],
    # G040 (vertical pair)
    "m02_G040": [[(410122, 257662)], [(410122, 257663)]],
    # G042 + G136/1303647107 (2x2)
    "m03_G042_G136": [[(410120, 257669), (410121, 257669)],
                      [None, (410121, 257670)]],
    # G045 (vertical pair)
    "m04_G045": [[(410120, 257662)], [(410120, 257663)]],
    # G046 2x3 block (+ G135 992117732, 1232335178)
    "m05_G046": [[(410123, 257679), (410124, 257679)],
                 [(410123, 257680), (410124, 257680)],
                 [(410123, 257681), (410124, 257681)]],
    # G110 + G135 151224274/263461647/603815895/1303809998-99 column
    "m06_G110_col": [[(410122, 257664)],
                     [(410122, 257665)],
                     [(410122, 257666)],
                     [(410122, 257667)]],
    "m06b_G110_west": [[(410121, 257665)]],
    # G135 cluster A: Sunway South / 210994xxx + 14699975xx + 764530864
    "m07_G135_clusterA": [[(410111, 257677), (410112, 257677)],
                          [(410111, 257678), None]],
    # G135 cluster B: 2211959xx near elevated walkway
    "m08_G135_clusterB": [[(410123, 257668), (410124, 257668)]],
    # G135 steps cluster west of corridor
    "m09_G135_steps": [[(410110, 257666)]],
    # G135 singles
    "m10_G135_1234667535": [[(410116, 257680)]],
    "m11_G135_1230756957": [[(410122, 257674)]],
    # G136
    "m12_G136_1063221997_8": [[(410122, 257677)]],
    "m13_G136_1303647085": [[(410120, 257665)]],
    "m14_G136_1467785091": [[(410114, 257673)]],
}

for name, grid in MONTAGES.items():
    rows, cols = len(grid), max(len(r) for r in grid)
    canvas = Image.new("RGB", (cols * TS, rows * TS), (40, 40, 40))
    draw = ImageDraw.Draw(canvas)
    for r, row in enumerate(grid):
        for c, key in enumerate(row):
            if key is None:
                continue
            x, y = key
            p = os.path.join(T, f"{x}_{y}_annot.png")
            if not os.path.exists(p):
                print("MISSING:", p)
                continue
            canvas.paste(Image.open(p).convert("RGB"), (c * TS, r * TS))
            draw.rectangle([c * TS, r * TS, (c + 1) * TS - 1, (r + 1) * TS - 1],
                           outline=(255, 255, 255), width=1)
            draw.text((c * TS + 3, r * TS + 3), f"z19/{y}/{x}", fill=(255, 255, 0), font=font)
    out = os.path.join(OUT, name + ".png")
    canvas.save(out)
    print(name, canvas.size)
print("montages done")
