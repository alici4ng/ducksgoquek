#!/usr/bin/env python3
"""Build an INTERIM pedestrian_ways asset so routing development can start
before the full imagery review completes.

Coverage values applied:
  1. Existing OSM covered=yes/no tags (preserved verbatim).
  2. Recorded Hermes decisions from data/review/decisions.jsonl.
  3. Everything else: covered=no with coverage_source=default_pending
     (development default; the final patch replaces these).

Every feature keeps osm_way_id + full osm_tags + length_m, so the routing
agent can build the graph exactly as it will with the final asset.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
RAW = os.path.join(DATA, "working", "pedestrian_ways_raw.geojson")
DEC = os.path.join(DATA, "review", "decisions.jsonl")
OUT = os.path.join(DATA, "working", "pedestrian_ways_interim.geojson")

gj = json.load(open(RAW, encoding="utf-8"))
decisions = {}
if os.path.exists(DEC):
    with open(DEC, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            d = json.loads(line)
            decisions[str(d["osm_way_id"])] = d

stats = {"osm_explicit": 0, "hermes_reviewed": 0, "default_pending": 0}
covered_yes = covered_no = 0
len_yes = len_no = 0.0

for feat in gj["features"]:
    p = feat["properties"]
    t = p.get("osm_tags", {})
    wid = str(p["osm_way_id"])
    osm_cov = t.get("covered")
    d = decisions.get(wid)

    if osm_cov in ("yes", "no"):
        cov = osm_cov
        src = "osm_existing"
        conf = "high"
        rev = ""
        stats["osm_explicit"] += 1
    elif d and d["classification"] in ("yes", "no"):
        cov = d["classification"]
        src = ("boundary_inference" if d.get("evidence_type") == "boundary_inference"
               else "hermes_review")
        conf = d["confidence"]
        rev = d["review_id"]
        stats["hermes_reviewed"] += 1
    else:
        cov = "no"
        src = "default_pending"
        conf = "low"
        rev = ""
        stats["default_pending"] += 1

    p["covered"] = cov
    p["coverage_source"] = src
    p["coverage_confidence"] = conf
    if rev:
        p["coverage_review_id"] = rev
    if cov == "yes":
        covered_yes += 1
        len_yes += p["length_m"]
    else:
        covered_no += 1
        len_no += p["length_m"]

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(gj, f)

total = len_yes + len_no
print("wrote", OUT)
print("coverage provenance:", stats)
print(f"features: {len(gj['features'])} | covered=yes: {covered_yes} ({len_yes:.0f}m) | covered=no: {covered_no} ({len_no:.0f}m)")
print(f"covered by length: {100*len_yes/total:.1f}%")
