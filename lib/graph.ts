/**
 * The walkable network of Bandar Sunway as a real graph, built from OSM
 * pedestrian ways (public/data/pedestrian_ways.geojson — fetched once at
 * setup by scripts/fetch-pedestrian-ways.mjs, never queried live).
 *
 * Everything here is native WGS84 lat/lng — no schematic projection.
 * Any real-world point (an OSM search pin, a preset place) routes by
 * snapping to the nearest walkable edge, same as dropping a pin in any
 * map app.
 */

import { COVERAGE_META, type Coverage } from '@/lib/shade-map'

export type LatLng = { lat: number; lng: number }

/** Rough metres-per-degree at Bandar Sunway's latitude. */
const M_PER_DEG_LAT = 110574
const M_PER_DEG_LNG = 111320 * Math.cos((3.07 * Math.PI) / 180)

export type GraphEdge = {
  a: string
  b: string
  /** Geometry from a to b. */
  points: LatLng[]
  meters: number
  coverage: Coverage
  name: string
}

export type Graph = {
  nodes: Map<string, LatLng>
  edges: GraphEdge[]
  adjacency: Map<string, { edgeIndex: number; to: string }[]>
}

/** Ways that are never walkable regardless of other tags. */
function unwalkable(props: { highway: string; name: string }): boolean {
  if (/^(motorway|trunk|motorway_link|trunk_link)$/.test(props.highway)) return true
  // "Lorong Motosikal" = motorcycle-only lanes along the expressways.
  if (/motosikal/i.test(props.name)) return true
  return false
}

const keyOf = (ll: LatLng) => `${ll.lat.toFixed(6)},${ll.lng.toFixed(6)}`

function metersBetween(a: LatLng, b: LatLng) {
  return Math.hypot((a.lat - b.lat) * M_PER_DEG_LAT, (a.lng - b.lng) * M_PER_DEG_LNG)
}

export function buildGraph(collection: {
  features: {
    properties: { coverage: Coverage; name: string; highway: string }
    geometry: { coordinates: [number, number][] }
  }[]
}): Graph {
  const nodes = new Map<string, LatLng>()
  const edges: GraphEdge[] = []
  const adjacency = new Map<string, { edgeIndex: number; to: string }[]>()

  for (const feature of collection.features) {
    const props = feature.properties
    if (unwalkable(props)) continue
    const points = feature.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
    if (points.length < 2) continue

    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]
      const b = points[i]
      const aKey = keyOf(a)
      const bKey = keyOf(b)
      if (aKey === bKey) continue
      nodes.set(aKey, a)
      nodes.set(bKey, b)

      const edgeIndex = edges.length
      edges.push({
        a: aKey,
        b: bKey,
        points: [a, b],
        meters: metersBetween(a, b),
        coverage: props.coverage,
        name: props.name,
      })
      ;(adjacency.get(aKey) ?? adjacency.set(aKey, []).get(aKey)!).push({ edgeIndex, to: bKey })
      ;(adjacency.get(bKey) ?? adjacency.set(bKey, []).get(bKey)!).push({ edgeIndex, to: aKey })
    }
  }

  bridgeSmallGaps(nodes, edges, adjacency)
  return { nodes, edges, adjacency }
}

/** Coverages with real vertical separation — never auto-bridged, so the
 *  elevated canopy can never short-circuit into the street below it. */
const VERTICAL: Coverage[] = ['bridge', 'underground', 'transit']

/**
 * OSM footways often end a few metres short of the street they meet, leaving
 * disconnected graph islands (a campus gate 8 m from the road, etc.). Link
 * components whose nearest ground-level nodes are within maxMeters with a
 * straight open-air connector — the pragmatic version of hand-patching.
 */
