# TRAVELERO TRALALA — PRD v3
### Covered Route Navigation · KL Golden Triangle
### Stack: FastAPI + NetworkX + Railway + Vercel

---

## WHAT WE ARE BUILDING

A navigation app for Kuala Lumpur that answers two questions no other
app can:

> **"How do I get from A to B while staying as covered as possible?"**
> **"How much UV am I actually going to absorb on this walk?"**

KL has two weather enemies: rain (200+ rainy days/year) and UV
(index 10–12 between 11am–3pm, classified WHO Extreme). Google Maps
ignores both. Travelero Tralala routes around both, in real time,
using the hidden network of mall links, underground tunnels, and
covered walkways that already exist across the Golden Triangle.

---

## WHY NOT GOOGLE MAPS

| | Google Maps | Travelero Tralala |
|---|---|---|
| Optimises for | Fastest | Most covered + lowest UV exposure |
| Knows mall links | Inconsistently | Yes, hand-verified |
| Rain mode | None | Maximises coverage |
| UV awareness | None | Real-time index, route weights by hour |
| Sunscreen reminders | None | Notification at 15-min outdoor exposure |
| Differentiates indoor/outdoor | No | Yes, per segment |
| Language | English / formal BM | BM, English, Manglish (Qwen) |

---

## TECH STACK

```
Language      Python 3.11
Framework     FastAPI
Routing       NetworkX (pure Python, in-memory graph)
UV data       Open-Meteo API (free, no key required)
Deploy BE     Railway (connect GitHub → live URL in 8 min)
Deploy FE     React + Vite + Mapbox GL JS → Vercel
No Docker     No PostgreSQL    No pgRouting    No Redis
```

### Why NetworkX instead of pgRouting

The Golden Triangle covered network has ~500 path segments.
NetworkX loads the entire graph into memory at startup and answers
a Dijkstra query in under 50ms. No database, no topology build,
no Docker dependency. `pip install networkx` and it works.

### Procfile (Railway needs this in /backend)

```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

### requirements.txt

```
fastapi==0.111.0
uvicorn==0.30.0
networkx==3.3
shapely==2.0.4
geojson==3.1.0
httpx==0.27.0
scipy==1.13.0
python-dotenv==1.0.1
pydantic==2.7.1
```

---

## HOW TO GET THE DATA

### Stage 1 — Overpass query (run at overpass-turbo.eu)

```
[out:json][timeout:60];
(
  way["covered"="yes"](3.1350,101.6850,3.1650,101.7250);
  way["indoor"="yes"](3.1350,101.6850,3.1650,101.7250);
  way["tunnel"="building_passage"](3.1350,101.6850,3.1650,101.7250);
  way["highway"="corridor"](3.1350,101.6850,3.1650,101.7250);
  way["location"="indoor"](3.1350,101.6850,3.1650,101.7250);
  way["highway"~"footway|path|pedestrian"]
    ["covered"="yes"](3.1350,101.6850,3.1650,101.7250);
);
out body; >; out skel qt;
```

Export → GeoJSON → save as `backend/data/osm_covered_raw.geojson`.

Also export the open-air pedestrian paths (needed to complete the
graph between covered segments):

```
[out:json][timeout:60];
(
  way["highway"~"footway|path|pedestrian|steps"]
    (3.1350,101.6850,3.1650,101.7250);
);
out body; >; out skel qt;
```

Save as `backend/data/osm_open_air.geojson`.

---

### Stage 2 — Manual patches

Draw these at geojson.io using satellite + Street View.
Save as `backend/data/manual_patches.geojson`.

Every feature must have these properties:

```json
{
  "name": "Pavilion KL to KLCC elevated walkway",
  "coverage_type": "elevated_walkway",
  "coverage_score": 1.0,
  "air_conditioned": true,
  "paid_access": false,
  "operating_hours": "10:00-22:00"
}
```

#### The 16 known connections to draw

```
GOLDEN TRIANGLE
  1.  Pavilion ↔ KLCC elevated walkway         score 1.0  AC  1173m
  2.  Pavilion ↔ Fahrenheit 88 (B2 underground) score 1.0  AC  120m
  3.  Fahrenheit 88 ↔ Lot 10 (overhead bridge)  score 0.9      80m
  4.  Lot 10 ↔ Sungei Wang (underground)        score 1.0  AC  100m
  5.  Sungei Wang ↔ BB Plaza (bridge)           score 0.9      60m
  6.  Bukit Bintang MRT ↔ Pavilion (B2 link)    score 1.0  AC  200m

