'use client'

import { Layers, Locate, Minus, Plus } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'

import { Button } from '@/components/ui/button'
import { COVERAGE_META, CONDITIONS_NOW } from '@/lib/shade-map'
import { EDGES, NODES, type Point, type Route } from '@/lib/route-engine'
import {
  BRT_LINE,
  CITY,
  FILLER_BLOCKS,
  GREENS,
  PLACES,
  PLACE_BY_ID,
  ROADS,
  WATER,
  type Place,
} from '@/lib/sunway-city'
import { cn } from '@/lib/utils'

export type Bounds = { x: number; y: number; w: number; h: number }

const MIN_SPAN = 420
const MAX_SPAN = CITY.w * 1.2

/** Shadows fall opposite the sun; length shortens as the sun climbs. */
const SHADOW = (() => {
  const away = ((CONDITIONS_NOW.sunAzimuth + 180) * Math.PI) / 180
  const length = 34 / Math.tan((CONDITIONS_NOW.sunAltitude * Math.PI) / 180) + 14
  return { dx: Math.sin(away) * length, dy: -Math.cos(away) * length }
})()

const ROAD_WIDTH: Record<string, number> = {
  expressway: 34,
  arterial: 24,
  local: 15,
}

const KIND_FILL: Record<Place['kind'], string> = {
  mall: 'var(--coverage-indoor)',
  attraction: 'var(--uv-moderate)',
  campus: 'var(--coverage-arcade)',
  hospital: 'var(--destructive)',
  hotel: 'var(--coverage-bridge)',
  office: 'var(--map-block)',
  transit: 'var(--coverage-transit)',
  residential: 'var(--map-block)',
  park: 'var(--map-park)',
  water: 'var(--map-water)',
  civic: 'var(--map-block)',
}

/** Landmark footprints are tinted, ordinary stock stays sand-coloured. */
function placeFill(place: Place) {
  return place.kind === 'office' ||
    place.kind === 'residential' ||
    place.kind === 'civic'
    ? 'var(--map-block)'
    : KIND_FILL[place.kind]
}

type View = { cx: number; cy: number; span: number }

/** Whole-city overview, reachable from the locate button. */
const CITY_VIEW: View = { cx: CITY.w / 2, cy: CITY.h / 2, span: CITY.w }
/** Opening view: the dense core, framed above the search sheet. */
const HOME_VIEW: View = { cx: 980, cy: 1060, span: 1250 }
/** Slack so a view can sit off-centre and still show the city edge. */
const EDGE_SLACK = 360

