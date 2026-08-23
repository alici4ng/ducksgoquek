'use client'

import { useEffect, useState } from 'react'

import { MapSurface } from '@/components/map-canvas'
import { MapHud, StatusBar } from '@/components/map-hud'
import { PlanSheet } from '@/components/plan-sheet'
import { RouteSheet } from '@/components/route-sheet'
import { SunscreenSheet } from '@/components/sunscreen-sheet'

type Phase = 'plan' | 'route'

export function ShadeApp() {
  const [phase, setPhase] = useState<Phase>('plan')
  const [computing, setComputing] = useState(false)
  const [rainMode, setRainMode] = useState(false)
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const [reminderOpen, setReminderOpen] = useState(false)

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
    const timer = setTimeout(() => setReminderOpen(true), 1300)
    return () => clearTimeout(timer)
  }, [phase])

  return (
    <div className="relative size-full overflow-hidden bg-background">
      <MapSurface
        showRoute={phase === 'route'}
        activeStepId={activeStepId}
        rainMode={rainMode}
      />

      <StatusBar />
      <MapHud
        rainMode={rainMode}
        onRainModeChange={setRainMode}
        onUvPress={() => setReminderOpen(true)}
      />

      {phase === 'plan' ? (
        <PlanSheet
          computing={computing}
          onSubmit={() => setComputing(true)}
        />
      ) : (
        <RouteSheet
          activeStepId={activeStepId}
          onActiveStepChange={setActiveStepId}
          onBack={() => {
            setActiveStepId(null)
            setPhase('plan')
          }}
        />
      )}

      <SunscreenSheet open={reminderOpen} onOpenChange={setReminderOpen} />
    </div>
  )
}
