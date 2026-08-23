'use client'

import { CloudRain } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { UV } from '@/lib/shade-map'
import { cn } from '@/lib/utils'

type MapHudProps = {
  rainMode: boolean
  onRainModeChange: (value: boolean) => void
  onUvPress: () => void
}

export function MapHud({ rainMode, onRainModeChange, onUvPress }: MapHudProps) {
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
          Rain mode
        </span>
        <Switch
          checked={rainMode}
          onCheckedChange={onRainModeChange}
          size="sm"
          className="data-checked:bg-rain"
        />
      </label>

      <button
        type="button"
        onClick={onUvPress}
        aria-label={`UV index ${UV.index}, ${UV.label}. Open sunscreen reminder.`}
        className="pointer-events-auto shrink-0 rounded-4xl outline-none focus-visible:ring-3 focus-visible:ring-uv-extreme/50"
      >
        <Badge
          className={cn(
            'h-8 gap-1 px-2.5 text-coverage-foreground shadow-sm',
            UV.bg,
          )}
        >
          <span className="font-mono text-[0.8rem] font-semibold tabular">
            UV {UV.index}
          </span>
          <span aria-hidden className="opacity-50">
            ·
          </span>
          <span className="text-[0.8rem]">{UV.label}</span>
        </Badge>
      </button>
    </div>
  )
}

export function StatusBar() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 pt-2 font-mono text-[0.7rem] font-medium text-foreground/70 tabular">
      <span>13:42</span>
      <span>34°C · feels 41°</span>
    </div>
  )
}
