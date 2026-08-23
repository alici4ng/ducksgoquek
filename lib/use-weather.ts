'use client'

import { useEffect, useState } from 'react'

import type { Weather } from '@/lib/weather'

const REFRESH_MS = 5 * 60 * 1000

/** Polls /api/weather every five minutes; null until the first response. */
export function useWeather(): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/weather')
        if (!res.ok) return
        const data = (await res.json()) as Weather
        if (!cancelled) setWeather(data)
      } catch {
        // Weather is a progressive enhancement — stay silent offline.
      }
    }
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  return weather
}
