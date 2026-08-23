import { ShadeApp } from '@/components/shade-app'

export default function Page() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted sm:p-8">
      <div className="relative h-svh w-full overflow-hidden bg-background sm:h-[844px] sm:max-h-[calc(100svh-4rem)] sm:w-[390px] sm:rounded-[2.75rem] sm:shadow-2xl sm:ring-8 sm:ring-foreground/90">
        <ShadeApp />
      </div>
    </main>
  )
}
