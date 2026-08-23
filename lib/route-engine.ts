/**
 * Pedestrian network for Sunway City and the router that walks it.
 *
 * Every edge carries the kind of cover it offers, so the cost function can
 * trade minutes against UV exposure instead of only minimising distance. All
 * distances fall out of the geometry — nothing about a route is hand-written.
 */

import { COVERAGE_META, type Coverage } from '@/lib/shade-map'
import { placeById, PLACES, type Place } from '@/lib/sunway-city'

export type Point = { x: number; y: number }

export const NODES: Record<string, Point> = {
  pyr_w: { x: 890, y: 915 },
  pyr_c: { x: 1115, y: 915 },
  pyr_e: { x: 1340, y: 915 },
  pyr_n: { x: 1115, y: 770 },
  pyr_s: { x: 1115, y: 1055 },
  resort: { x: 980, y: 690 },
  pyrhotel: { x: 1190, y: 690 },
  clio: { x: 1380, y: 650 },
  lagoon_ent: { x: 1440, y: 930 },
  med_e: { x: 825, y: 960 },
  med_c: { x: 690, y: 960 },
  med_n: { x: 690, y: 835 },
  menara: { x: 575, y: 690 },
  brt_mentari: { x: 395, y: 630 },
  mentari: { x: 350, y: 850 },
  brt_setiajaya: { x: 335, y: 245 },
  pjs11: { x: 790, y: 475 },
  brt_lagoon: { x: 1050, y: 1135 },
  canopy_j1: { x: 1050, y: 1185 },
  brt_sunu: { x: 1080, y: 1245 },
  sunu_n: { x: 940, y: 1290 },
  sunu_c: { x: 875, y: 1430 },
  college: { x: 595, y: 1390 },
  monash_n: { x: 1250, y: 1290 },
  monash_c: { x: 1280, y: 1430 },
  geo: { x: 1280, y: 1715 },
  pinnacle: { x: 1530, y: 1675 },
  brt_southquay: { x: 1330, y: 1880 },
  southquay: { x: 1510, y: 2050 },
  brt_usj7: { x: 515, y: 2280 },
  xing_barat: { x: 840, y: 1150 },
  xing_timur: { x: 1340, y: 1150 },
  xing_universiti: { x: 1120, y: 1600 },
}

export type Edge = {
  a: string
  b: string
  coverage: Coverage
  /** Human name of the corridor, shown as the step detail. */
  name: string
  /** Intermediate points so the drawn line follows the street plan. */
  via?: Point[]
}

