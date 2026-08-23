#!/usr/bin/env python3
"""Travelero coverage pipeline — Step 2: convert Overpass cache to GeoJSON + inventory.

Approach: MANUAL Python conversion (ways + nodes from raw Overpass JSON -> LineString
features). Chosen over `npx osmtogeojson` because it guarantees deterministic
preservation of the numeric OSM way id, the complete original tag dict, and per-feature
derived fields (length_m, status) with no external-dependency drift.

Input:  data/overpass/overpass_response.json   (from scripts/01_extract.py)
Output: data/working/pedestrian_ways_raw.geojson
        data/working/coverage_inventory.csv
        data/working/inventory_summary.json

Phase rule: NEVER alter existing covered values — this pass only classifies.

Status rules (preliminary):
  existing_explicit  covered=yes|no, or covered=* with clear built meaning
                     (arcade, colonnade, roof, portico, building_passage)
  implicit_review    no covered tag, but tunnel=building_passage, indoor=yes,
                     highway=corridor, layer>=1, or bridge=yes pedestrian way
  ambiguous          covered value unclear, or conflicting tags
                     (e.g. covered=no with indoor=yes / building_passage)
  missing            no covered tag and no implicit signal
"""
from __future__ import annotations

import csv
import json
import math
import sys
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_CACHE = REPO_ROOT / "data" / "overpass" / "overpass_response.json"
WORKING_DIR = REPO_ROOT / "data" / "working"
GEOJSON_OUT = WORKING_DIR / "pedestrian_ways_raw.geojson"
CSV_OUT = WORKING_DIR / "coverage_inventory.csv"
SUMMARY_OUT = WORKING_DIR / "inventory_summary.json"

ROUTABLE_HIGHWAYS = {"footway", "path", "pedestrian", "steps", "corridor", "living_street"}
# covered values with clear BUILT overhead-cover meaning (canopy/shadow do not count)
EXPLICIT_COVERED = {"yes", "no", "arcade", "colonnade", "roof", "portico", "building_passage"}
CSV_COLUMNS = ["osm_way_id", "highway", "footway", "sidewalk", "corridor", "tunnel",
               "indoor", "layer", "bridge", "covered", "length_m", "status", "reason"]

EARTH_RADIUS_M = 6371008.8


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def path_length_m(coords: list[list[float]]) -> float:
    total = 0.0
    for (lon1, lat1), (lon2, lat2) in zip(coords, coords[1:]):
        total += haversine_m(lat1, lon1, lat2, lon2)
    return total


def classify(tags: dict) -> tuple[str, str]:
    """Return (status, reason) without modifying any tag."""
    covered = tags.get("covered")
    highway = tags.get("highway", "")
    tunnel = tags.get("tunnel", "")
    indoor = tags.get("indoor", "")
    layer_raw = tags.get("layer", "")
    bridge = tags.get("bridge", "")

    if covered is not None:
        cv = covered.strip().lower()
        if cv in EXPLICIT_COVERED:
            # conflicting combos: explicitly uncovered yet tagged as interior/passage
            if cv == "no" and (indoor.lower() == "yes" or tunnel == "building_passage"):
                return ("ambiguous",
                        f"covered=no conflicts with indoor={indoor}/tunnel={tunnel}")
            return ("existing_explicit", f"covered={covered} is an explicit built-cover value")
        return ("ambiguous", f"covered={covered} value has no clear built-cover meaning")

    implicit_signals = []
    if tunnel == "building_passage":
        implicit_signals.append("tunnel=building_passage")
    if indoor.lower() == "yes":
        implicit_signals.append("indoor=yes")
    if highway == "corridor":
        implicit_signals.append("highway=corridor")
    if highway in ROUTABLE_HIGHWAYS:  # layer/bridge signals apply to pedestrian ways only
        try:
            if float(layer_raw) >= 1:
                implicit_signals.append(f"layer={layer_raw}")
        except (TypeError, ValueError):
            pass
        if bridge.lower() in {"yes", "covered_bridge", "viaduct"}:
            implicit_signals.append(f"bridge={bridge}")

    if implicit_signals:
        return ("implicit_review",
                "no covered tag; possibly covered: " + ", ".join(implicit_signals))
    return ("missing", "no covered tag and no implicit cover signal")


