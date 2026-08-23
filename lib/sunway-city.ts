/**
 * Curated landmarks of Bandar Sunway, used as picker suggestions and quick
 * trip shortcuts. Positions are real WGS84 coordinates verified against OSM.
 *
 * These are NOT the routing system — routing runs on the OSM pedestrian
 * graph (lib/graph.ts) and any searched place can be an endpoint. This list
 * exists so the picker can offer familiar one-tap choices.
 */

export type PlaceKind =
  | 'mall'
  | 'attraction'
  | 'campus'
  | 'hospital'
  | 'hotel'
  | 'office'
  | 'transit'
  | 'residential'
  | 'park'
  | 'water'
  | 'civic'

export type Place = {
  id: string
  name: string
  short?: string
  kind: PlaceKind
  /** Real WGS84 position. */
  lat: number
  lng: number
  /** Whether the interior itself is climate controlled / roofed. */
  sheltered: boolean
  blurb?: string
}

/** Everything offered as a suggestion, searchable in the picker. */
export const PLACES: Place[] = [
  {
    id: 'pyramid',
    name: 'Sunway Pyramid',
    short: 'Pyramid',
    kind: 'mall',
    lat: 3.07251,
    lng: 101.60708,
    sheltered: true,
    blurb: 'Five-level mall. Air-conditioned end to end and the spine of most covered routes.',
  },
  {
    id: 'lagoon',
    name: 'Sunway Lagoon',
    kind: 'attraction',
    lat: 3.06964,
    lng: 101.60677,
    sheltered: false,
    blurb: 'Theme park. Mostly open air — plan arrivals through the Pyramid link bridge.',
  },
  {
    id: 'resort',
    name: 'Sunway Resort Hotel',
    kind: 'hotel',
    lat: 3.07101,
    lng: 101.60881,
    sheltered: true,
  },
  {
    id: 'pyramid-hotel',
    name: 'Sunway Pyramid Hotel',
    kind: 'hotel',
    lat: 3.07223,
    lng: 101.60836,
    sheltered: true,
  },
  {
    id: 'clio',
    name: 'Sunway Clio Hotel',
    kind: 'hotel',
    lat: 3.07283,
    lng: 101.60447,
    sheltered: true,
  },
  {
    id: 'medical',
    name: 'Sunway Medical Centre',
    short: 'Sunway Medical',
    kind: 'hospital',
    lat: 3.06638,
    lng: 101.60853,
    sheltered: true,
    blurb: 'Main towers on Jalan Lagoon Selatan, served by the SB4 SunMed BRT station.',
  },
  {
    id: 'sunway-university',
    name: 'Sunway University',
    short: 'Sunway U',
    kind: 'campus',
    lat: 3.06717,
    lng: 101.60386,
    sheltered: true,
  },
  {
    id: 'monash',
    name: 'Monash University Malaysia',
    short: 'Monash',
    kind: 'campus',
    lat: 3.0639,
    lng: 101.60057,
    sheltered: true,
  },
  {
    id: 'sunway-college',
    name: 'Sunway College',
    kind: 'campus',
    lat: 3.06841,
    lng: 101.60393,
    sheltered: true,
  },
  {
    id: 'geo',
    name: 'Sunway Geo Avenue',
    kind: 'office',
    lat: 3.06481,
    lng: 101.60885,
    sheltered: false,
    blurb: 'Shop-office rows with continuous five-foot-way arcades at street level.',
  },
  {
    id: 'pinnacle',
    name: 'Sunway Pinnacle',
    kind: 'office',
    lat: 3.07007,
    lng: 101.61015,
    sheltered: true,
  },
  {
    id: 'menara-sunway',
    name: 'Menara Sunway',
    kind: 'office',
    lat: 3.06898,
    lng: 101.60993,
    sheltered: true,
  },
  {
    id: 'south-quay',
    name: 'Sunway South Quay',
    kind: 'residential',
    lat: 3.0624,
    lng: 101.60787,
    sheltered: false,
  },
  {
    id: 'mentari',
    name: 'Sunway Mentari',
    kind: 'residential',
    lat: 3.07645,
    lng: 101.61168,
    sheltered: false,
  },
  {
    id: 'pjs11',
    name: 'PJS 11 Neighbourhood',
    kind: 'residential',
    lat: 3.0755,
    lng: 101.6025,
    sheltered: false,
  },
  {
    id: 'brt-setia-jaya',
    name: 'BRT Sunway-Setia Jaya',
    short: 'Setia Jaya',
    kind: 'transit',
    lat: 3.08296,
    lng: 101.61225,
    sheltered: true,
  },
  {
    id: 'brt-mentari',
    name: 'BRT Mentari',
    kind: 'transit',
    lat: 3.07615,
    lng: 101.61022,
    sheltered: true,
  },
  {
    id: 'brt-lagoon',
    name: 'BRT Sunway Lagoon',
    kind: 'transit',
    lat: 3.07071,
    lng: 101.61073,
    sheltered: true,
  },
  {
    id: 'brt-sunu',
    name: 'BRT SunU-Monash',
    kind: 'transit',
    lat: 3.06532,
    lng: 101.60154,
    sheltered: true,
  },
  {
    id: 'brt-south-quay',
    name: 'BRT South Quay',
    kind: 'transit',
    lat: 3.06162,
    lng: 101.59678,
    sheltered: true,
  },
  {
    id: 'brt-usj7',
    name: 'BRT USJ 7',
    kind: 'transit',
    lat: 3.05533,
    lng: 101.59197,
    sheltered: true,
  },
]

export const PLACE_BY_ID = new Map(PLACES.map((p) => [p.id, p]))

/** Places added at runtime via OSM search, kept for the session. */
const CUSTOM_PLACES = new Map<string, Place>()

export function registerCustomPlace(place: Place) {
  CUSTOM_PLACES.set(place.id, place)
}

/** Resolves preset places first, then anything found via OSM search. */
export function placeById(id: string): Place | undefined {
  return PLACE_BY_ID.get(id) ?? CUSTOM_PLACES.get(id)
}
