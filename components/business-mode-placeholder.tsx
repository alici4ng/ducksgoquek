import { Lightbulb } from 'lucide-react'

/**
 * Reserved slot where the business / monetization breakdown used to live.
 * Deliberately inert: no toggle, no state, nothing to click — it exists only
 * to hold the position in the sheet until that panel is rebuilt.
 */
export function BusinessModePlaceholder() {
  return (
    <div className="mx-4 mt-3 flex shrink-0 items-center gap-2 rounded-2xl border border-dashed border-border bg-background px-3 py-2.5">
      <Lightbulb className="size-3.5 shrink-0 text-muted-foreground/70" />
      <span className="min-w-0 flex-1 truncate text-[0.72rem] font-medium tracking-wide text-muted-foreground uppercase">
        Business &amp; monetization
      </span>
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 font-mono text-[0.6rem] tracking-wide text-muted-foreground uppercase">
        Soon
      </span>
    </div>
  )
}