function clampView(view: View, aspect: number): View {
  const span = Math.min(MAX_SPAN, Math.max(MIN_SPAN, view.span))
  const spanY = span * aspect
  const halfX = Math.min(span, CITY.w) / 2
  const halfY = Math.min(spanY, CITY.h) / 2
  return {
    span,
    cx: Math.min(
      CITY.w - halfX + EDGE_SLACK,
      Math.max(halfX - EDGE_SLACK, view.cx),
    ),
    cy: Math.min(
      CITY.h - halfY + EDGE_SLACK,
      Math.max(halfY - EDGE_SLACK, view.cy),
    ),
  }
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

type MapCanvasProps = {
  route: Route | null
  activeStepId: string | null
  rainMode: boolean
  showCoveredNetwork: boolean
  originId: string | null
  destinationId: string | null
  selectedPlaceId: string | null
  focus: Bounds | null
  onSelectPlace: (placeId: string) => void
}

export function MapSurface({
  className,
  onToggleCoveredNetwork,
  ...props
}: MapCanvasProps & {
  className?: string
  onToggleCoveredNetwork: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 390, h: 844 })
  const [view, setView] = useState<View>(HOME_VIEW)
  const animation = useRef<number | null>(null)
  const gesture = useRef<{
    pointers: Map<number, { x: number; y: number }>
    start: View | null
    startDistance: number
    moved: boolean
  }>({ pointers: new Map(), start: null, startDistance: 0, moved: false })

  const aspect = size.h / size.w
  const viewRef = useRef(view)
  viewRef.current = view

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect
      if (box.width > 0 && box.height > 0) setSize({ w: box.width, h: box.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const animateTo = useCallback(
    (target: View) => {
      if (animation.current) cancelAnimationFrame(animation.current)
      const clamped = clampView(target, aspect)
      const from = viewRef.current
      const started = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - started) / 520)
        const k = easeOutCubic(t)
        setView({
          cx: from.cx + (clamped.cx - from.cx) * k,
          cy: from.cy + (clamped.cy - from.cy) * k,
          span: from.span + (clamped.span - from.span) * k,
        })
        if (t < 1) animation.current = requestAnimationFrame(tick)
      }
      animation.current = requestAnimationFrame(tick)
    },
    [aspect],
  )

  useEffect(() => () => {
    if (animation.current) cancelAnimationFrame(animation.current)
  }, [])

  const { focus } = props
  useEffect(() => {
    if (!focus) return
    animateTo({
      cx: focus.x + focus.w / 2,
      cy: focus.y + focus.h / 2,
      span: Math.max(focus.w, focus.h / aspect),
    })
  }, [focus, aspect, animateTo])

  const unitsPerPixel = view.span / Math.max(size.w, 1)
  const zoom = CITY.w / view.span

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
    g.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    g.start = view
    g.moved = false
    if (g.pointers.size === 2) {
      const [a, b] = [...g.pointers.values()]
      g.startDistance = Math.hypot(a.x - b.x, a.y - b.y)
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current
    if (!g.pointers.has(event.pointerId) || !g.start) return
    const previous = g.pointers.get(event.pointerId)!
    g.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (g.pointers.size === 2) {
      const [a, b] = [...g.pointers.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      if (g.startDistance > 0 && distance > 0) {
        g.moved = true
        const ratio = g.startDistance / distance
        setView((current) => clampView({ ...current, span: current.span * ratio }, aspect))
        g.startDistance = distance
      }
      return
    }

    const dx = event.clientX - previous.x
    const dy = event.clientY - previous.y
    if (Math.abs(dx) + Math.abs(dy) > 2) g.moved = true
    setView((current) =>
      clampView(
        {
          ...current,
          cx: current.cx - dx * (current.span / Math.max(size.w, 1)),
          cy: current.cy - dy * (current.span / Math.max(size.w, 1)),
        },
        aspect,
      ),
    )
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    gesture.current.pointers.delete(event.pointerId)
    if (gesture.current.pointers.size === 0) gesture.current.start = null
  }

  function onWheel(event: ReactWheelEvent<HTMLDivElement>) {
    setView((current) =>
      clampView(
        { ...current, span: current.span * Math.exp(event.deltaY * 0.0012) },
        aspect,
      ),
    )
  }

  function zoomBy(factor: number) {
    animateTo({ ...view, span: view.span * factor })
  }

  const spanY = view.span * aspect
  const viewBox = `${view.cx - view.span / 2} ${view.cy - spanY / 2} ${view.span} ${spanY}`

  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)}>
      <div
        ref={containerRef}
        className="size-full touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <MapCanvas
          {...props}
          viewBox={viewBox}
          unitsPerPixel={unitsPerPixel}
          zoom={zoom}
          suppressClick={() => gesture.current.moved}
        />
      </div>

      {/* Controls hug the right edge above the sheet, which owns the lower half. */}
      <div className="pointer-events-none absolute top-[26%] right-3 z-20 flex flex-col gap-1.5">
        <MapButton label="Zoom in" onClick={() => zoomBy(1 / 1.7)}>
          <Plus className="size-4" />
        </MapButton>
        <MapButton label="Zoom out" onClick={() => zoomBy(1.7)}>
          <Minus className="size-4" />
        </MapButton>
        <MapButton
          label="Show the whole of Sunway City"
          onClick={() => animateTo(CITY_VIEW)}
        >
          <Locate className="size-4" />
        </MapButton>
        <MapButton
          label="Toggle the covered walkway network"
          active={props.showCoveredNetwork}
          onClick={onToggleCoveredNetwork}
        >
          <Layers className="size-4" />
        </MapButton>
      </div>

      <ScaleBar unitsPerPixel={unitsPerPixel} />
    </div>
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
      <span className="font-mono text-[0.6rem] text-foreground/55 tabular">
        {step >= 1000 ? `${step / 1000} km` : `${step} m`}
      </span>
    </div>
  )
}

type CanvasProps = MapCanvasProps & {
  viewBox: string
  unitsPerPixel: number
  zoom: number
  suppressClick: () => boolean
}

