"""
Export computed shade for visualisation.

Writes backend/demo/ files:
  buildings.geojson       building footprints + resolved heights (context layer)
  shadows_HHMM.geojson    shadow polygons per 30-min bucket, 07:00-19:00 KL
  meta.json               available buckets + viewport

Run from the repo root:
    python backend/export_shadows.py
"""
import json
import pathlib
from datetime import datetime, timedelta

import pytz
from shapely.geometry import box
from shapely.ops import transform

from shade import ShadeModel, SUNWAY_CENTER, M_PER_DEG_LAT

KL = pytz.timezone("Asia/Kuala_Lumpur")
DEMO_DATE = (2026, 8, 23)

# Demo viewport: Sunway core (Pyramid, Lagoon, BRT, universities)
VIEWPORT = {  # (west, south, east, north)
    "west": 101.5990, "south": 3.0630, "east": 101.6150, "north": 3.0760,
}

DATA = pathlib.Path(__file__).parent / "data" / "osm_buildings.geojson"
OUT = pathlib.Path(__file__).parent / "demo"


def round_coords(geom, ndigits=6):
    return transform(lambda x, y, z=None: (round(x, ndigits), round(y, ndigits)), geom)


def main():
    model = ShadeModel(str(DATA), center=SUNWAY_CENTER)
    print(f"Loaded {len(model._buildings)} buildings")

    # viewport in projected metres
    m_lng = model.m_per_deg_lng
    vp_m = box(
        (VIEWPORT["west"] - model.lng0) * m_lng, (VIEWPORT["south"] - model.lat0) * M_PER_DEG_LAT,
        (VIEWPORT["east"] - model.lng0) * m_lng, (VIEWPORT["north"] - model.lat0) * M_PER_DEG_LAT,
    )

    def to_lnglat(geom):
        return transform(
            lambda x, y, z=None: (x / m_lng + model.lng0, y / M_PER_DEG_LAT + model.lat0),
            geom,
        )

    OUT.mkdir(parents=True, exist_ok=True)

    # buildings context layer
    feats = []
    for poly, height in model._buildings:
        if poly.intersects(vp_m):
            feats.append({
                "type": "Feature",
                "properties": {"height": round(height, 1)},
                "geometry": round_coords(to_lnglat(poly)).__geo_interface__,
            })
    with open(OUT / "buildings.geojson", "w") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f)
    print(f"buildings.geojson: {len(feats)} features in viewport")

    # shadow layers per 30-min bucket
    buckets = []
    t = KL.localize(datetime(*DEMO_DATE, 7, 0))
    end = KL.localize(datetime(*DEMO_DATE, 19, 0))
    while t <= end:
        tree, shadows = model._shadow_tree(t)
        label = t.strftime("%H%M")
        if tree is not None:
            idxs = set(tree.query(vp_m))
            feats = [
                {"type": "Feature", "properties": {},
                 "geometry": round_coords(to_lnglat(shadows[i])).__geo_interface__}
                for i in idxs
            ]
            with open(OUT / f"shadows_{label}.geojson", "w") as f:
                json.dump({"type": "FeatureCollection", "features": feats}, f)
            buckets.append(label)
            print(f"shadows_{label}.geojson: {len(feats)} polygons")
        else:
            print(f"{label}: night (sun below horizon) — skipped")
        t += timedelta(minutes=30)

    with open(OUT / "meta.json", "w") as f:
        json.dump({"buckets": buckets, "viewport": VIEWPORT,
                   "date": f"{DEMO_DATE[0]}-{DEMO_DATE[1]:02d}-{DEMO_DATE[2]:02d}"}, f)
    print(f"\nDone. {len(buckets)} buckets -> {OUT}")


if __name__ == "__main__":
    main()
