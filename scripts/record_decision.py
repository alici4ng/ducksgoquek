#!/usr/bin/env python3
"""Append a coverage classification decision to data/review/decisions.jsonl.

Schema (one JSON object per line):
  review_id        str   queue review ID (R001..) or 'BOUNDARY-BULK' for bulk ways
  osm_way_id       int|str  source OSM way ID (one record per way; bulk ways get
                            one record each pointing at the shared boundary decision)
  classification   str   yes | no | mixed | unresolved
  confidence       str   high | medium | low
  evidence_type    str   satellite | street_level | tags | boundary_inference | mixed
  observation      str   concise evidence note
  imagery_ref      str   tile URL(s) / coordinates viewed, capture date if known
  transition_coords list  for mixed: [{lat,lng,before,after}, ...] else []
  reviewed_at      str   ISO UTC timestamp (auto)
  reviewer         str   e.g. 'hermes-agent-3' or 'boundary-scan'

Usage:
  python scripts/record_decision.py --review-id R005 --way 12345 \
      --class yes --confidence high --evidence satellite \
      --note "continuous roof band over way, shadow edge visible" \
      --ref "https://server.arcgisonline.com/.../tile/19/...@3.0685,101.6035" \
      [--transition '3.0685,101.6035,yes,no'] [--reviewer hermes-agent-3]

Validates fields and refuses invalid classification/confidence values.
"""
import argparse
import datetime
import json
import os
import sys

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "review", "decisions.jsonl")
VALID_CLASS = {"yes", "no", "mixed", "unresolved"}
VALID_CONF = {"high", "medium", "low"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--review-id", required=True)
    ap.add_argument("--way", required=True)
    ap.add_argument("--class", dest="cls", required=True)
    ap.add_argument("--confidence", required=True)
    ap.add_argument("--evidence", default="satellite")
    ap.add_argument("--note", required=True)
    ap.add_argument("--ref", default="")
    ap.add_argument("--transition", action="append", default=[],
                    help="lat,lng,before,after (repeatable)")
    ap.add_argument("--reviewer", default="hermes-agent")
    a = ap.parse_args()

    if a.cls not in VALID_CLASS:
        sys.exit(f"invalid classification {a.cls!r}; must be one of {sorted(VALID_CLASS)}")
    if a.confidence not in VALID_CONF:
        sys.exit(f"invalid confidence {a.confidence!r}; must be one of {sorted(VALID_CONF)}")
    if a.cls == "mixed" and not a.transition:
        sys.exit("mixed classification requires at least one --transition point")
    if a.cls == "unresolved" and not a.note:
        sys.exit("unresolved requires a note stating exact evidence/human check needed")

    trans = []
    for t in a.transition:
        lat, lng, before, after = t.split(",")
        trans.append({"lat": float(lat), "lng": float(lng),
                      "before": before.strip(), "after": after.strip()})

    rec = {
        "review_id": a.review_id,
        "osm_way_id": a.way,
        "classification": a.cls,
        "confidence": a.confidence,
        "evidence_type": a.evidence,
        "observation": a.note,
        "imagery_ref": a.ref,
        "transition_coords": trans,
        "reviewed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "reviewer": a.reviewer,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print(f"recorded {a.review_id}/{a.way} -> {a.cls} ({a.confidence})")


if __name__ == "__main__":
    main()
