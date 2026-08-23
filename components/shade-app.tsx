'use client'

import { CloudSun, Umbrella } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { MapSurface, type LatLngBounds } from '@/components/map-canvas'
import { MapHud, StatusBar } from '@/components/map-hud'
import { PlacePicker, type PickedPlace } from '@/components/place-picker'
import { PlanSheet } from '@/components/plan-sheet'
import { RouteSheet } from '@/components/route-sheet'
import { SunscreenSheet } from '@/components/sunscreen-sheet'
import { makeOsmPlace } from '@/lib/osm-search'
import { boundsOf, buildRouteSet, type Route } from '@/lib/route-engine'
import { placeById } from '@/lib/sunway-city'
import { useWeather } from '@/lib/use-weather'

type Phase = 'plan' | 'route'
type PickerTarget = 'origin' | 'destination' | null

/** Sheets cover the lower half, so stretch the frame southward to keep the
 *  subject in the visible upper part. */
function aboveSheet(bounds: LatLngBounds): LatLngBounds {
  const h = bounds.north - bounds.south
  return { ...bounds, north: bounds.north + h * 0.06, south: bounds.south - h * 1.45 }
}

export function ShadeApp({ variant = 'sun' }: { variant?: 'sun' | 'rain' }) {
  const weather = useWeather()
  const [phase, setPhase] = useState<Phase>('plan')
  const [originId, setOriginId] = useState<string>('monash')
  const [destinationId, setDestinationId] = useState<string>('pyramid')
  const [computing, setComputing] = useState(false)
  // Rain routing is a page variant (/rain), not a toggle on the sun view.
  const rainMode = variant === 'rain'
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [picker, setPicker] = useState<PickerTarget>(null)
  const [recents, setRecents] = useState<string[]>(['pyramid', 'monash', 'medical'])
  const [focus, setFocus] = useState<LatLngBounds | null>(null)
  const [routes, setRoutes] = useState<Route[]>([])

  const route =
    routes.find((candidate) => candidate.id === selectedRouteId) ?? routes[0] ?? null

  // Routing is async: the graph loads from a static GeoJSON on first request,
  // then Dijkstra runs in-browser per strategy.
  useEffect(() => {
    if (!computing) return
    let cancelled = false
    buildRouteSet(originId, destinationId, rainMode).then((result) => {
      if (cancelled) return
      setRoutes(result)
      setComputing(false)
      if (result.length > 0) setPhase('route')
    })
    return () => {
      cancelled = true
    }
  }, [computing, originId, destinationId, rainMode])

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

  function remember(placeId: string) {
    setRecents((current) => [placeId, ...current.filter((id) => id !== placeId)].slice(0, 5))
  }

  function pick(selection: PickedPlace) {
    // OSM results become registered places on first use, so everything
    // downstream — recents, markers, routing — resolves them like presets.
    const placeId =
      selection.source === 'osm' ? makeOsmPlace(selection.result).id : selection.id
    if (picker === 'origin') setOriginId(placeId)
    if (picker === 'destination') setDestinationId(placeId)
    remember(placeId)
    setPicker(null)
    setPhase('plan')
    setSelectedRouteId(null)
    focusPlace(placeId)
  }

  function focusPlace(placeId: string) {
    const place = placeById(placeId)
    if (!place) return
    // ~260 m around the place, stretched south so it clears the sheet.
    setFocus(
      aboveSheet({
        south: place.lat - 260 / 110574,
        north: place.lat + 260 / 110574,
        west: place.lng - 260 / 111152,
        east: place.lng + 260 / 111152,
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
        focus={focus}
      />

      <StatusBar />
      <MapHud weather={weather} />

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
          onEditOrigin={() => setPicker('origin')}
          onEditDestination={() => setPicker('destination')}
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

      <PlacePicker
        open={picker !== null}
        title={picker === 'origin' ? 'Choose a starting point' : 'Choose a destination'}
        excludeId={picker === 'origin' ? destinationId : originId}
        recents={recents}
        onOpenChange={(open) => setPicker(open ? picker : null)}
        onPick={pick}
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
