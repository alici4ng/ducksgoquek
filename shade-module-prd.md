# Shade Engine — Feature PRD

**Module owner:** Xuan
**Branch:** `feature/shade-engine`
**Parent project:** Travelero Tralala (PRD v3)
**Status:** builds and tests standalone; merges into `router.py` via a 6-line change

---

## 1. What this module does

Travelero currently knows about **built cover** — malls, tunnels, elevated walkways — via `coverage_score` on each edge. That's binary-ish and static: a segment is covered or it isn't, at 8am and at 2pm alike.

This module adds **computed shade**: for any timestamp, it works out which open-air segments are sitting in the shadow of a building, using real sun position and building footprints from OSM.

The effect on routing: an open-air street on the west side of a tower is genuinely fine at 9am and brutal at 4pm, and the router will now know the difference. Two paths with identical `coverage_score` stop being equivalent.

### Why this is worth building

It is the one part of Travelero that produces data nobody has. Built cover is hand-mapped and finite — 16 connections. Shade is *computed*, so it works for every street in the bounding box without anyone surveying anything. In the pitch this is the answer to "how does this scale beyond the Golden Triangle."

### Non-goals

- Does not modify `uv.py`, `main.py`, or any frontend file
- Does not change the graph structure, node keys, or the API response shape
- Does not model tree canopy, awnings, terrain, or reflected light
- Does not attempt sub-metre accuracy — see Section 8 on error tolerance

---

## 2. Interface contract (this is the merge boundary)

The module exposes exactly two things. Nothing else is public.

```python
# backend/shade.py

class ShadeModel:
    def __init__(self, buildings_geojson_path: str, center: tuple[float, float]): ...
    def score_segment(self, lng1, lat1, lng2, lat2, when: datetime) -> float: ...

# backend/shade_adapter.py

def shade_map(G, model: ShadeModel, when: datetime) -> dict[tuple, float]: ...
```

`score_segment` returns a float in `[0.0, 1.0]` — the fraction of the segment estimated to be in building shadow at that moment.

`shade_map` walks a NetworkX graph and returns `{(node_a, node_b): shade_score}`, keyed by the same `(lat, lng)` tuples `router.py` already uses, normalised with `tuple(sorted(...))` so lookup is order-independent.

**Both are pure.** No global state beyond an internal cache, no graph mutation, no I/O after construction. This is what makes the merge safe while the base layer is still being built.

---

## 3. Dependencies

Add one line to `requirements.txt`:

```
suncalc==0.1.3
```

`shapely`, `scipy`, and `numpy` are already there. No pyproj, no geopandas, no rasterio.

> **Also add `pytz==2024.1`** — `uv.py` imports it and it's missing from the current file. Flag this to the teammate; it will crash Railway on boot.

**Fallback if `suncalc` misbehaves:** `astral==3.2` provides the same sun position with a different API. Do not write your own solar position algorithm.

---

## 4. Data acquisition

### 4.1 Building footprints

Run at overpass-turbo.eu, same bbox as the existing queries:

```
[out:json][timeout:120];
(
  way["building"](3.1350,101.6850,3.1650,101.7250);
  relation["building"](3.1350,101.6850,3.1650,101.7250);
);
out body; >; out skel qt;
```

Export → GeoJSON → save as `backend/data/osm_buildings.geojson`.

Expect several thousand features. That's fine; Section 6 covers performance.

### 4.2 Height resolution — tiered, never fails

OSM height tagging in KL is patchy. Resolve in this order and always return a number:

| Order | Source | Rule |
|---|---|---|
| 1 | `height` or `building:height` | Parse the number, strip a trailing `m` |
| 2 | `building:levels` | × 6.0 m for retail/mall/commercial, × 3.5 m otherwise |
| 3 | Type heuristic | See table below |
| 4 | Default | 12.0 m |

Heuristic table, applied on `building=*` plus footprint area:

| Condition | Height |
|---|---|
| `shop=mall`, or `building=retail` with area > 5000 m² | 30 m |
| `building=retail` with area ≤ 5000 m² | 15 m |
| `building=commercial\|office`, area > 1000 m² | 60 m |
| `building=commercial\|office`, area ≤ 1000 m² | 40 m |
| `building=hotel` | 50 m |
| `building=apartments` | 35 m |
| `building=house\|terrace\|residential\|detached` | 8 m |
| `building=roof\|carport\|canopy\|shelter` | 4 m |
| anything else | 12 m |

