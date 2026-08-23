#!/usr/bin/env python3
"""Prompt 3 / Task A: corridor boundary scan for the Bandar Sunway linkway.

Deterministic graph traversal over the cached Overpass response.
Builds the pedestrian graph, finds the main corridor component, walks the
ordered way sequence Monash (south) -> Pyramid (north-east), proposes the two
cover-boundary ways (hypotheses for imagery verification in Prompt 4), and
writes data/review/corridor_traversal.json.
"""
import json
import os
import sys
from collections import defaultdict

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(REPO, "data", "overpass", "overpass_response.json")
OUT = os.path.join(REPO, "data", "review", "corridor_traversal.json")

SOUTH_ANCHOR = (3.0649, 101.6073)   # Monash campus edge (start of corridor)
NORTH_ANCHOR = (3.0716, 101.6055)   # Sunway Pyramid / Sunway University area


def load():
    with open(RAW, encoding="utf-8") as f:
        d = json.load(f)
    nodes, ways = {}, {}
    for e in d["elements"]:
        if e["type"] == "node":
            nodes[e["id"]] = (e.get("lat"), e.get("lon"))
        elif e["type"] == "way":
            ways[e["id"]] = {"nodes": e.get("nodes", []), "tags": e.get("tags", {})}
    return nodes, ways


def way_endpoints(wid, nodes, ways):
    ns = ways[wid]["nodes"]
    return nodes[ns[0]], nodes[ns[-1]]


def main():
    nodes, ways = load()
    # node -> ways incidence
    inc = defaultdict(list)
    for wid, w in ways.items():
        if not w["nodes"]:
            continue
        inc[w["nodes"][0]].append(wid)
        inc[w["nodes"][-1]].append(wid)

    # connected components over all 165 ways
    seen = set()
    comps = []
    for wid in ways:
        if wid in seen:
            continue
        stack, comp = [wid], set()
        while stack:
            w = stack.pop()
            if w in comp:
                continue
            comp.add(w)
            for nid in (ways[w]["nodes"][0], ways[w]["nodes"][-1]):
                for n2 in inc[nid]:
                    if n2 not in comp:
                        stack.append(n2)
        seen |= comp
        comps.append(comp)
    comps.sort(key=len, reverse=True)
    print("components:", len(comps), "| sizes:", [len(c) for c in comps[:8]])

    main_comp = comps[0]
    # find south end: way endpoint closest to SOUTH_ANCHOR within main component
    def dist(a, b):
        return ((a[0]-b[0])**2 + (a[1]-b[1])**2) ** 0.5

    best = None
    for wid in main_comp:
        a, b = way_endpoints(wid, nodes, ways)
        for nid, pt in ((ways[wid]["nodes"][0], a), (ways[wid]["nodes"][-1], b)):
            dd = dist(pt, SOUTH_ANCHOR)
            if best is None or dd < best[0]:
                best = (dd, wid, nid, pt)
    print("south start:", best)

    # DFS over ways from south start to find path reaching closest to NORTH_ANCHOR
    start_dd, start_wid, start_node, start_pt = best
    # walk: prefer continuing NNE; exhaustive DFS with pruning is fine (24 ways)
    best_path = None
    best_score = None
    ANCHOR_RADIUS = 0.0015  # degrees; ~165m — "arrived at Pyramid/SunU"

    def dfs(cur_node, path, visited):
        nonlocal best_path, best_score
        # score: first priority = reach the north anchor zone, second = longer path
        pt = nodes[cur_node]
        d = dist(pt, NORTH_ANCHOR)
        if d <= ANCHOR_RADIUS:
            score = (1, len(path), -d)
        else:
            score = (0, -d, len(path))
        if best_score is None or score > best_score:
            best_score = score
            best_path = (list(path), cur_node)
        for wid in inc[cur_node]:
            if wid in visited or wid not in main_comp:
                continue
            a, b = way_endpoints(wid, nodes, ways)
            n0, n1 = ways[wid]["nodes"][0], ways[wid]["nodes"][-1]
            nxt = n1 if n0 == cur_node else n0
            visited.add(wid)
            path.append(wid)
            dfs(nxt, path, visited)
            path.pop()
            visited.remove(wid)

    dfs(start_node, [], set())
    path, end_node = best_path
    print("\nordered corridor sequence (south->north):")
    detail = []
    for wid in path:
        t = ways[wid]["tags"]
        a, b = way_endpoints(wid, nodes, ways)
        sel = {k: t[k] for k in ("highway", "footway", "sidewalk", "layer", "bridge",
                                 "covered", "tunnel", "indoor", "corridor", "name") if k in t}
        detail.append({"way_id": wid, "tags": sel,
                       "start": [a[0], a[1]], "end": [b[0], b[1]]})
        print(f"  {wid}: {sel}  {a} -> {b}")

    # boundary hypothesis: cover-indicating tags
    def cover_signal(wid):
        t = ways[wid]["tags"]
        if t.get("covered") in ("yes", "arcade", "colonnade"):
            return True
        if t.get("indoor") == "yes" or t.get("highway") == "corridor":
            return True
        if t.get("tunnel") == "building_passage":
            return True
        lay = t.get("layer")
        if t.get("bridge") == "yes" or (lay is not None and int(lay) >= 1):
            return True
        return False

    sig = [cover_signal(w) for w in path]
    b_start = b_end = None
    for i, s in enumerate(sig):
        if s:
            b_start = i
            break
    for i in range(len(sig)-1, -1, -1):
        if sig[i]:
            b_end = i
            break
    bulk, pulled = [], []
    if b_start is not None and b_end is not None and b_end > b_start:
        for wid in path[b_start+1:b_end]:
            pulled.append({"way_id": wid,
                           "reason": "no cover signal tags mid-corridor (layer/bridge/covered all absent) — suspected gap in roofline; verify individually"}) \
                if not cover_signal(wid) else bulk.append(wid)
    print(f"\nB_START way={path[b_start]} idx={b_start}")
    print(f"B_END   way={path[b_end]} idx={b_end}")
    print("bulk candidates:", bulk)
    print("pulled out:", pulled)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    rec = {
        "corridor": path,
        "boundary_start_way": path[b_start],
        "boundary_end_way": path[b_end],
        "bulk_tag_candidates": bulk,
        "pulled_out": pulled,
        "graph_notes": ("Main pedestrian component traversed by exhaustive DFS from the "
                        "endpoint nearest Monash campus; path chosen maximizing proximity "
                        "to Sunway Pyramid/SunU anchor then length. Boundary ways are "
                        "HYPOTHESES from cover-signal tags (covered/indoor/corridor/"
                        "building_passage/layer>=1/bridge) pending imagery verification."),
        "components_summary": f"{len(comps)} components; main has {len(main_comp)} ways",
        "per_way_detail": detail,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(rec, f, indent=2)
    print("\nwrote", OUT)


if __name__ == "__main__":
    main()
