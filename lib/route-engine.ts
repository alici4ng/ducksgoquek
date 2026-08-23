/**
 * Routing on the real pedestrian network of Bandar Sunway (lib/graph.ts).
 *
 * Any two places — curated or found via OSM search — route by their real
 * coordinates. There is no schematic layer: the graph is OSM ways, and the
 * coverage each way carries drives the three route strategies.
 */

import { loadGraph, routeBetween, type Graph, type LatLng } from '@/lib/graph'
import { COVERAGE_META, type Coverage } from '@/lib/shade-map'
import { placeById } from '@/lib/sunway-city'

export type { LatLng }

export type RouteStep = {
  id: string
  title: string
  detail: string
  coverage: Coverage
  meters: number
  minutes: number
  points: LatLng[]
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
  points: LatLng[]
}

function stepTitle(coverage: Coverage, name: string, index: number): string {
  switch (coverage) {
    case 'underground':
      return 'Take the underpass'
    case 'indoor':
      return name ? `Walk through ${name}` : 'Walk through the building'
    case 'bridge':
      return index === 0
        ? name
          ? `Head onto ${name}`
          : 'Head onto the covered walkway'
        : name
          ? `Stay on ${name}`
          : 'Stay on the covered walkway'
    case 'arcade':
      return 'Follow the arcaded frontage'
    case 'transit':
      return 'Cross the platform'
    default:
      return name ? `Walk along ${name}` : 'Open-air stretch'
  }
}

function buildRoute(
  graph: Graph,
  from: LatLng,
  to: LatLng,
  shadePreference: number,
  label: string,
  id: string,
): Route | null {
  const path = routeBetween(graph, from, to, shadePreference)
  if (!path || path.meters < 1) return null

  // Walk the edge chain, measuring each hop off along the polyline, and merge
  // consecutive edges that share a coverage type and street name into steps.
  type RawStep = {
    coverage: Coverage
    name: string
    meters: number
    minutes: number
    startIdx: number
    endIdx: number
  }
  const raws: RawStep[] = []
  let cursor = 1 // path.points[0] is the origin pin
  for (const hop of path.chain) {
    const edge = graph.edges[hop.edgeIndex]
    const startIdx = cursor - 1
    let remaining = hop.meters
    while (cursor < path.points.length && remaining > 0) {
      remaining -= dist(path.points[cursor - 1], path.points[cursor])
      cursor++
    }
    const last = raws[raws.length - 1]
    if (last && last.coverage === edge.coverage && last.name === edge.name) {
      last.meters += hop.meters
      last.minutes += hop.meters / COVERAGE_META[edge.coverage].speed
      last.endIdx = cursor
    } else {
      raws.push({
        coverage: edge.coverage,
        name: edge.name,
        meters: hop.meters,
        minutes: hop.meters / COVERAGE_META[edge.coverage].speed,
        startIdx,
        endIdx: cursor,
      })
    }
  }

  const steps: RouteStep[] = raws.map((raw, i) => ({
    id: `step-${i}`,
    title: stepTitle(raw.coverage, raw.name, i),
    detail: raw.name || COVERAGE_META[raw.coverage].label,
    coverage: raw.coverage,
    meters: Math.round(raw.meters),
    minutes: Math.max(1, Math.round(raw.minutes)),
    points: path.points.slice(raw.startIdx, raw.endIdx + 1),
  }))

  const meters = raws.reduce((n, s) => n + s.meters, 0)
  const minutes = raws.reduce((n, s) => n + s.minutes, 0)
  const uvLoad = raws.reduce((n, s) => n + s.meters * COVERAGE_META[s.coverage].exposure, 0)

  return {
    id,
    label,
    steps,
    meters: Math.round(meters),
    minutes: Math.max(1, Math.round(minutes)),
    exposedMeters: Math.round(uvLoad),
    coverage: Math.round(100 - (uvLoad / Math.max(meters, 1)) * 100),
    points: path.points,
  }
}

function dist(a: LatLng, b: LatLng) {
  return Math.hypot((a.lat - b.lat) * 110574, (a.lng - b.lng) * 111152)
}

export const ROUTE_OPTIONS = [
  { id: 'shadiest', label: 'Shadiest', shadePreference: 1 },
  { id: 'balanced', label: 'Balanced', shadePreference: 0.45 },
  { id: 'fastest', label: 'Fastest', shadePreference: 0 },
] as const

export type RouteOptionId = (typeof ROUTE_OPTIONS)[number]['id']

/** All three strategies between two places, de-duplicated when they agree. */
export async function buildRouteSet(fromPlaceId: string, toPlaceId: string): Promise<Route[]> {
  const from = placeById(fromPlaceId)
  const to = placeById(toPlaceId)
  if (!from || !to || from.id === to.id) return []

  const graph = await loadGraph()
  const origin = { lat: from.lat, lng: from.lng }
  const destination = { lat: to.lat, lng: to.lng }

  const seen = new Set<string>()
  const routes: Route[] = []
  for (const option of ROUTE_OPTIONS) {
    const route = buildRoute(
      graph,
      origin,
      destination,
      option.shadePreference,
      option.label,
      option.id,
    )
    if (!route) continue
    const signature = route.steps.map((s) => `${s.coverage}:${s.detail}`).join('|')
    if (seen.has(signature)) continue
    seen.add(signature)
    routes.push(route)
  }
  return routes
}

export function boundsOf(points: LatLng[], paddingMeters = 120) {
  const padLat = paddingMeters / 110574
  const padLng = paddingMeters / 111152
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  return {
    south: Math.min(...lats) - padLat,
    north: Math.max(...lats) + padLat,
    west: Math.min(...lngs) - padLng,
    east: Math.max(...lngs) + padLng,
  }
}
