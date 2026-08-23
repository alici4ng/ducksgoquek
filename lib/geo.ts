/**
 * Georeferencing between the schematic plan in sunway-city.ts / route-engine.ts
 * and the real world, so the custom shade overlays can be drawn on top of
 * OpenStreetMap tiles.
 *
 * The schematic is stylised, so instead of warping it, every named graph node
 * and place is anchored to its real WGS84 position. Intermediate "via" points
 * (which only exist to curve a path) are re-expressed relative to their edge's
 * endpoints and carried over proportionally. Anything not anchored falls back
 * to a least-squares affine fit of the anchor set.
 */

import { NODES, type Point } from '@/lib/route-engine'
import type { Place } from '@/lib/sunway-city'

export type LatLng = { lat: number; lng: number }

/** Rough metres-per-degree at Bandar Sunway's latitude. */
const METRES_PER_DEGREE_LAT = 110574
const METRES_PER_DEGREE_LNG = 111320 * Math.cos((3.07 * Math.PI) / 180)

/** Real positions of the route graph's nodes (approximate, OSM-derived). */
export const GEO_NODES: Record<string, LatLng> = {
  pyr_w: { lat: 3.0732, lng: 101.6058 },
  pyr_c: { lat: 3.0733, lng: 101.6073 },
  pyr_e: { lat: 3.0734, lng: 101.6086 },
  pyr_n: { lat: 3.0744, lng: 101.6073 },
  pyr_s: { lat: 3.0721, lng: 101.6073 },
  resort: { lat: 3.0752, lng: 101.6064 },
  pyrhotel: { lat: 3.0744, lng: 101.6082 },
  clio: { lat: 3.0738, lng: 101.6095 },
  lagoon_ent: { lat: 3.0688, lng: 101.6068 },
  med_e: { lat: 3.0709, lng: 101.6045 },
  med_c: { lat: 3.071, lng: 101.6034 },
  med_n: { lat: 3.0719, lng: 101.6034 },
  menara: { lat: 3.0727, lng: 101.6022 },
  brt_mentari: { lat: 3.0773, lng: 101.61 },
  mentari: { lat: 3.0776, lng: 101.6104 },
  brt_setiajaya: { lat: 3.0838, lng: 101.6112 },
  pjs11: { lat: 3.0755, lng: 101.6025 },
  brt_lagoon: { lat: 3.0689, lng: 101.6069 },
  canopy_j1: { lat: 3.0679, lng: 101.605 },
  brt_sunu: { lat: 3.0653, lng: 101.6014 },
  sunu_n: { lat: 3.0659, lng: 101.6007 },
  sunu_c: { lat: 3.0646, lng: 101.6009 },
  college: { lat: 3.0656, lng: 101.5994 },
  monash_n: { lat: 3.0628, lng: 101.6008 },
  monash_c: { lat: 3.0617, lng: 101.6009 },
  geo: { lat: 3.061, lng: 101.5985 },
  pinnacle: { lat: 3.0698, lng: 101.5954 },
  brt_southquay: { lat: 3.0617, lng: 101.6034 },
  southquay: { lat: 3.0593, lng: 101.6046 },
  brt_usj7: { lat: 3.0545, lng: 101.5922 },
  xing_barat: { lat: 3.0713, lng: 101.6052 },
  xing_timur: { lat: 3.071, lng: 101.608 },
  xing_universiti: { lat: 3.0622, lng: 101.5996 },
}

