'use client'

import { CloudRain, Umbrella } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { CONDITIONS_NOW, UV, uvBand } from '@/lib/shade-map'
import type { Weather } from '@/lib/weather'
import { cn } from '@/lib/utils'

type MapHudProps = {
  rainMode: boolean
  onRainModeChange: (value: boolean) => void
  onUvPress: () => void
  /** Live conditions; falls back to the hardcoded demo values when absent. */
  weather?: Weather | null
  /** Where the "Covered routes" chip navigates to when it is raining. */
  rainHref?: string
}

export function MapHud({
  rainMode,
  onRainModeChange,
  onUvPress,
  weather,
  rainHref = '/rain',
}: MapHudProps) {
  const uvIndex = weather?.uvIndex ?? UV.index
  const uv = uvBand(uvIndex)
  const raining = weather?.raining ?? false

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 pt-10">
      <label
        className={cn(
          'pointer-events-auto flex items-center gap-2 rounded-4xl border border-border py-2 pr-2.5 pl-3 shadow-sm transition-colors',
          rainMode ? 'bg-rain/12' : 'bg-card',
        )}
      >
        <CloudRain
          className={cn(
            'size-4 shrink-0 transition-colors',
            rainMode ? 'text-rain' : 'text-muted-foreground',
          )}
        />
        <span className="text-[0.8rem] font-medium whitespace-nowrap">
          {raining
            ? `${weather!.label} · ${weather!.precipitationMm}mm`
            : 'Rain mode'}
        </span>
        <Switch
          checked={rainMode}
          onCheckedChange={onRainModeChange}
          size="sm"
          className="data-checked:bg-rain"
        />
      </label>

      {raining && (
        <Link
          href={rainHref}
          className="pointer-events-auto mt-1 flex h-8 shrink-0 items-center gap-1.5 rounded-4xl border border-rain/30 bg-rain/12 px-3 text-[0.8rem] font-medium text-rain shadow-sm backdrop-blur transition-colors hover:bg-rain/20"
        >
          <Umbrella className="size-3.5" />
          Covered routes
        </Link>
      )}

      <button
        type="button"
        onClick={onUvPress}
        aria-label={`UV index ${uvIndex}, ${uv.label}. Open sunscreen reminder.`}
        className="pointer-events-auto shrink-0 rounded-4xl outline-none focus-visible:ring-3 focus-visible:ring-uv-extreme/50"
      >
        <Badge
          className={cn(
            'h-8 gap-1 px-2.5 text-coverage-foreground shadow-sm',
            uv.bg,
          )}
        >
          <span className="font-mono text-[0.8rem] font-semibold tabular">
            UV {uvIndex}
          </span>
          <span aria-hidden className="opacity-50">
            ·
          </span>
          <span className="text-[0.8rem]">{uv.label}</span>
        </Badge>
      </button>
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
