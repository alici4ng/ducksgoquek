#!/usr/bin/env python3
"""Travelero coverage pipeline — Step 3: verify extraction artifacts.

Checks:
  1. Raw Overpass cache parses and has elements.
  2. Working GeoJSON is a valid FeatureCollection with LineString/MultiLineString geoms.
  3. Every feature carries osm_way_id, length_m, osm_tags, status, status_reason.
  4. osm_way_id and osm_tags on every feature exactly match the raw way (id + full tag dict).
  5. Inventory CSV row count == feature count, and ids align 1:1.

Exit code 0 = all checks pass.
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_CACHE = REPO_ROOT / "data" / "overpass" / "overpass_response.json"
GEOJSON = REPO_ROOT / "data" / "working" / "pedestrian_ways_raw.geojson"
CSV_FILE = REPO_ROOT / "data" / "working" / "coverage_inventory.csv"

failures: list[str] = []


def check(cond: bool, msg: str) -> None:
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        failures.append(msg)


def main() -> int:
    raw = json.loads(RAW_CACHE.read_text(encoding="utf-8"))
    check(isinstance(raw.get("elements"), list) and len(raw["elements"]) > 0,
          f"raw cache parses; {len(raw.get('elements', []))} elements")

    raw_ways = {e["id"]: e.get("tags", {}) for e in raw["elements"] if e["type"] == "way"}

    fc = json.loads(GEOJSON.read_text(encoding="utf-8"))
    check(fc.get("type") == "FeatureCollection", "geojson is FeatureCollection")
    feats = fc.get("features", [])
    check(all(f.get("type") == "Feature" for f in feats), "all entries are Features")
    check(all(f["geometry"]["type"] in ("LineString", "MultiLineString") for f in feats),
          "all geometries LineString/MultiLineString")

    req_props = ("osm_way_id", "length_m", "osm_tags", "status", "status_reason")
    check(all(all(k in f["properties"] for k in req_props) for f in feats),
          "every feature has osm_way_id, length_m, osm_tags, status, status_reason")
    check(all(isinstance(f["properties"]["length_m"], (int, float)) and
              f["properties"]["length_m"] >= 0 for f in feats),
          "length_m numeric and >= 0 on every feature")

    tag_mismatch = [f["properties"]["osm_way_id"] for f in feats
                    if f["properties"]["osm_way_id"] not in raw_ways
                    or f["properties"]["osm_tags"] != raw_ways[f["properties"]["osm_way_id"]]]
    check(not tag_mismatch,
          f"osm_way_id + full osm_tags match raw ways on every feature (mismatches: {len(tag_mismatch)})")

    with CSV_FILE.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    check(len(rows) == len(feats), f"CSV rows ({len(rows)}) == features ({len(feats)})")
    check({int(r["osm_way_id"]) for r in rows} == {f["properties"]["osm_way_id"] for f in feats},
          "CSV way ids align 1:1 with feature ids")
    length_ok = all(abs(float(r["length_m"]) -
                        next(f["properties"]["length_m"] for f in feats
                             if f["properties"]["osm_way_id"] == int(r["osm_way_id"]))) < 0.01
                    for r in rows)
    check(length_ok, "CSV length_m matches feature length_m")

    print(f"\n{'ALL CHECKS PASSED' if not failures else f'{len(failures)} FAILURES'}")
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
