'use client'

import { ArrowLeft, Clock, Ruler, Sun } from 'lucide-react'

import { BottomSheet } from '@/components/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { Route } from '@/lib/route-engine'
import { COVERAGE_META } from '@/lib/shade-map'
import { placeById } from '@/lib/sunway-city'
import { cn } from '@/lib/utils'

type RouteSheetProps = {
  routes: Route[]
  route: Route
  originId: string
  destinationId: string
  activeStepId: string | null
  onRouteChange: (routeId: string) => void
  onActiveStepChange: (id: string | null) => void
  onBack: () => void
}

export function RouteSheet({
  routes,
  route,
  originId,
  destinationId,
  activeStepId,
  onRouteChange,
  onActiveStepChange,
  onBack,
}: RouteSheetProps) {
  const origin = placeById(originId)
  const destination = placeById(destinationId)
  const fastest = routes.reduce((a, b) => (b.minutes < a.minutes ? b : a), route)
  const delta = route.minutes - fastest.minutes

  return (
    <BottomSheet className="flex max-h-[76%] flex-col">
      <header className="flex items-center gap-1.5 px-3 pt-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Back to search"
          className="size-8 shrink-0 rounded-full"
        >
          <ArrowLeft />
        </Button>
        <span className="truncate text-[0.8rem] font-medium text-muted-foreground">
          {origin?.short ?? origin?.name} → {destination?.short ?? destination?.name}
        </span>
      </header>

      {routes.length > 1 && (
        <div className="flex gap-1.5 px-4 pt-2">
          {routes.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onRouteChange(option.id)}
              aria-pressed={option.id === route.id}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 rounded-2xl border px-2 py-1.5 transition-colors',
                option.id === route.id
                  ? 'border-transparent bg-coverage-indoor/12'
                  : 'border-border bg-background',
              )}
            >
              <span className="text-[0.72rem] font-medium">{option.label}</span>
              <span className="font-mono text-[0.65rem] text-muted-foreground tabular">
                {option.minutes} min · {option.coverage}%
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end justify-between gap-3 px-4 pt-2">
        <div className="flex flex-col">
          <div className="flex items-start gap-0.5">
            <span className="font-mono text-5xl leading-none font-semibold tracking-tighter text-coverage-indoor-ink tabular">
              {route.coverage}
            </span>
            <span className="mt-0.5 font-mono text-xl leading-none font-medium text-coverage-indoor-ink/70">
              %
            </span>
          </div>
          <span className="pt-1.5 text-[0.8rem] font-medium text-muted-foreground">
            covered
          </span>
        </div>
        <p className="max-w-[52%] pb-1 text-right text-[0.7rem] leading-relaxed text-muted-foreground text-pretty">
          {route.label} of {routes.length} routes.{' '}
          {delta > 0
            ? `Adds ${delta} min over the fastest.`
            : 'Also the quickest way across.'}
        </p>
      </div>

      <div
        role="img"
        aria-label={`Route composition: ${route.steps
          .map((s) => `${s.title}, ${s.meters} metres`)
          .join('; ')}`}
        className="mx-4 mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full"
      >
        {route.steps.map((step) => (
          <span
            key={step.id}
            style={{
              backgroundColor: COVERAGE_META[step.coverage].stroke,
              flexGrow: Math.max(step.meters, 90),
            }}
            className={cn(
              'transition-opacity duration-300',
              activeStepId && activeStepId !== step.id ? 'opacity-25' : 'opacity-100',
            )}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1.5 px-4 pt-3">
        <Stat icon={Clock} value={`${route.minutes}`} unit="min" />
        <Stat icon={Ruler} value={(route.meters / 1000).toFixed(1)} unit="km" />
        <Stat icon={Sun} value={`${route.exposedMeters}`} unit="m out" tone="flare" />
      </div>

      <Separator className="mt-3" />

      <ol className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        {route.steps.map((step, index) => {
          const active = activeStepId === step.id
          const meta = COVERAGE_META[step.coverage]
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onActiveStepChange(active ? null : step.id)}
                aria-pressed={active}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-2xl px-2 py-2.5 text-left transition-colors outline-none',
                  'focus-visible:ring-3 focus-visible:ring-ring/40',
                  active ? 'bg-muted/70' : 'hover:bg-muted/40',
                )}
              >
                <span className="relative flex w-3 shrink-0 justify-center pt-1.5">
                  <span
                    className={cn(
                      'size-3 rounded-full transition-transform',
                      meta.dot,
                      active && 'scale-125',
                    )}
                  />
                  {index < route.steps.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute top-6 h-[calc(100%-0.5rem)] border-l border-border"
                    />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[0.9rem] leading-snug font-medium text-pretty">
                    {step.title}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 text-[0.7rem] leading-relaxed text-muted-foreground">
                    <span className={cn('font-medium', meta.ink)}>{meta.label}</span>
                    <span aria-hidden>·</span>
                    <span className="min-w-0">{step.detail}</span>
                  </span>
                </span>
                <span className="shrink-0 pt-0.5 font-mono text-[0.8rem] text-muted-foreground tabular">
                  {step.meters}m
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="border-t border-border bg-card px-4 pt-3">
        <Button
          size="lg"
          className="h-13 w-full rounded-2xl bg-coverage-arcade-ink text-base text-coverage-foreground hover:bg-coverage-arcade-ink/90"
        >
          Start walking
        </Button>
      </div>
    </BottomSheet>
  )
}

function Stat({
  icon: Icon,
  value,
  unit,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  value: string
  unit: string
  tone?: 'flare'
}) {
  const flare = tone === 'flare'
  return (
    <div
      className={cn(
        'flex h-8 items-center justify-center gap-1 rounded-4xl border px-1.5',
        flare
          ? 'border-transparent bg-coverage-openair/12 text-coverage-openair-ink'
          : 'border-border bg-background',
      )}
    >
      <Icon
        className={cn(
          'size-3.5 shrink-0',
          flare ? 'text-coverage-openair-ink' : 'text-muted-foreground',
        )}
      />
      <span className="truncate font-mono text-[0.7rem] font-medium tabular">
        {value}
        <span className="pl-0.5 font-sans font-normal opacity-70">{unit}</span>
      </span>
    </div>
  )
}
