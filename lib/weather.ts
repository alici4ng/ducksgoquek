/**
 * Live weather for Sunway City, sourced from Open-Meteo (free, no API key)
 * through the /api/weather route handler, which caches upstream responses.
 * Pure helpers only — the polling hook lives in use-weather.ts so this file
 * stays importable from server code.
 */

export type Weather = {
  raining: boolean
  precipitationMm: number
  weatherCode: number
  label: string
  uvIndex: number
  tempC: number
  feelsLikeC: number
  fetchedAt: string
}

/** WMO weather codes that mean rain of some intensity is falling. */
const RAIN_CODES = new Set([
  51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99,
])

export function isRaining(code: number, precipitationMm: number) {
  return RAIN_CODES.has(code) || precipitationMm > 0
}

const WMO_LABELS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Icy fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers',
  81: 'Showers',
  82: 'Violent showers',
  85: 'Snow showers',
  86: 'Snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with hail',
}

export function weatherLabel(code: number) {
  return WMO_LABELS[code] ?? 'Unknown'
}
