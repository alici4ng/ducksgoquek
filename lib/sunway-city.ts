/**
 * Sunway City (Bandar Sunway, Selangor) as a schematic plan.
 *
 * World units are metres and the origin sits at the north-west corner of the
 * mapped area, so every distance the router reports is derived from the
 * geometry below rather than hand-written. Positions are stylised — the plan
 * keeps the real adjacencies (Pyramid next to the Lagoon, the campuses south
 * across Jalan Universiti, South Quay on the lake) without claiming survey
 * accuracy.
 */

import {
  Building2,
  Bus,
  FerrisWheel,
  GraduationCap,
  Hotel,
  Landmark,
  ShoppingBag,
  Stethoscope,
  Trees,
} from 'lucide-react'

export const CITY = { w: 2200, h: 2600 }

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
  /** Footprint in world metres. */
  x: number
  y: number
  w: number
  h: number
  /** Graph node used when this place is an origin or a destination. */
  node: string
  /** Whether the interior itself is climate controlled / roofed. */
  sheltered: boolean
  /** Minimum zoom at which the label is worth drawing. */
  labelFrom?: number
  blurb?: string
}

/** Everything that can be searched for, routed to, or tapped on the map. */
export const PLACES: Place[] = [
  {
    id: 'pyramid',
    name: 'Sunway Pyramid',
    short: 'Pyramid',
    kind: 'mall',
    x: 880,
    y: 760,
    w: 470,
    h: 300,
    node: 'pyr_c',
    sheltered: true,
    labelFrom: 0,
    blurb: 'Five-level mall. Air-conditioned end to end and the spine of most covered routes.',
  },
  {
    id: 'lagoon',
    name: 'Sunway Lagoon',
    kind: 'attraction',
    x: 1400,
    y: 700,
    w: 420,
    h: 420,
    node: 'lagoon_ent',
    sheltered: false,
    labelFrom: 0,
    blurb: 'Theme park. Mostly open air — plan arrivals through the Pyramid link bridge.',
  },
  {
    id: 'resort',
    name: 'Sunway Resort Hotel',
    kind: 'hotel',
    x: 880,
    y: 600,
    w: 200,
    h: 130,
    node: 'resort',
    sheltered: true,
    labelFrom: 1.4,
  },
  {
    id: 'pyramid-hotel',
    name: 'Sunway Pyramid Hotel',
    kind: 'hotel',
    x: 1105,
    y: 600,
    w: 175,
    h: 130,
    node: 'pyrhotel',
    sheltered: true,
    labelFrom: 1.8,
  },
  {
    id: 'clio',
    name: 'Sunway Clio Hotel',
    kind: 'hotel',
    x: 1305,
    y: 590,
    w: 150,
    h: 120,
    node: 'clio',
    sheltered: true,
    labelFrom: 1.8,
  },
  {
    id: 'medical',
    name: 'Sunway Medical Centre',
    short: 'Sunway Medical',
    kind: 'hospital',
    x: 560,
    y: 830,
    w: 265,
    h: 260,
    node: 'med_c',
    sheltered: true,
    labelFrom: 0,
    blurb: 'Towers A–E, linked to the Pyramid by the basement pedestrian tunnel.',
  },
  {
    id: 'sunway-university',
    name: 'Sunway University',
    short: 'Sunway U',
    kind: 'campus',
    x: 700,
    y: 1290,
    w: 350,
    h: 280,
    node: 'sunu_c',
    sheltered: true,
    labelFrom: 0,
  },
  {
    id: 'monash',
    name: 'Monash University Malaysia',
    short: 'Monash',
    kind: 'campus',
    x: 1120,
    y: 1290,
    w: 320,
    h: 280,
    node: 'monash_c',
    sheltered: true,
    labelFrom: 0,
  },
  {
    id: 'sunway-college',
    name: 'Sunway College',
    kind: 'campus',
    x: 520,
    y: 1300,
    w: 150,
    h: 180,
    node: 'college',
    sheltered: true,
    labelFrom: 1.6,
  },
  {
    id: 'geo',
    name: 'Sunway Geo Avenue',
    kind: 'office',
    x: 1150,
    y: 1640,
    w: 260,
    h: 150,
    node: 'geo',
    sheltered: false,
    labelFrom: 1.2,
    blurb: 'Shop-office rows with continuous five-foot-way arcades at street level.',
  },
  {
    id: 'pinnacle',
    name: 'Sunway Pinnacle',
    kind: 'office',
    x: 1450,
    y: 1600,
    w: 160,
    h: 150,
    node: 'pinnacle',
    sheltered: true,
    labelFrom: 1.2,
  },
  {
    id: 'menara-sunway',
    name: 'Menara Sunway',
    kind: 'office',
    x: 500,
    y: 620,
    w: 150,
    h: 140,
    node: 'menara',
    sheltered: true,
    labelFrom: 1.6,
  },
  {
    id: 'south-quay',
    name: 'Sunway South Quay',
    kind: 'residential',
    x: 1360,
    y: 1950,
    w: 300,
    h: 200,
    node: 'southquay',
    sheltered: false,
    labelFrom: 1,
  },
  {
    id: 'mentari',
    name: 'Sunway Mentari',
    kind: 'residential',
    x: 230,
    y: 720,
    w: 240,
    h: 260,
    node: 'mentari',
    sheltered: false,
    labelFrom: 1.2,
  },
  {
    id: 'pjs11',
    name: 'PJS 11 Neighbourhood',
    kind: 'residential',
    x: 640,
    y: 400,
    w: 300,
    h: 150,
    node: 'pjs11',
    sheltered: false,
    labelFrom: 1.8,
  },
  {
    id: 'brt-setia-jaya',
    name: 'BRT Sunway-Setia Jaya',
    short: 'Setia Jaya',
    kind: 'transit',
    x: 290,
    y: 215,
    w: 90,
    h: 60,
    node: 'brt_setiajaya',
    sheltered: true,
    labelFrom: 1,
  },
  {
    id: 'brt-mentari',
    name: 'BRT Mentari',
    kind: 'transit',
    x: 350,
    y: 600,
    w: 90,
    h: 60,
    node: 'brt_mentari',
    sheltered: true,
    labelFrom: 1,
  },
  {
    id: 'brt-lagoon',
    name: 'BRT Sunway Lagoon',
    kind: 'transit',
    x: 1000,
    y: 1105,
    w: 100,
    h: 60,
    node: 'brt_lagoon',
    sheltered: true,
    labelFrom: 0.8,
  },
  {
    id: 'brt-sunu',
    name: 'BRT SunU-Monash',
    kind: 'transit',
    x: 1030,
    y: 1215,
    w: 100,
    h: 60,
    node: 'brt_sunu',
    sheltered: true,
    labelFrom: 0.8,
  },
  {
    id: 'brt-south-quay',
    name: 'BRT South Quay',
    kind: 'transit',
    x: 1280,
    y: 1850,
    w: 100,
    h: 60,
    node: 'brt_southquay',
    sheltered: true,
    labelFrom: 1,
  },
  {
    id: 'brt-usj7',
    name: 'BRT USJ 7',
    kind: 'transit',
    x: 470,
    y: 2250,
    w: 90,
    h: 60,
    node: 'brt_usj7',
    sheltered: true,
    labelFrom: 1,
  },
]

