#!/usr/bin/env python3
"""Prompt 3 / Task B: build the general coverage-gap review queue.

Deterministic. For every non-explicit pedestrian way, emit a queue item with a
SPECIFIC reason derived from (a) its own tags, (b) whether it shares an endpoint
node with an already-covered=yes way (covered-network adjacency => likely
transition point), and (c) its distance to the Monash->Pyramid corridor axis.

Batching: ground-level (no layer/bridge), short, non-corridor ways with no
covered-network adjacency and no building-passage/indoor signal are grouped into
open_batch entries for efficient imagery spot-checking. Everything with real
ambiguity stays individual.

Writes:
  data/review/review_queue_general.json
  data/review/review_queue_general.geojson
  data/review/review_report_general.md
"""
import json
import math
import os
from collections import defaultdict

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WJ = os.path.join(REPO, "data", "working", "pedestrian_ways_raw.geojson")
RAW = os.path.join(REPO, "data", "overpass", "overpass_response.json")
TRAV = os.path.join(REPO, "data", "review", "corridor_traversal.json")
OUT_J = os.path.join(REPO, "data", "review", "review_queue_general.json")
OUT_G = os.path.join(REPO, "data", "review", "review_queue_general.geojson")
OUT_M = os.path.join(REPO, "data", "review", "review_report_general.md")


def hav_m(p1, p2):
    R = 6371000.0
    la1, lo1 = math.radians(p1[0]), math.radians(p1[1])
    la2, lo2 = math.radians(p2[0]), math.radians(p2[1])
    return 2 * R * math.asin(math.sqrt(
        math.sin((la2 - la1) / 2) ** 2 +
        math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2))


def point_to_seg(p, a, b):
    """approx distance (meters) from point p to segment a-b using local equirect."""
    def to_xy(q, ref):
        x = (q[1] - ref[1]) * math.cos(math.radians(ref[0]))
        y = (q[0] - ref[0])
        return (x, y)
    ref = p
    px, py = 0.0, 0.0
    ax, ay = to_xy(a, ref)
    bx, by = to_xy(b, ref)
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return hav_m(p, a)
    t = max(0.0, min(1.0, -((ax * dx + ay * dy) / (dx * dx + dy * dy))))
    cx, cy = ax + t * dx, ay + t * dy
    # back to meters
    mx = cx * 111320.0
    my = cy * 110540.0
    return math.hypot(mx, my)