KL SENTRAL
  7.  KL Sentral ↔ Nu Sentral (concourse)       score 1.0  AC  180m
  8.  KL Sentral ↔ Muzium Negara MRT (elevated) score 0.85     240m

MASJID JAMEK / CHINATOWN
  9.  Masjid Jamek LRT ↔ Pasar Seni (tunnel)   score 1.0  AC  300m
  10. Central Market ↔ Pasar Seni (arcade)      score 0.85     150m
  11. Central Market ↔ CM Annexe (bridge)       score 1.0      80m

KLCC
  12. KLCC LRT ↔ Suria KLCC (underground)       score 1.0  AC  200m
  13. Suria KLCC ↔ KLCC Park covered path       score 0.6      350m
  14. Ampang Park MRT ↔ Ampang Park LRT         score 0.3      120m

PUDU / IMBI
  15. Berjaya Times Square ↔ Imbi MRT           score 1.0  AC  160m
  16. Plaza Rakyat LRT ↔ Merdeka MRT (paid)     score 1.0  AC  180m
      paid_access: true  ← excluded from routing by default
```

---

## PROJECT STRUCTURE

```
travelero/
├── backend/
│   ├── main.py          ← FastAPI app + lifespan loader
│   ├── router.py        ← NetworkX graph + Dijkstra routing
│   ├── uv.py            ← UV index fetcher + penalty weights
│   ├── Procfile         ← web: uvicorn main:app --host 0.0.0.0 --port $PORT
│   ├── requirements.txt
│   └── data/
│       ├── osm_covered_raw.geojson
│       ├── osm_open_air.geojson
│       └── manual_patches.geojson
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── Map.jsx
    │   ├── RoutePanel.jsx
    │   ├── UVBadge.jsx
    │   └── useNotifications.js
    └── package.json
```

---

## BACKEND — COMPLETE CODE

### main.py

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from router import build_graph, find_covered_route
from uv import get_uv_index, uv_penalty, uv_label, outdoor_exposure_minutes
import json, pathlib

graph = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    data = pathlib.Path(__file__).parent / "data"
    features = []
    for fname in ["osm_covered_raw.geojson",
                  "osm_open_air.geojson",
                  "manual_patches.geojson"]:
        path = data / fname
        if path.exists():
            features += json.loads(path.read_text())["features"]

    graph["G"] = build_graph(features)
    print(f"Graph ready — {graph['G'].number_of_nodes()} nodes, "
          f"{graph['G'].number_of_edges()} edges")
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
def health():
    return {"status": "ok",
            "nodes": graph["G"].number_of_nodes(),
            "edges": graph["G"].number_of_edges()}

@app.post("/route")
async def route(body: dict):
    origin      = body["origin"]
    destination = body["destination"]
    rain_mode   = body.get("rain_mode", False)

    # Fetch live UV index for KL Golden Triangle centroid
    uv = await get_uv_index(lat=3.1488, lng=101.7139)
    penalty = uv_penalty(uv, rain_mode)

    result = find_covered_route(
        graph["G"],
        origin["lat"],      origin["lng"],
        destination["lat"], destination["lng"],
        penalty=penalty
    )

    if "error" not in result:
        result["uv"] = {
            "index":               uv,
            "label":               uv_label(uv),
            "outdoor_minutes":     outdoor_exposure_minutes(result),
            "sunscreen_reminder":  outdoor_exposure_minutes(result) >= 15 and uv >= 6,
            "reminder_message":    _reminder_text(uv)
                                   if outdoor_exposure_minutes(result) >= 15 and uv >= 6
                                   else None
        }
    return result


def _reminder_text(uv: float) -> str:
    if uv >= 11:
        return ("UV is Extreme right now (index {:.0f}). "
                "Reapply SPF 50+ after 10 minutes outdoors.").format(uv)
    if uv >= 8:
        return ("UV is Very High (index {:.0f}). "
                "Reapply sunscreen after 15 minutes outdoors.").format(uv)
    return ("UV is High (index {:.0f}). "
            "Reapply sunscreen after 20 minutes outdoors.").format(uv)
```

---

### uv.py

