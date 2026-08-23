#!/usr/bin/env python3
"""Tile URL helpers for the Travelero coverage pass.

Computes slippy-map tile URLs for a lat/lng at a zoom level so reviewers can
fetch overhead imagery deterministically. Primary source: Esri World Imagery
(free, no key, high-res over Bandar Sunway).

Usage:
  python tile_url.py LAT LNG [ZOOM]          # one point, default zoom 18
  python tile_url.py --poly "lng,lat lng,lat ..." [ZOOM]   # tiles covering a polyline
Output: one URL per line (deduped, ordered along the polyline).
"""
import math
import sys


def tile_xy(lat: float, lng: float, z: int):
    n = 2 ** z
    x = int((lng + 180.0) / 360.0 * n)
    lat_r = math.radians(lat)
    y = int((1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * n)
    return x, y


def esri_url(x: int, y: int, z: int) -> str:
    return (
        "https://server.arcgisonline.com/ArcGIS/rest/services/"
        f"World_Imagery/MapServer/tile/{z}/{y}/{x}"
    )


def tiles_along(coords, z):
    """coords: list of (lng, lat). Returns ordered, deduped tile (x,y) list."""
    seen = set()
    out = []
    prev = None
    for lng, lat in coords:
        x, y = tile_xy(lat, lng, z)
        if prev is None:
            cur = (x, y)
            if cur not in seen:
                seen.add(cur)
                out.append(cur)
            prev = cur
            continue
        # walk the tile line from prev to (x, y) so long segments get full coverage
        x0, y0 = prev
        steps = max(abs(x - x0), abs(y - y0), 1)
        for i in range(1, steps + 1):
            cx = round(x0 + (x - x0) * i / steps)
            cy = round(y0 + (y - y0) * i / steps)
            if (cx, cy) not in seen:
                seen.add((cx, cy))
                out.append((cx, cy))
        prev = (x, y)
    return out


def main(argv):
    if len(argv) >= 3 and argv[1] == "--poly":
        z = int(argv[3]) if len(argv) > 3 else 18
        coords = []
        for pair in argv[2].split():
            lng_s, lat_s = pair.split(",")
            coords.append((float(lng_s), float(lat_s)))
        for x, y in tiles_along(coords, z):
            print(esri_url(x, y, z))
    else:
        lat, lng = float(argv[1]), float(argv[2])
        z = int(argv[3]) if len(argv) > 3 else 18
        x, y = tile_xy(lat, lng, z)
        print(esri_url(x, y, z))


if __name__ == "__main__":
    main(sys.argv)
