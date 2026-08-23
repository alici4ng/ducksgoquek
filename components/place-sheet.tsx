'use client'

import { CircleDot, Navigation, X } from 'lucide-react'

import { KIND_ICON, KIND_LABEL } from '@/components/place-picker'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { EDGES } from '@/lib/route-engine'
import { COVERAGE_META } from '@/lib/shade-map'
import { placeById } from '@/lib/sunway-city'

/** How this place connects to the rest of the network, by kind of cover. */
function linksFor(node: string) {
  const kinds = new Set(
    EDGES.filter((edge) => edge.a === node || edge.b === node).map(
      (edge) => edge.coverage,
    ),
  )
  return [...kinds]
}

type PlaceSheetProps = {
  placeId: string | null
  onOpenChange: (open: boolean) => void
  onSetOrigin: (placeId: string) => void
  onSetDestination: (placeId: string) => void
}

export function PlaceSheet({
  placeId,
  onOpenChange,
  onSetOrigin,
  onSetDestination,
}: PlaceSheetProps) {
  const place = placeId ? placeById(placeId) : undefined
  const Icon = place ? KIND_ICON[place.kind] : CircleDot

  return (
    <Sheet open={Boolean(place)} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto flex max-w-[520px] flex-col gap-0 rounded-t-4xl border-border bg-card pb-6"
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <span aria-hidden className="h-1 w-10 rounded-full bg-muted-foreground/25" />
        </div>

        {place && (
          <>
            <SheetHeader className="flex-row items-center gap-3 px-4 pt-2 pb-0">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-coverage-indoor/15 text-coverage-indoor-ink">
                <Icon className="size-5" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <SheetTitle className="truncate text-base leading-tight font-semibold tracking-tight">
                  {place.name}
                </SheetTitle>
                <SheetDescription className="text-[0.8rem]">
                  {KIND_LABEL[place.kind]}
                  {place.sheltered ? ' · sheltered inside' : ' · open air'}
                </SheetDescription>
              </div>
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

            {place.blurb && (
              <p className="px-4 pt-3 text-[0.85rem] leading-relaxed text-muted-foreground text-pretty">
                {place.blurb}
              </p>
            )}

            <div className="flex flex-wrap gap-1.5 px-4 pt-3">
              {linksFor(place.node).map((coverage) => {
                const meta = COVERAGE_META[coverage]
                return (
                  <span
                    key={coverage}
                    className="flex items-center gap-1.5 rounded-4xl border border-border bg-background px-2.5 py-1 text-[0.7rem] font-medium"
                  >
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ backgroundColor: meta.stroke }}
                    />
                    <span className={meta.ink}>{meta.label} link</span>
                  </span>
                )
              })}
            </div>

            <div className="flex gap-2 px-4 pt-4">
              <Button
                variant="outline"
                size="lg"
                onClick={() => onSetOrigin(place.id)}
                className="h-12 flex-1 rounded-2xl text-[0.9rem]"
              >
                <CircleDot data-icon="inline-start" />
                Start here
              </Button>
              <Button
                size="lg"
                onClick={() => onSetDestination(place.id)}
                className="h-12 flex-1 rounded-2xl bg-coverage-arcade-ink text-[0.9rem] text-coverage-foreground hover:bg-coverage-arcade-ink/90"
              >
                <Navigation data-icon="inline-start" />
                Directions
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