```python
"""
UV index integration using Open-Meteo — free, no API key required.
UV data for KL updated hourly.
"""
import httpx
from datetime import datetime, timezone
import pytz

KL_TZ = pytz.timezone("Asia/Kuala_Lumpur")

OPEN_METEO_URL = (
    "https://api.open-meteo.com/v1/forecast"
    "?latitude={lat}&longitude={lng}"
    "&hourly=uv_index"
    "&timezone=Asia%2FKuala_Lumpur"
    "&forecast_days=1"
)


async def get_uv_index(lat: float = 3.1488, lng: float = 101.7139) -> float:
    """
    Fetch current UV index from Open-Meteo.
    Returns 0.0 if the API call fails — safe fallback.
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(OPEN_METEO_URL.format(lat=lat, lng=lng))
            data = resp.json()

        now_kl    = datetime.now(KL_TZ)
        hour_str  = now_kl.strftime("%Y-%m-%dT%H:00")
        times     = data["hourly"]["time"]
        uv_values = data["hourly"]["uv_index"]

        if hour_str in times:
            idx = times.index(hour_str)
            return float(uv_values[idx])

        # Fallback: return the closest hour's UV
        return float(uv_values[now_kl.hour])

    except Exception:
        # Never crash routing because UV API failed
        return _estimated_uv_by_hour()


def _estimated_uv_by_hour() -> float:
    """
    Rough UV estimate for KL when API is unavailable.
    Based on typical KL solar noon pattern.
    """
    hour = datetime.now(KL_TZ).hour
    curve = {
        6: 0.5, 7: 1.5, 8: 3.0, 9: 5.5, 10: 8.0,
        11: 10.5, 12: 12.0, 13: 12.0, 14: 11.0, 15: 9.0,
        16: 6.0, 17: 3.5, 18: 1.5, 19: 0.5
    }
    return curve.get(hour, 0.0)


def uv_penalty(uv: float, rain_mode: bool) -> float:
    """
    Returns the penalty multiplier applied to open-air path segments.

    Rain mode overrides UV — rain is more immediately unpleasant.
    UV mode kicks in during dry but sunny conditions.

    Penalty is applied to open-air segments only:
      final_edge_cost = base_metres * penalty (if coverage_score < 0.4)

    The higher the penalty, the more the router prefers covered paths.
    """
    if rain_mode:
        return 6.0   # rain: strongly avoid open air

    # UV-based penalty schedule
    if uv >= 11:   return 5.0   # Extreme  — treat like rain
    if uv >= 8:    return 3.5   # Very High
    if uv >= 6:    return 2.5   # High
    if uv >= 3:    return 1.5   # Moderate — slight preference for shade
    return 1.0                  # Low      — no penalty, open air is fine


def uv_label(uv: float) -> str:
    if uv >= 11: return "Extreme"
    if uv >= 8:  return "Very High"
    if uv >= 6:  return "High"
    if uv >= 3:  return "Moderate"
    if uv >= 1:  return "Low"
    return "None"


def uv_color(uv: float) -> str:
    """Hex color for the UV badge on the frontend."""
    if uv >= 11: return "#7B2D8B"   # violet
    if uv >= 8:  return "#E24B4A"   # red
    if uv >= 6:  return "#D85A30"   # orange
    if uv >= 3:  return "#EF9F27"   # amber
    return "#1D9E75"                 # green


def outdoor_exposure_minutes(route_result: dict) -> int:
    """
    Calculate total outdoor exposure time in minutes from a route result.
    Used to decide whether to trigger the sunscreen reminder.
    """
    if "summary" not in route_result:
        return 0
    total_m    = route_result["summary"]["total_distance_m"]
    covered_pct = route_result["summary"]["coverage_pct"]
    outdoor_m   = total_m * (1 - covered_pct / 100)
    return max(0, round(outdoor_m / 80))  # 80m/min walking pace
```

---

### router.py