export const PLACE_BY_ID = new Map(PLACES.map((p) => [p.id, p]))

/** Icon per place kind, shared by the search predictions and the place sheet. */
export const KIND_ICON: Record<
  PlaceKind,
  React.ComponentType<{ className?: string }>
> = {
  mall: ShoppingBag,
  attraction: FerrisWheel,
  campus: GraduationCap,
  hospital: Stethoscope,
  hotel: Hotel,
  office: Building2,
  transit: Bus,
  residential: Landmark,
  park: Trees,
  water: Trees,
  civic: Landmark,
}

export const KIND_LABEL: Record<PlaceKind, string> = {
  mall: 'Shopping',
  attraction: 'Attraction',
  campus: 'Campus',
  hospital: 'Healthcare',
  hotel: 'Hotel',
  office: 'Office',
  transit: 'BRT station',
  residential: 'Residential',
  park: 'Park',
  water: 'Waterfront',
  civic: 'Civic',
}

/** Lakes and the Sungai Klang channel. */
export const WATER: { id: string; name: string; d: string; labelAt?: [number, number] }[] = [
  {
    id: 'lagoon-lake',
    name: 'Sunway Lagoon Lake',
    d: 'M1470 780 q120 -60 230 10 q90 60 40 160 q-60 110 -200 90 q-140 -20 -140 -140 q0 -80 70 -120 Z',
  },
  {
    id: 'south-quay-lake',
    name: 'South Quay Lake',
    d: 'M1150 1980 q180 -120 420 -70 q260 55 300 220 q30 170 -190 240 q-260 80 -450 -30 q-160 -95 -80 -240 Z',
    labelAt: [1420, 2180],
  },
  {
    id: 'klang',
    name: 'Sungai Klang',
    d: 'M0 470 q260 60 520 20 q300 -46 560 40 q320 84 640 20 q260 -52 480 -20 l0 44 q-240 -30 -480 22 q-330 66 -650 -20 q-280 -76 -540 -34 q-280 44 -530 -20 Z',
  },
]

export const GREENS: { id: string; name?: string; d: string }[] = [
  { id: 'g1', name: 'Sunway Lagoon Park', d: 'M1380 1130 h420 v130 h-420 Z' },
  { id: 'g2', name: 'Monash Green', d: 'M1120 1590 h300 v90 h-300 Z' },
  { id: 'g3', d: 'M690 1590 h340 v80 h-340 Z' },
  { id: 'g4', name: 'Quay Waterfront', d: 'M1000 1900 h130 v300 h-130 Z' },
  { id: 'g5', d: 'M200 1050 h250 v170 h-250 Z' },
  { id: 'g6', d: 'M1650 1250 h300 v220 h-300 Z' },
  { id: 'g7', d: 'M60 300 h220 v120 h-220 Z' },
]

