'use client'

import { HelpCircle } from 'lucide-react'

export default function ProductTourCourseCustomerHint({
  customerNameKo,
  customerNameEn,
}: {
  customerNameKo?: string | null
  customerNameEn?: string | null
}) {
  const ko = customerNameKo?.trim() || ''
  const en = customerNameEn?.trim() || ''
  if (!ko && !en) return null

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        className="peer inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="고객용 이름"
      >
        <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 hidden w-max max-w-[220px] -translate-x-1/2 rounded-lg border border-border bg-white px-2.5 py-1.5 text-left text-[11px] leading-snug text-foreground shadow-lg peer-hover:block peer-focus-visible:block"
      >
        {ko ? <span className="block">고객용: {ko}</span> : null}
        {en ? <span className="block">고객용(EN): {en}</span> : null}
      </span>
    </span>
  )
}
