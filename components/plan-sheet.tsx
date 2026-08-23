'use client'

import { ArrowUpDown, Umbrella, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { BottomSheet } from '@/components/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  KIND_ICON,
  KIND_LABEL,
  PLACES,
  PLACE_BY_ID,
  type Place,
} from '@/lib/sunway-city'
import { cn } from '@/lib/utils'

type PlanSheetProps = {
  originId: string | null
  destinationId: string | null
  computing: boolean
  onOriginChange: (placeId: string) => void
  onDestinationChange: (placeId: string) => void
  onSwap: () => void
  onSubmit: () => void
}

export function PlanSheet({
  originId,
  destinationId,
  computing,
  onOriginChange,
  onDestinationChange,
  onSwap,
  onSubmit,
}: PlanSheetProps) {
  const ready = Boolean(originId && destinationId && originId !== destinationId)

  return (
    <BottomSheet>
      <div className="flex flex-col gap-4 px-4 pt-3">
        <h1 className="text-base font-semibold tracking-tight text-balance">
          Where to, in the shade?
        </h1>

        <div className="relative">
          <div className="flex flex-col gap-2.5">
            <EndpointInput
              label="Starting point"
              placeId={originId}
              excludeId={destinationId}
              onSelect={onOriginChange}
              marker={
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full bg-coverage-arcade ring-3 ring-coverage-arcade/20"
                />
              }
            />
            <EndpointInput
              label="Destination"
              placeId={destinationId}
              excludeId={originId}
              onSelect={onDestinationChange}
              marker={
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-[2px] bg-destructive ring-3 ring-destructive/20"
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
            className="absolute top-1/2 right-2 z-10 size-9 -translate-y-1/2 rounded-full bg-card"
          >
            <ArrowUpDown />
          </Button>
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

/** Ranked predictions: prefix matches first, then substring matches. */
function predict(needle: string, excludeId: string | null): Place[] {
  const pool = PLACES.filter((place) => place.id !== excludeId)
  const q = needle.trim().toLowerCase()
  if (!q) return pool
  const starts: Place[] = []
  const contains: Place[] = []
  for (const place of pool) {
    const name = place.name.toLowerCase()
    const short = (place.short ?? '').toLowerCase()
    if (name.startsWith(q) || short.startsWith(q)) starts.push(place)
    else if (
      name.includes(q) ||
      short.includes(q) ||
      KIND_LABEL[place.kind].toLowerCase().includes(q)
    )
      contains.push(place)
  }
  return [...starts, ...contains]
}

function EndpointInput({
  label,
  placeId,
  excludeId,
  marker,
  onSelect,
}: {
  label: string
  placeId: string | null
  excludeId: string | null
  marker: React.ReactNode
  onSelect: (placeId: string) => void
}) {
  const place = placeId ? PLACE_BY_ID.get(placeId) : undefined
  /** Text being typed; null means "show the selected place's name". */
  const [query, setQuery] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const predictions = useMemo(
    () => predict(query ?? '', excludeId).slice(0, 6),
    [query, excludeId],
  )

  function select(placeId: string) {
    onSelect(placeId)
    setQuery(null)
    setOpen(false)
  }

  return (
    <div className="relative">
      <div
        className={cn(
          'flex h-12 w-full items-center gap-3 rounded-2xl border bg-background pr-12 pl-3.5 transition-colors',
          open ? 'border-ring' : 'border-input',
        )}
      >
        {marker}
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          value={query ?? place?.name ?? ''}
          placeholder={label}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            setQuery('')
            setOpen(true)
          }}
          onBlur={() => {
            // Let a prediction click land before the list closes.
            setTimeout(() => {
              setOpen(false)
              setQuery(null)
            }, 120)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false)
              setQuery(null)
              event.currentTarget.blur()
            }
            if (event.key === 'Enter' && open && predictions.length > 0) {
              event.preventDefault()
              select(predictions[0].id)
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-[0.95rem] outline-none placeholder:text-muted-foreground"
        />
        {query !== null && query !== '' && (
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setQuery('')}
            className="absolute top-1/2 right-11 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {open && (
        <ul
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-2xl border border-border bg-card py-1 shadow-lg"
        >
          {predictions.map((prediction) => {
            const Icon = KIND_ICON[prediction.kind]
            return (
              <li key={prediction.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={prediction.id === placeId}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => select(prediction.id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full',
                      prediction.sheltered
                        ? 'bg-coverage-indoor/15 text-coverage-indoor-ink'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[0.88rem] font-medium">
                      {prediction.name}
                    </span>
                    <span className="truncate text-[0.7rem] text-muted-foreground">
                      {KIND_LABEL[prediction.kind]}
                      {prediction.sheltered ? ' · sheltered' : ''}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
          {predictions.length === 0 && (
            <li className="px-4 py-3 text-center text-[0.8rem] text-muted-foreground">
              Nothing in Sunway City matches “{query}”.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