**Manual override.** Create `backend/data/building_heights.json` as `{ "<osm_id>": <metres> }` and let it take priority over everything above. Hand-fill the 20–30 landmark buildings along the demo corridor — Pavilion, Lot 10, Fahrenheit, KLCC, Exchange 106. Twenty minutes of work that makes the demo corridor accurate while the rest of the bbox stays estimated.

---

## 5. Algorithm

### 5.1 Sun position

```python
from suncalc import get_position
pos = get_position(when, lng, lat)   # NOTE: lng BEFORE lat in suncalc-py
altitude = pos["altitude"]           # radians above horizon
azimuth  = pos["azimuth"]            # radians, measured from SOUTH toward WEST
```

**Azimuth convention is the single most likely bug in this module.** suncalc measures from south, not north. The direction a shadow points, as a compass bearing from north:

```
shadow_bearing_deg = degrees(azimuth) % 360
```

Sanity check that must pass: at 08:00 KL the sun is roughly east-southeast, so shadows fall west-northwest — `shadow_bearing_deg` should land near 280°. At 17:00 the sun is west, shadows point east — near 90°. Assert both in the test suite before trusting anything downstream.

If `altitude <= 0.02` rad (sun at or below the horizon), short-circuit: return **1.0** for every segment. After dark, sun exposure is not a factor, and treating everything as shaded makes the router fall back to pure distance, which is correct.

### 5.2 Local metric projection

Everything is computed in metres using a local equirectangular projection about the corridor centre. No pyproj.

```
M_PER_DEG_LAT = 110574.0
M_PER_DEG_LNG = 111320.0 * cos(radians(lat0))     # ≈ 111152 at KL

x = (lng - lng0) * M_PER_DEG_LNG
y = (lat - lat0) * M_PER_DEG_LAT
```

Error over a 3 km bbox is well under a metre. Irrelevant at our tolerance.

### 5.3 Shadow polygon

For each building, projected to metres:

```
shadow_length = height / tan(altitude)          # clamp to [0, 200]
dx = shadow_length * sin(radians(shadow_bearing))
dy = shadow_length * cos(radians(shadow_bearing))
shadow = convex_hull( union( footprint, translate(footprint, dx, dy) ) )
```

The convex hull of the footprint and its translated copy approximates the swept region. It is exact for convex buildings and slightly over-generous for L-shaped ones — acceptable, and far cheaper than a true Minkowski sum.

The 200 m clamp matters: near sunrise and sunset `tan(altitude)` approaches zero and shadow length diverges toward infinity. Without the clamp you get kilometre-long polygons and the union blows up.

### 5.4 Segment scoring

Sample 5 points evenly along the segment (including both endpoints). Query an `STRtree` of shadow polygons for candidates, then test containment precisely. Score = fraction of sample points inside any shadow.

### 5.5 Caching

Shadow geometry is rebuilt only when the **rounded** timestamp changes. Round `when` down to the nearest 30 minutes and key the cache on that. During a demo you touch three or four distinct half-hours, so this is effectively free after the first call.

Build the cache lazily on first request, not at startup — Railway cold starts are already slow enough.

---

## 6. Performance budget

| Operation | Target |
|---|---|
| Load + project buildings (startup) | < 3 s for 5,000 features |
| Build shadow union for one timestep | < 1.5 s |
| `shade_map` over 500 edges, cache warm | < 100 ms |
| `score_segment` single call, cache warm | < 2 ms |

If the shadow build exceeds 2 s, drop buildings with footprint area under 50 m² — sheds and garages contribute nothing at street scale and are numerous.

---

## 7. Merge contract

### 7.1 What changes in `router.py`

`find_covered_route` gains two optional parameters, both defaulted so **existing calls keep working unchanged**:

```python
def find_covered_route(
    G, orig_lat, orig_lng, dest_lat, dest_lng,
    penalty: float = 1.5,
    shade: dict | None = None,      # NEW — from shade_map(), or None
    rain_mode: bool = False,        # NEW — shade doesn't help in rain
) -> dict:
```

