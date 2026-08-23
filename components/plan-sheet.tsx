'use client'

import { ArrowUpDown, Umbrella } from 'lucide-react'
import { useState } from 'react'

import { BottomSheet } from '@/components/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { ENDPOINTS } from '@/lib/shade-map'

type PlanSheetProps = {
  computing: boolean
  onSubmit: () => void
}

export function PlanSheet({ computing, onSubmit }: PlanSheetProps) {
  const [origin, setOrigin] = useState(ENDPOINTS.origin)
  const [destination, setDestination] = useState(ENDPOINTS.destination)

  function swap() {
    setOrigin(destination)
    setDestination(origin)
  }

  return (
    <BottomSheet>
      <form
        className="flex flex-col gap-4 px-4 pt-3"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <h1 className="text-base font-semibold tracking-tight text-balance">
          Where to, in the shade?
        </h1>

        <div className="relative">
          <FieldGroup className="gap-2.5">
            <Field>
              <FieldLabel htmlFor="origin" className="sr-only">
                Origin
              </FieldLabel>
              <InputGroup className="h-12 rounded-2xl bg-background">
                <InputGroupAddon className="pl-3.5">
                  <span
                    aria-hidden
                    className="size-2.5 rounded-full bg-coverage-arcade ring-3 ring-coverage-arcade/20"
                  />
                </InputGroupAddon>
                <InputGroupInput
                  id="origin"
                  value={origin}
                  onChange={(event) => setOrigin(event.target.value)}
                  className="h-12 pr-12 text-[0.95rem]"
                  placeholder="Starting point"
                />
              </InputGroup>
            </Field>

            <Field>
              <FieldLabel htmlFor="destination" className="sr-only">
                Destination
              </FieldLabel>
              <InputGroup className="h-12 rounded-2xl bg-background">
                <InputGroupAddon className="pl-3.5">
                  <span
                    aria-hidden
                    className="size-2.5 rounded-[2px] bg-destructive ring-3 ring-destructive/20"
                  />
                </InputGroupAddon>
                <InputGroupInput
                  id="destination"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  className="h-12 pr-12 text-[0.95rem]"
                  placeholder="Destination"
                />
              </InputGroup>
            </Field>
          </FieldGroup>

          {/* Connector between the two markers */}
          <span
            aria-hidden
            className="absolute top-[38px] left-[22px] h-4 border-l border-dashed border-muted-foreground/40"
          />

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={swap}
            aria-label="Swap origin and destination"
            className="absolute top-1/2 right-2 size-9 -translate-y-1/2 rounded-full bg-card"
          >
            <ArrowUpDown />
          </Button>
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={computing}
          className="h-13 rounded-2xl bg-coverage-arcade-ink text-base text-coverage-foreground hover:bg-coverage-arcade-ink/90"
        >
          {computing ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Umbrella data-icon="inline-start" />
          )}
          {computing ? 'Reading shade map…' : 'Find covered route'}
        </Button>
      </form>
    </BottomSheet>
  )
}
