'use client'

export function TodoPanelMountSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex min-h-[3.5rem] items-center gap-2 rounded border border-border/50 bg-muted/20 px-2 py-2 ${className}`}
      aria-hidden
    >
      <div className="h-4 w-4 shrink-0 animate-pulse rounded-full bg-muted" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted/80" />
      </div>
    </div>
  )
}
