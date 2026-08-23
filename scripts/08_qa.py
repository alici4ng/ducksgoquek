#!/usr/bin/env python3
"""Prompt 6: strict QA pass on data/output/pedestrian_ways.geojson.

Checks (numbered per HERMES_COVERAGE_PROMPTS.md Prompt 6):
 1. valid GeoJSON FeatureCollection
 2. all features LineString/MultiLineString with valid coords
 3. all coords within bbox (3.063,101.599)-(3.075,101.610) [small epsilon]
 4. every feature has unique feature id + traceable osm_way_id
 5. covered exactly 'yes' or 'no' (string)
 6. every hermes-derived value links to a decision record
 7. OSM explicit tags preserved (compare vs raw inventory)
 8. mixed ways split (no single feature carrying a mixed decision)
 9. no duplicate geometries / zero-length segments
10. demo corridor connected (corridor traversal chain still represented)
11. stats: total length, feature count, covered % by length
12. list unresolved/low-confidence/suspicious segments

Writes data/output/qa_report.json and prints PASS/FAIL.
"""
import json
import math
import os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
OUT_GJ = os.path.join(DATA, "output", "pedestrian_ways.geojson")
RAW_GJ = os.path.join(DATA, "working", "pedestrian_ways_raw.geojson")
TRAV = os.path.join(DATA, "review", "corridor_traversal.json")
DEC_FILES = ["decisions.jsonl", "decisions_agent_high.jsonl",
             "decisions_agent_medium.jsonl", "decisions_agent_low.jsonl"]
BBOX = (3.063, 101.599, 3.075, 101.610)  # S W N E
EPS = 0.0005
REPORT = os.path.join(DATA, "output", "qa_report.json")


def hav_m(p1, p2):
    R = 6371000.0
    la1, lo1 = math.radians(p1[0]), math.radians(p1[1])
    la2, lo2 = math.radians(p2[0]), math.radians(p2[1])
    return 2 * R * math.asin(math.sqrt(
        math.sin((la2 - la1) / 2) ** 2 +
        math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2))


