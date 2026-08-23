'use client'

import { useRef, useState } from 'react'

import { cn } from '@/lib/utils'

/** Snap positions, as translateY fractions of the sheet's own height. */
const SNAPS = [0, 0.55, 0.88] as const

export function BottomSheet({
  className,
  children,
  elevated,
  ...props
}: React.ComponentProps<'section'> & { elevated?: boolean }) {
  const sheetRef = useRef<HTMLElement>(null)
  const [snap, setSnap] = useState(0)
  const [dragY, setDragY] = useState<number | null>(null)
  const drag = useRef<{ startY: number; startSnap: number; moved: boolean } | null>(null)

  function height() {
    return sheetRef.current?.offsetHeight ?? 1
  }

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { startY: e.clientY, startSnap: snap, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return
    const delta = e.clientY - drag.current.startY
    if (Math.abs(delta) > 4) drag.current.moved = true
    const base = SNAPS[drag.current.startSnap] * height()
    setDragY(Math.max(0, Math.min(height() * SNAPS[2], base + delta)))
  }

  function onPointerUp() {
    if (!drag.current) return
    if (!drag.current.moved) {
      // Tap on the handle toggles expanded <-> half.
      setSnap((s) => (s === 0 ? 1 : 0))
    } else {
      const y = dragY ?? SNAPS[drag.current.startSnap] * height()
      let best = 0
      let bestDist = Infinity
      SNAPS.forEach((s, i) => {
        const d = Math.abs(s * height() - y)
        if (d < bestDist) {
          bestDist = d
          best = i
        }
      })
      setSnap(best)
    }
    setDragY(null)
    drag.current = null
  }

  const translateY = dragY ?? SNAPS[snap] * height()

  return (
    <section
      ref={sheetRef}
      className={cn(
        'absolute inset-x-0 bottom-0 z-30 rounded-t-4xl border-t border-border bg-card pb-6',
        'animate-in slide-in-from-bottom-16 duration-500 ease-out',
        dragY === null && 'transition-transform duration-300 ease-out',
        elevated ? 'z-40 shadow-2xl' : 'shadow-xl',
        className,
      )}
      style={{ transform: `translateY(${translateY}px)` }}
      {...props}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label="Drag to resize the panel, or tap to collapse"
        className="flex w-full cursor-grab touch-none justify-center py-3 active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span aria-hidden className="h-1 w-10 rounded-full bg-muted-foreground/25" />
      </div>
      {children}
    </section>
  )
}
