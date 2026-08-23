'use client'

import { CloudSun, Umbrella } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { MapSurface, type Bounds } from '@/components/map-canvas'
import { MapHud, StatusBar } from '@/components/map-hud'
import { PlaceSheet } from '@/components/place-sheet'
import { PlanSheet } from '@/components/plan-sheet'
import { RouteSheet } from '@/components/route-sheet'
import { SunscreenSheet } from '@/components/sunscreen-sheet'
import { boundsOf, buildRouteSet } from '@/lib/route-engine'
import { PLACE_BY_ID } from '@/lib/sunway-city'
import { useWeather } from '@/lib/use-weather'

type Phase = 'plan' | 'route'

/** Sheets cover the lower half, so pad the frame downward to keep it clear. */
function aboveSheet(bounds: Bounds): Bounds {
  return {
    x: bounds.x,
    y: bounds.y - bounds.h * 0.06,
    w: bounds.w,
    h: bounds.h * 2.45,
  }
}

export function ShadeApp({ variant = 'sun' }: { variant?: 'sun' | 'rain' }) {
  const weather = useWeather()
  const [phase, setPhase] = useState<Phase>('plan')
  const [originId, setOriginId] = useState<string>('monash')
  const [destinationId, setDestinationId] = useState<string>('pyramid')
  const [computing, setComputing] = useState(false)
  const [rainMode, setRainMode] = useState(variant === 'rain')
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [focus, setFocus] = useState<Bounds | null>(null)

  // Real rain flips rain mode on; the toggle stays as a manual override.
  useEffect(() => {
    if (weather?.raining) setRainMode(true)
  }, [weather?.raining])

  const routes = useMemo(
    () => (phase === 'route' ? buildRouteSet(originId, destinationId, rainMode) : []),
    [phase, originId, destinationId, rainMode],
  )
  const route =
    routes.find((candidate) => candidate.id === selectedRouteId) ?? routes[0] ?? null

  useEffect(() => {
    if (!computing) return
    const timer = setTimeout(() => {
      setComputing(false)
      setPhase('route')
    }, 750)
    return () => clearTimeout(timer)
  }, [computing])

  useEffect(() => {
    if (phase !== 'route') return
    const timer = setTimeout(() => setReminderOpen(true), 1600)
    return () => clearTimeout(timer)
  }, [phase])

  // Frame whatever the user is looking at: the whole route, or a tapped place.
  useEffect(() => {
    if (!route) return
    setFocus(aboveSheet(boundsOf(route.points, 200)))
  }, [route])

  function changeEndpoint(target: 'origin' | 'destination', placeId: string) {
    if (target === 'origin') setOriginId(placeId)
    else setDestinationId(placeId)
    setPhase('plan')
    setSelectedRouteId(null)
    focusPlace(placeId)
  }

  function focusPlace(placeId: string) {
    const place = PLACE_BY_ID.get(placeId)
    if (!place) return
    setFocus(
      aboveSheet({
        x: place.x - 260,
        y: place.y - 260,
        w: place.w + 520,
        h: place.h + 520,
      }),
    )
  }

  return (
    <div className="relative size-full overflow-hidden bg-background">
      <MapSurface
        route={phase === 'route' ? route : null}
        activeStepId={activeStepId}
        rainMode={rainMode}
        originId={originId}
        destinationId={destinationId}
        selectedPlaceId={selectedPlaceId}
        focus={focus}
        onSelectPlace={(placeId) => {
          setSelectedPlaceId(placeId)
          focusPlace(placeId)
        }}
      />

      <StatusBar />
      <MapHud
        rainMode={rainMode}
        onRainModeChange={setRainMode}
        onUvPress={() => setReminderOpen(true)}
        weather={weather}
      />

      {variant === 'rain' && (
        <div className="pointer-events-none absolute inset-x-3 top-24 z-20 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-2 rounded-4xl border border-rain/30 bg-card/95 px-3.5 py-2 shadow-sm backdrop-blur">
            <Umbrella className="size-4 shrink-0 text-rain" />
            <span className="text-[0.78rem] font-medium whitespace-nowrap">
              {weather?.raining
                ? `${weather.label} in Sunway City — driest routes first`
                : 'Rain routing — driest routes first'}
            </span>
            <Link
              href="/"
              className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.72rem] font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              <CloudSun className="size-3.5" />
              Sun view
            </Link>
          </div>
        </div>
      )}

      {phase === 'plan' || !route ? (
        <PlanSheet
          originId={originId}
          destinationId={destinationId}
          computing={computing}
          onOriginChange={(placeId) => changeEndpoint('origin', placeId)}
          onDestinationChange={(placeId) => changeEndpoint('destination', placeId)}
          onSwap={() => {
            setOriginId(destinationId)
            setDestinationId(originId)
          }}
          onSubmit={() => setComputing(true)}
        />
      ) : (
        <RouteSheet
          routes={routes}
          route={route}
          originId={originId}
          destinationId={destinationId}
          activeStepId={activeStepId}
          onRouteChange={setSelectedRouteId}
          onActiveStepChange={setActiveStepId}
          onBack={() => {
            setActiveStepId(null)
            setSelectedRouteId(null)
            setPhase('plan')
          }}
        />
      )}

      <PlaceSheet
        placeId={selectedPlaceId}
        onOpenChange={(open) => setSelectedPlaceId(open ? selectedPlaceId : null)}
        onSetOrigin={(placeId) => {
          setOriginId(placeId)
          setSelectedPlaceId(null)
          setPhase('plan')
        }}
        onSetDestination={(placeId) => {
          setDestinationId(placeId)
          setSelectedPlaceId(null)
          setSelectedRouteId(null)
          setComputing(true)
        }}
      />

      <SunscreenSheet
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        coverage={route?.coverage ?? null}
        exposedMeters={route?.exposedMeters ?? null}
        uvIndex={weather?.uvIndex ?? null}
      />
    </div>
  )
}