And `weight_fn` becomes:

```python
SHADE_CREDIT = 0.7   # building shade is good, but a roof is better

def weight_fn(u, v, data):
    base  = data.get("dist", 1.0)
    score = data.get("coverage_score", 0.0)

    if shade and not rain_mode:
        s = shade.get(tuple(sorted([u, v])), 0.0)
        score = max(score, s * SHADE_CREDIT)

    if score >= 0.8:   return base
    elif score >= 0.4: return base * 1.3
    else:              return base * penalty
```

**`rain_mode` suppressing shade entirely is the important line.** A shadow keeps the sun off; it does nothing about rain. Getting this right is a genuinely good detail to point at during judging.

### 7.2 What changes in `main.py`

```python
from shade import ShadeModel
from shade_adapter import shade_map

# in lifespan, after build_graph:
graph["shade"] = ShadeModel(str(data / "osm_buildings.geojson"), center=(3.1488, 101.7139))

# in /route, before find_covered_route:
now_kl = datetime.now(KL_TZ)
shade = shade_map(graph["G"], graph["shade"], now_kl)

result = find_covered_route(..., penalty=penalty, shade=shade, rain_mode=rain_mode)
```

### 7.3 Optional response addition

If she's happy to extend the contract, add to `summary`:

```json
"shaded_pct": 34,
"exposure_score": 0.41
```

`shaded_pct` is the length-weighted share of open-air distance that falls in shadow. It makes the shade work visible in the UI, which is the difference between the judges noticing this feature and not. Propose it, don't merge it unilaterally.

### 7.4 Merge order

1. Build and test `shade.py` and `shade_adapter.py` entirely on your branch against a fixture graph
2. Wait for her `build_graph` to land on main
3. Rebase, apply the six-line `router.py` diff and the three-line `main.py` diff
4. Verify `/health` still returns, then `/route` with and without shade

Steps 1 and 2 are independent. **Do not wait for her base layer to start.** Section 9's fixture lets you complete this module without a single line of her code existing.

---

## 8. Accuracy and honesty

Height estimates are rough, and that's tolerable for two structural reasons worth understanding before anyone panics about it.

**Saturation.** Once a shadow is longer than the street is wide, the street is fully shaded and additional height changes nothing. Jalan Bukit Bintang is ~25 m kerb to kerb; at a 45° sun any building above 25 m shades it completely. Errors on tall buildings are essentially free.

**Latitude.** At 3°N the midday sun is nearly overhead — altitude around 85°, `tan(altitude)` is large, and shadows collapse to almost nothing. The model will report near-total exposure at 1pm, which is exactly right and requires no height accuracy at all.

The sensitive window is roughly 09:00–11:00 and 15:00–17:00, where sun altitude sits near 40–60° and shadow length is comparable to building height. That is also the window where routes meaningfully diverge, so **demo at 10am or 4pm.** At noon all routes converge on "everything is exposed," which is correct and boring.

**Required in the UI copy:** describe this as *estimated* shade. Do not imply survey accuracy.

---

## 9. Test fixture and acceptance

### 9.1 Fixture

Create `backend/tests/fixtures/mini.geojson` with:

- One 60 m tower (`height: 60`)
- One 4 m canopy (`building: roof`, no height tag → heuristic path)
- One untagged building (→ 12 m default)
- Three street segments: one on the tower's north side, one on its south side, one 300 m clear of everything

### 9.2 Acceptance criteria

| # | Test | Expected |
|---|---|---|
| 1 | `shadow_bearing_deg` at 08:00 KL | 260°–300° |
| 2 | `shadow_bearing_deg` at 17:00 KL | 70°–110° |
| 3 | Segment 300 m from any building, any time | `0.0` |
| 4 | Segment on tower's west side at 08:00 | `> 0.5` |
| 5 | Same segment at 12:30 | `< 0.3` |
| 6 | Any segment at 22:00 (sun below horizon) | `1.0` |
| 7 | Building with no height tags | resolves to 12.0, no exception |
| 8 | Building with `height: "45 m"` | parses to 45.0 |
| 9 | `shade_map` over a 500-edge graph, warm cache | < 100 ms |
| 10 | Malformed geometry in input GeoJSON | skipped, no crash |
| 11 | Same `when` called twice | second call hits cache, no rebuild |
| 12 | `rain_mode=True` in `weight_fn` | shade ignored, identical result to `shade=None` |