```python
import networkx as nx
from scipy.spatial import cKDTree
import numpy as np, math

COVERAGE_TYPE_LABELS = {
    "indoor_mall":      "Walk through {name}",
    "underground_link": "Take the underground tunnel",
    "elevated_walkway": "Take the covered walkway",
    "covered_arcade":   "Walk through the covered arcade",
    "overhead_bridge":  "Cross the covered bridge",
    "open_air":         "Brief outdoor stretch — {dist}m",
}

_kd_tree  = None
_node_arr = None
_node_lst = None


def haversine(lat1, lng1, lat2, lng2) -> float:
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a  = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def build_graph(features: list) -> nx.Graph:
    global _kd_tree, _node_arr, _node_lst
    G = nx.Graph()

    for feat in features:
        geom  = feat.get("geometry", {})
        props = feat.get("properties", {})
        if geom.get("type") != "LineString":
            continue
        if props.get("paid_access"):
            continue

        coords  = geom["coordinates"]
        score   = _infer_score(props)
        c_type  = props.get("coverage_type") or _infer_type(props)
        name    = props.get("name", "")
        air_con = props.get("air_conditioned", False)
        hours   = props.get("operating_hours")

        for i in range(len(coords) - 1):
            lng1, lat1 = coords[i]
            lng2, lat2 = coords[i + 1]
            n_a = (round(lat1, 6), round(lng1, 6))
            n_b = (round(lat2, 6), round(lng2, 6))
            d   = haversine(lat1, lng1, lat2, lng2)
            if d < 0.5:
                continue
            G.add_edge(n_a, n_b,
                       dist            = d,
                       coverage_score  = score,
                       coverage_type   = c_type,
                       name            = name,
                       air_conditioned = air_con,
                       operating_hours = hours,
                       coords          = [[lng1, lat1], [lng2, lat2]])

    # Build KD-tree for fast nearest-node lookup
    _node_lst = list(G.nodes())
    _node_arr = np.array(_node_lst)
    _kd_tree  = cKDTree(_node_arr)

    return G


def find_covered_route(
    G: nx.Graph,
    orig_lat: float, orig_lng: float,
    dest_lat: float, dest_lng: float,
    penalty: float = 1.5   # from uv.uv_penalty()
) -> dict:
    origin = _nearest_node(orig_lat, orig_lng)
    dest   = _nearest_node(dest_lat, dest_lng)

    if not origin:
        return {"error": "Origin is outside our coverage area. "
                         "Try a point in the KL Golden Triangle."}
    if not dest:
        return {"error": "Destination is outside our coverage area. "
                         "Try a point in the KL Golden Triangle."}
    if origin == dest:
        return {"error": "Origin and destination are the same point."}

    def weight_fn(u, v, data):
        score = data.get("coverage_score", 0.0)
        base  = data.get("dist", 1.0)
        if score >= 0.8:   return base
        elif score >= 0.4: return base * 1.3
        else:              return base * penalty

    try:
        path = nx.shortest_path(G, origin, dest, weight=weight_fn)
    except nx.NetworkXNoPath:
        return {"error": "No walkable route found between these points."}

    return _build_response(G, path)


def _nearest_node(lat: float, lng: float, max_m: float = 300):
    dist_deg, idx = _kd_tree.query([lat, lng])
    dist_m = dist_deg * 111_000
    return _node_lst[idx] if dist_m < max_m else None


def _build_response(G: nx.Graph, path: list) -> dict:
    segments, features = [], []
    total_dist = covered_dist = 0.0

    for i in range(len(path) - 1):
        u, v   = path[i], path[i+1]
        data   = G[u][v]
        dist   = data["dist"]
        score  = data.get("coverage_score", 0.0)
        c_type = data.get("coverage_type", "open_air")
        coords = data.get("coords", [[v[1],v[0]],[u[1],u[0]]])

        total_dist   += dist
        covered_dist += dist * max(score, 0)

        segments.append({"coverage_score": round(score, 2),
                         "coverage_type": c_type,
                         "name": data.get("name",""),
                         "air_conditioned": data.get("air_conditioned", False),
                         "distance_m": round(dist)})
        features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {"coverage_score": score,
                           "coverage_type": c_type,
                           "air_conditioned": data.get("air_conditioned", False)}
        })

    coverage_pct = round(covered_dist / total_dist * 100) if total_dist else 0

    return {
        "route_geojson": {"type": "FeatureCollection", "features": features},
        "summary": {
            "total_distance_m":   round(total_dist),
            "coverage_pct":       coverage_pct,
            "estimated_walk_min": max(1, round(total_dist / 80))
        },
        "directions": _directions(segments)
    }


def _directions(segments: list) -> list:
    if not segments: return []
    out, cur_type, cur_name, cur_dist = [], segments[0]["coverage_type"], segments[0]["name"], 0.0
    for seg in segments:
        if seg["coverage_type"] == cur_type:
            cur_dist += seg["distance_m"]
        else:
            out.append(_step(cur_type, cur_name, cur_dist))
            cur_type, cur_name, cur_dist = seg["coverage_type"], seg["name"], seg["distance_m"]
    out.append(_step(cur_type, cur_name, cur_dist))
    return out


def _step(c_type, name, dist):
    t = COVERAGE_TYPE_LABELS.get(c_type, "Continue walking — {dist}m")
    return {"type": c_type,
            "description": t.format(name=name or "this section", dist=round(dist)),
            "distance_m": round(dist)}


def _infer_score(props) -> float:
    if "coverage_score" in props:    return float(props["coverage_score"])
    if props.get("indoor") == "yes": return 1.0
    if props.get("location") == "indoor": return 1.0
    if props.get("tunnel") == "building_passage": return 1.0
    if props.get("highway") == "corridor": return 1.0
    if props.get("covered") == "yes": return 0.85
    return 0.0


def _infer_type(props) -> str:
    if props.get("indoor") == "yes": return "indoor_mall"
    if props.get("tunnel") == "building_passage": return "underground_link"
    if props.get("covered") == "yes" and props.get("bridge"): return "overhead_bridge"
    if props.get("covered") == "yes": return "covered_arcade"
    return "open_air"
```

