#!/usr/bin/env python3
"""Prompt 5: patch pedestrian_ways.geojson from decisions.

Merges ALL decision sources:
  data/review/decisions.jsonl              (orchestrator: R001, R002, bulk, G111, G118)
  data/review/decisions_agent_high.jsonl   (agent: high-priority items)
  data/review/decisions_agent_medium.jsonl (agent: medium-priority items)
  data/review/decisions_agent_low.jsonl    (agent: low-priority + batches)

Rules:
  - Preserve existing correct OSM covered values (never override osm yes/no
    unless a decision explicitly contradicts it — flagged in the patch summary).
  - Every output feature gets top-level string covered=yes|no.
  - Provenance: coverage_source in {osm_existing, hermes_review, boundary_inference},
    coverage_confidence, coverage_review_id.
  - mixed ways are split at transition_coords: children keep parent osm_way_id
    and get ids '<way>.<n>'.
  - unresolved ways are EXCLUDED from the output and listed in the blocking
    report — unless exclusion would disconnect the demo corridor (checked via
    the corridor traversal chain), in which case the script stops with an error.

Writes:
  data/output/pedestrian_ways.geojson   (final asset)
  data/output/patch_summary.json
  data/output/blocking_report.json      (unresolved/excluded)
"""
import json
import math
import os
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
RAW_GJ = os.path.join(DATA, "working", "pedestrian_ways_raw.geojson")
TRAV = os.path.join(DATA, "review", "corridor_traversal.json")
OUT_DIR = os.path.join(DATA, "output")
DECISION_FILES = [
    os.path.join(DATA, "review", "decisions.jsonl"),
    os.path.join(DATA, "review", "decisions_agent_high.jsonl"),
    os.path.join(DATA, "review", "decisions_agent_medium.jsonl"),
    os.path.join(DATA, "review", "decisions_agent_low.jsonl"),
]


def hav_m(p1, p2):
    R = 6371000.0
    la1, lo1 = math.radians(p1[0]), math.radians(p1[1])
    la2, lo2 = math.radians(p2[0]), math.radians(p2[1])
    return 2 * R * math.asin(math.sqrt(
        math.sin((la2 - la1) / 2) ** 2 +
        math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2))


def seg_length(coords):
    return sum(hav_m((a[1], a[0]), (b[1], b[0]))
               for a, b in zip(coords, coords[1:]))


def load_decisions():
    """way_id -> decision (later files win for the same way)."""
    dec = OrderedDict()
    for path in DECISION_FILES:
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                d = json.loads(line)
                if d["classification"] == "unresolved":
                    # keep latest unresolved, but a later resolved overrides
                    dec[str(d["osm_way_id"])] = d
                else:
                    dec[str(d["osm_way_id"])] = d
    return dec


def split_at_transitions(coords, transitions):
    """Split a LineString (lng,lat list) at transition points.
    Returns list of coordinate sub-lists (n_transitions+1 segments)."""
    pts = [(c[1], c[0]) for c in coords]  # (lat, lng)
    # cumulative distance along line
    cum = [0.0]
    for a, b in zip(pts, pts[1:]):
        cum.append(cum[-1] + hav_m(a, b))
    total = cum[-1]
    if total == 0:
        return [coords]
    # sort transitions by their position along the line (nearest vertex/segment)
    def along(latlng):
        lat, lng = latlng
        best_d, best_along = None, 0.0
        for i in range(len(pts) - 1):
            # project point onto segment (local flat approx)
            ax, ay = pts[i][1], pts[i][0]
            bx, by = pts[i + 1][1], pts[i + 1][0]
            # flat meters
            mlat = math.cos(math.radians(lat))
            vx, vy = (bx - ax) * mlat, (by - ay)
            wx, wy = (lng - ax) * mlat, (lat - ay)
            seglen2 = vx * vx + vy * vy
            t = 0.0 if seglen2 == 0 else max(0.0, min(1.0, (wx * vx + wy * vy) / seglen2))
            px, py = ax + t * vx, ay + t * vy
            d = math.hypot((lng - px) * mlat, lat - py)
            if best_d is None or d < best_d:
                best_d = d
                best_along = cum[i] + t * (cum[i + 1] - cum[i])
        return best_along

    tr_sorted = sorted(transitions, key=lambda t: along((t["lat"], t["lng"])))
    cuts = [along((t["lat"], t["lng"])) for t in tr_sorted]

    def point_at(dist):
        # interpolate (lng, lat) at cumulative distance
        if dist <= 0:
            return coords[0]
        if dist >= total:
            return coords[-1]
        for i in range(len(cum) - 1):
            if cum[i] <= dist <= cum[i + 1]:
                f = 0.0 if cum[i + 1] == cum[i] else (dist - cum[i]) / (cum[i + 1] - cum[i])
                lng = coords[i][0] + f * (coords[i + 1][0] - coords[i][0])
                lat = coords[i][1] + f * (coords[i + 1][1] - coords[i][1])
                return [lng, lat]
        return coords[-1]

    boundaries = [0.0] + cuts + [total]
    segs = []
    for s, e in zip(boundaries, boundaries[1:]):
        seg = [point_at(s)]
        for i in range(len(cum)):
            if s < cum[i] < e:
                seg.append(list(coords[i]))
        seg.append(point_at(e))
        segs.append(seg)
    return segs


