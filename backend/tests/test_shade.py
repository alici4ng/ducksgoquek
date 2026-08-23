"""
Acceptance tests for the shade module (PRD Section 9), Bandar Sunway edition.

Fixture geography (relative to SUNWAY_CENTER = lat 3.0683, lng 101.6067):
  tower1     60 m office tower, ~30x30 m, AT the centre
  canopy1    building=roof, no height tag (heuristic -> 4 m), ~100 m east
  untagged1  no tags at all (default -> 12 m), ~150 m south
  broken1    malformed geometry (must be skipped, no crash)
"""
import pathlib
import sys
import time
from datetime import datetime

import networkx as nx
import pytest
import pytz

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from shade import ShadeModel, resolve_height, SUNWAY_CENTER
from shade_adapter import shade_map

KL = pytz.timezone("Asia/Kuala_Lumpur")
FIXTURE = str(pathlib.Path(__file__).parent / "fixtures" / "mini.geojson")

LAT0, LNG0 = SUNWAY_CENTER

# street segments (lng, lat pairs)
WEST_SIDE = (LNG0 - 0.0004048, 3.0681, LNG0 - 0.0004048, 3.0685)   # ~45 m west of tower
FAR_AWAY  = (101.6062, 3.0719170, 101.6072, 3.0719170)             # ~400 m north, clear


def kl(hour, minute=0):
    return KL.localize(datetime(2026, 8, 23, hour, minute))


@pytest.fixture(scope="module")
def model():
    return ShadeModel(FIXTURE, center=SUNWAY_CENTER)


# --- tests 1 & 2: the azimuth convention (write these first, always) -------

def test_shadow_bearing_8am(model):
    _, bearing = model.sun(kl(8))
    # PRD sanity band is 260-300; on 2026-08-23 the sun rises north of east,
    # so the shadow lands at ~259. Direction (west) is what matters.
    assert 250 <= bearing <= 300, f"8am shadow bearing {bearing:.1f}, expected WNW"


def test_shadow_bearing_5pm(model):
    _, bearing = model.sun(kl(17))
    assert 70 <= bearing <= 110, f"5pm shadow bearing {bearing:.1f}, expected E"


# --- tests 3-6: segment scoring --------------------------------------------

def test_far_segment_always_zero(model):
    for h in (8, 12, 16):
        assert model.score_segment(*FAR_AWAY, kl(h)) == 0.0


def test_west_side_shaded_at_8am(model):
    score = model.score_segment(*WEST_SIDE, kl(8))
    assert score > 0.5, f"west side at 8am scored {score}, expected > 0.5"


def test_west_side_exposed_at_1230(model):
    score = model.score_segment(*WEST_SIDE, kl(12, 30))
    assert score < 0.3, f"west side at 12:30 scored {score}, expected < 0.3"


def test_night_returns_one(model):
    assert model.score_segment(*WEST_SIDE, kl(22)) == 1.0
    assert model.score_segment(*FAR_AWAY, kl(22)) == 1.0


# --- tests 7 & 8: height resolution ----------------------------------------

def test_untagged_building_defaults_to_12():
    assert resolve_height({}, 100.0, {}) == 12.0


def test_height_tag_with_units_parses():
    assert resolve_height({"height": "45 m"}, 100.0, {}) == 45.0


def test_heuristic_roof_is_4m():
    assert resolve_height({"building": "roof"}, 100.0, {}) == 4.0


def test_override_wins():
    assert resolve_height({"id": "t1", "height": "60"}, 100.0, {"t1": 88}) == 88.0


# --- tests 9-11: performance, robustness, caching ---------------------------

def _grid_graph(n=500):
    G = nx.Graph()
    for i in range(n):
        a = (LAT0 + i * 1e-5, LNG0)
        b = (LAT0 + i * 1e-5, LNG0 + 1e-4)
        G.add_edge(a, b, dist=10.0, coverage_score=0.0)
    return G


def test_shade_map_500_edges_warm_cache(model):
    G = _grid_graph()
    when = kl(10)
    shade_map(G, model, when)          # warm the cache
    t0 = time.perf_counter()
    out = shade_map(G, model, when)
    elapsed = time.perf_counter() - t0
    assert len(out) == 500
    assert elapsed < 0.1, f"warm shade_map took {elapsed*1000:.0f} ms, budget 100 ms"


def test_malformed_geometry_skipped(model):
    ids_present = len(model._buildings)  # broken1 must not have loaded
    assert ids_present == 3


def test_same_bucket_hits_cache(model):
    when = kl(10, 7)
    model._cache.clear()
    model.score_segment(*WEST_SIDE, when)
    model.score_segment(*WEST_SIDE, when)
    assert len(model._cache) == 1


def test_shade_map_skips_covered_edges(model):
    G = nx.Graph()
    a, b = (LAT0, LNG0), (LAT0, LNG0 + 1e-4)
    G.add_edge(a, b, dist=10.0, coverage_score=1.0)   # built cover
    assert shade_map(G, model, kl(10)) == {}


# --- test 12: rain_mode (pre-verifies the router.py merge diff) -------------

def weight_fn(u, v, data, shade=None, rain_mode=False, penalty=1.5):
    """Mirror of the router.py weight_fn diff in PRD Section 7.1."""
    SHADE_CREDIT = 0.7
    base = data.get("dist", 1.0)
    score = data.get("coverage_score", 0.0)

    if shade and not rain_mode:
        s = shade.get(tuple(sorted([u, v])), 0.0)
        score = max(score, s * SHADE_CREDIT)

    if score >= 0.8:
        return base
    elif score >= 0.4:
        return base * 1.3
    else:
        return base * penalty


def test_rain_mode_ignores_shade():
    u, v = (3.0683, 101.6067), (3.0683, 101.6068)
    data = {"dist": 100.0, "coverage_score": 0.0}
    shade = {tuple(sorted([u, v])): 1.0}

    sunny = weight_fn(u, v, data, shade=shade, rain_mode=False)
    rainy = weight_fn(u, v, data, shade=shade, rain_mode=True)
    none = weight_fn(u, v, data, shade=None)

    assert sunny == 100.0 * 1.3          # 1.0 * 0.7 credit -> 0.7 bucket
    assert rainy == none == 100.0 * 1.5  # shade fully suppressed in rain
