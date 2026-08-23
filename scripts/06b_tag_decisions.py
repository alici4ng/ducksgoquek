#!/usr/bin/env python3
"""Resolve deterministic covered=yes ways from tags alone (no vision needed).

indoor=yes / highway=corridor  -> inside a building  -> roofed by definition
tunnel=building_passage        -> through a building  -> roofed by definition

Appends decisions to data/review/decisions.jsonl with evidence_type=tags.
These may be overridden later by agent imagery review (07_patch.py loads
agent files after decisions.jsonl, so agent verdicts win if they exist).
"""
import json
import os
import sys
import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
RAW = os.path.join(DATA, "working", "pedestrian_ways_raw.geojson")
OUT = os.path.join(DATA, "review", "decisions.jsonl")

# ways already decided (don't re-record)
existing = set()
if os.path.exists(OUT):
    for line in open(OUT, encoding="utf-8"):
        if line.strip():
            existing.add(str(json.loads(line)["osm_way_id"]))

gj = json.load(open(RAW, encoding="utf-8"))
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
added = 0
recs = []
for f in gj["features"]:
    p = f["properties"]
    t = p.get("osm_tags", {})
    wid = str(p["osm_way_id"])
    if t.get("covered") in ("yes", "no"):
        continue
    if wid in existing:
        continue
    indoor = t.get("indoor") == "yes" or t.get("highway") == "corridor"
    passage = t.get("tunnel") == "building_passage"
    if not (indoor or passage):
        continue
    kind = "building_passage" if passage else "indoor_corridor"
    recs.append({
        "review_id": f"TAG-{kind.upper()}",
        "osm_way_id": int(wid),
        "classification": "yes",
        "confidence": "high",
        "evidence_type": "tags",
        "observation": (f"Tag-derived: {kind} — {'passes through a building' if passage else 'located inside a building'}; "
                        f"overhead roof implied by definition. No imagery required."),
        "imagery_ref": f"osm_tags {dict((k, t[k]) for k in ('highway','indoor','tunnel','corridor') if k in t)}",
        "transition_coords": [],
        "reviewed_at": now,
        "reviewer": "orchestrator-tag-inference",
    })
    added += 1

with open(OUT, "a", encoding="utf-8") as fh:
    for r in recs:
        fh.write(json.dumps(r, ensure_ascii=False) + "\n")

print(f"recorded {added} deterministic tag-based covered=yes decisions")
bp = sum(1 for r in recs if r["review_id"] == "TAG-BUILDING_PASSAGE")
print(f"  building_passage: {bp}, indoor_corridor: {added - bp}")
print("way ids:", [r["osm_way_id"] for r in recs])