/** Real centres of the named places (footprint sizes stay in plan metres). */
export const GEO_PLACES: Record<string, LatLng> = {
  pyramid: { lat: 3.0733, lng: 101.6073 },
  lagoon: { lat: 3.0686, lng: 101.6062 },
  resort: { lat: 3.0752, lng: 101.6064 },
  'pyramid-hotel': { lat: 3.0744, lng: 101.6082 },
  clio: { lat: 3.0738, lng: 101.6095 },
  medical: { lat: 3.0708, lng: 101.6037 },
  'sunway-university': { lat: 3.0646, lng: 101.6009 },
  monash: { lat: 3.0617, lng: 101.6009 },
  'sunway-college': { lat: 3.0656, lng: 101.5994 },
  geo: { lat: 3.061, lng: 101.5985 },
  pinnacle: { lat: 3.0698, lng: 101.5954 },
  'menara-sunway': { lat: 3.0727, lng: 101.6022 },
  'south-quay': { lat: 3.0593, lng: 101.6046 },
  mentari: { lat: 3.0776, lng: 101.6104 },
  pjs11: { lat: 3.0755, lng: 101.6025 },
  'brt-setia-jaya': { lat: 3.0838, lng: 101.6112 },
  'brt-mentari': { lat: 3.0773, lng: 101.61 },
  'brt-lagoon': { lat: 3.0689, lng: 101.6069 },
  'brt-sunu': { lat: 3.0653, lng: 101.6014 },
  'brt-south-quay': { lat: 3.0617, lng: 101.6034 },
  'brt-usj7': { lat: 3.0545, lng: 101.5922 },
}

type Affine = { a: number; b: number; c: number }

/** Solves the 3×3 normal equations for v ≈ a·x + b·y + c. */
function fitAffine(pairs: { x: number; y: number; v: number }[]): Affine {
  let sxx = 0
  let sxy = 0
  let syy = 0
  let sx = 0
  let sy = 0
  let sxv = 0
  let syv = 0
  let sv = 0
  const n = pairs.length
  for (const { x, y, v } of pairs) {
    sxx += x * x
    sxy += x * y
    syy += y * y
    sx += x
    sy += y
    sxv += x * v
    syv += y * v
    sv += v
  }
  const m = [
    [sxx, sxy, sx, sxv],
    [sxy, syy, sy, syv],
    [sx, sy, n, sv],
  ]
  for (let col = 0; col < 3; col++) {
    let pivot = col
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row
    }
    ;[m[col], m[pivot]] = [m[pivot], m[col]]
    for (let row = 0; row < 3; row++) {
      if (row === col) continue
      const factor = m[row][col] / m[col][col]
      for (let k = col; k < 4; k++) m[row][k] -= factor * m[col][k]
    }
  }
  return {
    a: m[0][3] / m[0][0],
    b: m[1][3] / m[1][1],
    c: m[2][3] / m[2][2],
  }
}

const FIT_PAIRS = Object.entries(GEO_NODES)
  .filter(([id]) => NODES[id])
  .map(([id, ll]) => ({ x: NODES[id].x, y: NODES[id].y, lat: ll.lat, lng: ll.lng }))
const LNG_FIT = fitAffine(FIT_PAIRS.map((p) => ({ ...p, v: p.lng })))
const LAT_FIT = fitAffine(FIT_PAIRS.map((p) => ({ ...p, v: p.lat })))

/** Fallback for schematic points with no exact anchor. */
export function schematicToLatLng(point: Point): LatLng {
  return {
    lat: LAT_FIT.a * point.x + LAT_FIT.b * point.y + LAT_FIT.c,
    lng: LNG_FIT.a * point.x + LNG_FIT.b * point.y + LNG_FIT.c,
  }
}

/** Inverse of schematicToLatLng — solves the same 2×2 affine system. */
export function latLngToSchematic(ll: LatLng): Point {
  const det = LAT_FIT.a * LNG_FIT.b - LAT_FIT.b * LNG_FIT.a
  const dLat = ll.lat - LAT_FIT.c
  const dLng = ll.lng - LNG_FIT.c
  return {
    x: (LNG_FIT.b * dLat - LAT_FIT.b * dLng) / det,
    y: (-LNG_FIT.a * dLat + LAT_FIT.a * dLng) / det,
  }
}

/** Real position of a place's centre: explicit coords, then anchor, then node. */
export function placeCentreLatLng(place: Place): LatLng {
  if (place.lat != null && place.lng != null) return { lat: place.lat, lng: place.lng }
  return GEO_PLACES[place.id] ?? nodeToLatLng(NODES[place.node])
}

