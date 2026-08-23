#!/usr/bin/env python3
"""Download z19 Esri tiles for the low-priority + batch review and annotate
each tile with the way geometries it contains (projected to tile pixels).
Output: tiles/<x>_<y>.jpg (raw) and <x>_<y>_annot.png (annotated) + manifest.json
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "scripts")))
from tile_url import tile_xy, esri_url  # noqa: E402

from PIL import Image, ImageDraw, ImageFont  # noqa: E402

BASE = os.path.dirname(os.path.abspath(__file__))
GJ = os.path.join(BASE, "..", "..", "working", "pedestrian_ways_raw.geojson")
Z = 19
TILE = 256

# review_id -> way ids (individual low items)
INDIVIDUAL = {
    "G006": [210994261],
    "G008": [210994303],
    "G040": [777826792],
    "G042": [921167830],
    "G045": [931278406],
    "G046": [991986584],
    "G110": [1427916322],
}
G135 = [151224274, 210994244, 210994304, 221195953, 221195960, 221195964,
        221195967, 221195973, 221195974, 263461647, 603815895, 764530864,
        776301354, 776301355, 992117732, 1230756957, 1232335178, 1234667535,
        1303809998, 1303809999, 1469997594, 1469997595, 1469997596,
        1469997597, 1469997598, 1469997599, 1469997600]
G136 = [1063221997, 1063221998, 1303647085, 1303647107, 1467785091]
BATCH = {"G135": G135, "G136": G136}

# Tiles to review. Individual: full way coverage. Batch: sample covering the
# member spread (+ 2 shared with G046 that also hold G135 members).
TILES = [
    (410108, 257678), (410109, 257678), (410109, 257679),          # G006+G008
    (410122, 257663), (410122, 257662),                            # G040
    (410121, 257669), (410121, 257670),                            # G042
    (410120, 257662), (410120, 257663),                            # G045
    (410123, 257680), (410123, 257679), (410124, 257679),          # G046 (+G135 members)
    (410124, 257680), (410124, 257681), (410123, 257681),
    (410122, 257665), (410121, 257665),                            # G110
    (410111, 257677), (410112, 257677), (410123, 257668),          # G135 sample
    (410122, 257667), (410110, 257666), (410116, 257680),
    (410122, 257674),
    (410122, 257677), (410120, 257665), (410120, 257669),          # G136
    (410114, 257673),
    (410122, 257664), (410122, 257666), (410111, 257678),          # G135 extras
    (410124, 257668),
]

COLORS = [
    (255, 0, 0), (0, 255, 255), (255, 255, 0), (0, 255, 0),
    (255, 0, 255), (255, 140, 0), (0, 120, 255), (255, 255, 255),
]


def load_geoms():
    with open(GJ, "r", encoding="utf-8") as f:
        gj = json.load(f)
    out = {}
    for feat in gj["features"]:
        wid = int(feat["properties"]["osm_way_id"])
        g = feat["geometry"]
        lines = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        out[wid] = [[(p[0], p[1]) for p in ls] for ls in lines]
    return out


def px(lng, lat, tx, ty):
    n = 2 ** Z
    gx = (lng + 180.0) / 360.0 * n
    lat_r = math.radians(lat)
    gy = (1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * n
    return (gx - tx) * TILE, (gy - ty) * TILE


def main():
    geoms = load_geoms()
    all_ways = []
    for rid, wids in INDIVIDUAL.items():
        for w in wids:
            all_ways.append((rid, w))
    for rid, wids in BATCH.items():
        for w in wids:
            all_ways.append((rid, w))

    tile_dir = os.path.join(BASE, "tiles")
    os.makedirs(tile_dir, exist_ok=True)
    manifest = []
    for tx, ty in TILES:
        ways_here = []
        for rid, wid in all_ways:
            for ls in geoms[wid]:
                inside = any(tile_xy(lat, lng, Z) == (tx, ty) for lng, lat in ls)
                # also include if segment crosses tile bbox (approx: check midpoints)
                if not inside:
                    for i in range(len(ls) - 1):
                        mlng = (ls[i][0] + ls[i + 1][0]) / 2
                        mlat = (ls[i][1] + ls[i + 1][1]) / 2
                        if tile_xy(mlat, mlng, Z) == (tx, ty):
                            inside = True
                            break
                if inside:
                    ways_here.append((rid, wid))
                    break
        manifest.append({"tile": [tx, ty], "url": esri_url(tx, ty, Z),
                         "ways": [{"review_id": r, "osm_way_id": w} for r, w in ways_here]})

    with open(os.path.join(BASE, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=1)
    for m in manifest:
        print(m["tile"], "->", [(w["review_id"], w["osm_way_id"]) for w in m["ways"]])

    # annotate
    try:
        font = ImageFont.truetype("arial.ttf", 13)
    except Exception:
        font = ImageFont.load_default()
    for m in manifest:
        tx, ty = m["tile"]
        raw = os.path.join(tile_dir, f"{tx}_{ty}.jpg")
        if not os.path.exists(raw) or os.path.getsize(raw) < 1000:
            print("MISSING TILE (download first):", raw)
            continue
        img = Image.open(raw).convert("RGB")
        draw = ImageDraw.Draw(img)
        for i, w in enumerate(m["ways"]):
            wid = w["osm_way_id"]
            color = COLORS[i % len(COLORS)]
            for ls in geoms[wid]:
                pts = [px(lng, lat, tx, ty) for lng, lat in ls]
                if len(pts) > 1:
                    draw.line(pts, fill=(0, 0, 0), width=5)
                    draw.line(pts, fill=color, width=3)
                # endpoint dots
                for p in (pts[0], pts[-1]):
                    draw.ellipse([p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4], fill=color, outline=(0, 0, 0))
            mid = pts[len(pts) // 2]
            label = str(wid)
            draw.text((mid[0] + 6, mid[1] - 16), label, fill=(0, 0, 0), font=font)
            draw.text((mid[0] + 5, mid[1] - 17), label, fill=color, font=font)
        annot = os.path.join(tile_dir, f"{tx}_{ty}_annot.png")
        img.save(annot)
    print("annotated OK")


if __name__ == "__main__":
    main()
