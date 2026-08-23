# Travelero — Product Requirements Document
**Hackathon scope: half-day build**

## 1. Problem Statement
For short "last-mile" trips (station → home, campus → mall, etc.), people default to Grab instead of walking — often because they don't know a shaded, covered, or safer path exists. Travelero finds walking routes that trade off speed against coverage and safety, so walking becomes the obviously better choice.

## 2. Goals (hackathon MVP)
- Given an origin and destination, show **three route options**: Fastest, Most Covered, Balanced.
- Visually flag **danger zones** along the way: highways/high-speed roads (pre-built) and broken/unsafe paths (community-reported).
- Let a user submit a broken-path report from the map.
- Runs live, on a real (small) demo area, deployed on Vercel.

## 2.1 Demo Area
**Bandar Sunway: Monash University Malaysia → Sunway University → Sunway Pyramid**, including the elevated BRT/linkway corridor connecting them.

- **Bounding box:** lat 3.063–3.075, lng 101.599–101.610 (~1.3km × 1.3km)
- Chosen because: small enough to fully tag/verify in the available time, and it already contains a real, well-known elevated covered-walkway network — good contrast between covered and exposed segments for the demo.

## 3. Non-Goals (explicitly out of scope for today)
- City-wide or nationwide routing coverage.
- Turn-by-turn live navigation / GPS tracking.
- Route recalculation that avoids community-reported hazards (visual overlay only for now).
- User accounts / auth (unless trivially fast via Supabase Auth — nice-to-have, not required).
- Weather, time-of-day, or crowd-density factors.

## 4. Target User & Core Use Case
A pedestrian near a transit stop or campus deciding: "Do I walk or do I Grab?" They open Travelero, set start/end, and pick a route that matches their priority (speed vs. shade/coverage vs. a bit of both) while seeing which segments to avoid.

## 5. Core Features

### 5.1 Route Generation
- Input: origin + destination (map tap or search-free — pin-drop is fine for demo).
- Output: three route lines rendered simultaneously (or toggle-able):
  - **Fastest** — shortest walking distance.
  - **Most Covered** — minimizes exposure to uncovered/exposed segments, even if longer.
  - **Balanced** — moderate tradeoff between the two.
- Each route shows: distance, est. walking time, % of route covered.

### 5.2 Danger Highlighting
- **Highways (pre-built):** static overlay layer, precomputed once for the demo area from OSM tags (`highway=trunk|primary|secondary`, missing sidewalk tag, high `maxspeed`). Rendered as a red line layer.
- **Broken Paths (community-driven):** user-submitted pins (lat/lng, type, optional note/photo). Rendered as markers. Visible to all users in real time (Supabase).

### 5.3 Community Reporting
- Simple form/modal: tap a point on the map → select hazard type (`broken_path`, `no_lighting`, `flooding`, `other`) → optional note → submit.
- Appears on the map immediately for all users (Supabase Realtime or refetch-on-load).

