import { NextResponse } from 'next/server'

import { isRaining, weatherLabel } from '@/lib/weather'

/** Sunway Pyramid, the centre of the mapped area. */
const OPEN_METEO =
  'https://api.open-meteo.com/v1/forecast?latitude=3.0733&longitude=101.6073' +
  '&current=temperature_2m,apparent_temperature,precipitation,weather_code,uv_index' +
  '&timezone=Asia%2FKuala_Lumpur'

export const revalidate = 300

export async function GET() {
  try {
    const res = await fetch(OPEN_METEO, { next: { revalidate: 300 } })
    if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`)
    const data = await res.json()
    const current = data.current
    return NextResponse.json({
      raining: isRaining(current.weather_code, current.precipitation),
      precipitationMm: current.precipitation,
      weatherCode: current.weather_code,
      label: weatherLabel(current.weather_code),
      uvIndex: Math.round(current.uv_index ?? 0),
      tempC: Math.round(current.temperature_2m),
      feelsLikeC: Math.round(current.apparent_temperature),
      fetchedAt: current.time,
    })
  } catch {
    return NextResponse.json({ error: 'Weather unavailable' }, { status: 502 })
  }
}