function bridgeSmallGaps(
  nodes: Map<string, LatLng>,
  edges: GraphEdge[],
  adjacency: Map<string, { edgeIndex: number; to: string }[]>,
  maxMeters = 12,
) {
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    let r = x
    while (parent.get(r) !== r) r = parent.get(r)!
    let cur = x
    while (parent.get(cur) !== cur) {
      const next = parent.get(cur)!
      parent.set(cur, r)
      cur = next
    }
    return r
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  for (const key of nodes.keys()) parent.set(key, key)
  for (const e of edges) union(e.a, e.b)

  // A node is bridgeable if at least one incident edge is ground-level.
  const groundCache = new Map<string, boolean>()
  const isGround = (key: string) => {
    let g = groundCache.get(key)
    if (g === undefined) {
      g = (adjacency.get(key) ?? []).some((l) => !VERTICAL.includes(edges[l.edgeIndex].coverage))
      groundCache.set(key, g)
    }
    return g
  }

  // Spatial grid so candidate lookup is near-linear.
  const CELL = 0.00025 // ~25 m
  const grid = new Map<string, string[]>()
  for (const [key, ll] of nodes) {
    const cell = `${Math.floor(ll.lat / CELL)},${Math.floor(ll.lng / CELL)}`
    ;(grid.get(cell) ?? grid.set(cell, []).get(cell)!).push(key)
  }

  const candidates: { a: string; b: string; meters: number }[] = []
  for (const [key, ll] of nodes) {
    const clat = Math.floor(ll.lat / CELL)
    const clng = Math.floor(ll.lng / CELL)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const other of grid.get(`${clat + dx},${clng + dy}`) ?? []) {
          if (other <= key) continue
          if (find(key) === find(other)) continue
          if (!isGround(key) || !isGround(other)) continue
          const meters = metersBetween(ll, nodes.get(other)!)
          if (meters <= maxMeters) candidates.push({ a: key, b: other, meters })
        }
      }
    }
  }

  candidates.sort((x, y) => x.meters - y.meters)
  let bridged = 0
  for (const { a, b, meters } of candidates) {
    if (find(a) === find(b)) continue
    union(a, b)
    const edgeIndex = edges.length
    edges.push({
      a,
      b,
      points: [nodes.get(a)!, nodes.get(b)!],
      meters,
      coverage: 'openair',
      name: '',
    })
    ;(adjacency.get(a) ?? adjacency.set(a, []).get(a)!).push({ edgeIndex, to: b })
    ;(adjacency.get(b) ?? adjacency.set(b, []).get(b)!).push({ edgeIndex, to: a })
    bridged++
  }
  if (typeof window === 'undefined' && bridged > 0) {
    console.log(`bridged ${bridged} small gap(s) in the pedestrian graph`)
  }
}

let graphPromise: Promise<Graph> | null = null

/** Loads and builds the graph once; subsequent calls return the same instance. */
export function loadGraph(): Promise<Graph> {
  graphPromise ??= fetch('/data/pedestrian_ways.geojson')
    .then((res) => res.json())
    .then(buildGraph)
  return graphPromise
}

// ------------------------------------------------------------------ snapping

export type Snap = {
  edgeIndex: number
  /** Projected position of the pin on the edge. */
  point: LatLng
  /** Index of the segment within edge.points the pin projected onto. */
  segment: number
  /** Metres from edge endpoint a to the projection, measured along the edge. */
  dFromA: number
  /** Straight-line metres from the pin to its projection. */
  distance: number
}

/** Projects a point onto the nearest walkable edge. */
export function snapToEdge(graph: Graph, ll: LatLng): Snap {
  let best: Snap | null = null
  for (let edgeIndex = 0; edgeIndex < graph.edges.length; edgeIndex++) {
    const edge = graph.edges[edgeIndex]
    let along = 0
    for (let i = 1; i < edge.points.length; i++) {
      const a = edge.points[i - 1]
      const b = edge.points[i]
      const segLen = metersBetween(a, b)
      // project in metre space
      const px = (ll.lng - a.lng) * M_PER_DEG_LNG
      const py = (ll.lat - a.lat) * M_PER_DEG_LAT
      const bx = (b.lng - a.lng) * M_PER_DEG_LNG
      const by = (b.lat - a.lat) * M_PER_DEG_LAT
      const lenSq = bx * bx + by * by
      const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / lenSq))
      const proj: LatLng = { lat: a.lat + (t * by) / M_PER_DEG_LAT, lng: a.lng + (t * bx) / M_PER_DEG_LNG }
      const distance = metersBetween(ll, proj)
      if (!best || distance < best.distance) {
        best = { edgeIndex, point: proj, segment: i - 1, dFromA: along + t * segLen, distance }
      }
      along += segLen
    }
  }
  if (!best) throw new Error('graph is empty')
  return best
}

// ------------------------------------------------------------------ routing

/** Exposure-aware cost: minutes of travel, taxed by time in full sun.
 *  Rain adds its own surcharge: a minute in the wet is worth about eight
 *  dry ones. */
function edgeCost(coverage: Coverage, meters: number, shadePreference: number, rain: boolean) {
  const meta = COVERAGE_META[coverage]
  const minutes = meters / meta.speed
  let penalty = 1 + shadePreference * 6 * meta.exposure
  if (rain) penalty += 8 * meta.wetness
  return minutes * penalty
}

/** Sub-path of an edge from its projection point to one of its endpoints. */
function subpath(edge: GraphEdge, snap: Snap, toward: 'a' | 'b'): LatLng[] {
  const pts = edge.points
  const i = snap.segment
  if (toward === 'a') return [snap.point, ...pts.slice(0, i + 1).reverse()]
  return [snap.point, ...pts.slice(i + 1)]
}

