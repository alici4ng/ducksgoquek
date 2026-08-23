#!/usr/bin/env python3
"""Prompt 3 Task A helper: dump the 24 main-corridor-component ways with tags + endpoints.

Read-only exploration; prints only.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_CACHE = REPO_ROOT / "data" / "overpass" / "overpass_response.json"

MAIN_COMPONENT = [
    210994197, 603814881, 603815893, 603815894, 603815895, 603816937,
    603816938, 764530864, 1303647076, 1303647077, 1303647078, 1303647083,
    1460003879, 1460003881, 1460003882, 1460003883, 1460003884, 1460003885,
    1460003886, 1467745041, 1467745042, 1467745043, 1467745044, 1467785088,
]

KEYS = ("highway", "footway", "layer", "bridge", "covered", "tunnel", "indoor", "name")


def main() -> int:
    raw = json.loads(RAW_CACHE.read_text(encoding="utf-8"))
    els = raw["elements"]
    node_xy = {e["id"]: (e["lat"], e["lon"]) for e in els if e["type"] == "node"}
    ways = {e["id"]: e for e in els if e["type"] == "way"}

    for wid in MAIN_COMPONENT:
        w = ways[wid]
        t = w.get("tags", {})
        a = node_xy[w["nodes"][0]]
        b = node_xy[w["nodes"][-1]]
        tagstr = " ".join(f"{k}={t[k]}" for k in KEYS if k in t) or "(no tags)"
        print(f"{wid}: {tagstr}")
        print(f"    n0={w['nodes'][0]} ({a[0]:.6f},{a[1]:.6f}) -> n1={w['nodes'][-1]} ({b[0]:.6f},{b[1]:.6f}) nnodes={len(w['nodes'])}")

    # endpoint node degree within component + shared-node adjacency list
    from collections import defaultdict
    adj: dict[int, list[int]] = defaultdict(list)
    for wid in MAIN_COMPONENT:
        w = ways[wid]
        adj[w["nodes"][0]].append(wid)
        adj[w["nodes"][-1]].append(wid)
    print("\nshared endpoint nodes (deg>=2):")
    for n, ws in sorted(adj.items(), key=lambda kv: -len(kv[1])):
        if len(ws) >= 2:
            lat, lon = node_xy[n]
            print(f"  node {n} ({lat:.6f},{lon:.6f}) deg={len(ws)} ways={ws}")
    print("\nleaf endpoint nodes (deg==1):")
    for n, ws in sorted(adj.items(), key=lambda kv: kv[1][0]):
        if len(ws) == 1:
            lat, lon = node_xy[n]
            print(f"  node {n} ({lat:.6f},{lon:.6f}) way={ws[0]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