/** Closest route-graph node to a real position, in metres. */
export function nearestGraphNode(ll: LatLng): string {
  let best: string | null = null
  let bestDist = Infinity
  for (const [id, geo] of Object.entries(GEO_NODES)) {
    if (!NODES[id]) continue
    const dLat = (geo.lat - ll.lat) * METRES_PER_DEGREE_LAT
    const dLng = (geo.lng - ll.lng) * METRES_PER_DEGREE_LNG
    const d = Math.hypot(dLat, dLng)
    if (d < bestDist) {
      bestDist = d
      best = id
    }
  }
  return best ?? 'pyr_c'
}

const NODE_ID_BY_POINT = new Map(Object.entries(NODES).map(([id, p]) => [p, id]))

/** Exact position for a graph node, affine fallback otherwise. */
export function nodeToLatLng(point: Point): LatLng {
  const id = NODE_ID_BY_POINT.get(point)
  return id && GEO_NODES[id] ? GEO_NODES[id] : schematicToLatLng(point)
}

/**
 * Carries a "via" shaping point onto the georeferenced edge between a and b,
 * keeping its relative position along, and offset from, the segment.
 */
export function viaToLatLng(point: Point, a: Point, b: Point): LatLng {
  const A = nodeToLatLng(a)
  const B = nodeToLatLng(b)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return A

  const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq
  const perpX = point.x - (a.x + t * dx)
  const perpY = point.y - (a.y + t * dy)

  // Real segment in a south-positive metre frame, matching the schematic's axes.
  const DX = (B.lng - A.lng) * METRES_PER_DEGREE_LNG
  const DY = -(B.lat - A.lat) * METRES_PER_DEGREE_LAT
  const scale = Math.hypot(DX, DY) / Math.sqrt(lenSq)
  const cos = (dx * DX + dy * DY) / (Math.hypot(dx, dy) * Math.hypot(DX, DY))
  const sin = (dx * DY - dy * DX) / (Math.hypot(dx, dy) * Math.hypot(DX, DY))

  const X = (A.lng * METRES_PER_DEGREE_LNG) + t * DX + scale * (perpX * cos - perpY * sin)
  const Y = (-A.lat * METRES_PER_DEGREE_LAT) + t * DY + scale * (perpX * sin + perpY * cos)
  return { lat: -Y / METRES_PER_DEGREE_LAT, lng: X / METRES_PER_DEGREE_LNG }
}

/**
 * Converts a flattened sequence of node and via points (as produced by the
 * route engine) into real coordinates.
 */
export function pathToLatLngs(points: Point[]): LatLng[] {
  const out: LatLng[] = []
  let i = 0
  while (i < points.length) {
    const point = points[i]
    if (NODE_ID_BY_POINT.has(point)) {
      out.push(nodeToLatLng(point))
      i++
      continue
    }
    const a = points[i - 1]
    let j = i
    while (j < points.length && !NODE_ID_BY_POINT.has(points[j])) j++
    const b = points[j]
    for (let k = i; k < j; k++) {
      out.push(a && b ? viaToLatLng(points[k], a, b) : schematicToLatLng(points[k]))
    }
    i = j
  }
  return out
}

/** Converts a schematic rect to a lat/lng bounding box (affine fallback). */
export function boundsToLatLng(bounds: { x: number; y: number; w: number; h: number }) {
  const a = schematicToLatLng({ x: bounds.x, y: bounds.y })
  const b = schematicToLatLng({ x: bounds.x + bounds.w, y: bounds.y + bounds.h })
  return {
    south: Math.min(a.lat, b.lat),
    north: Math.max(a.lat, b.lat),
    west: Math.min(a.lng, b.lng),
    east: Math.max(a.lng, b.lng),
  }
}

/** Opening frame: the dense core around Sunway Pyramid and the campuses. */
export const HOME_BOUNDS = {
  south: 3.0625,
  north: 3.0765,
  west: 101.598,
  east: 101.6105,
}

/** The whole mapped area, reachable from the locate button. */
export const CITY_BOUNDS = {
  south: 3.052,
  north: 3.086,
  west: 101.5895,
  east: 101.614,
}
