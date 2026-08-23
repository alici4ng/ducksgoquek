"""
The only file in this module that knows about NetworkX.
Keeps shade.py testable in isolation.
"""
from datetime import datetime
import networkx as nx
from shade import ShadeModel


def shade_map(G: nx.Graph, model: ShadeModel, when: datetime) -> dict:
    """
    Returns {(node_a, node_b): shade_score} keyed by sorted (lat, lng) tuples,
    matching the node keys router.build_graph() creates.

    Built-cover edges are skipped — a roof is a roof regardless of the sun,
    and scoring them wastes time.
    """
    out: dict = {}
    for u, v, data in G.edges(data=True):
        if data.get("coverage_score", 0.0) >= 0.4:
            continue

        coords = data.get("coords")
        if coords and len(coords) >= 2:
            (lng1, lat1), (lng2, lat2) = coords[0], coords[-1]
        else:
            (lat1, lng1), (lat2, lng2) = u, v

        out[tuple(sorted([u, v]))] = model.score_segment(lng1, lat1, lng2, lat2, when)

    return out
