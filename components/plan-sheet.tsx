'use client'

import { ArrowUpDown, Umbrella } from 'lucide-react'

import { BottomSheet } from '@/components/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { PLACE_BY_ID } from '@/lib/sunway-city'
import { cn } from '@/lib/utils'

/** Trips the demo cares about, phrased as the pairs people actually walk. */
const SUGGESTIONS: { from: string; to: string; label: string }[] = [
  { from: 'monash', to: 'pyramid', label: 'Monash → Pyramid' },
  { from: 'sunway-university', to: 'medical', label: 'Sunway U → Medical' },
  { from: 'brt-setia-jaya', to: 'geo', label: 'Setia Jaya → Geo' },
  { from: 'south-quay', to: 'lagoon', label: 'South Quay → Lagoon' },
]

type PlanSheetProps = {
  originId: string | null
  destinationId: string | null
  computing: boolean
  onEditOrigin: () => void
  onEditDestination: () => void
  onSwap: () => void
  onSubmit: () => void
  onSuggestion: (from: string, to: string) => void
}

export function PlanSheet({
  originId,
  destinationId,
  computing,
  onEditOrigin,
  onEditDestination,
  onSwap,
  onSubmit,
  onSuggestion,
}: PlanSheetProps) {
  const origin = originId ? PLACE_BY_ID.get(originId) : undefined
  const destination = destinationId ? PLACE_BY_ID.get(destinationId) : undefined
  const ready = Boolean(origin && destination && origin.id !== destination.id)

  return (
    <BottomSheet>
      <div className="flex flex-col gap-4 px-4 pt-3">
        <h1 className="text-base font-semibold tracking-tight text-balance">
          Where to, in the shade?
        </h1>

        <div className="relative">
          <div className="flex flex-col gap-2.5">
            <EndpointButton
              label="Starting point"
              value={origin?.name}
              onClick={onEditOrigin}
              marker={
                <span
                  aria-hidden
                  className="size-2.5 rounded-full bg-coverage-arcade ring-3 ring-coverage-arcade/20"
                />
              }
            />
            <EndpointButton
              label="Destination"
              value={destination?.name}
              onClick={onEditDestination}
              marker={
                <span
                  aria-hidden
                  className="size-2.5 rounded-[2px] bg-destructive ring-3 ring-destructive/20"
                />
              }
            />
          </div>

          <span
            aria-hidden
            className="absolute top-[38px] left-[22px] h-4 border-l border-dashed border-muted-foreground/40"
          />

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onSwap}
            aria-label="Swap origin and destination"
            className="absolute top-1/2 right-2 size-9 -translate-y-1/2 rounded-full bg-card"
          >
            <ArrowUpDown />
          </Button>
        </div>

        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4">
          {SUGGESTIONS.map((trip) => (
            <button
              key={trip.label}
              type="button"
              onClick={() => onSuggestion(trip.from, trip.to)}
              className="shrink-0 rounded-4xl border border-border bg-background px-3 py-1.5 text-[0.72rem] font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              {trip.label}
            </button>
          ))}
        </div>

        <Button
          type="button"
          size="lg"
          disabled={computing || !ready}
          onClick={onSubmit}
          className="h-13 rounded-2xl bg-coverage-arcade-ink text-base text-coverage-foreground hover:bg-coverage-arcade-ink/90"
        >
          {computing ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Umbrella data-icon="inline-start" />
          )}
          {computing ? 'Reading shade map…' : 'Find covered route'}
        </Button>
      </div>
    </BottomSheet>
  )
}

function EndpointButton({
  label,
  value,
  marker,
  onClick,
}: {
  label: string
  value?: string
  marker: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 w-full items-center gap-3 rounded-2xl border border-input bg-background pr-12 pl-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      {marker}
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-[0.95rem]',
          value ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {value ?? label}
      </span>
    </button>
  )
}
