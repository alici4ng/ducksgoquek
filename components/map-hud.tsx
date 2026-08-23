'use client'

import { Umbrella } from 'lucide-react'
import Link from 'next/link'

import { CONDITIONS_NOW } from '@/lib/shade-map'
import type { Weather } from '@/lib/weather'

type MapHudProps = {
  /** Live conditions; the rain chip only appears when it is actually raining. */
  weather?: Weather | null
  /** Where the "Covered routes" chip navigates to when it is raining. */
  rainHref?: string
}

export function MapHud({ weather, rainHref = '/rain' }: MapHudProps) {
  const raining = weather?.raining ?? false

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 pt-10">
      {raining && (
        <Link
          href={rainHref}
          className="pointer-events-auto mt-1 flex h-8 shrink-0 items-center gap-1.5 rounded-4xl border border-rain/30 bg-rain/12 px-3 text-[0.8rem] font-medium text-rain shadow-sm backdrop-blur transition-colors hover:bg-rain/20"
        >
          <Umbrella className="size-3.5" />
          {weather!.label} · {weather!.precipitationMm}mm — covered routes
        </Link>
      )}
    </div>
  )
}

export function StatusBar() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 pt-2 font-mono text-[0.7rem] font-medium text-foreground/70 tabular">
      <span>{CONDITIONS_NOW.timeLabel}</span>
      <span>
        {CONDITIONS_NOW.tempC}°C · feels {CONDITIONS_NOW.feelsLikeC}°
      </span>
    </div>
  )
}
