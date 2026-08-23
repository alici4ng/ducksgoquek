'use client'

import 'leaflet/dist/leaflet.css'

import type { LeafletMouseEvent, Map as LeafletMap } from 'leaflet'
import { Locate, Minus, Plus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  boundsToLatLng,
  CITY_BOUNDS,
  GEO_PLACES,
  HOME_BOUNDS,
  nodeToLatLng,
  pathToLatLngs,
  type LatLng,
} from '@/lib/geo'
import { NODES, type Point, type Route } from '@/lib/route-engine'
import { COVERAGE_META } from '@/lib/shade-map'
import { PLACES, PLACE_BY_ID, type Place } from '@/lib/sunway-city'
import { cn } from '@/lib/utils'

export type Bounds = { x: number; y: number; w: number; h: number }

/** Real position of a place's centre, exact where anchored. */
function placeCentre(place: Place): LatLng {
  return GEO_PLACES[place.id] ?? nodeToLatLng(NODES[place.node])
}

type MapCanvasProps = {
  route: Route | null
  activeStepId: string | null
  rainMode: boolean
  originId: string | null
  destinationId: string | null
  selectedPlaceId: string | null
  focus: Bounds | null
  onSelectPlace: (placeId: string) => void
}

export function MapSurface({
  className,
  ...props
}: MapCanvasProps & {
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<LeafletMap | null>(null)
  const [, setTick] = useState(0)
  const raf = useRef<number | null>(null)
  const propsRef = useRef(props)
  propsRef.current = props

  const scheduleSync = useCallback(() => {
    if (raf.current !== null) return
    raf.current = requestAnimationFrame(() => {
      raf.current = null
      setTick((tick) => tick + 1)
    })
  }, [])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    let disposed = false
    let instance: LeafletMap | null = null

    void import('leaflet').then((L) => {
      if (disposed || containerRef.current !== element) return
      const m = L.map(element, {
        zoomControl: false,
        attributionControl: false,
        minZoom: 14,
        maxZoom: 19,
        zoomSnap: 0.5,
      })
      // Colourful basemap with bright cyan water. Raster tiles cannot be
      // restyled directly, so palette changes mean swapping the tile source.
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 20,
          attribution: '© OpenStreetMap contributors © CARTO',
        },
      ).addTo(m)

      // Attribution clears the HUD, which owns the top corners.
      const attribution = L.control
        .attribution({ position: 'topright', prefix: false })
        .addAttribution(
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · <a href="https://carto.com/">CARTO</a>',
        )
        .addTo(m)
      const attributionEl = attribution.getContainer()
      if (attributionEl) attributionEl.style.marginTop = '5rem'

      // Sheets own the lower half, so the opening frame sits above them.
      m.fitBounds(
        [
          [HOME_BOUNDS.south, HOME_BOUNDS.west],
          [HOME_BOUNDS.north, HOME_BOUNDS.east],
        ],
        { paddingBottomRight: [0, element.clientHeight * 0.45] },
      )

      m.on('move zoom resize', scheduleSync)
      m.on('click', (event: LeafletMouseEvent) => {
        // Taps land on the basemap, so hit-test the overlays manually.
        const ppm =
          2 ** m.getZoom() /
          (156543.03392 * Math.cos((m.getCenter().lat * Math.PI) / 180))
        let best: Place | null = null
        for (const place of PLACES) {
          const c = m.latLngToContainerPoint(placeCentre(place))
          const w = place.w * ppm
          const h = place.h * ppm
          const hit =
            event.containerPoint.x >= c.x - w / 2 &&
            event.containerPoint.x <= c.x + w / 2 &&
            event.containerPoint.y >= c.y - h / 2 &&
            event.containerPoint.y <= c.y + h / 2
          if (hit && (!best || place.w * place.h < best.w * best.h)) best = place
        }
        if (best) propsRef.current.onSelectPlace(best.id)
      })

      instance = m
      setMap(m)
    })

    return () => {
      disposed = true
      if (raf.current !== null) cancelAnimationFrame(raf.current)
      instance?.remove()
    }
  }, [scheduleSync])

  const { focus } = props
  useEffect(() => {
    if (!map || !focus) return
    const b = boundsToLatLng(focus)
    map.flyToBounds(
      [
        [b.south, b.west],
        [b.north, b.east],
      ],
      { duration: 0.5 },
    )
  }, [map, focus])

  function zoomBy(levels: number) {
    if (map) map.setZoom(map.getZoom() + levels, { animate: true })
  }

  function locate() {
    if (!map) return
    map.flyToBounds([
      [CITY_BOUNDS.south, CITY_BOUNDS.west],
      [CITY_BOUNDS.north, CITY_BOUNDS.east],
    ])
  }

  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)}>
      <div ref={containerRef} className="absolute inset-0 z-0 size-full" />
      {map && <Overlay map={map} {...props} />}

      {/* Controls hug the right edge above the sheet, which owns the lower half. */}
      <div className="pointer-events-none absolute top-[26%] right-3 z-20 flex flex-col gap-1.5">
        <MapButton label="Zoom in" onClick={() => zoomBy(0.75)}>
          <Plus className="size-4" />
        </MapButton>
        <MapButton label="Zoom out" onClick={() => zoomBy(-0.75)}>
          <Minus className="size-4" />
        </MapButton>
        <MapButton label="Show the whole of Sunway City" onClick={locate}>
          <Locate className="size-4" />
        </MapButton>
      </div>

      {map && (
        <ScaleBar
          unitsPerPixel={
            (156543.03392 * Math.cos((map.getCenter().lat * Math.PI) / 180)) /
            2 ** map.getZoom()
          }
        />
      )}
    </div>
  )
}

