'use client'

/** 인증 확인 중에도 관리자 레이아웃 골격을 보여 체감 대기 시간을 줄인다. */
export default function AdminAuthLoadingShell() {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-border/60 bg-card lg:block">
          <div className="border-b border-border/60 px-4 py-5">
            <div className="h-6 w-32 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="space-y-2 p-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-muted/80" />
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b border-border/60 bg-card px-4 sm:px-6">
            <div className="h-8 w-40 animate-pulse rounded-lg bg-muted lg:hidden" />
            <div className="hidden h-8 w-56 animate-pulse rounded-lg bg-muted lg:block" />
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
              <div className="hidden h-8 w-24 animate-pulse rounded-lg bg-muted sm:block" />
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl space-y-6">
              <div className="h-9 w-48 animate-pulse rounded-lg bg-muted" />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-32 animate-pulse rounded-2xl border border-border/60 bg-card"
                  />
                ))}
              </div>
              <div className="h-64 animate-pulse rounded-2xl border border-border/60 bg-card" />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