export const EDGES: Edge[] = [
  // Sunway Pyramid interior
  { a: 'pyr_w', b: 'pyr_c', coverage: 'indoor', name: 'Pyramid ground concourse' },
  { a: 'pyr_c', b: 'pyr_e', coverage: 'indoor', name: 'Pyramid Orange Atrium' },
  { a: 'pyr_c', b: 'pyr_n', coverage: 'indoor', name: 'Pyramid Blue Atrium' },
  { a: 'pyr_c', b: 'pyr_s', coverage: 'indoor', name: 'Pyramid Grand Lobby' },

  // Hotel and theme-park links
  { a: 'pyr_n', b: 'resort', coverage: 'bridge', name: 'Sunway Resort link bridge' },
  { a: 'pyr_n', b: 'pyrhotel', coverage: 'bridge', name: 'Pyramid Hotel link bridge' },
  {
    a: 'pyr_e',
    b: 'clio',
    coverage: 'arcade',
    name: 'Clio covered frontage',
    via: [{ x: 1380, y: 830 }],
  },
  { a: 'pyr_e', b: 'lagoon_ent', coverage: 'bridge', name: 'Lagoon entrance bridge' },

  // Sunway Medical Centre
  {
    a: 'pyr_w',
    b: 'med_e',
    coverage: 'underground',
    name: 'Pyramid–Medical basement link',
    via: [{ x: 860, y: 935 }],
  },
  { a: 'med_e', b: 'med_c', coverage: 'indoor', name: 'Sunway Medical concourse' },
  { a: 'med_c', b: 'med_n', coverage: 'indoor', name: 'Tower B lift lobby' },
  {
    a: 'med_n',
    b: 'menara',
    coverage: 'openair',
    name: 'Jalan Lagoon Barat pavement',
    via: [{ x: 640, y: 780 }],
  },
  {
    a: 'menara',
    b: 'brt_mentari',
    coverage: 'openair',
    name: 'Persiaran Kewajipan crossing',
  },
  { a: 'brt_mentari', b: 'mentari', coverage: 'openair', name: 'Mentari access ramp' },
  {
    a: 'menara',
    b: 'pjs11',
    coverage: 'openair',
    name: 'Jalan PJS 11/20 pavement',
    via: [{ x: 580, y: 500 }],
  },
  {
    a: 'pjs11',
    b: 'resort',
    coverage: 'openair',
    name: 'Jalan Lagoon Utara pavement',
    via: [{ x: 900, y: 560 }],
  },

  // BRT Sunway Line — elevated and roofed at every stop
  {
    a: 'brt_setiajaya',
    b: 'brt_mentari',
    coverage: 'transit',
    name: 'BRT Sunway Line · northbound platform',
  },
  {
    a: 'brt_mentari',
    b: 'brt_lagoon',
    coverage: 'transit',
    name: 'BRT Sunway Line',
    via: [
      { x: 900, y: 690 },
      { x: 1000, y: 760 },
    ],
  },
  { a: 'brt_lagoon', b: 'brt_sunu', coverage: 'transit', name: 'BRT Sunway Line' },
  {
    a: 'brt_sunu',
    b: 'brt_southquay',
    coverage: 'transit',
    name: 'BRT Sunway Line',
    via: [{ x: 1120, y: 1345 }],
  },
  {
    a: 'brt_southquay',
    b: 'brt_usj7',
    coverage: 'transit',
    name: 'BRT Sunway Line',
    via: [{ x: 1270, y: 1970 }],
  },

  // Canopy Walkway — the covered spine of the city
  { a: 'pyr_s', b: 'brt_lagoon', coverage: 'bridge', name: 'Pyramid–BRT skybridge' },
  { a: 'brt_lagoon', b: 'canopy_j1', coverage: 'bridge', name: 'Canopy Walkway' },
  { a: 'canopy_j1', b: 'brt_sunu', coverage: 'bridge', name: 'Canopy Walkway' },
  {
    a: 'brt_sunu',
    b: 'sunu_n',
    coverage: 'bridge',
    name: 'Canopy Walkway · SunU spur',
    via: [{ x: 960, y: 1245 }],
  },
  {
    a: 'brt_sunu',
    b: 'monash_n',
    coverage: 'bridge',
    name: 'Canopy Walkway · Monash spur',
    via: [{ x: 1240, y: 1245 }],
  },
  { a: 'sunu_n', b: 'sunu_c', coverage: 'indoor', name: 'Sunway University south wing' },
  { a: 'monash_n', b: 'monash_c', coverage: 'indoor', name: 'Monash Building 6 link' },
  {
    a: 'sunu_c',
    b: 'college',
    coverage: 'arcade',
    name: 'Sunway College colonnade',
    via: [{ x: 700, y: 1430 }],
  },

  // Street-level alternatives — the routes the app exists to argue against
  {
    a: 'pyr_w',
    b: 'xing_barat',
    coverage: 'openair',
    name: 'Jalan Lagoon Barat pavement',
    via: [{ x: 860, y: 1060 }],
  },
  { a: 'xing_barat', b: 'med_c', coverage: 'openair', name: 'Hospital forecourt', via: [{ x: 700, y: 1150 }] },
  {
    a: 'xing_barat',
    b: 'sunu_n',
    coverage: 'openair',
    name: 'Jalan Lagoon Selatan crossing',
    via: [{ x: 860, y: 1290 }],
  },
  {
    a: 'pyr_s',
    b: 'xing_timur',
    coverage: 'openair',
    name: 'Jalan Lagoon Selatan pavement',
    via: [{ x: 1340, y: 1055 }],
  },
  { a: 'lagoon_ent', b: 'xing_timur', coverage: 'openair', name: 'Lagoon forecourt' },
  {
    a: 'xing_timur',
    b: 'monash_n',
    coverage: 'openair',
    name: 'Persiaran Lagoon pavement',
    via: [{ x: 1340, y: 1290 }],
  },
  {
    a: 'monash_c',
    b: 'xing_universiti',
    coverage: 'openair',
    name: 'Jalan Universiti crossing',
    via: [{ x: 1280, y: 1600 }],
  },
  {
    a: 'sunu_c',
    b: 'xing_universiti',
    coverage: 'openair',
    name: 'Jalan Universiti pavement',
    via: [{ x: 875, y: 1600 }],
  },
  { a: 'xing_universiti', b: 'geo', coverage: 'openair', name: 'Geo Avenue approach', via: [{ x: 1280, y: 1600 }] },
  {
    a: 'geo',
    b: 'pinnacle',
    coverage: 'arcade',
    name: 'Geo Avenue five-foot way',
    via: [{ x: 1400, y: 1690 }],
  },
  { a: 'geo', b: 'brt_southquay', coverage: 'arcade', name: 'Geo Avenue link arcade' },
  {
    a: 'brt_southquay',
    b: 'southquay',
    coverage: 'arcade',
    name: 'South Quay covered walk',
    via: [{ x: 1400, y: 1960 }],
  },
  {
    a: 'pinnacle',
    b: 'southquay',
    coverage: 'openair',
    name: 'South Quay Boulevard',
    via: [{ x: 1540, y: 1900 }],
  },
  {
    a: 'college',
    b: 'brt_usj7',
    coverage: 'openair',
    name: 'Jalan USJ 7 pavement',
    via: [
      { x: 560, y: 1700 },
      { x: 530, y: 2250 },
    ],
  },
]

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function edgePoints(edge: Edge, forward: boolean): Point[] {
  const pts = [NODES[edge.a], ...(edge.via ?? []), NODES[edge.b]]
  return forward ? pts : [...pts].reverse()
}

