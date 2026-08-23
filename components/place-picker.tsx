'use client'

import {
  Building2,
  Bus,
  FerrisWheel,
  GraduationCap,
  Hotel,
  Landmark,
  Search,
  ShoppingBag,
  Stethoscope,
  Trees,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { searchOsm, type OsmResult } from '@/lib/osm-search'
import { placeById, PLACES, type Place, type PlaceKind } from '@/lib/sunway-city'
import { cn } from '@/lib/utils'

export const KIND_ICON: Record<
  PlaceKind,
  React.ComponentType<{ className?: string }>
> = {
  mall: ShoppingBag,
  attraction: FerrisWheel,
  campus: GraduationCap,
  hospital: Stethoscope,
  hotel: Hotel,
  office: Building2,
  transit: Bus,
  residential: Landmark,
  park: Trees,
  water: Trees,
  civic: Landmark,
}

export const KIND_LABEL: Record<PlaceKind, string> = {
  mall: 'Shopping',
  attraction: 'Attraction',
  campus: 'Campus',
  hospital: 'Healthcare',
  hotel: 'Hotel',
  office: 'Office',
  transit: 'BRT station',
  residential: 'Residential',
  park: 'Park',
  water: 'Waterfront',
  civic: 'Civic',
}

const FILTERS: { id: 'all' | PlaceKind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'transit', label: 'BRT' },
  { id: 'campus', label: 'Campus' },
  { id: 'mall', label: 'Shopping' },
  { id: 'hospital', label: 'Health' },
  { id: 'office', label: 'Work' },
  { id: 'hotel', label: 'Stay' },
]

/** No section of the picker ever lists more than this. */
const MAX_RESULTS = 5

/** Curated starter picks, shown before anyone types. */
const SUGGESTED = ['pyramid', 'lagoon', 'monash', 'sunway-university', 'medical']
  .map((id) => placeById(id))
  .filter((place): place is Place => Boolean(place))

/** A preset from the curated list, or any place found via OpenStreetMap. */
export type PickedPlace =
  | { source: 'preset'; id: string }
  | { source: 'osm'; result: OsmResult }

type PlacePickerProps = {
  open: boolean
  title: string
  excludeId?: string | null
  recents?: string[]
  onOpenChange: (open: boolean) => void
  onPick: (selection: PickedPlace) => void
}

