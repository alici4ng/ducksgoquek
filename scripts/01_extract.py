#!/usr/bin/env python3
"""Travelero coverage pipeline — Step 1: Overpass extraction.

Fetches pedestrian-network ways for the Bandar Sunway corridor bbox and caches
the raw Overpass JSON verbatim, plus extraction metadata (endpoint, timestamp).

Deterministic and rerunnable: re-running overwrites the cache with a fresh pull.
Run from repo root or from scripts/ — paths are resolved relative to this file.

Usage:
    python scripts/01_extract.py [--use-cache]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
OVERPASS_DIR = REPO_ROOT / "data" / "overpass"
RAW_CACHE = OVERPASS_DIR / "overpass_response.json"
META_FILE = OVERPASS_DIR / "extraction_meta.json"

# Fixed scope bbox (south, west, north, east) — DO NOT broaden.
BBOX = "3.063,101.599,3.075,101.610"

QUERY = """[out:json][timeout:60];
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
out skel qt;"""

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

RETRY_PAUSE_S = 30
MAX_RETRIES_PER_ENDPOINT = 2


def fetch(endpoint: str) -> dict:
    """POST the query (data-urlencode) and return parsed JSON, raising on failure."""
    last_err: Exception | None = None
    for attempt in range(1, MAX_RETRIES_PER_ENDPOINT + 1):
        try:
            print(f"[extract] POST {endpoint} (attempt {attempt})")
            resp = requests.post(
                endpoint,
                data={"data": QUERY},
                timeout=120,
                headers={"User-Agent": "Travelero-coverage-pipeline/0.1 (hackathon research; local asset only)"},
            )
            if resp.status_code in (429, 504):
                raise requests.HTTPError(f"rate-limited/timeout: HTTP {resp.status_code}")
            resp.raise_for_status()
            payload = resp.json()
            if "elements" not in payload:
                raise ValueError("response JSON has no 'elements' key")
            return payload
        except Exception as err:  # noqa: BLE001 — retry conservatively on any failure
            last_err = err
            print(f"[extract] attempt {attempt} failed: {err}")
            if attempt < MAX_RETRIES_PER_ENDPOINT:
                print(f"[extract] waiting {RETRY_PAUSE_S}s before retry")
                time.sleep(RETRY_PAUSE_S)
    raise RuntimeError(f"endpoint {endpoint} exhausted: {last_err}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Overpass extraction for Travelero coverage pipeline")
    parser.add_argument("--use-cache", action="store_true",
                        help="skip network if a valid cached response already exists")
    args = parser.parse_args()

    OVERPASS_DIR.mkdir(parents=True, exist_ok=True)

    if args.use_cache and RAW_CACHE.exists():
        try:
            cached = json.loads(RAW_CACHE.read_text(encoding="utf-8"))
            if isinstance(cached.get("elements"), list):
                print(f"[extract] using cached response ({len(cached['elements'])} elements)")
                return 0
        except (json.JSONDecodeError, OSError) as err:
            print(f"[extract] cache invalid ({err}); refetching")

    payload: dict | None = None
    used_endpoint: str | None = None
    for endpoint in ENDPOINTS:
        try:
            payload = fetch(endpoint)
            used_endpoint = endpoint
            break
        except RuntimeError as err:
            print(f"[extract] {err} — falling back to next endpoint")

    if payload is None or used_endpoint is None:
        print("[extract] FATAL: all Overpass endpoints failed", file=sys.stderr)
        return 1

    RAW_CACHE.write_text(json.dumps(payload), encoding="utf-8")
    ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
    meta = {
        "extracted_at_utc": ts,
        "endpoint": used_endpoint,
        "query": QUERY,
        "bbox_south_west_north_east": BBOX,
        "element_count": len(payload["elements"]),
        "way_count": sum(1 for e in payload["elements"] if e.get("type") == "way"),
        "node_count": sum(1 for e in payload["elements"] if e.get("type") == "node"),
        "raw_cache": str(RAW_CACHE.relative_to(REPO_ROOT)).replace("\\", "/"),
    }
    META_FILE.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"[extract] cached {meta['element_count']} elements "
          f"({meta['way_count']} ways, {meta['node_count']} nodes) from {used_endpoint} at {ts}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
