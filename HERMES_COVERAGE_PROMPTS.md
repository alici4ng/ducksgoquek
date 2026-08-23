# Hermes Prompt Series: Bandar Sunway Coverage Tags

## PRD identified

The source of truth is `Travelero_PRD.md`, especially Sections 2.1, 5.1, 7, 8.1, 10, and 12.

The required Hermes pass is narrowly scoped to pedestrian routes in Bandar Sunway:

- Corridor: Monash University Malaysia → Sunway University → Sunway Pyramid, including the elevated BRT/linkway corridor.
- Bounding box: south `3.063`, west `101.599`, north `3.075`, east `101.610`.
- Goal: preserve correct existing OpenStreetMap coverage data, investigate only missing or ambiguous coverage, and produce a patched `pedestrian_ways.geojson` whose route segments have reliable `covered=yes` or `covered=no` values.
- Important distinction: `covered=*` describes built overhead protection. Tree canopy and temporary building shadows are not cover. Dynamic building shade belongs to the separate Shade Engine.
- Do not upload edits to OpenStreetMap. This workflow produces a local static demo asset.

## How to use these prompts

Run the prompts in order in the same Hermes workspace/session. Each prompt consumes the artifacts produced by the previous prompt. Do not skip a gate when unresolved or malformed data is reported.

---

## Prompt 1 — Establish the contract and inspect the workspace

```text
You are preparing the coverage dataset for the Travelero hackathon MVP. Read Travelero_PRD.md in full before doing anything else, then inspect the repository structure and available tools/dependencies.

Scope is fixed:
- Bandar Sunway corridor: Monash University Malaysia → Sunway University → Sunway Pyramid, including the elevated BRT/linkway corridor.
- Bounding box in Overpass order (south, west, north, east): (3.063,101.599,3.075,101.610).
- Output is a local patched GeoJSON asset; do not edit or upload data to OpenStreetMap.
- Only classify built overhead cover. Do not treat tree canopy or computed building shadow as covered.
- Known prior: an elevated covered linkway is reported to run continuously along approximately this corridor (Monash → BRT station → Sunway University → Pyramid). Treat this as a lead to verify with imagery, not as a substitute for verification — confirm its actual extent and any gaps rather than assuming full coverage end to end.

Imagery tooling:
- If browser/computer-use access is available, use it to view Google Maps satellite imagery as the primary overhead source for classification, and Google Street View for cases where overhead imagery cannot distinguish a roof from tree canopy.
- Record only your classification, reasoning, and a reference (URL, coordinates, capture date if shown) to what you viewed. Do not save, download, screenshot, or embed the imagery itself into any output file or the repository.
- If no browser/imagery tool is available, state this explicitly as a blocker rather than proceeding on assumption.

Create a concise execution plan that follows PRD Section 8.1:
1. Query existing OSM pedestrian and coverage tags.
2. Convert and inventory the source data.
3. Identify only missing or ambiguous coverage.
4. Verify those gaps with legally accessible satellite/street-level imagery.
5. Patch and validate pedestrian_ways.geojson.

Before executing later phases, report:
- tools and dependencies available;
- proposed artifact paths;
- how OSM way IDs and source tags will be preserved;
- how mixed covered/uncovered ways will be split at actual transition points;
- blockers such as unavailable network or imagery access.

Use deterministic, rerunnable steps. Do not guess coverage and do not silently replace existing tags.
```

**Gate:** Continue only when Hermes has confirmed it can preserve source identity and produce GeoJSON. Network or imagery limitations must be explicit.

---

## Prompt 2 — Pull and inventory the OSM pedestrian network

```text
Execute the OSM extraction phase from the approved plan. Use this exact PRD query for the fixed Bandar Sunway bounding box:

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

Requirements:
- Cache the raw Overpass JSON locally so later work does not depend on a live API.
- If an Overpass endpoint fails or rate-limits, retry conservatively or use another standard public endpoint; do not broaden the bounding box.
- Convert the response to GeoJSON using the repository's existing tooling where available. Do not add a dependency unless needed and approved by the project conventions.
- Retain only relevant routable pedestrian LineString/MultiLineString features in the working pedestrian dataset. Do not mistake returned helper nodes for routes.
- Preserve each OSM way ID, all original tags, and enough provenance to trace every output feature to its source.
- Do not alter any existing `covered` value in this phase.

Create an inventory with, at minimum:
- source OSM way ID;
- highway/footway/sidewalk/corridor/tunnel/indoor/layer/bridge tags when present;
- existing `covered` value when present;
- geometry length;
- preliminary status: `existing_explicit`, `implicit_review`, `missing`, or `ambiguous`;
- reason for that status.

Treat indoor corridors and `tunnel=building_passage` as requiring semantic review for application coverage, but preserve their original OSM tagging conventions. At the end, report feature counts by highway type, coverage value, and review status, plus all created artifact paths.
```

