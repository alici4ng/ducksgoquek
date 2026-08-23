# Coverage-Gap Review Report (Prompt 3 output, consolidated)

Generated: 2026-08-23 (MYT) by the Hermes orchestrator pass for the Travelero
coverage pipeline (HERMES_COVERAGE_PROMPTS.md, Prompt 3).

## Scope

- Bounding box (S,W,N,E): 3.063, 101.599, 3.075, 101.610 — Bandar Sunway.
- Corridor: Monash University Malaysia → Sunway University → Sunway Pyramid,
  including the elevated BRT/linkway corridor.
- Source: 165 pedestrian ways extracted 2026-08-23T04:34:51Z from
  https://overpass-api.de/api/interpreter (cached: data/overpass/overpass_response.json).

## Corridor boundary scan (highest-priority item)

Main pedestrian component: 24 ways (69 components total; all others are small
isolated clusters). Traversal script: scripts/04_traversal.py (deterministic DFS).

Ordered Monash→Pyramid sequence (south→north):

| # | way ID | character |
|---|--------|-----------|
| 1 | 1460003882 | footway, layer=1, bridge=yes (B_START hypothesis, R001) |
| 2 | 1460003881 | footway, 5.4m, no tags — PULLED OUT (suspected gap) |
| 3 | 1467745043 | footway, tunnel=building_passage |
| 4 | 1467745042 | steps, 43.3m, no tags — PULLED OUT (suspected gap) |
| 5 | 1467745044 | footway, tunnel=building_passage |
| 6 | 1460003879 | footway, covered=yes, bridge, layer=1 |
| 7 | 1467745041 | "Canopy Walk" covered=yes, bridge, 302m |
| 8 | 1460003884 | "Canopy Walk" covered=yes, indoor |
| 9 | 1460003886 | "Canopy Walk" covered=yes |
| 10 | 1460003885 | "Canopy Walk" steps, covered=yes |
| 11 | 1460003883 | "Canopy Walk" covered=yes, bridge, 419m |
| 12 | 603816937 | footway, 10.1m, no tags — PULLED OUT (suspected gap) |
| 13 | 1303647078 | indoor corridor (Sunway Pyramid) |
| 14 | 1303647077 | indoor corridor (duplicate of 1303647083 geometry) |
| 15 | 1303647083 | indoor corridor (B_END hypothesis, R002) |

- **B_START (R001):** way 1460003882 — elevated bridge footway at the Monash
  campus edge; cover-signal tags present but no `covered` tag. Imagery review
  must confirm where built cover begins.
- **B_END (R002):** way 1303647083 — indoor corridor inside Sunway Pyramid;
  cover ends where the corridor exits the building toward Sunway University.
- **Bulk-tag candidates (10):** ways strictly between R001 and R002 not pulled
  out: 1467745043, 1467745044, 1460003879, 1467745041, 1460003884, 1460003886,
  1460003885, 1460003883, 1303647078, 1303647077.
- **Pulled out (3):** 1460003881 (5.4m), 1467745042 (43.3m steps), 603816937
  (10.1m) — no cover-signal tags mid-corridor; suspected roofline gaps. Queued
  as G111, G118, G030 for individual imagery review.

Component branches NOT on the chosen path (all queued individually in the
general queue; connectivity verified):
- West arm of Canopy Walk: 210994197 (covered=yes, 362m) → 603816938 (steps) →
  764530864 — serves BRT Sunway-Setia Jaya / SunU-Residence direction.
- Pyramid east arm: 1303647076 (indoor corridor) → 603815893/603814881
  (covered bridges) → 603815894 (indoor steps) → 603815895.
- Monash east approach: 1467785088 (building_passage) extending east from the
  path start.

## General review queue

- 104 queue items covering 134 member ways
  (individual: 102, batch: 2).
- Priority totals: high=35, medium=61, low=8.
- Batched: G135 (27 low-priority clearly-ground-level open ways, 534.7m) and
  G136 (5 medium-priority open ways, 94.7m) — spot-check only.
- Every item carries a specific ambiguity reason derived from tags, covered-
  network endpoint adjacency, and corridor distance (see review_queue_general.json).
- Zero generic reasons.

## Reconciliation (gate check)

165 total = 25 existing_explicit (preserved, not queued) + 134 queued +
10 bulk-tag candidates + 2 boundary ways (R001/R002). Union covers all 165;
no overlaps. 3 pulled-out corridor ways are inside the 134 queued.

## Artifacts

- data/review/corridor_traversal.json — traversal record
- data/review/review_queue_general.json — machine-readable queue
- data/review/review_queue_general.geojson — map layer of queued segments
- data/review/review_report_general.md — queue methodology detail
- data/review/review_report.md — this file

## Next stage (Prompt 4)

Verify R001/R002 boundaries first; bulk-tag the 10 candidates between them
with confidence=medium and boundary-scan provenance; classify all 104 queue
items against satellite imagery (Esri World Imagery) with street-level
cross-check where roofs vs canopy is ambiguous. Decisions append to
data/review/decisions.jsonl via scripts/record_decision.py.