def main() -> int:
    if not RAW_CACHE.exists():
        print(f"[convert] FATAL: {RAW_CACHE} missing — run scripts/01_extract.py first",
              file=sys.stderr)
        return 1

    raw = json.loads(RAW_CACHE.read_text(encoding="utf-8"))
    elements = raw["elements"]

    node_xy: dict[int, tuple[float, float]] = {}
    ways: dict[int, dict] = {}
    for el in elements:
        if el["type"] == "node" and "lat" in el and "lon" in el:
            node_xy[el["id"]] = (el["lon"], el["lat"])
        elif el["type"] == "way":
            ways[el["id"]] = el  # union queries dedupe; dict guards duplicates anyway

    helper_node_total = sum(1 for el in elements if el["type"] == "node")
    features: list[dict] = []
    excluded_ways = 0
    dropped_missing_nodes = 0

    for way_id in sorted(ways):
        way = ways[way_id]
        tags = way.get("tags", {})
        highway = tags.get("highway")
        keep = (highway in ROUTABLE_HIGHWAYS
                or "covered" in tags
                or "sidewalk" in tags)
        if not keep:
            excluded_ways += 1
            continue

        coords = []
        unresolved = 0
        for nid in way.get("nodes", []):
            if nid in node_xy:
                coords.append(list(node_xy[nid]))
            else:
                unresolved += 1
        if unresolved:
            dropped_missing_nodes += 1
            print(f"[convert] WARNING way {way_id}: {unresolved} node refs lack coords")
        if len(coords) < 2:
            print(f"[convert] WARNING way {way_id}: degenerate geometry "
                  f"({len(coords)} resolvable points) — excluded from routes")
            excluded_ways += 1
            continue

        status, reason = classify(tags)
        length_m = round(path_length_m(coords), 2)
        features.append({
            "type": "Feature",
            "properties": {
                "osm_way_id": way_id,
                "osm_tags": tags,
                "length_m": length_m,
                "status": status,
                "status_reason": reason,
            },
            "geometry": {
                "type": "LineString",
                "coordinates": coords,
            },
        })

    fc = {"type": "FeatureCollection", "features": features}
    WORKING_DIR.mkdir(parents=True, exist_ok=True)
    GEOJSON_OUT.write_text(json.dumps(fc), encoding="utf-8")

    # --- inventory CSV ---
    rows = []
    for f in features:
        t = f["properties"]["osm_tags"]
        rows.append({
            "osm_way_id": f["properties"]["osm_way_id"],
            "highway": t.get("highway", ""),
            "footway": t.get("footway", ""),
            "sidewalk": t.get("sidewalk", ""),
            "corridor": t.get("corridor", ""),
            "tunnel": t.get("tunnel", ""),
            "indoor": t.get("indoor", ""),
            "layer": t.get("layer", ""),
            "bridge": t.get("bridge", ""),
            "covered": t.get("covered", ""),
            "length_m": f["properties"]["length_m"],
            "status": f["properties"]["status"],
            "reason": f["properties"]["status_reason"],
        })
    with CSV_OUT.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    # --- summary ---
    by_highway = Counter(r["highway"] or "(none)" for r in rows)
    by_covered = Counter(r["covered"] or "(none)" for r in rows)
    by_status = Counter(r["status"] for r in rows)
    total_length = round(sum(r["length_m"] for r in rows), 2)
    summary = {
        "total_way_count": len(rows),
        "total_length_m": total_length,
        "by_highway": dict(sorted(by_highway.items())),
        "by_covered_value": dict(sorted(by_covered.items())),
        "by_status": dict(sorted(by_status.items())),
        "conversion": {
            "approach": "manual python ways+nodes -> LineString (deterministic)",
            "ways_in_query": len(ways),
            "ways_kept": len(rows),
            "ways_excluded": excluded_ways,
            "helper_nodes_in_response": helper_node_total,
            "ways_with_missing_node_refs": dropped_missing_nodes,
        },
        "source_cache": str(RAW_CACHE.relative_to(REPO_ROOT)).replace("\\", "/"),
    }
    SUMMARY_OUT.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print(f"[convert] ways in response: {len(ways)} | kept: {len(rows)} | excluded: {excluded_ways}")
    print(f"[convert] helper nodes in response: {helper_node_total}")
    print(f"[convert] total length: {total_length} m")
    print(f"[convert] by_status: {dict(by_status)}")
    print(f"[convert] wrote {GEOJSON_OUT.name}, {CSV_OUT.name}, {SUMMARY_OUT.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
