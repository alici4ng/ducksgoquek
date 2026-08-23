/**
 * Free-text place search via Nominatim, the geocoder behind the search box
 * on openstreetmap.org. No API key; usage policy asks for <= 1 request/sec,
 * so the caller debounces and aborts superseded requests.
 *
 * Results are biased toward the Sunway City viewport but NOT bounded to it —
 * any location in the world can be found, same as the OSM website.
 */

import { latLngToSchematic, nearestGraphNode, type LatLng } from '@/lib/geo'
import { registerCustomPlace, type Place, type PlaceKind } from '@/lib/sunway-city'

const ENDPOINT = 'https://nominatim.openstreetmap.org/search'
/** west, north, east, south — the mapped area, used as a ranking bias only. */
const VIEWBOX = '101.5895,3.086,101.614,3.052'

export type OsmResult = {
  /** Stable id, e.g. "osm-way-123456". */
  id: string
  name: string
  /** Remainder of the display name after the title — the address-ish part. */
  detail: string
  lat: number
  lng: number
  kind: PlaceKind
}

type NominatimHit = {
  osm_type: string
  osm_id: number
  display_name: string
  name?: string
  lat: string
  lon: string
  class: string
  type: string
}

function toKind(cls: string, type: string): PlaceKind {
  if (cls === 'shop') return 'mall'
  if (cls === 'tourism') return type === 'hotel' || type === 'hostel' ? 'hotel' : 'attraction'
  if (cls === 'amenity') {
    if (type === 'hospital' || type === 'clinic' || type === 'doctors') return 'hospital'
    if (type === 'university' || type === 'college' || type === 'school') return 'campus'
    return 'civic'
  }
  if (cls === 'leisure') return type === 'park' || type === 'garden' ? 'park' : 'attraction'
  if (cls === 'office') return 'office'
  if (cls === 'railway' || (cls === 'highway' && type === 'bus_stop')) return 'transit'
  if (cls === 'place') return 'residential'
  if (cls === 'natural') return type === 'water' ? 'water' : 'park'
  return 'civic'
}

export async function searchOsm(query: string, signal?: AbortSignal): Promise<OsmResult[]> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    q: query,
    limit: '5',
    viewbox: VIEWBOX,
    bounded: '0',
    'accept-language': 'en',
  })
  const res = await fetch(`${ENDPOINT}?${params}`, { signal })
  if (!res.ok) return []
  const hits: NominatimHit[] = await res.json()

  return hits.map((hit) => {
    const parts = hit.display_name.split(', ')
    const name = hit.name || parts[0]
    return {
      id: `osm-${hit.osm_type}-${hit.osm_id}`,
      name,
      detail: parts.slice(1, 4).join(', '),
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      kind: toKind(hit.class, hit.type),
    }
  })
}

/**
 * Turns a search result into a Place the rest of the app understands and
 * registers it, so placeById() resolves it from then on. The place anchors
 * itself to the nearest route-graph node — the interim routing story until
 * arbitrary-point routing is designed.
 */
export function makeOsmPlace(result: OsmResult): Place {
  const ll: LatLng = { lat: result.lat, lng: result.lng }
  const centre = latLngToSchematic(ll)
  const place: Place = {
    id: result.id,
    name: result.name,
    kind: result.kind,
    x: centre.x - 40,
    y: centre.y - 40,
    w: 80,
    h: 80,
    node: nearestGraphNode(ll),
    sheltered: false,
    lat: result.lat,
    lng: result.lng,
    blurb: result.detail ? `${result.detail} · from OpenStreetMap` : 'From OpenStreetMap',
  }
  registerCustomPlace(place)
  return place
}
