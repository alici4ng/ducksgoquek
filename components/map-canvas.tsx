import {
  BLOCKS,
  COVERAGE_META,
  DESTINATION,
  MAP_H,
  MAP_W,
  ORIGIN,
  ROUTE,
} from '@/lib/shade-map'
import { cn } from '@/lib/utils'

const KIND_FILL: Record<string, string> = {
  block: 'var(--map-block)',
  park: 'var(--map-park)',
  water: 'var(--map-water)',
  covered: 'var(--map-block)',
}

/** Sun sits high in the north-west, so shade falls to the south-east. */
const SHADE_DX = 11
const SHADE_DY = 14

type MapCanvasProps = {
  showRoute: boolean
  activeStepId: string | null
  rainMode: boolean
}

export function MapCanvas({
  showRoute,
  activeStepId,
  rainMode,
}: MapCanvasProps) {
  return (
    <svg
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      preserveAspectRatio="xMidYMin slice"
      className="size-full"
      role="img"
      aria-label={
        showRoute
          ? 'City map showing a walking route made of covered and exposed segments'
          : 'City map centred on your current location'
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
        <pattern
          id="arcade"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="6"
            stroke="var(--coverage-arcade)"
            strokeWidth="1.4"
            strokeOpacity="0.45"
          />
        </pattern>
      </defs>

      <rect width={MAP_W} height={MAP_H} fill="var(--background)" />

      {/* Cast shade — the layer the whole product is about. */}
      <g fill="var(--map-shadow)" opacity={rainMode ? 0.04 : 0.2}>
        {BLOCKS.map((b, i) =>
          b.kind === 'water' ? null : (
            <rect
              key={`s${i}`}
              x={b.x + SHADE_DX}
              y={b.y + SHADE_DY}
              width={b.w}
              height={b.h}
              rx={1.5}
            />
          ),
        )}
      </g>

      {BLOCKS.map((b, i) => (
        <g key={`b${i}`}>
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx={1.5}
            fill={KIND_FILL[b.kind]}
          />
          {b.kind === 'covered' && (
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx={1.5}
              fill="url(#arcade)"
            />
          )}
        </g>
      ))}

      {rainMode && (
        <>
          <rect
            width={MAP_W}
            height={MAP_H}
            fill="var(--rain)"
            opacity={0.09}
          />
          <rect width={MAP_W} height={MAP_H} fill="url(#rain)" />
        </>
      )}

      {showRoute && (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* Halo so the route reads over any block colour. */}
          <path
            d={ROUTE.map((s) => s.d).join(' ')}
            stroke="var(--card)"
            strokeWidth="11"
            strokeOpacity="0.9"
          />
          {ROUTE.map((step) => {
            const dim = activeStepId !== null && activeStepId !== step.id
            const meta = COVERAGE_META[step.coverage]
            return (
              <path
                key={step.id}
                d={step.d}
                stroke={meta.stroke}
                strokeWidth={activeStepId === step.id ? 7 : 5}
                strokeOpacity={dim ? 0.22 : 1}
                strokeDasharray={meta.covered ? undefined : '1 7'}
                className="transition-all duration-300"
              />
            )
          })}
        </g>
      )}

      {/* Destination — red square */}
      {showRoute && (
        <g className="animate-in fade-in duration-500">
          <rect
            x={DESTINATION.x - 7}
            y={DESTINATION.y - 7}
            width={14}
            height={14}
            rx={2}
            fill="var(--card)"
          />
          <rect
            x={DESTINATION.x - 4.5}
            y={DESTINATION.y - 4.5}
            width={9}
            height={9}
            rx={1}
            fill="var(--destructive)"
          />
        </g>
      )}

      {/* Origin — green dot */}
      <g>
        <circle
          cx={ORIGIN.x}
          cy={ORIGIN.y}
          r={13}
          fill="var(--coverage-arcade)"
          opacity={0.16}
        />
        <circle cx={ORIGIN.x} cy={ORIGIN.y} r={7.5} fill="var(--card)" />
        <circle
          cx={ORIGIN.x}
          cy={ORIGIN.y}
          r={4.5}
          fill="var(--coverage-arcade)"
        />
      </g>
    </svg>
  )
}

export function MapSurface({
  className,
  ...props
}: MapCanvasProps & { className?: string }) {
  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)}>
      <MapCanvas {...props} />
    </div>
  )
}