export type RoutedPath = {
  /** Lat/lng polyline from pin to pin. */
  points: LatLng[]
  /** Edge chain for step building, in travel order. */
  chain: { edgeIndex: number; forward: boolean; meters: number }[]
  meters: number
}

const START = '__start'
const END = '__end'

export function routeBetween(
  graph: Graph,
  from: LatLng,
  to: LatLng,
  shadePreference: number,
  rain = false,
): RoutedPath | null {
  const snapA = snapToEdge(graph, from)
  const snapB = snapToEdge(graph, to)
  const edgeA = graph.edges[snapA.edgeIndex]
  const edgeB = graph.edges[snapB.edgeIndex]

  // Both pins on the same edge: walk straight along it.
  if (snapA.edgeIndex === snapB.edgeIndex) {
    const meters = Math.abs(snapA.dFromA - snapB.dFromA)
    const forward = snapB.dFromA >= snapA.dFromA
    const lo = forward ? snapA : snapB
    const hi = forward ? snapB : snapA
    const middle = edgeA.points.slice(lo.segment + 1, hi.segment + 1)
    const between = forward
      ? [snapA.point, ...middle, snapB.point]
      : [snapB.point, ...[...middle].reverse(), snapA.point]
    return {
      points: [from, ...between, to],
      chain: [{ edgeIndex: snapA.edgeIndex, forward: true, meters }],
      meters,
    }
  }

  // Dijkstra over node keys, with virtual START/END injected onto the
  // snapped edges.
  const dist = new Map<string, number>([[START, 0]])
  const prev = new Map<
    string,
    { from: string; edgeIndex: number; forward: boolean; meters: number }
  >()
  const visited = new Set<string>()

  const linksOf = (node: string): { to: string; edgeIndex: number; forward: boolean; meters: number }[] => {
    if (node === START) {
      return [
        { to: edgeA.a, edgeIndex: snapA.edgeIndex, forward: false, meters: snapA.dFromA },
        { to: edgeA.b, edgeIndex: snapA.edgeIndex, forward: true, meters: edgeA.meters - snapA.dFromA },
      ]
    }
    const out = (graph.adjacency.get(node) ?? []).map((l) => ({
      to: l.to,
      edgeIndex: l.edgeIndex,
      forward: graph.edges[l.edgeIndex].a === node,
      meters: graph.edges[l.edgeIndex].meters,
    }))
    if (node === edgeB.a) out.push({ to: END, edgeIndex: snapB.edgeIndex, forward: true, meters: snapB.dFromA })
    if (node === edgeB.b) out.push({ to: END, edgeIndex: snapB.edgeIndex, forward: false, meters: edgeB.meters - snapB.dFromA })
    return out
  }

  for (;;) {
    let current: string | null = null
    let currentDist = Infinity
    for (const [node, d] of dist) {
      if (!visited.has(node) && d < currentDist) {
        current = node
        currentDist = d
      }
    }
    if (current === null) return null
    if (current === END) break
    visited.add(current)

    for (const link of linksOf(current)) {
      const edge = graph.edges[link.edgeIndex]
      const next = currentDist + edgeCost(edge.coverage, link.meters, shadePreference, rain)
      if (next < (dist.get(link.to) ?? Infinity)) {
        dist.set(link.to, next)
        prev.set(link.to, { from: current, edgeIndex: link.edgeIndex, forward: link.forward, meters: link.meters })
      }
    }
  }

  // Reconstruct
  const chain: { edgeIndex: number; forward: boolean; meters: number }[] = []
  let cursor = END
  while (cursor !== START) {
    const step = prev.get(cursor)
    if (!step) return null
    chain.unshift({ edgeIndex: step.edgeIndex, forward: step.forward, meters: step.meters })
    cursor = step.from
  }

  const points: LatLng[] = [from]
  chain.forEach((hop, idx) => {
    const edge = graph.edges[hop.edgeIndex]
    let pts: LatLng[]
    if (idx === 0) {
      // partial first edge: projection -> endpoint, in travel order
      pts = subpath(edge, snapA, hop.forward ? 'b' : 'a')
    } else if (idx === chain.length - 1) {
      // partial last edge: endpoint -> projection, in travel order
      pts = subpath(edge, snapB, hop.forward ? 'a' : 'b').reverse()
    } else {
      pts = hop.forward ? edge.points : [...edge.points].reverse()
    }
    for (const p of pts) {
      const last = points[points.length - 1]
      if (metersBetween(last, p) > 0.5) points.push(p)
    }
  })
  points.push(to)

  return { points, chain, meters: chain.reduce((m, h) => m + h.meters, 0) }
}
