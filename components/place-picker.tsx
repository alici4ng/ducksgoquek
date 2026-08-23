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
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { PLACES, type Place, type PlaceKind } from '@/lib/sunway-city'
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

type PlacePickerProps = {
  open: boolean
  title: string
  excludeId?: string | null
  recents?: string[]
  onOpenChange: (open: boolean) => void
  onPick: (placeId: string) => void
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

  // Each visit starts from the full list rather than the last search.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setFilter('all')
  }, [open])

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
  }, [query, filter, excludeId])

  const recentPlaces = PLACES.filter(
    (place) => recents.includes(place.id) && place.id !== excludeId,
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto flex h-[88dvh] max-w-[520px] flex-col gap-0 rounded-t-4xl border-border bg-card p-0"
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
              placeholder="Search Sunway City"
              className="h-12 text-[0.95rem]"
            />
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
          {!query && recentPlaces.length > 0 && (
            <>
              <GroupLabel>Recent</GroupLabel>
              {recentPlaces.map((place) => (
                <PlaceRow key={`r-${place.id}`} place={place} onPick={onPick} />
              ))}
              <GroupLabel>All places</GroupLabel>
            </>
          )}
          {results.map((place) => (
            <PlaceRow key={place.id} place={place} onPick={onPick} />
          ))}
          {results.length === 0 && (
            <p className="px-4 py-8 text-center text-[0.85rem] text-muted-foreground">
              Nothing in Sunway City matches “{query}”.
            </p>
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
  onPick: (placeId: string) => void
}) {
  const Icon = KIND_ICON[place.kind]
  return (
    <button
      type="button"
      onClick={() => onPick(place.id)}
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