### 5.4 Shade Engine (module owner: Xuan — builds independently, merges into routing)
Extends the "Most Covered" route beyond static built cover (malls, tunnels, elevated walkways) with **computed shade**: for a given timestamp, works out which open-air segments sit in a building's shadow using real sun position + OSM building footprints. Same segment can score differently at 10am vs 4pm.
- **Interface:** `ShadeModel.scoreSegment(lng1, lat1, lng2, lat2, when)` → float `0.0–1.0`; `shadeMap(graph, model, when)` walks the routing graph and returns a score per edge, keyed the same way the base graph keys edges.
- **Feeds into route weighting:** the route-weight function takes an optional `shade` map and a `rainMode` flag — shade credit is applied only when not raining (a shadow blocks sun, not rain).
- **Status:** ported to JS and verified against a 12-case acceptance suite on a synthetic Bandar Sunway fixture (Aug 2026) — logic confirmed correct. Still needed before this is demo-ready: real Bandar Sunway building footprints (Overpass pull, Section 8.1's approach applied to `building=*` instead of pedestrian ways) and wiring into the actual base routing graph once it exists.
- **Demo timing matters:** near the equator, midday sun is nearly overhead and all routes converge on "everything is exposed" — correct, but visually boring. Demo the shade contrast at **10am or 4pm**, not noon.
- **UI copy requirement:** label this as *estimated* shade, not surveyed — building heights are resolved from OSM tags where present and a type-based heuristic otherwise.

## 6. Tech Stack
- **Frontend:** Next.js (App Router), deployed on Vercel.
- **Map rendering:** Leaflet.js + OpenFreeMap (or CARTO free) tiles.
- **Geospatial utilities:** Turf.js (distance, buffering).
- **Routing/graph:** OpenStreetMap data (via Overpass API) → `osmtogeojson` → graph built with `graphology` → `graphology-shortest-path` (`dijkstra.bidirectional`) run 3x with different edge-weight functions.
- **Shade module:** `suncalc` (sun position) + `@turf/turf` (footprint area, shadow projection, containment) — no separate geometry/projection library needed; turf's geodesic functions replace what would otherwise require a custom map projection.
- **Backend/DB:** Supabase (Postgres + **PostGIS extension enabled**).
- **UI:** shadcn/ui + Tailwind.
- **Build agent:** Devin AI.

## 7. Data Model (Supabase)

**`hazard_reports`**
| column | type | notes |
|---|---|---|
| id | uuid, pk | default gen_random_uuid() |
| location | geography(Point,4326) | PostGIS, spatial index |
| type | text | enum-like: broken_path / no_lighting / flooding / other |
| note | text | optional |
| photo_url | text | optional |
| created_at | timestamptz | default now() |
| upvotes | int | default 0, stretch goal |

**Static assets (not DB — precomputed files):**
- `pedestrian_ways.geojson` — OSM ways for demo area, tagged with coverage attributes.
- `danger_highways.geojson` — precomputed dangerous road segments.

## 8. Architecture / Data Flow

### 8.1 Coverage Data Prep (Hermes pass — do this first, before build hours start)
1. **Query existing tags:** run the Overpass QL query below against the bounding box to see what coverage/sidewalk data already exists — don't re-tag what's already correct.
   ```
   [out:json][timeout:60];
   (
     way["highway"~"footway|path|pedestrian|steps|corridor|living_street"]
        (3.063,101.599,3.075,101.610);
     way["highway"]["sidewalk"]
        (3.063,101.599,3.075,101.610);
     way["covered"]
        (3.063,101.599,3.075,101.610);
   );
   out body;
   >;
   out skel qt;
   ```
2. **Diff the results:** flag ways with no coverage tag at all, or ambiguous ones (e.g. unclear if a segment is under the elevated linkway).
3. **Run Hermes only on the gaps:** Hermes visually inspects the flagged segments against satellite/street-level imagery and classifies coverage (`covered=yes/no`), given the small scope this is expected to take well under an hour.
4. **Patch the GeoJSON** with Hermes's outputs → this becomes `pedestrian_ways.geojson`.

### 8.2 Runtime Flow
1. **On load:** app fetches static way-graph GeoJSON (patched above) + live `hazard_reports` from Supabase.
2. **On route request:** build/query graph in-browser (or a Next.js API route) → run shortest-path 3x with different weight functions → return 3 GeoJSON LineStrings.
3. **Render:** Leaflet draws base map, 3 route lines (distinct colors), danger overlay, hazard pins.
4. **On report submit:** insert into `hazard_reports` → map re-renders pin.

### 8.3 Shade Module Integration
1. **Independent build:** `ShadeModel` and `shadeMap()` (Section 5.4) build and test against a fixture graph, no dependency on the base routing graph existing yet.
2. **Data prep (parallel to Section 8.1, same technique, different tag):** Overpass query for `building=*`/`building` relations in the bounding box → resolve height per building (explicit tag → `building:levels` → type heuristic → 12m default) → hand-verify heights for the handful of landmark buildings on the demo corridor (Sunway Pyramid, Sunway Resort Hotel, etc.).
3. **Merge point:** once the base graph exists, compute `shadeMap(G, model, now)` before each route request and pass it into the route-weight function alongside `rainMode`. No changes to the graph structure or node keys required — shade is looked up by edge, same key scheme the base graph already uses.
4. **Verify:** `/route` still returns correctly with `shade: null` (unaffected callers) and with a real shade map (route changes by time of day).

## 9. Success Criteria for the Demo
- Live app on a Vercel URL.
- Three visibly different routes rendered for a real start/end pair in the chosen demo area.
- At least one highway danger segment and one seeded "broken path" report visible on the map.
- A judge can submit a new hazard report live and see it appear.

## 10. Suggested Half-Day Build Order
| Time | Task |
|---|---|
| Hr 0 (before build starts) | Run Hermes coverage-tagging pass on the Bandar Sunway bounding box (Section 8.1) |
| Hr 1 | Repo setup (Next.js + Supabase + PostGIS enabled); pull patched OSM data into GeoJSON |
| Hr 2 | Build weighted graph; implement 3 route-weight functions; test pathfinding output |
| Hr 3 | Map UI: render base map, route toggle, danger overlay |
| Hr 4 | Hazard reporting flow (form → Supabase → map refresh); UI polish |
| Hr 5 | Seed demo data, rehearse demo script, deploy, buffer for bugs |

## 11. Stretch Goals (only if ahead of schedule)
- Route recalculation that actively avoids community-reported hazards.
- Supabase Realtime so hazard pins appear live for all viewers without refresh.
- Surface `shaded_pct` / exposure score in the UI per route (the underlying shade scoring itself is built — see Section 5.4 — this is just wiring it into the response and the route card).
- Upvote system on hazard reports to weight their reliability.

## 12. Open Risks
- OSM coverage-tagging may be sparse or inconsistent for the linkway network — Hermes pass (Section 8.1) exists specifically to close this gap; keep it scoped to the bounding box, not wider KL (see Section 13).
- Overpass API can rate-limit or be slow — pull and cache data *before* the demo, don't query live on stage.
- Keep the demo area small and rehearsed; don't attempt to make routing "work anywhere" live.
- Overhead satellite imagery can't always distinguish an actual covered structure from tree canopy — where Hermes is uncertain, cross-check with street-level imagery rather than guessing from satellite alone.
- **Sun-library conventions vary and aren't obvious from the docs.** The Python `suncalc` package (which the Shade Engine's original design assumed) and the npm `suncalc` package used in the JS port return sun position in different units and different angle conventions (radians vs degrees; azimuth measured from south vs. the sun's own compass bearing from north). Ported literally, this silently points every shadow 180° in the wrong direction with no error thrown. Caught by checking computed sun positions against known KL sun behavior (morning sun in the east, evening in the west) before trusting the output — worth re-verifying if this dependency is ever upgraded.
- Exact shadow bearing shifts with the calendar date (solar declination) — don't hardcode acceptance-test angle ranges tuned to one day; test the directional pattern (morning shadows fall west-of-compass, evening shadows fall east-of-compass) instead, and sanity-check actual numbers the morning of the real demo.

## 13. Roadmap (post-hackathon, not in scope today)
- Extending Hermes's coverage-tagging pass beyond Bandar Sunway to other KL neighbourhoods, then city-wide.
- At city scale this is a genuinely large effort — imagery access (Street View API cost/ToS), classification accuracy, and validation all become real bottlenecks, not just compute. Worth pitching as vision, not promising as delivered.
- Swapping the in-browser graph pathfinding for a self-hosted routing engine (e.g. Valhalla) with native custom costing, once coverage beyond one small area is needed.
- Route recalculation that actively avoids community-reported hazards, rather than displaying them as an overlay only.