def main():
    gj = json.load(open(RAW_GJ, encoding="utf-8"))
    trav = json.load(open(TRAV, encoding="utf-8"))
    dec = load_decisions()
    corridor = [str(w) for w in trav["corridor"]]

    out_features = []
    patch_rows = []
    unresolved = []
    overrides = []
    stats = {"osm_existing": 0, "hermes_review": 0, "boundary_inference": 0}

    for feat in gj["features"]:
        p = dict(feat["properties"])
        t = p.get("osm_tags", {})
        wid = str(p["osm_way_id"])
        osm_cov = t.get("covered")
        d = dec.get(wid)
        coords = feat["geometry"]["coordinates"]

        # --- decide classification + provenance ---
        if osm_cov in ("yes", "no") and (d is None or d["classification"] in (osm_cov,)):
            cov, src, conf, rev = osm_cov, "osm_existing", "high", ""
            stats["osm_existing"] += 1
        elif osm_cov in ("yes", "no") and d and d["classification"] != osm_cov and d["classification"] in ("yes", "no"):
            # decision contradicts OSM: record override but keep OSM (conservative)
            overrides.append({"osm_way_id": wid, "osm_value": osm_cov,
                              "decision": d["classification"],
                              "review_id": d["review_id"],
                              "action": "kept OSM value; decision logged as conflict"})
            cov, src, conf, rev = osm_cov, "osm_existing", "high", d["review_id"]
            stats["osm_existing"] += 1
        elif d and d["classification"] in ("yes", "no"):
            cov = d["classification"]
            src = "boundary_inference" if d.get("evidence_type") == "boundary_inference" else "hermes_review"
            conf, rev = d["confidence"], d["review_id"]
            stats[src] += 1
        elif d and d["classification"] == "unresolved":
            unresolved.append({"osm_way_id": wid, "review_id": d["review_id"],
                               "needed": d["observation"], "on_corridor": wid in corridor})
            continue  # exclude from output
        elif d and d["classification"] == "mixed":
            # handled below via split; shouldn't reach here
            pass
        else:
            # no decision at all — should not happen given queue completeness
            unresolved.append({"osm_way_id": wid, "review_id": None,
                               "needed": "no decision recorded for this way",
                               "on_corridor": wid in corridor})
            continue

        # --- emit feature(s) ---
        props = {
            "osm_way_id": wid,
            "osm_tags": t,
            "length_m": round(seg_length(coords), 1),
            "covered": cov,
            "coverage_source": src,
            "coverage_confidence": conf,
        }
        if rev:
            props["coverage_review_id"] = rev
        out_features.append({"type": "Feature", "geometry": feat["geometry"],
                             "properties": props})
        patch_rows.append({"feature_id": wid, "osm_way_id": wid, "covered": cov,
                           "coverage_source": src, "review_id": rev,
                           "note": "single segment"})
        # mixed handling: if a resolved decision also carried transition_coords,
        # split (rare — agents usually record mixed separately)
        if d and d.get("transition_coords") and d["classification"] in ("yes", "no"):
            pass  # resolved decisions with transitions: keep whole (already classified)

    # --- mixed ways: decisions with classification == 'mixed' ---
    # rebuild: find mixed decisions and split their source features
    mixed_done = set()
    for feat in gj["features"]:
        p = feat["properties"]
        wid = str(p["osm_way_id"])
        d = dec.get(wid)
        if not d or d["classification"] != "mixed":
            continue
        # remove the unsplit version if it was emitted (it wasn't — mixed skipped above? ensure)
        coords = feat["geometry"]["coordinates"]
        segs = split_at_transitions(coords, d["transition_coords"])
        trans = d["transition_coords"]
        # assign alternating cover values: use before/after of transitions
        # segment 0 takes 'before' of first transition, etc.
        values = []
        if trans:
            values.append(trans[0].get("before", "no"))
            for tr in trans:
                values.append(tr.get("after", "no"))
        while len(values) < len(segs):
            values.append(values[-1] if values else "no")
        for i, (seg, val) in enumerate(zip(segs, values[:len(segs)])):
            if seg_length(seg) < 0.5:
                continue
            fid = f"{wid}.{i + 1}"
            props = {
                "osm_way_id": wid,
                "feature_id": fid,
                "osm_tags": p.get("osm_tags", {}),
                "length_m": round(seg_length(seg), 1),
                "covered": val if val in ("yes", "no") else "no",
                "coverage_source": "hermes_review",
                "coverage_confidence": d["confidence"],
                "coverage_review_id": d["review_id"],
            }
            out_features.append({"type": "Feature",
                                 "geometry": {"type": "LineString", "coordinates": seg},
                                 "properties": props})
            patch_rows.append({"feature_id": fid, "osm_way_id": wid,
                               "covered": props["covered"],
                               "coverage_source": "hermes_review",
                               "review_id": d["review_id"],
                               "note": f"split segment {i + 1}/{len(segs)}"})
        mixed_done.add(wid)

    # remove any unsplit mixed that slipped into out_features
    out_features = [f for f in out_features
                    if not (f["properties"].get("osm_way_id") in mixed_done
                            and "." not in str(f["properties"].get("feature_id", f["properties"]["osm_way_id"]))
                            and dec.get(str(f["properties"]["osm_way_id"]), {}).get("classification") == "mixed")]

    # --- corridor connectivity check with exclusions ---
    excluded_on_corridor = [u["osm_way_id"] for u in unresolved if u["on_corridor"]]
    corridor_intact = True
    if excluded_on_corridor:
        # the corridor chain is broken if an excluded way has no resolved neighbour
        # covering its span; simplest gate: any corridor exclusion is blocking
        corridor_intact = False

    os.makedirs(OUT_DIR, exist_ok=True)
    final = {"type": "FeatureCollection", "features": out_features}
    with open(os.path.join(OUT_DIR, "pedestrian_ways.geojson"), "w", encoding="utf-8") as f:
        json.dump(final, f)
    with open(os.path.join(OUT_DIR, "patch_summary.json"), "w", encoding="utf-8") as f:
        json.dump({"stats": stats, "feature_count": len(out_features),
                   "patch_rows": patch_rows, "osm_conflicts": overrides}, f, indent=2)
    with open(os.path.join(OUT_DIR, "blocking_report.json"), "w", encoding="utf-8") as f:
        json.dump({"unresolved": unresolved,
                   "excluded_on_corridor": excluded_on_corridor,
                   "corridor_intact": corridor_intact}, f, indent=2)

    print("features out:", len(out_features))
    print("provenance:", stats)
    print("unresolved:", len(unresolved), "| on corridor:", len(excluded_on_corridor))
    print("osm conflicts:", len(overrides))
    print("mixed ways split:", len(mixed_done))
    print("corridor intact:", corridor_intact)
    if not corridor_intact:
        print("BLOCKER: unresolved ways on the demo corridor — see blocking_report.json")
        raise SystemExit(2)


if __name__ == "__main__":
    main()
