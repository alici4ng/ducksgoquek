export const MAP_W = 390
export const MAP_H = 844

/**
 * Street centre-lines. The route below only ever travels along these, so the
 * drawn path always sits inside a real street gap on the generated city plan.
 */
const STREETS_X = [-10, 24, 70, 112, 154, 208, 262, 306, 348, 400]
const STREETS_Y = [
  -10, 40, 96, 140, 186, 222, 248, 300, 368, 412, 456, 512, 570, 630, 700, 770,
  860,
]

const STREET_HALF = 5

export type Block = {
  x: number
  y: number
  w: number
  h: number
  kind: 'block' | 'park' | 'water' | 'covered'
}

/** Cells (col,row) that are not ordinary buildings. */
const PARKS = new Set(['1-1', '6-2', '2-11', '7-13', '0-8'])
const WATER = new Set(['0-14', '1-14', '0-15'])
/**
 * Blocks flanking the route that carry permanent cover — the market hall and
 * the arcaded frontages. These get the arcade hatch on the map.
 */
const COVERED = new Set(['1-6', '2-6', '1-7', '4-3', '5-3', '4-4'])

function blockKind(key: string): Block['kind'] {
  if (WATER.has(key)) return 'water'
  if (PARKS.has(key)) return 'park'
  if (COVERED.has(key)) return 'covered'
  return 'block'
}

export const BLOCKS: Block[] = (() => {
  const out: Block[] = []
  for (let c = 0; c < STREETS_X.length - 1; c++) {
    for (let r = 0; r < STREETS_Y.length - 1; r++) {
      const x = STREETS_X[c] + STREET_HALF
      const y = STREETS_Y[r] + STREET_HALF
      const w = STREETS_X[c + 1] - STREETS_X[c] - STREET_HALF * 2
      const h = STREETS_Y[r + 1] - STREETS_Y[r] - STREET_HALF * 2
      if (w < 10 || h < 8) continue
      out.push({ x, y, w, h, kind: blockKind(`${c}-${r}`) })
    }
  }
  return out
})()

/**
 * The route sits high in the map because the sheet covers the lower half of
 * the screen. Combined with `xMidYMin slice` on the SVG, this keeps the
 * destination and the exposed crossing inside the visible band on a 581px
 * tall phone, where the route sheet leaves only ~100px of map showing.
 */
export const ORIGIN = { x: 70, y: 368 }
export const DESTINATION = { x: 262, y: 96 }

/**
 * Single source of truth for the demo route's endpoints. Both the search
 * inputs and the route-result header read this, so the two screens can never
 * disagree about where the walk starts and ends.
 */
export const ENDPOINTS = {
  origin: 'Monash University',
  destination: 'Sunway Pinnacle',
}

/** The five ways a stretch of pavement can be covered. */
export type Coverage =
  | 'indoor'
  | 'underground'
  | 'bridge'
  | 'arcade'
  | 'openair'

export type RouteStep = {
  id: string
  title: string
  meters: number
  minutes: number
  coverage: Coverage
  /** SVG path following street centre-lines. */
  d: string
  detail: string
}

export const ROUTE: RouteStep[] = [
  {
    id: 'tunnel',
    title: 'Take the underground link',
    meters: 300,
    minutes: 5,
    coverage: 'underground',
    d: `M${ORIGIN.x} ${ORIGIN.y} V300`,
    detail: 'Monash basement link · fully below grade',
  },
  {
    id: 'market',
    title: 'Walk through Sunway Pyramid',
    meters: 250,
    minutes: 4,
    coverage: 'indoor',
    d: 'M70 300 H154',
    detail: 'Ground floor concourse · air conditioned',
  },
  {
    id: 'walkway',
    title: 'Take the Canopy Walkway',
    meters: 800,
    minutes: 12,
    coverage: 'bridge',
    d: 'M154 300 V140 H262',
    detail: 'Elevated canopy walkway · roofed both sides',
  },
  {
    id: 'outdoor',
    title: 'Brief outdoor stretch',
    meters: 45,
    minutes: 2,
    coverage: 'openair',
    d: `M262 140 V${DESTINATION.y}`,
    detail: 'Crossing at Jalan Lagoon Selatan · no shade',
  },
]

export const COVERAGE_META: Record<
  Coverage,
  { label: string; stroke: string; dot: string; ink: string; covered: boolean }
> = {
  indoor: {
    label: 'Indoor',
    stroke: 'var(--coverage-indoor)',
    dot: 'bg-coverage-indoor',
    ink: 'text-coverage-indoor-ink',
    covered: true,
  },
  underground: {
    label: 'Underground',
    stroke: 'var(--coverage-underground)',
    dot: 'bg-coverage-underground',
    ink: 'text-coverage-underground-ink',
    covered: true,
  },
  bridge: {
    label: 'Elevated',
    stroke: 'var(--coverage-bridge)',
    dot: 'bg-coverage-bridge',
    ink: 'text-coverage-bridge-ink',
    covered: true,
  },
  arcade: {
    label: 'Arcade',
    stroke: 'var(--coverage-arcade)',
    dot: 'bg-coverage-arcade',
    ink: 'text-coverage-arcade-ink',
    covered: true,
  },
  openair: {
    label: 'Open air',
    stroke: 'var(--coverage-openair)',
    dot: 'bg-coverage-openair',
    ink: 'text-coverage-openair-ink',
    covered: false,
  },
}

export const TOTAL_METERS = ROUTE.reduce((n, s) => n + s.meters, 0)
export const EXPOSED_METERS = ROUTE.filter(
  (s) => !COVERAGE_META[s.coverage].covered,
).reduce((n, s) => n + s.meters, 0)
export const TOTAL_MINUTES = ROUTE.reduce((n, s) => n + s.minutes, 0)
/**
 * UV-weighted shade score, not a plain distance ratio: the elevated walkway is
 * only side-screened and the market concourse has glazed sections, so both
 * carry a partial penalty on top of the fully exposed crossing.
 */
export const COVERAGE = 87

/** WHO UV index bands, so the badge colour is derived rather than asserted. */
const UV_BANDS = [
  { max: 2, label: 'Low', bg: 'bg-uv-low', ink: 'text-uv-low' },
  { max: 5, label: 'Moderate', bg: 'bg-uv-moderate', ink: 'text-uv-moderate-ink' },
  { max: 7, label: 'High', bg: 'bg-uv-high', ink: 'text-uv-high' },
  { max: 10, label: 'Very high', bg: 'bg-uv-veryhigh', ink: 'text-uv-veryhigh' },
  {
    max: Infinity,
    label: 'Extreme',
    bg: 'bg-uv-extreme',
    ink: 'text-uv-extreme-ink',
  },
] as const

export function uvBand(index: number) {
  return UV_BANDS.find((band) => index <= band.max) ?? UV_BANDS[4]
}

export const UV_INDEX = 11
export const UV = { index: UV_INDEX, ...uvBand(UV_INDEX) }
