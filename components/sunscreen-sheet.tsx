'use client'

import { Sun, TriangleAlert } from 'lucide-react'

import { BusinessModePlaceholder } from '@/components/business-mode-placeholder'
import { SponsorCard } from '@/components/sponsor-card'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { COVERAGE_META, UV, uvBand } from '@/lib/shade-map'
import { CONDITIONS, adTriggered } from '@/lib/sponsor'

type SunscreenSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Route figures, when a route is on screen behind the sheet. */
  coverage: number | null
  exposedMeters: number | null
  /** Live UV index; falls back to the hardcoded demo value. */
  uvIndex?: number | null
}

export function SunscreenSheet({
  open,
  onOpenChange,
  coverage,
  exposedMeters,
  uvIndex,
}: SunscreenSheetProps) {
  const uv = { index: uvIndex ?? UV.index, ...uvBand(uvIndex ?? UV.index) }
  const showSponsor = adTriggered()
  const exposedMinutes =
    exposedMeters === null
      ? null
      : Math.round(exposedMeters / COVERAGE_META.openair.speed)
  const stats = [
    { label: 'Outdoor left', value: exposedMeters === null ? '—' : `${exposedMeters}`, unit: 'm' },
    { label: 'Time exposed', value: exposedMinutes === null ? '—' : `${exposedMinutes}`, unit: 'min' },
    { label: 'Last applied', value: '2:10', unit: 'ago' },
  ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto flex max-h-[94dvh] max-w-[520px] flex-col gap-0 rounded-t-4xl border-border bg-card pb-5"
      >
        <div className="flex shrink-0 justify-center pt-2.5 pb-1">
          <span
            aria-hidden
            className="h-1 w-10 rounded-full bg-muted-foreground/25"
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <SheetHeader className="flex-row items-center gap-3 px-4 pt-2 pb-0">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-uv-moderate/18">
              <Sun className="size-5 text-uv-moderate-ink" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <SheetTitle className="text-base leading-tight font-semibold tracking-tight">
                Sunscreen reminder
              </SheetTitle>
              <SheetDescription className="text-[0.8rem]">
                <span className="font-mono tabular">UV index {uv.index}</span>
                {' · '}
                <span className={uv.ink}>{uv.label}</span>
              </SheetDescription>
            </div>
          </SheetHeader>

          {/* Live conditions widget — the context that justifies the alert. */}
          <div className="mx-4 mt-4 flex shrink-0 flex-col gap-2.5 rounded-2xl border border-border bg-background p-3">
            <div className="flex items-stretch gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[0.6rem] tracking-wide text-muted-foreground uppercase">
                  UV index
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="font-mono text-xl leading-none font-semibold tabular">
                    {uvIndex ?? CONDITIONS.uvIndex}
                  </span>
                  <span
                    className={`truncate text-[0.7rem] font-medium ${uv.ink}`}
                  >
                    {uv.label}
                  </span>
                </span>
              </div>

              <span aria-hidden className="w-px shrink-0 bg-border" />

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[0.6rem] tracking-wide text-muted-foreground uppercase">
                  Shade cover
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="font-mono text-xl leading-none font-semibold text-coverage-indoor-ink tabular">
                    {coverage === null ? '—' : `${coverage}%`}
                  </span>
                  <span className="truncate text-[0.7rem] text-muted-foreground">
                    {CONDITIONS.tempC}°C
                  </span>
                </span>
              </div>
            </div>

            <p className="flex items-center gap-1.5 rounded-xl bg-uv-extreme/12 px-2.5 py-1.5 text-[0.72rem] leading-snug font-medium text-uv-extreme-ink">
              <TriangleAlert className="size-3.5 shrink-0" />
              <span className="min-w-0 text-pretty">
                High UV on your current route leg
              </span>
            </p>
          </div>

          <p className="px-4 pt-4 text-[0.85rem] leading-relaxed text-muted-foreground text-pretty">
            Reapply SPF 50+ before you leave the walkway. At this index,
            unprotected skin burns in under 10 minutes — a broad-spectrum layer
            on face, neck and hands lasts you the rest of the route.
          </p>

          <dl className="mx-4 mt-4 flex shrink-0 items-stretch rounded-2xl border border-border bg-background py-2.5">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={
                  index > 0
                    ? 'flex min-w-0 flex-1 flex-col items-center gap-0.5 border-l border-border px-1'
                    : 'flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1'
                }
              >
                <dd className="flex items-baseline gap-0.5">
                  <span className="font-mono text-lg leading-none font-semibold tabular">
                    {stat.value}
                  </span>
                  <span className="text-[0.65rem] text-muted-foreground">
                    {stat.unit}
                  </span>
                </dd>
                <dt className="w-full truncate text-center text-[0.6rem] tracking-wide text-muted-foreground uppercase">
                  {stat.label}
                </dt>
              </div>
            ))}
          </dl>

          {showSponsor && <SponsorCard />}

          <BusinessModePlaceholder />
        </div>

        <div className="shrink-0 px-4 pt-3">
          <SheetClose
            render={
              <Button
                variant="outline"
                size="lg"
                className="h-12 w-full rounded-2xl text-base"
              />
            }
          >
            Dismiss
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  )
}