def main():
    errors, warnings = [], []
    checks = {}

    # 1. valid GeoJSON
    try:
        gj = json.load(open(OUT_GJ, encoding="utf-8"))
        assert gj.get("type") == "FeatureCollection"
        checks["1_valid_featurecollection"] = True
    except Exception as e:
        print("FAIL: not a valid GeoJSON FeatureCollection:", e)
        raise SystemExit(1)
    feats = gj["features"]

    # 2. geometry types + valid coords
    bad_geom = []
    for f in feats:
        g = f.get("geometry") or {}
        if g.get("type") not in ("LineString", "MultiLineString"):
            bad_geom.append(f["properties"].get("osm_way_id"))
            continue
        lines = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        for line in lines:
            if len(line) < 2:
                bad_geom.append(f["properties"].get("osm_way_id"))
            for c in line:
                if not (isinstance(c, list) and len(c) >= 2 and
                        isinstance(c[0], (int, float)) and isinstance(c[1], (int, float))):
                    bad_geom.append(f["properties"].get("osm_way_id"))
    checks["2_geometry_valid"] = not bad_geom
    if bad_geom:
        errors.append(f"invalid geometries: {bad_geom}")

    # 3. bbox
    out_of_bbox = []
    for f in feats:
        g = f["geometry"]
        lines = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        for line in lines:
            for lng, lat in line:
                if not (BBOX[1] - EPS <= lng <= BBOX[3] + EPS and
                        BBOX[0] - EPS <= lat <= BBOX[2] + EPS):
                    out_of_bbox.append((f["properties"].get("osm_way_id"), lat, lng))
    checks["3_within_bbox"] = not out_of_bbox
    if out_of_bbox:
        errors.append(f"{len(out_of_bbox)} coords outside bbox")

    # 4. unique feature id + osm_way_id
    fids = [f["properties"].get("feature_id", f["properties"].get("osm_way_id")) for f in feats]
    no_wid = [i for i, f in enumerate(feats) if not f["properties"].get("osm_way_id")]
    dup_ids = [k for k, v in defaultdict(int, {x: fids.count(x) for x in fids}).items() if v > 1]
    checks["4_ids_unique_traceable"] = not no_wid and not dup_ids
    if no_wid:
        errors.append(f"{len(no_wid)} features missing osm_way_id")
    if dup_ids:
        errors.append(f"duplicate feature ids: {dup_ids[:10]}")

    # 5. covered values
    bad_cov = [f["properties"].get("osm_way_id") for f in feats
               if f["properties"].get("covered") not in ("yes", "no")]
    checks["5_covered_yes_no_only"] = not bad_cov
    if bad_cov:
        errors.append(f"invalid covered values: {bad_cov}")

    # 6. provenance links
    decisions = {}
    for name in DEC_FILES:
        path = os.path.join(DATA, "review", name)
        if os.path.exists(path):
            for line in open(path, encoding="utf-8"):
                if line.strip():
                    d = json.loads(line)
                    decisions[str(d["osm_way_id"])] = d
    unlinked = []
    for f in feats:
        p = f["properties"]
        if p.get("coverage_source") in ("hermes_review", "boundary_inference"):
            if not p.get("coverage_review_id") and str(p["osm_way_id"]) not in decisions:
                unlinked.append(p.get("osm_way_id"))
    checks["6_provenance_linked"] = not unlinked
    if unlinked:
        errors.append(f"hermes values without decision link: {unlinked}")

    # 7. OSM preservation
    raw = json.load(open(RAW_GJ, encoding="utf-8"))
    raw_cov = {str(f["properties"]["osm_way_id"]): f["properties"].get("osm_tags", {}).get("covered")
               for f in raw["features"]}
    lost = []
    for f in feats:
        wid = str(f["properties"]["osm_way_id"])
        if raw_cov.get(wid) in ("yes", "no"):
            if f["properties"]["covered"] != raw_cov[wid] and "." not in wid:
                lost.append((wid, raw_cov[wid], f["properties"]["covered"]))
    checks["7_osm_preserved"] = not lost
    if lost:
        errors.append(f"OSM coverage altered: {lost}")

    # 8. mixed ways split
    mixed_wids = {wid for wid, d in decisions.items() if d.get("classification") == "mixed"}
    unsplit = []
    for wid in mixed_wids:
        parts = [f for f in feats if str(f["properties"].get("osm_way_id")) == wid]
        if len(parts) == 1 and "." not in str(parts[0]["properties"].get("feature_id", "")):
            unsplit.append(wid)
    checks["8_mixed_split"] = not unsplit
    if unsplit:
        errors.append(f"mixed ways not split: {unsplit}")

    # 9. duplicates / zero length
    seen_geoms, zero_len, dups = set(), [], []
    for f in feats:
        g = f["geometry"]
        key = json.dumps(g["coordinates"])
        if key in seen_geoms:
            dups.append(f["properties"].get("osm_way_id"))
        seen_geoms.add(key)
        lines = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        L = sum(hav_m((a[1], a[0]), (b[1], b[0])) for line in lines
                for a, b in zip(line, line[1:]))
        if L < 0.3:
            zero_len.append((f["properties"].get("osm_way_id"), round(L, 2)))
    checks["9_no_dups_zero_len"] = not dups and not zero_len
    if dups:
        warnings.append(f"duplicate geometries: {dups}")
    if zero_len:
        warnings.append(f"zero-length segments: {zero_len}")

    # 10. corridor connectivity
    trav = json.load(open(TRAV, encoding="utf-8"))
    corridor = [str(w) for w in trav["corridor"]]
    present = set()
    for f in feats:
        present.add(str(f["properties"].get("osm_way_id")))
    missing_corridor = [w for w in corridor if w not in present]
    checks["10_corridor_routable"] = not missing_corridor
    if missing_corridor:
        errors.append(f"corridor ways missing from output: {missing_corridor}")

    # 11/12. stats
    total_len = yes_len = no_len = 0.0
    yes_n = no_n = 0
    low_conf, suspicious = [], []
    for f in feats:
        p = f["properties"]
        g = f["geometry"]
        lines = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        L = sum(hav_m((a[1], a[0]), (b[1], b[0])) for line in lines
                for a, b in zip(line, line[1:]))
        total_len += L
        if p["covered"] == "yes":
            yes_n += 1
            yes_len += L
        else:
            no_n += 1
            no_len += L
        if p.get("coverage_confidence") == "low":
            low_conf.append(p.get("osm_way_id"))
        if p.get("coverage_source") == "default_pending":
            suspicious.append(p.get("osm_way_id"))

    stats = {
        "feature_count": len(feats),
        "total_route_length_m": round(total_len, 1),
        "covered_yes": {"features": yes_n, "length_m": round(yes_len, 1)},
        "covered_no": {"features": no_n, "length_m": round(no_len, 1)},
        "covered_pct_by_length": round(100 * yes_len / total_len, 2) if total_len else 0,
        "low_confidence": low_conf,
        "suspicious_default_pending": suspicious,
    }

    # verdict
    passed = all(checks.values())
    blocking = json.load(open(os.path.join(DATA, "output", "blocking_report.json"),
                              encoding="utf-8")) if os.path.exists(
        os.path.join(DATA, "output", "blocking_report.json")) else {"unresolved": []}
    if blocking.get("unresolved"):
        on_corr = [u for u in blocking["unresolved"] if u.get("on_corridor")]
        if on_corr:
            passed = False
            errors.append(f"unresolved ways block corridor: {on_corr}")

    report = {"verdict": "PASS" if passed else "FAIL", "checks": checks,
              "errors": errors, "warnings": warnings, "stats": stats,
              "unresolved": blocking.get("unresolved", [])}
    with open(REPORT, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print("VERDICT:", "PASS" if passed else "FAIL")
    for k, v in checks.items():
        print(f"  [{'ok' if v else 'XX'}] {k}")
    for e in errors:
        print("  ERROR:", e)
    for w in warnings:
        print("  WARN:", w)
    print(json.dumps(stats, indent=1))
    raise SystemExit(0 if passed else 1)


if __name__ == "__main__":
    main()
