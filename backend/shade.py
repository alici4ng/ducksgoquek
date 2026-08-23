"""
Computed building shade for Travelero Tralala — Bandar Sunway.

Pure geometry. No dependency on NetworkX, FastAPI, or router.py —
this module can be built and tested before the base layer exists.

Data flow: building footprints are pulled ONCE from the OSM Overpass API
(see fetch_buildings.py) and stored locally as data/osm_buildings.geojson.
This module performs no network I/O — ever.
"""
from __future__ import annotations

import json
import math
from datetime import datetime
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

# Bandar Sunway centre (roughly Sunway Pyramid / BRT Sunway Lagoon area)
SUNWAY_CENTER = (3.0683, 101.6067)   # (lat, lng)


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
        self._cache: dict[datetime, tuple[STRtree | None, list]] = {}

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
        # suncalc azimuth is measured from SOUTH toward WEST, which happens
        # to put it 180 deg off the compass bearing of the shadow.
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
        """Fraction of the segment estimated to be in building shadow, [0, 1]."""
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