---

## API CONTRACT

### POST /route

**Request:**
```json
{
  "origin":      { "lat": 3.1478, "lng": 101.6953 },
  "destination": { "lat": 3.1488, "lng": 101.7139 },
  "rain_mode":   false
}
```

**Response:**
```json
{
  "route_geojson": { "type": "FeatureCollection", "features": [...] },
  "summary": {
    "total_distance_m":   1420,
    "coverage_pct":       87,
    "estimated_walk_min": 18
  },
  "directions": [
    { "type": "underground_link", "description": "Take the underground tunnel", "distance_m": 300 },
    { "type": "indoor_mall",      "description": "Walk through Suria KLCC",     "distance_m": 380 },
    { "type": "elevated_walkway", "description": "Take the covered walkway",    "distance_m": 740 }
  ],
  "uv": {
    "index":              11.2,
    "label":              "Extreme",
    "outdoor_minutes":    2,
    "sunscreen_reminder": false,
    "reminder_message":   null
  }
}
```

### GET /health
```json
{ "status": "ok", "nodes": 512, "edges": 487 }
```

### GET /uv
Returns current UV index for KL without routing. Used by frontend
to show the UV badge before a route is calculated.

```json
{ "index": 11.2, "label": "Extreme", "color": "#7B2D8B",
  "message": "UV is Extreme. Route heavily prefers covered paths." }
```

---

## UV ROUTING BEHAVIOUR BY TIME OF DAY

The penalty scales automatically with the live UV index.
This table shows typical KL values — the actual number comes from
Open-Meteo in real time.

| Time (KL) | Typical UV | Label    | Penalty | Behaviour |
|---|---|---|---|---|
| 6am–8am   | 0–2   | Low      | 1.0×  | No penalty — open air same as covered |
| 8am–10am  | 3–6   | Moderate | 1.5–2.5× | Mild preference for covered |
| 10am–2pm  | 8–12  | Very High / Extreme | 3.5–5.0× | Strongly avoids open air |
| 2pm–4pm   | 6–9   | High / Very High | 2.5–3.5× | Clear preference for covered |
| 4pm–6pm   | 2–5   | Low / Moderate | 1.0–1.5× | Mild preference |
| After 6pm | 0–1   | None / Low | 1.0×  | No UV penalty |
| Rain mode | any   | —        | 6.0×  | Overrides UV — rain is urgent |

The route at 12pm through an outdoor stretch will look different from
the same route at 7pm. The algorithm doesn't change — only the penalty
weight does. Covered segments always cost the same; open air segments
get more expensive as the sun gets stronger.

---

## SUNSCREEN REMINDER — FRONTEND NOTIFICATION

When the route response includes `sunscreen_reminder: true`, the
frontend triggers a Web Push notification timed to the outdoor segment.

