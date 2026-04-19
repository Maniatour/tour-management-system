'use client'

import { Landmark } from 'lucide-react'

/** reconciliation_matches에 연결된 지출·입금 행 표시 */
export function StatementReconciledBadge({
  matched,
  className = ''
}: {
  matched: boolean
  className?: string
}) {
  if (!matched) return null
  return (
    <span
      className={`inline-flex items-center justify-center text-emerald-700 ${className}`}
      title="명세 대조에 연결됨"
      aria-label="명세 대조에 연결됨"
    >
      <Landmark className="h-4 w-4 shrink-0" aria-hidden />
    </span>
  )
}
