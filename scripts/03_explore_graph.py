#!/usr/bin/env python3
"""Travelero coverage pipeline — Step 3 (exploration helper): pedestrian graph + components.

Read-only exploration for the Prompt 3 corridor boundary scan:
  1. Build vertex/edge graph from raw Overpass ways+nodes (all 165 ways).
  2. Compute connected components of the pedestrian-only subgraph.
  3. Print component membership, elevated-chain candidates, and degree-2 chains
     so the Monash->Pyramid traversal can be pinned down deterministically.

This script prints only; it writes no artifacts.
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict, deque
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_CACHE = REPO_ROOT / "data" / "overpass" / "overpass_response.json"

# Edge-inclusion rule for the PEDESTRIAN subgraph (documented in artifacts):
#   include a way if:
#     a) highway in {footway, path, pedestrian, steps, corridor, living_street}
#     b) OR it carries footway=* / sidewalk=* / crossing=* pedestrian tags
#     c) OR it has no highway but carries covered=* (pedestrian-relevant by query design)
#   exclude: ways whose ONLY highway tag is service / secondary_link / other
#     vehicular class WITHOUT any pedestrian character tags from (b)/(c).
PEDESTRIAN_HIGHWAYS = {"footway", "path", "pedestrian", "steps", "corridor", "living_street"}
PEDESTRIAN_CHAR_TAGS = {"footway", "sidewalk", "crossing", "covered", "indoor", "tunnel"}


def is_pedestrian_edge(tags: dict) -> tuple[bool, str]:
    hw = tags.get("highway")
    if hw in PEDESTRIAN_HIGHWAYS:
        return True, f"highway={hw}"
    char = sorted(k for k in PEDESTRIAN_CHAR_TAGS if k in tags)
    if char:
        return True, f"pedestrian-character tags: {','.join(char)} (highway={hw or 'none'})"
    return False, f"vehicular/no-pedestrian-character (highway={hw or 'none'})"


def main() -> int:
    raw = json.loads(RAW_CACHE.read_text(encoding="utf-8"))
    els = raw["elements"]
    node_xy = {e["id"]: (e["lon"], e["lat"]) for e in els if e["type"] == "node"}
    ways = [e for e in els if e["type"] == "way"]
    assert len(ways) == 165, len(ways)

    edges: dict[int, dict] = {}
    excluded: list[tuple[int, str]] = []
    for w in ways:
        tags = w.get("tags", {})
        ok, why = is_pedestrian_edge(tags)
        if ok:
            edges[w["id"]] = w
        else:
            excluded.append((w["id"], why))

    print(f"pedestrian edges: {len(edges)} | excluded: {len(excluded)}")
    for wid, why in excluded:
        tags = next(w for w in ways if w["id"] == wid).get("tags", {})
        print(f"  EXCLUDED {wid}: {why} tags={tags}")

    # adjacency over endpoint nodes
    adj: dict[int, list[int]] = defaultdict(list)      # node -> way ids
    for wid, w in edges.items():
        adj[w["nodes"][0]].append(wid)
        adj[w["nodes"][-1]].append(wid)

    # connected components over ways (two ways connected if they share an endpoint node)
    comp_of: dict[int, int] = {}
    comp = 0
    for wid in sorted(edges):
        if wid in comp_of:
            continue
        comp += 1
        q = deque([wid])
        comp_of[wid] = comp
        while q:
            cur = q.popleft()
            w = edges[cur]
            for n in (w["nodes"][0], w["nodes"][-1]):
                for nb in adj[n]:
                    if nb not in comp_of:
                        comp_of[nb] = comp
                        q.append(nb)
    comps: dict[int, list[int]] = defaultdict(list)
    for wid, c in comp_of.items():
        comps[c].append(wid)
    print(f"\nconnected components: {len(comps)}")
    for c, members in sorted(comps.items(), key=lambda kv: -len(kv[1])):
        lats = []
        lons = []
        for wid in members:
            for n in (edges[wid]["nodes"][0], edges[wid]["nodes"][-1]):
                lats.append(node_xy[n][1]); lons.append(node_xy[n][0])
        print(f"  comp {c}: {len(members)} ways | centroid=({sum(lats)/len(lats):.5f},{sum(lons)/len(lons):.5f})")

    # which component holds the Monash/Pyramid corridor anchors
    def show_way(wid: int) -> str:
        w = edges[wid]
        t = w.get("tags", {})
        p0 = node_xy[w["nodes"][0]]; p1 = node_xy[w["nodes"][-1]]
        return (f"{wid} hw={t.get('highway','?')} layer={t.get('layer','')} bridge={t.get('bridge','')} "
                f"covered={t.get('covered','')} indoor={t.get('indoor','')} name={t.get('name','')!r} "
                f"({p0[1]:.5f},{p0[0]:.5f})->({p1[1]:.5f},{p1[0]:.5f}) nodes={len(w['nodes'])}")

    main_comp = max(comps, key=lambda c: len(comps[c]))
    print(f"\nmain component = {main_comp} ({len(comps[main_comp])} ways)")

    # degree analysis of endpoint nodes in main component
    deg = defaultdict(int)
    for wid in comps[main_comp]:
        w = edges[wid]
        deg[w["nodes"][0]] += 1
        deg[w["nodes"][-1]] += 1
    print(f"endpoint nodes in main comp: {len(deg)} | deg>=3: {sum(1 for v in deg.values() if v>=3)} | deg==1: {sum(1 for v in deg.values() if v==1)}")

    # elevated ways and their component
    print("\nELEVATED ways (bridge=yes or layer>=1) with component:")
    for wid in sorted(edges):
        t = edges[wid].get("tags", {})
        try:
            lay = float(t.get("layer", "0"))
        except ValueError:
            lay = 0
        if t.get("bridge") == "yes" or lay >= 1:
            print(f"  comp={comp_of[wid]:>2} {show_way(wid)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
