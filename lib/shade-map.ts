/**
 * Shared shade vocabulary: how a stretch of pavement can be covered, and how
 * hostile the sky currently is. The map, the route sheet and the alerts all
 * read their colours and labels from here so they cannot drift apart.
 */

/** The ways a stretch of a journey can be covered. */
export type Coverage =
  | 'indoor'
  | 'underground'
  | 'bridge'
  | 'arcade'
  | 'transit'
  | 'openair'

export const COVERAGE_META: Record<
  Coverage,
  {
    label: string
    stroke: string
    dot: string
    ink: string
    covered: boolean
    /** UV that still reaches you, 0 = none. Drives the coverage score. */
    exposure: number
    /** Travel speed in metres per minute. */
    speed: number
  }
> = {
  indoor: {
    label: 'Indoor',
    stroke: 'var(--coverage-indoor)',
    dot: 'bg-coverage-indoor',
    ink: 'text-coverage-indoor-ink',
    covered: true,
    exposure: 0.05,
    speed: 72,
  },
  underground: {
    label: 'Underground',
    stroke: 'var(--coverage-underground)',
    dot: 'bg-coverage-underground',
    ink: 'text-coverage-underground-ink',
    covered: true,
    exposure: 0,
    speed: 76,
  },
  bridge: {
    label: 'Elevated',
    stroke: 'var(--coverage-bridge)',
    dot: 'bg-coverage-bridge',
    ink: 'text-coverage-bridge-ink',
    covered: true,
    exposure: 0.18,
    speed: 78,
  },
  arcade: {
    label: 'Arcade',
    stroke: 'var(--coverage-arcade)',
    dot: 'bg-coverage-arcade',
    ink: 'text-coverage-arcade-ink',
    covered: true,
    exposure: 0.3,
    speed: 74,
  },
  transit: {
    label: 'BRT',
    stroke: 'var(--coverage-transit)',
    dot: 'bg-coverage-transit',
    ink: 'text-coverage-transit-ink',
    covered: true,
    exposure: 0.1,
    speed: 330,
  },
  openair: {
    label: 'Open air',
    stroke: 'var(--coverage-openair)',
    dot: 'bg-coverage-openair',
    ink: 'text-coverage-openair-ink',
    covered: false,
    exposure: 1,
    speed: 80,
  },
}

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

/** Local conditions shown in the HUD and the alert sheet. */
export const CONDITIONS_NOW = {
  timeLabel: '13:42',
  tempC: 34,
  feelsLikeC: 41,
  /** Solar azimuth as a compass bearing — drives which way shade is cast. */
  sunAzimuth: 292,
  sunAltitude: 71,
}