function MapCanvas({
  route,
  activeStepId,
  rainMode,
  showCoveredNetwork,
  originId,
  destinationId,
  selectedPlaceId,
  onSelectPlace,
  viewBox,
  unitsPerPixel,
  zoom,
  suppressClick,
}: CanvasProps) {
  const u = unitsPerPixel
  const origin = originId ? PLACE_BY_ID.get(originId) : undefined
  const destination = destinationId ? PLACE_BY_ID.get(destinationId) : undefined

  const coveredEdges = useMemo(
    () => EDGES.filter((edge) => COVERAGE_META[edge.coverage].covered && edge.coverage !== 'transit'),
    [],
  )

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid slice"
      className="size-full select-none"
      role="img"
      aria-label={
        route
          ? 'Map of Sunway City showing a walking route made of covered and exposed segments'
          : 'Map of Sunway City showing landmarks, the BRT line and the covered walkway network'
      }
    >
      <defs>
        <pattern id="rain" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
          <line x1="0" y1="0" x2="0" y2="7" stroke="var(--rain)" strokeWidth="1" strokeOpacity="0.5" />
        </pattern>
        <pattern id="arcade" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="9" stroke="var(--coverage-arcade)" strokeWidth="2" strokeOpacity="0.4" />
        </pattern>
      </defs>

      <rect x={-1600} y={-1600} width={CITY.w + 3200} height={CITY.h + 3200} fill="var(--background)" />

      {/* Water and greenery sit under everything built. */}
      {WATER.map((body) => (
        <path key={body.id} d={body.d} fill="var(--map-water)" />
      ))}
      {GREENS.map((green) => (
        <path key={green.id} d={green.d} fill="var(--map-park)" rx={4} />
      ))}

      {/* Road casings, then the carriageway on top — standard cartography. */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {ROADS.map((road) => (
          <path
            key={`casing-${road.id}`}
            d={road.d}
            stroke="var(--map-road-casing)"
            strokeWidth={ROAD_WIDTH[road.cls] + 6}
          />
        ))}
        {ROADS.map((road) => (
          <path key={road.id} d={road.d} stroke="var(--map-road)" strokeWidth={ROAD_WIDTH[road.cls]} />
        ))}
      </g>

      {/* Cast shade — the layer the whole product is about. */}
      <g fill="var(--map-shadow)" opacity={rainMode ? 0.04 : 0.17}>
        {FILLER_BLOCKS.map((b, i) => (
          <rect key={`fs${i}`} x={b.x + SHADOW.dx * 0.6} y={b.y + SHADOW.dy * 0.6} width={b.w} height={b.h} rx={3} />
        ))}
        {PLACES.filter((p) => p.kind !== 'transit').map((p) => (
          <rect key={`ps${p.id}`} x={p.x + SHADOW.dx} y={p.y + SHADOW.dy} width={p.w} height={p.h} rx={5} />
        ))}
      </g>

      {FILLER_BLOCKS.map((b, i) => (
        <rect key={`f${i}`} x={b.x} y={b.y} width={b.w} height={b.h} rx={3} fill="var(--map-block)" />
      ))}

      {PLACES.map((place) => {
        const selected = selectedPlaceId === place.id
        return (
          <g key={place.id}>
            <rect
              x={place.x}
              y={place.y}
              width={place.w}
              height={place.h}
              rx={place.kind === 'transit' ? 8 : 6}
              fill={placeFill(place)}
              fillOpacity={place.sheltered ? 0.5 : 0.34}
              stroke={selected ? 'var(--foreground)' : 'transparent'}
              strokeWidth={2 * u}
              className="cursor-pointer transition-[fill-opacity]"
              onClick={() => {
                if (!suppressClick()) onSelectPlace(place.id)
              }}
            />
            {place.sheltered && place.kind !== 'transit' && (
              <rect
                x={place.x}
                y={place.y}
                width={place.w}
                height={place.h}
                rx={6}
                fill="url(#arcade)"
                opacity={0.5}
                pointerEvents="none"
              />
            )}
          </g>
        )
      })}

      {/* Elevated BRT alignment. */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={BRT_LINE.d} stroke="var(--card)" strokeWidth={9} opacity={0.85} />
        <path
          d={BRT_LINE.d}
          stroke="var(--coverage-transit)"
          strokeWidth={5}
          strokeOpacity={route ? 0.35 : 0.7}
          strokeDasharray="26 14"
        />
      </g>

      {/* The covered network, so the city reads as a shade graph at rest. */}
      {showCoveredNetwork && (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {coveredEdges.map((edge, i) => (
            <path
              key={`cov${i}`}
              d={pathFor(edge.a, edge.b, edge.via)}
              stroke={COVERAGE_META[edge.coverage].stroke}
              strokeWidth={route ? 4 : 6}
              strokeOpacity={route ? 0.25 : 0.55}
            />
          ))}
        </g>
      )}

      {rainMode && (
        <>
          <rect x={-1600} y={-1600} width={CITY.w + 3200} height={CITY.h + 3200} fill="var(--rain)" opacity={0.09} />
          <rect x={-1600} y={-1600} width={CITY.w + 3200} height={CITY.h + 3200} fill="url(#rain)" />
        </>
      )}

      {route && (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path
            d={route.steps.map((s) => s.d).join(' ')}
            stroke="var(--card)"
            strokeWidth={16 * u}
            strokeOpacity={0.92}
          />
          {route.steps.map((step) => {
            const dim = activeStepId !== null && activeStepId !== step.id
            const meta = COVERAGE_META[step.coverage]
            return (
              <path
                key={step.id}
                d={step.d}
                stroke={meta.stroke}
                strokeWidth={(activeStepId === step.id ? 10 : 7) * u}
                strokeOpacity={dim ? 0.22 : 1}
                strokeDasharray={meta.covered ? undefined : `${2 * u} ${9 * u}`}
                className="transition-all duration-300"
              />
            )
          })}
        </g>
      )}

      {/* Road names appear once the view is tight enough to read them. */}
      {zoom > 1.5 && (
        <g pointerEvents="none" fill="var(--map-label)" opacity={0.75}>
          {ROADS.filter((road) => road.labelAt).map((road) => (
            <text
              key={`rl${road.id}`}
              x={road.labelAt![0]}
              y={road.labelAt![1]}
              fontSize={9.5 * u}
              className="font-sans"
            >
              {road.name}
            </text>
          ))}
        </g>
      )}

      {/* Place labels, thinned out as you zoom away. */}
      <g pointerEvents="none">
        {PLACES.filter((place) => zoom >= (place.labelFrom ?? 1)).map((place) => (
          <PlaceLabel key={`l${place.id}`} place={place} u={u} />
        ))}
      </g>

      {WATER.filter((w) => w.labelAt && zoom > 1.2).map((body) => (
        <text
          key={`wl${body.id}`}
          x={body.labelAt![0]}
          y={body.labelAt![1]}
          fontSize={10 * u}
          textAnchor="middle"
          fill="var(--coverage-bridge-ink)"
          opacity={0.7}
          pointerEvents="none"
        >
          {body.name}
        </text>
      ))}

      {destination && (
        <Marker
          point={NODES[destination.node]}
          u={u}
          fill="var(--destructive)"
          shape="square"
          label={`Destination: ${destination.name}`}
        />
      )}
      {origin && (
        <Marker
          point={NODES[origin.node]}
          u={u}
          fill="var(--coverage-arcade)"
          shape="dot"
          label={`Origin: ${origin.name}`}
        />
      )}
    </svg>
  )
}

function pathFor(a: string, b: string, via?: Point[]) {
  const points = [NODES[a], ...(via ?? []), NODES[b]]
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ')
}

function PlaceLabel({ place, u }: { place: Place; u: number }) {
  const cx = place.x + place.w / 2
  const cy = place.y + place.h / 2
  const transit = place.kind === 'transit'
  return (
    <g>
      <text
        x={cx}
        y={transit ? place.y - 9 * u : cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={(transit ? 9.5 : 11) * u}
        fontWeight={600}
        fill="var(--foreground)"
        stroke="var(--background)"
        strokeWidth={3.2 * u}
        paintOrder="stroke"
        className="font-sans"
      >
        {place.short ?? place.name}
      </text>
    </g>
  )
}

function Marker({
  point,
  u,
  fill,
  shape,
  label,
}: {
  point: Point
  u: number
  fill: string
  shape: 'dot' | 'square'
  label: string
}) {
  const r = 9 * u
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