export function PlacePicker({
  open,
  title,
  excludeId,
  recents = [],
  onOpenChange,
  onPick,
}: PlacePickerProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | PlaceKind>('all')
  const [osmResults, setOsmResults] = useState<OsmResult[]>([])
  const [searching, setSearching] = useState(false)

  // Each visit starts from the full list rather than the last search.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setFilter('all')
    setOsmResults([])
    setSearching(false)
  }, [open])

  // Debounced OpenStreetMap search for anything beyond the curated list.
  // Nominatim's usage policy caps at 1 request/sec — the delay + abort keep
  // us well under it.
  useEffect(() => {
    const needle = query.trim()
    if (needle.length < 3) {
      setOsmResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchOsm(needle, controller.signal)
        .then((results) => {
          if (!controller.signal.aborted) setOsmResults(results)
        })
        .catch(() => {})
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false)
        })
    }, 450)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return PLACES.filter((place) => place.id !== excludeId)
      .filter((place) => filter === 'all' || place.kind === filter)
      .filter(
        (place) =>
          !needle ||
          place.name.toLowerCase().includes(needle) ||
          (place.short ?? '').toLowerCase().includes(needle) ||
          KIND_LABEL[place.kind].toLowerCase().includes(needle),
      )
      .slice(0, MAX_RESULTS)
  }, [query, filter, excludeId])

  // Preset and OSM-found places both resolve here — recents keep their order.
  const recentPlaces = recents
    .map((id) => placeById(id))
    .filter((place): place is Place => place !== undefined && place.id !== excludeId)
    .slice(0, MAX_RESULTS)

  const suggestedPlaces = SUGGESTED.filter((place) => place.id !== excludeId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto flex h-[88%] max-w-[520px] flex-col gap-0 rounded-t-4xl border-border bg-card p-0"
      >
        <SheetHeader className="flex-row items-center gap-2 px-3 pt-3 pb-0">
          <SheetTitle className="min-w-0 flex-1 truncate pl-1 text-base font-semibold tracking-tight">
            {title}
          </SheetTitle>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="size-8 shrink-0 rounded-full"
          >
            <X />
          </Button>
        </SheetHeader>

        <div className="px-4 pt-3">
          <InputGroup className="h-12 rounded-2xl bg-background">
            <InputGroupAddon className="pl-3.5">
              <Search className="size-4 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search any place"
              className="h-12 text-[0.95rem]"
            />
            {query && (
              <InputGroupAddon align="inline-end" className="pr-2.5">
                <InputGroupButton
                  aria-label="Clear search"
                  onClick={() => setQuery('')}
                  className="rounded-full"
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </div>

        <div className="flex gap-1.5 overflow-x-auto px-4 py-3">
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setFilter(entry.id)}
              aria-pressed={filter === entry.id}
              className={cn(
                'shrink-0 rounded-4xl border px-3 py-1.5 text-[0.75rem] font-medium transition-colors',
                filter === entry.id
                  ? 'border-transparent bg-coverage-arcade-ink text-coverage-foreground'
                  : 'border-border bg-background text-muted-foreground',
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {!query && (
            <>
              {recentPlaces.length > 0 && (
                <>
                  <GroupLabel>Recent</GroupLabel>
                  {recentPlaces.map((place) => (
                    <PlaceRow key={`r-${place.id}`} place={place} onPick={onPick} />
                  ))}
                </>
              )}
              <GroupLabel>Suggested</GroupLabel>
              {suggestedPlaces.map((place) => (
                <PlaceRow key={`s-${place.id}`} place={place} onPick={onPick} />
              ))}
            </>
          )}
          {query.trim().length > 0 && results.length > 0 && (
            <GroupLabel>In Sunway City</GroupLabel>
          )}
          {query.trim().length > 0 &&
            results.map((place) => (
              <PlaceRow key={place.id} place={place} onPick={onPick} />
            ))}
          {results.length === 0 && query.trim().length > 0 && (
            <p className="px-4 pt-4 pb-2 text-center text-[0.85rem] text-muted-foreground">
              Nothing in Sunway City matches “{query}”.
            </p>
          )}

          {query.trim().length >= 3 && (
            <>
              <GroupLabel>From OpenStreetMap</GroupLabel>
              {osmResults.map((result) => (
                <OsmRow key={result.id} result={result} onPick={onPick} />
              ))}
              {searching && (
                <p className="px-4 py-3 text-[0.8rem] text-muted-foreground">
                  Searching OpenStreetMap…
                </p>
              )}
              {!searching && osmResults.length === 0 && (
                <p className="px-4 py-3 text-[0.8rem] text-muted-foreground">
                  No matches on OpenStreetMap.
                </p>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pt-3 pb-1 text-[0.6rem] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  )
}

function PlaceRow({
  place,
  onPick,
}: {
  place: Place
  onPick: (selection: PickedPlace) => void
}) {
  const Icon = KIND_ICON[place.kind]
  return (
    <button
      type="button"
      onClick={() => onPick({ source: 'preset', id: place.id })}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          place.sheltered
            ? 'bg-coverage-indoor/15 text-coverage-indoor-ink'
            : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[0.9rem] font-medium">{place.name}</span>
        <span className="truncate text-[0.72rem] text-muted-foreground">
          {KIND_LABEL[place.kind]}
          {place.sheltered ? ' · sheltered' : ''}
        </span>
      </span>
    </button>
  )
}

function OsmRow({
  result,
  onPick,
}: {
  result: OsmResult
  onPick: (selection: PickedPlace) => void
}) {
  const Icon = KIND_ICON[result.kind]
  return (
    <button
      type="button"
      onClick={() => onPick({ source: 'osm', result })}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[0.9rem] font-medium">{result.name}</span>
        <span className="truncate text-[0.72rem] text-muted-foreground">
          {result.detail || KIND_LABEL[result.kind]}
        </span>
      </span>
    </button>
  )
}
