import { Loader2 } from 'lucide-react'
import {
  formatImportTourDayStatusLine,
  type ImportTourDayStatusSummary,
  type ImportTourDayTeamStatus,
} from '@/lib/importTourDayStatus'

function remainingTone(spotsLeft: number): string {
  if (spotsLeft <= 0) return 'border-rose-200 bg-rose-50 text-rose-800'
  if (spotsLeft <= 4) return 'border-amber-200 bg-amber-50 text-amber-900'
  return 'border-teal-200 bg-teal-50 text-teal-800'
}

function TourTeamBadge({
  team,
  size = 'sm',
}: {
  team: ImportTourDayTeamStatus
  size?: 'sm' | 'md'
}) {
  const pad = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border font-medium tabular-nums leading-snug ${pad} ${remainingTone(team.spotsLeft)}`}
      title={`${team.index}. ${team.staffLabel} ${team.assigned}/${team.max} · 잔여 ${team.spotsLeft}석`}
    >
      <span className="shrink-0 text-[10px] opacity-70">{team.index}.</span>
      <span className="ml-1 truncate">{team.staffLabel}</span>
      <span className="ml-1 shrink-0">
        {team.assigned}/{team.max}
      </span>
    </span>
  )
}

export function ImportTourDayStatusLine({
  status,
  loading = false,
  compact = true,
}: {
  status: ImportTourDayStatusSummary | null | undefined
  loading?: boolean
  compact?: boolean
}) {
  const size = compact ? 'sm' : 'md'
  const summaryPad = compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'

  if (loading && !status) {
    const spinner = (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />
        투어 현황
      </span>
    )
    if (!compact) {
      return <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">{spinner}</div>
    }
    return spinner
  }
  if (!status) {
    if (!compact) {
      return (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
          해당일 투어 현황을 확인할 수 없습니다.
        </div>
      )
    }
    return <span className="text-xs text-gray-400">—</span>
  }
  if (status.tourCount === 0) {
    const emptyBadge = (
      <span className={`inline-flex items-center rounded-full border border-gray-200 bg-gray-50 font-medium text-gray-500 ${summaryPad}`}>
        투어 없음
      </span>
    )
    if (!compact) {
      return <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-2.5">{emptyBadge}</div>
    }
    return emptyBadge
  }

  const line = formatImportTourDayStatusLine(status)
  const badges = (
    <div className="flex flex-wrap items-center gap-1.5" title={line}>
      <span className={`inline-flex items-center rounded-full border border-gray-200 bg-white font-medium text-gray-700 ${summaryPad}`}>
        {status.tourCount} 투어
      </span>
      <span className={`inline-flex items-center rounded-full border font-medium ${summaryPad} ${remainingTone(status.totalSpotsLeft)}`}>
        {status.totalSpotsLeft} 잔여좌석
      </span>
      {status.teams.map((team) => (
        <TourTeamBadge key={team.index} team={team} size={size} />
      ))}
    </div>
  )

  if (compact) return badges

  return <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3">{badges}</div>
}