def main():
    gj = json.load(open(WJ, encoding="utf-8"))
    feats = gj["features"]
    raw = json.load(open(RAW, encoding="utf-8"))
    way_nodes = {e["id"]: e.get("nodes", []) for e in raw["elements"] if e["type"] == "way"}
    trav = json.load(open(TRAV, encoding="utf-8"))
    corridor_ids = set(trav["corridor"])
    boundary_ways = {trav["boundary_start_way"], trav["boundary_end_way"]}
    bulk_ids = set(trav["bulk_tag_candidates"])
    pulled_ids = {p["way_id"] for p in trav["pulled_out"]}

    # corridor axis polyline for distance: chain corridor way endpoints
    node_xy = {e["id"]: (e["lat"], e["lon"]) for e in raw["elements"] if e["type"] == "node"}
    corridor_pts = []
    for wid in trav["corridor"]:
        ns = way_nodes.get(wid, [])
        for nid in ns:
            if nid in node_xy:
                pt = node_xy[nid]
                if not corridor_pts or corridor_pts[-1] != pt:
                    corridor_pts.append(pt)

    # endpoint-node adjacency to covered=yes ways
    covered_endnodes = set()
    by_id = {f["properties"]["osm_way_id"]: f for f in feats}
    for wid, f in by_id.items():
        if f["properties"].get("osm_tags", {}).get("covered") == "yes":
            for nid in way_nodes.get(wid, []):
                covered_endnodes.add(nid)

    def corr_dist(coords):
        best = 1e9
        for i in range(len(corridor_pts) - 1):
            for seg_pt in coords:
                d = point_to_seg(seg_pt, corridor_pts[i], corridor_pts[i + 1])
                if d < best:
                    best = d
        return best

    items = []
    stats = defaultdict(int)
    gid = 0

    for f in feats:
        p = f["properties"]
        wid = p["osm_way_id"]
        st = p["status"]
        if st == "existing_explicit":
            continue  # presumed correct
        if wid in bulk_ids:
            continue  # handled by corridor boundary bulk inference
        if wid in boundary_ways:
            continue  # reserved R001/R002, handled separately

        t = p.get("osm_tags", {})
        hw = t.get("highway", "(none)")
        coords = f["geometry"]["coordinates"]  # [ [lng,lat], ... ]
        latlng = [(c[1], c[0]) for c in coords]
        start, end = latlng[0], latlng[-1]
        clat = sum(x[0] for x in latlng) / len(latlng)
        clng = sum(x[1] for x in latlng) / len(latlng)
        length = p["length_m"]

        # connectivity to covered network
        wn = way_nodes.get(wid, [])
        adj_covered = any(n in covered_endnodes for n in (wn[0], wn[-1])) if wn else False
        cd = corr_dist(latlng)

        # --- classify the ambiguity & build a specific reason ---
        tagsig = []
        if t.get("tunnel") == "building_passage":
            tagsig.append("building_passage")
        if t.get("indoor") == "yes":
            tagsig.append("indoor")
        if hw == "corridor":
            tagsig.append("corridor")
        if t.get("bridge") == "yes":
            tagsig.append("bridge")
        if t.get("layer") not in (None, "0"):
            tagsig.append(f"layer={t.get('layer')}")

        reason = ""
        evidence = ""
        batchable = False
        name = t.get("name", "")

        if wid in pulled_ids:
            reason = ("Corridor traversal pulled this way out of bulk inference: no cover "
                      "signal tags mid-corridor — suspected gap in the elevated linkway "
                      "roofline. Verify whether this short stretch is actually roofed.")
            evidence = "Overhead imagery at this exact corridor segment; street-level if ambiguous."
            prio = "high"
        elif "building_passage" in tagsig:
            reason = ("Tagged tunnel=building_passage: passes through a building, so overhead "
                      "cover is implied by definition. Confirm the passage is enclosed and record "
                      "covered=yes with built-passage provenance.")
            evidence = "Overhead imagery + street-level to confirm enclosed passage vs open gap."
            prio = "high" if cd < 120 else "medium"
        elif "indoor" in tagsig and hw == "corridor":
            reason = ("Indoor corridor (highway=corridor + indoor=yes): inside a building, covered "
                      "by definition. Confirm it is a real enclosed walkable corridor (not an "
                      "open atrium) and tag covered=yes.")
            evidence = "Overhead imagery of the building footprint; street-level entrance if needed."
            prio = "medium"
        elif "indoor" in tagsig:
            reason = ("Indoor feature (indoor=yes): under a roof by definition. Confirm it is an "
                      "enclosed walkable space and tag covered=yes.")
            evidence = "Overhead imagery of the enclosing building."
            prio = "medium"
        elif "bridge" in tagsig or any(s.startswith("layer=") for s in tagsig):
            lay = t.get("layer", "1")
            reason = (f"Elevated structure (bridge=yes / layer={lay}) but NO covered tag: elevation "
                      f"alone is not cover. Determine from imagery whether it has a continuous roof "
                      f"(covered linkway) or is an open elevated walkway.")
            if adj_covered:
                reason += " Shares an endpoint with a covered=yes way — likely a covered-network transition point."
            evidence = "Overhead imagery along the full length; street-level to distinguish roof vs open rail."
            prio = "high" if (cd < 120 or adj_covered) else "medium"
        else:
            # missing, no implicit signal — ground level
            if adj_covered:
                reason = ("No coverage tag, ground-level, but shares an endpoint with a covered=yes "
                          "way: may be the exposed approach or a covered extension. Determine cover "
                          "from imagery.")
                evidence = "Overhead imagery at the junction; street-level along the way."
                prio = "high" if cd < 120 else "medium"
                batchable = False
            else:
                nearname = name or hw
                reason = (f"No coverage tag and no implicit signal; ground-level {nearname}. "
                          f"{'Near the demo corridor — ' if cd < 120 else ''}determine from imagery "
                          f"whether any built overhead cover exists (trees/shadows don't count).")
                evidence = "Overhead imagery; batch spot-check acceptable if clearly open."
                prio = "high" if cd < 60 else ("medium" if cd < 200 else "low")
                batchable = (cd >= 120 and length < 60 and hw in
                             ("footway", "path", "steps", "living_street", "service", "secondary_link", "(none)"))

        gid += 1
        item = {
            "review_id": f"G{gid:03d}",
            "osm_way_ids": [wid],
            "tags": {k: t[k] for k in ("highway", "footway", "sidewalk", "layer", "bridge",
                                       "tunnel", "indoor", "corridor", "covered", "name") if k in t},
            "geometry_ref": {"centroid": [clat, clng], "start": [start[0], start[1]], "end": [end[0], end[1]]},
            "length_m": round(length, 1),
            "corridor_dist_m": round(cd, 1),
            "adjacent_to_covered_network": adj_covered,
            "reason": reason,
            "evidence_needed": evidence,
            "candidate_transition_points": [],
            "priority": prio,
            "batch": False,
            "_batchable": batchable,
        }
        items.append(item)
        stats[f"priority_{prio}"] += 1

    # --- batch consolidation: merge batchable open ways into batch entries ---
    batchable_items = [i for i in items if i.get("_batchable")]
    items = [i for i in items if not i.get("_batchable")]  # keep only individual

    if batchable_items:
        # group by priority for clearer batches
        groups = defaultdict(list)
        for i in batchable_items:
            groups[i["priority"]].append(i)
        for prio in ("low", "medium", "high"):
            grp = groups.get(prio, [])
            if not grp:
                continue
            gid += 1
            wids = [i["osm_way_ids"][0] for i in grp]
            totlen = sum(i["length_m"] for i in grp)
            clat = sum(i["geometry_ref"]["centroid"][0] for i in grp) / len(grp)
            clng = sum(i["geometry_ref"]["centroid"][1] for i in grp) / len(grp)
            items.append({
                "review_id": f"G{gid:03d}",
                "osm_way_ids": wids,
                "tags": {"_note": "batch of clearly ground-level open ways"},
                "geometry_ref": {"centroid": [clat, clng],
                                 "start": grp[0]["geometry_ref"]["start"],
                                 "end": grp[-1]["geometry_ref"]["end"]},
                "length_m": round(totlen, 1),
                "corridor_dist_m": None,
                "adjacent_to_covered_network": False,
                "reason": (f"Batch of {len(grp)} short ground-level ways with no coverage tag, no "
                           f"implicit signal, no covered-network adjacency, and no building-passage "
                           f"or elevation context. Expected open to sky; spot-check with imagery."),
                "evidence_needed": "Spot-check overhead imagery of representative members.",
                "candidate_transition_points": [],
                "priority": prio,
                "batch": True,
            })
            stats[f"priority_{prio}"] += 1
        stats["batched_member_ways"] = len(batchable_items)

    for i in items:
        i.pop("_batchable", None)

    member_ways = sum(len(i["osm_way_ids"]) for i in items)
    # recompute priority totals from the FINAL item list (batched members counted once, via their batch)
    for k in ("priority_high", "priority_medium", "priority_low"):
        stats.pop(k, None)
    for i in items:
        stats[f"priority_{i['priority']}"] += 1
    stats["total_items"] = len(items)
    stats["individual_items"] = sum(1 for i in items if not i["batch"])
    stats["batch_items"] = sum(1 for i in items if i["batch"])
    stats["member_ways_queued"] = member_ways

    os.makedirs(os.path.dirname(OUT_J), exist_ok=True)
    with open(OUT_J, "w", encoding="utf-8") as f:
        json.dump({"items": items, "stats": dict(stats)}, f, indent=2)

    # GeoJSON map layer
    gfeatures = []
    for i in items:
        wid0 = i["osm_way_ids"][0]
        feat = by_id.get(wid0)
        if feat is not None and feat["geometry"]["type"] == "LineString":
            geom = dict(feat["geometry"])
        else:
            geom = {"type": "Point", "coordinates": [i["geometry_ref"]["centroid"][1],
                                                     i["geometry_ref"]["centroid"][0]]}
        gfeatures.append({
            "type": "Feature",
            "geometry": geom,
            "properties": {
                "review_id": i["review_id"],
                "reason": i["reason"],
                "priority": i["priority"],
                "batch": i["batch"],
                "osm_way_ids": ",".join(str(w) for w in i["osm_way_ids"]),
            },
        })
    with open(OUT_G, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": gfeatures}, f)

    # human report
    lines = ["# General Coverage-Gap Review Queue", ""]
    lines.append(f"- Total queue items: **{stats['total_items']}** "
                 f"(individual: {stats['individual_items']}, batch: {stats['batch_items']})")
    lines.append(f"- Member ways covered: **{member_ways}**")
    lines.append(f"- Priority totals: high={stats.get('priority_high',0)}, "
                 f"medium={stats.get('priority_medium',0)}, low={stats.get('priority_low',0)}")
    lines.append("")
    lines.append("## Reconciliation")
    lines.append(f"165 total ways = 25 existing_explicit (not queued) + {member_ways} queued member ways "
                 f"+ {len(bulk_ids)} bulk-tag candidates + {len(boundary_ways)} boundary ways (R001/R002).")
    lines.append("")
    lines.append("## Notable individual items")
    for i in sorted([x for x in items if not x["batch"]],
                    key=lambda x: ({"high": 0, "medium": 1, "low": 2}[x["priority"]],
                                   x["corridor_dist_m"] if x["corridor_dist_m"] is not None else 999))[:12]:
        lines.append(f"- **{i['review_id']}** way {i['osm_way_ids'][0]} [{i['priority']}] "
                     f"({i['length_m']}m, {i['corridor_dist_m']}m from corridor): {i['reason']}")
    with open(OUT_M, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print("items:", len(items), "| member ways:", member_ways)
    print("stats:", dict(stats))
    print("wrote", OUT_J, OUT_G, OUT_M)


if __name__ == "__main__":
    main()
