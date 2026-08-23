'use client'

import { useEffect, useMemo, useState } from 'react'

import { MapSurface, type Bounds } from '@/components/map-canvas'
import { MapHud, StatusBar } from '@/components/map-hud'
import { PlacePicker } from '@/components/place-picker'
import { PlaceSheet } from '@/components/place-sheet'
import { PlanSheet } from '@/components/plan-sheet'
import { RouteSheet } from '@/components/route-sheet'
import { SunscreenSheet } from '@/components/sunscreen-sheet'
import { boundsOf, buildRouteSet } from '@/lib/route-engine'
import { PLACE_BY_ID } from '@/lib/sunway-city'

type Phase = 'plan' | 'route'
type PickerTarget = 'origin' | 'destination' | null

/** Sheets cover the lower half, so pad the frame downward to keep it clear. */
function aboveSheet(bounds: Bounds): Bounds {
  return {
    x: bounds.x,
    y: bounds.y - bounds.h * 0.06,
    w: bounds.w,
    h: bounds.h * 2.45,
  }
}

export function ShadeApp() {
  const [phase, setPhase] = useState<Phase>('plan')
  const [originId, setOriginId] = useState<string>('monash')
  const [destinationId, setDestinationId] = useState<string>('pyramid')
  const [computing, setComputing] = useState(false)
  const [rainMode, setRainMode] = useState(false)
  const [showCoveredNetwork, setShowCoveredNetwork] = useState(true)
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [picker, setPicker] = useState<PickerTarget>(null)
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [recents, setRecents] = useState<string[]>(['pyramid', 'monash', 'medical'])
  const [focus, setFocus] = useState<Bounds | null>(null)

  const routes = useMemo(
    () => (phase === 'route' ? buildRouteSet(originId, destinationId) : []),
    [phase, originId, destinationId],
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

  function remember(placeId: string) {
    setRecents((current) => [placeId, ...current.filter((id) => id !== placeId)].slice(0, 5))
  }

  function pick(placeId: string) {
    if (picker === 'origin') setOriginId(placeId)
    if (picker === 'destination') setDestinationId(placeId)
    remember(placeId)
    setPicker(null)
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
        showCoveredNetwork={showCoveredNetwork}
        originId={originId}
        destinationId={destinationId}
        selectedPlaceId={selectedPlaceId}
        focus={focus}
        onSelectPlace={(placeId) => {
          setSelectedPlaceId(placeId)
          focusPlace(placeId)
        }}
        onToggleCoveredNetwork={() => setShowCoveredNetwork((value) => !value)}
      />

      <StatusBar />
      <MapHud
        rainMode={rainMode}
        onRainModeChange={setRainMode}
        onUvPress={() => setReminderOpen(true)}
      />

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
          onSuggestion={(from, to) => {
            setOriginId(from)
            setDestinationId(to)
            setSelectedRouteId(null)
            setComputing(true)
          }}
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

      <PlaceSheet
        placeId={selectedPlaceId}
        onOpenChange={(open) => setSelectedPlaceId(open ? selectedPlaceId : null)}
        onSetOrigin={(placeId) => {
          setOriginId(placeId)
          remember(placeId)
          setSelectedPlaceId(null)
          setPhase('plan')
        }}
        onSetDestination={(placeId) => {
          setDestinationId(placeId)
          remember(placeId)
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
      />
    </div>
  )
}