**Gate:** The raw response, converted working GeoJSON, and inventory must exist, and every working route feature must have a traceable OSM way ID.

---

## Prompt 3 — Produce the coverage-gap review queue

```text
Using the cached source data and inventory, perform the PRD Section 8.1 diff. Do not re-review ways whose existing coverage is clearly correct unless geometry or other tags conflict with it.

Build a review queue containing only:
- pedestrian ways with no usable coverage classification;
- ways with conflicting tags;
- ways whose single geometry may span both covered and exposed sections;
- ways possibly under or inside the elevated BRT/linkway, a building, a roof, an arcade, a colonnade, or a building passage;
- existing `covered=yes/no` ways whose imagery or geometry creates a concrete ambiguity.

**Corridor boundary scan (do this before building the general queue above):**
For the known elevated linkway corridor (Monash → BRT station → Sunway University → Pyramid), do not queue every way along it for individual review. Instead:
1. Traverse the connected way sequence from the Monash end toward the Pyramid end by following shared endpoint nodes through the pedestrian network, and record the ordered list of way IDs that make up this path.
2. Identify exactly two boundary points to verify with imagery: where built cover begins near the Monash end, and where it ends near the Pyramid end.
3. Any way that falls entirely between those two verified points is a bulk-tag candidate — it does not need individual imagery review, only inclusion in this traversal record.
4. The two boundary ways themselves (where cover starts/ends) go through normal mixed-way handling — they may need splitting at the exact transition coordinate.
5. If anything along the traversal looks like a genuine break in continuity (e.g. an at-grade road crossing, a visible gap in the roofline), pull that specific way out of the bulk-tag candidate list and add it to the general review queue instead — do not assume continuity through a suspected gap.

Record the traversal (way ID sequence, the two boundary way IDs, and any ways pulled out for individual review) as its own artifact, separate from the general queue below.

For every item in the general queue include:
- stable review ID;
- source OSM way ID;
- relevant source tags;
- coordinates or a compact geometry reference;
- length;
- why it needs review;
- what evidence would resolve it;
- candidate transition points if the geometry appears mixed.

Generate both a machine-readable queue and a human-readable review report. Include a map-friendly GeoJSON layer for the queued segments if practical. Do not assign `covered=yes` or `covered=no` merely because a way is elevated, near a building, or beneath tree canopy.

Report queue totals and identify the highest-priority items along the Monash University Malaysia → Sunway University → Sunway Pyramid demo corridor. The corridor boundary scan above is the highest-priority item to resolve first — its two boundary points should be reviewed before any item in the general queue.
```

**Gate:** Every queued item must state a specific ambiguity and retain source identity. A generic “missing tag” without geometry/evidence context is insufficient.

---

## Prompt 4 — Visually classify only the gaps

```text
Review every item in the coverage-gap queue using legally accessible, appropriately licensed satellite and/or street-level imagery available through your tools. Prioritize the Monash University Malaysia → Sunway University → Sunway Pyramid corridor and the elevated BRT/linkway.

If browser/computer-use access is available, use it to view Google Maps satellite imagery as the primary overhead source, and Google Street View for cases where overhead imagery cannot distinguish a roof from tree canopy. Record only your classification, reasoning, and a reference (URL, coordinates, capture date if shown) to what you viewed — do not save, download, screenshot, or embed the imagery itself into any output file. If no such tool is available, state this explicitly as a blocker.

**Corridor boundary scan items (from Prompt 3) — process these first:**
- Verify only the two recorded boundary points (start of cover near Monash, end of cover near Pyramid) with imagery. Record each as a normal decision (classification, confidence, evidence).
- For every way in the traversal record that falls entirely between the two verified boundaries, apply `covered=yes` without individual imagery review. Mark these with `confidence: medium` and an evidence note stating they were bulk-inferred from the boundary scan, not individually viewed — this distinction matters for the patch step.
- Any way already pulled out of the bulk-tag list in Prompt 3 for a suspected gap goes through the normal per-way classification rules below.

**General queue items — classification rules:**
- `covered=yes`: continuous built overhead protection exists over the segment, such as a roofed linkway, building overhang, indoor corridor, covered arcade/colonnade, or building passage.
- `covered=no`: the segment is open to the sky with no built overhead cover.
- Tree canopy is not built cover.
- A building's temporary sun shadow is not built cover.
- Being elevated does not itself imply cover.
- Do not infer an entire way from one visible point when coverage changes along it.
- If coverage changes along a way, record precise transition coordinates and separate classifications for each resulting segment.
- Cross-check street-level imagery whenever overhead imagery cannot distinguish a roof from trees or shadows.
- Never guess. Mark insufficient evidence as `unresolved`.

For every reviewed item record:
- review ID and source OSM way ID;
- classification (`yes`, `no`, `mixed`, or `unresolved`);
- confidence (`high`, `medium`, or `low`);
- evidence type and concise observation;
- imagery source/reference and capture date when available;
- transition coordinates for mixed ways;
- reviewer timestamp.

Do not modify source files during this phase. Produce a machine-readable decision file and a human-readable decision report. End with totals by classification/confidence and a separate list of unresolved items. If anything is unresolved, state the exact evidence or human check required; do not default it to `no`.
```