function polylineLength(points: Point[]) {
  let total = 0
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i])
  return total
}

export const EDGE_METERS = EDGES.map((edge) => polylineLength(edgePoints(edge, true)))

type Adjacency = { edgeIndex: number; to: string; forward: boolean }

const ADJACENCY: Record<string, Adjacency[]> = (() => {
  const out: Record<string, Adjacency[]> = {}
  EDGES.forEach((edge, edgeIndex) => {
    ;(out[edge.a] ??= []).push({ edgeIndex, to: edge.b, forward: true })
    ;(out[edge.b] ??= []).push({ edgeIndex, to: edge.a, forward: false })
  })
  return out
})()

export type RouteStep = {
  id: string
  title: string
  detail: string
  coverage: Coverage
  meters: number
  minutes: number
  /** SVG path in world coordinates. */
  d: string
  /** Raw world points, so the map can reproject the step onto real tiles. */
  points: Point[]
}

export type Route = {
  id: string
  label: string
  steps: RouteStep[]
  meters: number
  minutes: number
  /** Metres of full-sun equivalent exposure across the whole trip. */
  exposedMeters: number
  /** UV-weighted share of the trip that is protected, 0–100. */
  coverage: number
  points: Point[]
}

/** Waiting for the bus is time you spend in the shade, but time all the same. */
const TRANSIT_BOARDING_MINUTES = 3

function pathToD(points: Point[]) {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
}

function edgeCost(edge: Edge, meters: number, shadePreference: number) {
  const meta = COVERAGE_META[edge.coverage]
  const minutes = meters / meta.speed + (edge.coverage === 'transit' ? TRANSIT_BOARDING_MINUTES : 0)
  // Exposure is charged as extra perceived minutes, so the slider reads as
  // "how many minutes is a minute of full sun worth to me".
  const penalty = 1 + shadePreference * 6 * meta.exposure
  return { minutes, cost: minutes * penalty }
}

function dijkstra(from: string, to: string, shadePreference: number) {
  const best: Record<string, number> = { [from]: 0 }
  const prev: Record<string, { node: string; edgeIndex: number; forward: boolean }> = {}
  const visited = new Set<string>()

  for (;;) {
    let current: string | null = null
    let currentCost = Infinity
    for (const [node, cost] of Object.entries(best)) {
      if (!visited.has(node) && cost < currentCost) {
        current = node
        currentCost = cost
      }
    }
    if (current === null) return null
    if (current === to) break
    visited.add(current)

    for (const link of ADJACENCY[current] ?? []) {
      const edge = EDGES[link.edgeIndex]
      const { cost } = edgeCost(edge, EDGE_METERS[link.edgeIndex], shadePreference)
      const next = currentCost + cost
      if (next < (best[link.to] ?? Infinity)) {
        best[link.to] = next
        prev[link.to] = { node: current, edgeIndex: link.edgeIndex, forward: link.forward }
      }
    }
  }

  const chain: { edgeIndex: number; forward: boolean }[] = []
  let cursor = to
  while (cursor !== from) {
    const step = prev[cursor]
    if (!step) return null
    chain.unshift({ edgeIndex: step.edgeIndex, forward: step.forward })
    cursor = step.node
  }
  return chain
}