function Overlay({
  map,
  route,
  activeStepId,
  rainMode,
  originId,
  destinationId,
}: Omit<MapCanvasProps, 'focus' | 'onSelectPlace' | 'selectedPlaceId'> & {
  map: LeafletMap
}) {
  const size = map.getSize()

  const origin = originId ? PLACE_BY_ID.get(originId) : undefined
  const destination = destinationId ? PLACE_BY_ID.get(destinationId) : undefined

  const px = (ll: LatLng) => map.latLngToContainerPoint(ll)
  const dFor = (points: Point[]) =>
    pathToLatLngs(points)
      .map((ll, i) => {
        const p = px(ll)
        return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`
      })
      .join(' ')

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10 size-full select-none"
      width={size.x}
      height={size.y}
      role="img"
      aria-label={
        route
          ? 'Map of Sunway City showing a walking route made of covered and exposed segments'
          : 'Map of Sunway City'
      }
    >
      <defs>
        <pattern
          id="rain"
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(18)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="7"
            stroke="var(--rain)"
            strokeWidth="1"
            strokeOpacity="0.5"
          />
        </pattern>
      </defs>

      {route && (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path
            d={route.steps.map((s) => dFor(s.points)).join(' ')}
            stroke="var(--card)"
            strokeWidth={16}
            strokeOpacity={0.92}
          />
          {route.steps.map((step) => {
            const dim = activeStepId !== null && activeStepId !== step.id
            const meta = COVERAGE_META[step.coverage]
            return (
              <path
                key={step.id}
                d={dFor(step.points)}
                stroke={meta.stroke}
                strokeWidth={activeStepId === step.id ? 10 : 7}
                strokeOpacity={dim ? 0.22 : 1}
                strokeDasharray={meta.covered ? undefined : '2 9'}
                className="transition-all duration-300"
              />
            )
          })}
        </g>
      )}

      {destination && (
        <Marker
          point={px(nodeToLatLng(NODES[destination.node]))}
          fill="var(--destructive)"
          shape="square"
          label={`Destination: ${destination.name}`}
        />
      )}
      {origin && (
        <Marker
          point={px(nodeToLatLng(NODES[origin.node]))}
          fill="var(--coverage-arcade)"
          shape="dot"
          label={`Origin: ${origin.name}`}
        />
      )}

      {rainMode && (
        <>
          <rect x={0} y={0} width={size.x} height={size.y} fill="var(--rain)" opacity={0.09} />
          <rect x={0} y={0} width={size.x} height={size.y} fill="url(#rain)" />
        </>
      )}
    </svg>
  )
}

function MapButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'pointer-events-auto size-9 rounded-full border-border bg-card shadow-sm',
        active && 'bg-coverage-bridge/15 text-coverage-bridge-ink',
      )}
    >
      {children}
    </Button>
  )
}

function ScaleBar({ unitsPerPixel }: { unitsPerPixel: number }) {
  const target = 74 * unitsPerPixel
  const step = [50, 100, 200, 300, 500, 1000].find((s) => s >= target) ?? 1000
  return (
    <div className="pointer-events-none absolute top-[6.5rem] left-4 z-20 flex flex-col items-start gap-0.5">
      <span
        className="border-x-2 border-b-2 border-foreground/35"
        style={{ width: step / unitsPerPixel, height: 5 }}
      />
      <span className="rounded-sm bg-card/80 px-1 font-mono text-[0.6rem] text-foreground/55 tabular">
        {step >= 1000 ? `${step / 1000} km` : `${step} m`}
      </span>
    </div>
  )
}

function Marker({
  point,
  fill,
  shape,
  label,
}: {
  point: { x: number; y: number }
  fill: string
  shape: 'dot' | 'square'
  label: string
}) {
  const r = 9
  return (
    <g className="animate-in fade-in duration-500" role="img" aria-label={label}>
      <circle cx={point.x} cy={point.y} r={r * 1.9} fill={fill} opacity={0.16} />
      {shape === 'dot' ? (
        <>
          <circle cx={point.x} cy={point.y} r={r} fill="var(--card)" />
          <circle cx={point.x} cy={point.y} r={r * 0.58} fill={fill} />
        </>
      ) : (
        <>
          <rect x={point.x - r} y={point.y - r} width={r * 2} height={r * 2} rx={r * 0.3} fill="var(--card)" />
          <rect
            x={point.x - r * 0.6}
            y={point.y - r * 0.6}
            width={r * 1.2}
            height={r * 1.2}
            rx={r * 0.2}
            fill={fill}
          />
        </>
      )}
    </g>
  )
}