**Gate:** All queued items must have a recorded decision or an explicit unresolved reason. Mixed ways must include usable transition points before patching.

---

## Prompt 5 — Patch `pedestrian_ways.geojson`

```text
Create the Travelero static pedestrian asset from the cached OSM working GeoJSON and the reviewed decision file.

Patching rules:
- Preserve correct existing OSM coverage values.
- Add application coverage only where supported by an explicit existing tag or a recorded Hermes decision.
- Every final routable segment must expose a top-level string property `covered` whose value is exactly `yes` or `no`.
- Preserve original OSM way ID and source tags/provenance on every output feature.
- Add provenance fields that distinguish existing OSM tags from Hermes-reviewed classifications, for example `coverage_source`, `coverage_confidence`, and `coverage_review_id`. Use one consistent schema.
- For ways bulk-tagged via the corridor boundary scan (Prompts 3-4), set `coverage_source` to identify them as boundary-inferred rather than individually reviewed, and carry through the `confidence: medium` from Prompt 4 rather than upgrading it — the review ID should point back to the shared boundary-scan decision, not a per-way review.
- For mixed ways, split the GeoJSON geometry at reviewed transition coordinates. Give each child a stable unique feature ID while retaining the parent OSM way ID.
- Do not mutate the cached raw response or the unpatched converted source.
- Do not turn unresolved items into `covered=no`. If unresolved items remain, write a blocking report and exclude only when that does not disconnect the required demo corridor; otherwise stop and report the blocker.
- Keep the output within the fixed bounding box and retain only routable pedestrian line geometry.

Write the final asset as `pedestrian_ways.geojson` in the repository location expected by the application if that location exists. If the application has not yet been scaffolded, place it in a clearly named data directory and report the path rather than inventing frontend structure.

Also write a patch summary mapping each added or changed output segment to its source way, decision, and evidence record. Do not upload these classifications to OpenStreetMap.
```

**Gate:** No final feature may have an unsupported classification, an invalid coverage value, or missing source identity.

---

## Prompt 6 — Validate coverage and routing readiness

```text
Perform a strict QA pass on the completed pedestrian_ways.geojson and fix only deterministic transformation/formatting defects. Do not invent evidence to fix classification defects.

Validate:
1. The file is valid GeoJSON and is a FeatureCollection.
2. All routable features are LineString or MultiLineString geometries with valid coordinates.
3. All coordinates lie within or intersect the fixed Bandar Sunway bounding box.
4. Every feature has a stable unique feature ID and traceable source OSM way ID.
5. Every feature has `covered` exactly equal to `yes` or `no`.
6. Every Hermes-derived value links to a review decision and evidence record.
7. Existing correct OSM coverage tags were preserved.
8. Mixed ways were split at coverage transitions rather than assigned one value end-to-end.
9. There are no accidental duplicate geometries or zero-length segments.
10. The Monash University Malaysia → Sunway University → Sunway Pyramid pedestrian corridor, including the BRT/linkway, remains connected enough for graph construction.
11. Report total route length and feature count split by `covered=yes/no`, plus covered percentage by length.
12. Report all unresolved, low-confidence, disconnected, or suspicious segments.

Create a final QA report with a clear PASS/FAIL result and reproducible validation commands. PASS only if there are no unresolved classifications affecting the required demo corridor and the output is suitable for the PRD's Fastest, Most Covered, and Balanced route calculations.

Conclude with:
- final asset path;
- source extraction timestamp;
- feature and length statistics;
- remaining limitations;
- exact handoff notes for the routing agent.
```

## Expected final artifacts

Hermes may adapt paths to repository conventions, but the completed pass should leave these logical artifacts:

1. Cached raw Overpass response.
2. Unpatched converted pedestrian GeoJSON.
3. Coverage inventory.
4. Gap-review queue and map layer.
5. Evidence-backed decision file and report.
6. Final `pedestrian_ways.geojson`.
7. Patch summary.
8. Final QA report with PASS/FAIL and routing handoff.

## Final acceptance checklist

- Work is limited to `(3.063,101.599,3.075,101.610)`.
- Existing correct tags are not needlessly reclassified.
- Only missing or ambiguous segments receive visual review.
- Built cover is not confused with trees or dynamic shade.
- Mixed ways are geometrically split at transitions.
- Every final segment has `covered=yes` or `covered=no` with provenance.
- No unresolved segment is silently treated as uncovered.
- The required Bandar Sunway demo corridor remains routable.
- The final asset is local only; no OSM upload occurs.
