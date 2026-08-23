"""
One-off setup script: pull building footprints for the Bandar Sunway
bounding box from the OSM Overpass API and save them locally as GeoJSON.

This is the ONLY network step. At runtime the shade module reads the saved
file and never touches the network.

Usage:
    python backend/fetch_buildings.py
"""
import json
import pathlib
import urllib.request

# Bandar Sunway bbox: (south, west, north, east)
# Covers Sunway Pyramid, Sunway Lagoon, Sunway/Monash/Taylor's, BRT corridor, PJS.
BBOX = (3.0550, 101.5920, 3.0820, 101.6230)

OUT_PATH = pathlib.Path(__file__).parent / "data" / "osm_buildings.geojson"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

QUERY = f"""
[out:json][timeout:120];
(
  way["building"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  relation["building"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
);
out geom;
"""


def ring_to_polygon(members):
    """Outer way members of a building relation -> list of coordinate rings."""
    return [
        [[pt["lon"], pt["lat"]] for pt in m["geometry"]]
        for m in members
        if m.get("type") == "way" and m.get("role") == "outer" and m.get("geometry")
    ]


def to_features(data):
    features = []
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        if el["type"] == "way" and el.get("geometry"):
            ring = [[pt["lon"], pt["lat"]] for pt in el["geometry"]]
            if len(ring) < 4:
                continue
            geom = {"type": "Polygon", "coordinates": [ring]}
        elif el["type"] == "relation" and el.get("members"):
            rings = ring_to_polygon(el["members"])
            if not rings:
                continue
            geom = (
                {"type": "Polygon", "coordinates": [rings[0]]}
                if len(rings) == 1
                else {"type": "MultiPolygon", "coordinates": [[r] for r in rings]}
            )
        else:
            continue
        tags["id"] = str(el["id"])
        features.append({"type": "Feature", "properties": tags, "geometry": geom})
    return features


def main():
    req = urllib.request.Request(
        OVERPASS_URL,
        data=QUERY.encode(),
        headers={"User-Agent": "travelero-shade-setup/1.0"},
    )
    print(f"Querying Overpass for buildings in {BBOX} ...")
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.load(resp)

    features = to_features(data)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f)

    print(f"Saved {len(features)} building features -> {OUT_PATH}")


if __name__ == "__main__":
    main()