export type RoadClass = 'expressway' | 'arterial' | 'local'

export const ROADS: {
  id: string
  name: string
  cls: RoadClass
  d: string
  /** Rotation-free label anchor. */
  labelAt?: [number, number]
}[] = [
  {
    id: 'federal',
    name: 'Federal Highway',
    cls: 'expressway',
    d: 'M0 150 H2200',
    labelAt: [300, 138],
  },
  {
    id: 'npe',
    name: 'New Pantai Expressway',
    cls: 'expressway',
    d: 'M0 330 H900 q120 0 200 60 L1400 560 q80 50 200 50 H2200',
    labelAt: [420, 318],
  },
  {
    id: 'kewajipan',
    name: 'Persiaran Kewajipan',
    cls: 'arterial',
    d: 'M180 150 V2600',
    labelAt: [192, 1500],
  },
  {
    id: 'lagoon-selatan',
    name: 'Jalan Lagoon Selatan',
    cls: 'arterial',
    d: 'M180 1150 H2200',
    labelAt: [1720, 1138],
  },
  {
    id: 'lagoon-barat',
    name: 'Jalan Lagoon Barat',
    cls: 'arterial',
    d: 'M840 560 V1150',
    labelAt: [852, 660],
  },
  {
    id: 'lagoon-timur',
    name: 'Jalan Lagoon Timur',
    cls: 'arterial',
    d: 'M1870 660 V1400 H1500',
    labelAt: [1882, 900],
  },
  {
    id: 'lagoon-utara',
    name: 'Jalan Lagoon Utara',
    cls: 'local',
    d: 'M500 560 H1870',
    labelAt: [600, 548],
  },
  {
    id: 'universiti',
    name: 'Jalan Universiti',
    cls: 'arterial',
    d: 'M180 1600 H1120 q60 0 90 40 L1450 1900 H1900',
    labelAt: [300, 1588],
  },
  {
    id: 'persiaran-lagoon',
    name: 'Persiaran Lagoon',
    cls: 'local',
    d: 'M1060 1150 V1290 H1500 V1600',
    labelAt: [1512, 1420],
  },
  {
    id: 'pjs11-loop',
    name: 'Jalan PJS 11/20',
    cls: 'local',
    d: 'M500 330 V1150',
    labelAt: [512, 430],
  },
  {
    id: 'south-quay-blvd',
    name: 'South Quay Boulevard',
    cls: 'local',
    d: 'M1120 1900 q140 -90 340 -60 q220 34 300 160',
    labelAt: [1150, 1880],
  },
  {
    id: 'usj-link',
    name: 'Jalan USJ 7',
    cls: 'local',
    d: 'M180 2250 H900 q100 0 160 -70 L1450 1900',
    labelAt: [260, 2238],
  },
]

/** Elevated BRT alignment, drawn as its own transit layer. */
export const BRT_LINE = {
  name: 'BRT Sunway Line',
  d: 'M335 245 V630 q0 60 60 60 H900 q60 0 100 60 L1050 1135 V1245 q0 60 40 100 L1330 1880 q0 60 -60 90 L560 2250 H470',
  stops: [
    'brt-setia-jaya',
    'brt-mentari',
    'brt-lagoon',
    'brt-sunu',
    'brt-south-quay',
    'brt-usj7',
  ],
}

/** Generic city blocks so the plan does not read as empty between landmarks. */
export const FILLER_BLOCKS: { x: number; y: number; w: number; h: number }[] =
  (() => {
    const cols = [60, 250, 440, 630, 1500, 1690, 1880, 2050]
    const rows = [1700, 1830, 1960, 2090, 2220, 2350, 2470]
    const out: { x: number; y: number; w: number; h: number }[] = []
    for (const x of cols) {
      for (const y of rows) {
        if (x > 1100 && y < 2000) continue
        out.push({ x, y, w: 150, h: 95 })
      }
    }
    // Northern light-industrial strip between the highway and the river.
    for (let x = 60; x < 2100; x += 210) {
      out.push({ x, y: 190, w: 165, h: 110 })
    }
    // Neighbouring Petaling Jaya / Subang fabric beyond the city edges, so a
    // zoomed-out view reads as a city in a region rather than an island.
    for (let x = -900; x < CITY.w + 900; x += 230) {
      for (const y of [-820, -640, -460, -280, CITY.h + 120, CITY.h + 300, CITY.h + 480]) {
        out.push({ x, y, w: 170, h: 110 })
      }
    }
    for (const x of [-880, -640, -400, CITY.w + 120, CITY.w + 360, CITY.w + 600]) {
      for (let y = -100; y < CITY.h + 60; y += 200) {
        out.push({ x, y, w: 175, h: 120 })
      }
    }
    return out
  })()