Tests 1 and 2 are the ones that catch the azimuth bug. Write them first.

---

## 10. Reference implementation

### `backend/shade.py`

```python
"""
Computed building shade for Travelero Tralala.

Pure geometry. No dependency on NetworkX, FastAPI, or router.py —
this module can be built and tested before the base layer exists.
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timedelta
from typing import Any

from shapely.geometry import shape, Point, Polygon, MultiPolygon
from shapely.affinity import translate
from shapely.ops import unary_union, transform
from shapely import STRtree
from suncalc import get_position

M_PER_DEG_LAT = 110_574.0
MAX_SHADOW_M = 200.0
MIN_ALTITUDE_RAD = 0.02      # below this, treat as night
CACHE_MINUTES = 30
MIN_FOOTPRINT_M2 = 50.0      # skip sheds and garages

LEVEL_HEIGHT_TALL = 6.0      # retail / commercial floor plates
LEVEL_HEIGHT_STD = 3.5


# ---------------------------------------------------------------- heights

def _parse_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(str(value).lower().replace("m", "").replace("metres", "").strip())
    except (ValueError, AttributeError):
        return None


def _heuristic_height(props: dict, area_m2: float) -> float:
    b = str(props.get("building", "")).lower()
    if props.get("shop") == "mall" or b == "retail":
        return 30.0 if area_m2 > 5000 else 15.0
    if b in ("commercial", "office"):
        return 60.0 if area_m2 > 1000 else 40.0
    if b == "hotel":
        return 50.0
    if b == "apartments":
        return 35.0
    if b in ("house", "terrace", "residential", "detached", "semidetached_house"):
        return 8.0
    if b in ("roof", "carport", "canopy", "shelter"):
        return 4.0
    return 12.0


def resolve_height(props: dict, area_m2: float, overrides: dict) -> float:
    osm_id = str(props.get("id") or props.get("@id") or "")
    if osm_id and osm_id in overrides:
        return float(overrides[osm_id])

    h = _parse_float(props.get("height")) or _parse_float(props.get("building:height"))
    if h and h > 0:
        return h

    levels = _parse_float(props.get("building:levels"))
    if levels and levels > 0:
        b = str(props.get("building", "")).lower()
        per = LEVEL_HEIGHT_TALL if b in ("retail", "commercial") or props.get("shop") == "mall" \
              else LEVEL_HEIGHT_STD
        return levels * per

    return _heuristic_height(props, area_m2)


# ------------------------------------------------------------------ model

class ShadeModel:
    def __init__(self, buildings_geojson_path: str, center: tuple[float, float],
                 overrides_path: str | None = None):
        self.lat0, self.lng0 = center
        self.m_per_deg_lng = 111_320.0 * math.cos(math.radians(self.lat0))

        overrides: dict = {}
        if overrides_path:
            try:
                with open(overrides_path) as f:
                    overrides = json.load(f)
            except (OSError, json.JSONDecodeError):
                pass

        self._buildings: list[tuple[Polygon, float]] = []
        self._load(buildings_geojson_path, overrides)
        self._cache: dict[datetime, tuple[STRtree, list]] = {}

    # -- projection ------------------------------------------------------

    def _to_m(self, lng, lat):
        return ((lng - self.lng0) * self.m_per_deg_lng,
                (lat - self.lat0) * M_PER_DEG_LAT)

    def _project(self, geom):
        return transform(
            lambda x, y, z=None: ((x - self.lng0) * self.m_per_deg_lng,
                                  (y - self.lat0) * M_PER_DEG_LAT),
            geom,
        )

    # -- loading ---------------------------------------------------------

    def _load(self, path: str, overrides: dict) -> None:
        with open(path) as f:
            data = json.load(f)

        for feat in data.get("features", []):
            try:
                geom = shape(feat.get("geometry"))
            except Exception:
                continue
            if geom.is_empty or geom.geom_type not in ("Polygon", "MultiPolygon"):
                continue

            props = feat.get("properties", {}) or {}
            parts = geom.geoms if geom.geom_type == "MultiPolygon" else [geom]

            for part in parts:
                try:
                    projected = self._project(part)
                    if not projected.is_valid:
                        projected = projected.buffer(0)
                    area = projected.area
                    if area < MIN_FOOTPRINT_M2:
                        continue
                    self._buildings.append((projected, resolve_height(props, area, overrides)))
                except Exception:
                    continue

    # -- sun -------------------------------------------------------------

    def sun(self, when: datetime) -> tuple[float, float]:
        """Returns (altitude_rad, shadow_bearing_deg_from_north)."""
        pos = get_position(when, self.lng0, self.lat0)   # lng first
        altitude = float(pos["altitude"])
        shadow_bearing = math.degrees(float(pos["azimuth"])) % 360.0
        return altitude, shadow_bearing

    # -- shadows ---------------------------------------------------------

    def _bucket(self, when: datetime) -> datetime:
        return when.replace(
            minute=(when.minute // CACHE_MINUTES) * CACHE_MINUTES,
            second=0, microsecond=0,
        )

    def _shadow_tree(self, when: datetime):
        key = self._bucket(when)
        if key in self._cache:
            return self._cache[key]

        altitude, bearing = self.sun(key)
        if altitude <= MIN_ALTITUDE_RAD:
            self._cache[key] = (None, [])
            return self._cache[key]

        br = math.radians(bearing)
        sin_b, cos_b = math.sin(br), math.cos(br)
        shadows = []

        for poly, height in self._buildings:
            length = min(height / math.tan(altitude), MAX_SHADOW_M)
            if length < 1.0:
                shadows.append(poly)
                continue
            moved = translate(poly, xoff=length * sin_b, yoff=length * cos_b)
            try:
                shadows.append(unary_union([poly, moved]).convex_hull)
            except Exception:
                shadows.append(poly)

        tree = STRtree(shadows) if shadows else None
        self._cache[key] = (tree, shadows)
        return self._cache[key]

    # -- public ----------------------------------------------------------

    def score_segment(self, lng1: float, lat1: float,
                      lng2: float, lat2: float,
                      when: datetime, samples: int = 5) -> float:
        altitude, _ = self.sun(self._bucket(when))
        if altitude <= MIN_ALTITUDE_RAD:
            return 1.0                       # night: exposure is not a factor

        tree, shadows = self._shadow_tree(when)
        if tree is None:
            return 0.0

        x1, y1 = self._to_m(lng1, lat1)
        x2, y2 = self._to_m(lng2, lat2)

        hits = 0
        for i in range(samples):
            t = i / (samples - 1) if samples > 1 else 0.5
            pt = Point(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)
            for idx in tree.query(pt):
                if shadows[idx].contains(pt):
                    hits += 1
                    break

        return hits / samples
```

