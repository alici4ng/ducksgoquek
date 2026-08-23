import { cn } from '@/lib/utils'

export function BottomSheet({
  className,
  children,
  elevated,
  ...props
}: React.ComponentProps<'section'> & { elevated?: boolean }) {
  return (
    <section
      className={cn(
        'absolute inset-x-0 bottom-0 z-30 rounded-t-4xl border-t border-border bg-card pb-6',
        'animate-in slide-in-from-bottom-16 duration-500 ease-out',
        elevated ? 'z-40 shadow-2xl' : 'shadow-xl',
        className,
      )}
      {...props}
    >
      <div className="flex justify-center pt-2.5 pb-1">
        <span
          aria-hidden
          className="h-1 w-10 rounded-full bg-muted-foreground/25"
        />
      </div>
      {children}
    </section>
  )
}
