'use client'

import { Navigation, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SPONSOR } from '@/lib/sponsor'

/**
 * Product thumbnail drawn as flat geometry rather than a bitmap: at 52px the
 * bottle only needs to read as "a tube of sunscreen", and inline vectors stay
 * crisp without shipping an asset.
 */
function BottleThumb() {
  return (
    <svg
      viewBox="0 0 40 52"
      className="size-full"
      role="img"
      aria-label={`${SPONSOR.brand} ${SPONSOR.product} bottle`}
    >
      <rect x="15" y="3" width="10" height="7" rx="2" fill="var(--uv-moderate)" />
      <rect
        x="8"
        y="10"
        width="24"
        height="39"
        rx="6"
        fill="var(--coverage-foreground)"
      />
      <rect
        x="8"
        y="27"
        width="24"
        height="22"
        rx="6"
        fill="var(--uv-moderate)"
        opacity="0.9"
      />
      <rect
        x="13"
        y="16"
        width="14"
        height="2.5"
        rx="1.25"
        fill="var(--uv-moderate-ink)"
        opacity="0.55"
      />
      <rect
        x="13"
        y="21"
        width="9"
        height="2.5"
        rx="1.25"
        fill="var(--uv-moderate-ink)"
        opacity="0.35"
      />
    </svg>
  )
}

export function SponsorCard() {
  return (
    <section
      aria-labelledby="sponsor-heading"
      /* Deep ink surface so advertising is visually separable from the health
         advice above it, per the spec's "supply drop" framing. */
      className="mx-4 mt-4 shrink-0 overflow-hidden rounded-3xl bg-foreground text-background ring-1 ring-uv-moderate/35"
    >
      <div className="flex items-start gap-3 px-3.5 pt-3.5">
        <span className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-background/10 p-2 backdrop-blur-md">
          <BottleThumb />
        </span>

        <div className="flex min-w-0 flex-col gap-1">
          <h3
            id="sponsor-heading"
            className="flex items-center gap-1.5 text-[0.9rem] leading-tight font-semibold tracking-tight text-balance"
          >
            <ShieldCheck className="size-4 shrink-0 text-uv-moderate" />
            {SPONSOR.headline}
          </h3>
          <p className="text-[0.78rem] leading-relaxed text-background/70 text-pretty">
            {SPONSOR.offer}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 px-3.5 pt-3 pb-3">
        <Button
          size="lg"
          className="h-12 w-full rounded-2xl bg-uv-moderate text-[0.9rem] font-semibold text-foreground transition-transform hover:bg-uv-moderate/90 active:scale-[0.985]"
        >
          <Navigation data-icon="inline-start" />
          Claim voucher &amp; navigate
        </Button>

        <p className="flex items-center justify-between gap-2 text-[0.62rem] tracking-wide text-background/45 uppercase">
          <span className="truncate">{SPONSOR.disclosure}</span>
          <span className="shrink-0 font-mono tabular normal-case">
            +{SPONSOR.detourMeters}m detour
          </span>
        </p>
      </div>
    </section>
  )
}