### `backend/shade_adapter.py`

```python
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
```

---

## 11. Build order

1. `pip install suncalc`, add to `requirements.txt`
2. Run the Overpass buildings query, save `data/osm_buildings.geojson`
3. Write acceptance tests 1, 2 and 6 first — the azimuth and night cases
4. `shade.py`: height resolution and projection, verified against the fixture
5. `shade.py`: shadow build and `score_segment`; make tests 3, 4, 5 pass
6. Hand-fill `building_heights.json` for the 20–30 corridor landmarks
7. `shade_adapter.py` against a fixture graph you build yourself
8. Benchmark test 9; add the 50 m² filter if it fails
9. **Stop.** Wait for `build_graph` on main, then apply the Section 7 diffs

Steps 1–8 have no dependency on the teammate's work. If she is delayed, you are not.

---

## 12. What to say about it in the pitch

One sentence, and don't oversell: *"Built cover is hand-mapped and finite. Shade is computed from building footprints and real sun position, so it works on every street in the city — and it changes by the hour, which is why the 10am route and the 4pm route aren't the same."*

If asked about accuracy, the honest answer is the strong one: heights are hand-verified along the demo corridor and estimated by building type elsewhere, and the estimate saturates — once a building shades the whole street, being wrong about its exact height doesn't change the route.