function stepTitle(edge: Edge, place: Place | undefined, index: number) {
  switch (edge.coverage) {
    case 'transit':
      return `Ride the BRT${place ? ` to ${place.short ?? place.name}` : ''}`
    case 'underground':
      return 'Take the underground link'
    case 'bridge':
      return index === 0 ? 'Head onto the covered walkway' : 'Stay on the covered walkway'
    case 'indoor':
      return place ? `Walk through ${place.short ?? place.name}` : 'Walk through the concourse'
    case 'arcade':
      return 'Follow the arcaded frontage'
    default:
      return 'Open-air stretch'
  }
}

const PLACE_BY_NODE = new Map(PLACES.map((p) => [p.node, p]))

export function buildRoute(
  fromPlaceId: string,
  toPlaceId: string,
  shadePreference: number,
  label: string,
  id: string,
): Route | null {
  const from = placeById(fromPlaceId)
  const to = placeById(toPlaceId)
  if (!from || !to || from.node === to.node) return null

  const chain = dijkstra(from.node, to.node, shadePreference)
  if (!chain) return null

  // Merge consecutive links that share a coverage type into one instruction.
  const steps: RouteStep[] = []
  const allPoints: Point[] = []
  let node = from.node

  for (const link of chain) {
    const edge = EDGES[link.edgeIndex]
    const points = edgePoints(edge, link.forward)
    const meters = EDGE_METERS[link.edgeIndex]
    const { minutes } = edgeCost(edge, meters, shadePreference)
    const nextNode = link.forward ? edge.b : edge.a
    const previous = steps[steps.length - 1]

    if (allPoints.length === 0) allPoints.push(...points)
    else allPoints.push(...points.slice(1))

    if (previous && previous.coverage === edge.coverage) {
      previous.meters += meters
      previous.minutes += minutes
      previous.d += ' ' + pathToD(points.slice(1)).replace(/^M/, 'L')
      previous.points.push(...points.slice(1))
      if (!previous.detail.includes(edge.name)) previous.detail += ` · ${edge.name}`
      previous.title = stepTitle(edge, PLACE_BY_NODE.get(nextNode), steps.length - 1)
    } else {
      steps.push({
        id: `${edge.a}-${edge.b}-${steps.length}`,
        title: stepTitle(edge, PLACE_BY_NODE.get(nextNode), steps.length),
        detail: edge.name,
        coverage: edge.coverage,
        meters,
        minutes,
        d: pathToD(points),
        points: [...points],
      })
    }
    node = nextNode
  }
  void node

  const meters = steps.reduce((n, s) => n + s.meters, 0)
  const minutes = steps.reduce((n, s) => n + s.minutes, 0)
  // UV-weighted rather than a plain covered/total ratio: a side-screened
  // walkway still lets some sun in and is scored accordingly, so the exposed
  // figure reads as "metres of full sun this route is worth".
  const uvLoad = steps.reduce(
    (n, s) => n + s.meters * COVERAGE_META[s.coverage].exposure,
    0,
  )

  return {
    id,
    label,
    steps: steps.map((s) => ({
      ...s,
      meters: Math.round(s.meters),
      minutes: Math.max(1, Math.round(s.minutes)),
    })),
    meters: Math.round(meters),
    minutes: Math.max(1, Math.round(minutes)),
    exposedMeters: Math.round(uvLoad),
    coverage: Math.round(100 - (uvLoad / Math.max(meters, 1)) * 100),
    points: allPoints,
  }
}

export const ROUTE_OPTIONS = [
  { id: 'shadiest', label: 'Shadiest', shadePreference: 1 },
  { id: 'balanced', label: 'Balanced', shadePreference: 0.45 },
  { id: 'fastest', label: 'Fastest', shadePreference: 0 },
] as const

export type RouteOptionId = (typeof ROUTE_OPTIONS)[number]['id']

/** All three strategies, de-duplicated when two of them agree. */
export function buildRouteSet(fromPlaceId: string, toPlaceId: string): Route[] {
  const seen = new Set<string>()
  const routes: Route[] = []
  for (const option of ROUTE_OPTIONS) {
    const route = buildRoute(
      fromPlaceId,
      toPlaceId,
      option.shadePreference,
      option.label,
      option.id,
    )
    if (!route) continue
    const signature = route.steps.map((s) => s.d).join('|')
    if (seen.has(signature)) continue
    seen.add(signature)
    routes.push(route)
  }
  return routes
}

export function boundsOf(points: Point[], padding = 120) {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return {
    x: Math.min(...xs) - padding,
    y: Math.min(...ys) - padding,
    w: Math.max(...xs) - Math.min(...xs) + padding * 2,
    h: Math.max(...ys) - Math.min(...ys) + padding * 2,
  }
}