```javascript
// frontend/src/useNotifications.js

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export function scheduleUVReminder(outdoorMinutes, uvIndex, reminderMessage) {
  if (!reminderMessage) return;
  if (Notification.permission !== "granted") return;

  // Fire the reminder after the user has been walking for 15 minutes
  // or at the start of the first outdoor segment — whichever is sooner
  const delayMs = Math.min(outdoorMinutes * 60 * 1000, 15 * 60 * 1000);

  setTimeout(() => {
    new Notification("Travelero Tralala — UV reminder", {
      body: reminderMessage,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "uv-reminder",     // replaces previous reminder if still showing
      requireInteraction: false
    });
  }, delayMs);
}
```

Usage in the route result handler:
```javascript
if (result.uv?.sunscreen_reminder) {
  await requestNotificationPermission();
  scheduleUVReminder(
    result.uv.outdoor_minutes,
    result.uv.index,
    result.uv.reminder_message
  );
}
```

---

## FRONTEND MAP — COVERAGE + UV COLOURS

```javascript
// Coverage type → route line colour
const COVERAGE_COLORS = {
  "indoor_mall":        "#1D9E75",   // teal
  "underground_link":   "#534AB7",   // purple
  "elevated_walkway":   "#3A8DCC",   // blue
  "covered_arcade":     "#6BAE48",   // green
  "overhead_bridge":    "#82B8D9",   // light blue
  "open_air":           "#D85A30",   // coral — avoid
  null:                 "#888780"    // grey
};

// UV index → badge colour (matches WHO standard)
const UV_COLORS = {
  Extreme:   "#7B2D8B",
  "Very High":"#E24B4A",
  High:      "#D85A30",
  Moderate:  "#EF9F27",
  Low:       "#1D9E75",
  None:      "#888780"
};
```

The UV badge sits in the top-right of the map and shows live:
```
☀ UV 11 · Extreme
Routing avoids open air
```

When rain mode is on it switches to:
```
🌧 Rain mode · Maximising coverage
```

---

## EDGE CASES TO HANDLE

| Scenario | Response |
|---|---|
| Origin outside 300m of graph | "We cover the KL Golden Triangle. Try dropping the pin inside the coloured area." |
| Destination outside graph | Same message |
| Origin = destination | "Origin and destination are the same point." |
| No path found (disconnected graph) | "No walkable route found. The areas may not be connected in our network yet." |
| Open-Meteo API timeout | Fall back to `_estimated_uv_by_hour()` — never crash routing |
| UV = 0 at night | Penalty = 1.0, no UV badge shown, no reminder triggered |
| Rain mode + UV extreme simultaneously | Rain mode wins (6.0× penalty). UV badge still shown. |

---

## DEPLOY CHECKLIST

```
□ Railway account created
□ GitHub repo connected to Railway (backend/ as root)
□ Procfile in backend/ → web: uvicorn main:app --host 0.0.0.0 --port $PORT
□ backend URL copied from Railway dashboard
□ Vercel account created
□ frontend/ deployed to Vercel
□ VITE_API_URL env var set in Vercel → Railway backend URL
□ Test: GET /health returns 200
□ Test: POST /route with Pasar Seni → Pavilion returns coverage_pct >= 60
□ Test: /route at 12pm KL time shows UV.index > 8 and higher coverage route
□ Test: rain_mode: true returns coverage_pct >= rain_mode: false
□ Test: notification fires on mobile Chrome (HTTPS required)
```

---

## BUILD ORDER FOR DEVIN

```
1. Create project structure (backend/ + frontend/)
2. requirements.txt — pip install all
3. data/ — run Overpass query, save both GeoJSON exports
4. manual_patches.geojson — draw all 16 connections at geojson.io
5. router.py — build_graph() first, then find_covered_route()
6. uv.py — get_uv_index() + uv_penalty() + outdoor_exposure_minutes()
7. main.py — wire router + uv, add /health + /route + /uv endpoints
8. Verify: python -c "from router import build_graph; import json;
   feats=json.load(open('data/osm_covered_raw.geojson'))['features'];
   G=build_graph(feats); print(G.number_of_nodes())"
9. Deploy backend to Railway
10. React frontend — Map.jsx + RoutePanel.jsx + UVBadge.jsx
11. Wire /route POST → map render (coverage colours) + directions
12. Wire /uv GET → UV badge in top-right corner
13. Wire sunscreen reminder (useNotifications.js)
14. Deploy frontend to Vercel
15. End-to-end test: Pasar Seni → Pavilion at 12pm KL time
```

---

*Travelero Tralala · PRD v3 · Merdeka 2026*
