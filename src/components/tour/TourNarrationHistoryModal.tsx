'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, Headphones, Loader2, MessageSquare, X, XCircle } from 'lucide-react'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import {
  fetchToursNarrationHistory,
  formatNarrationDuration,
  narrationRoleLabel,
  type TourNarrationHistoryRow,
  type TourNarrationSkipReport,
} from '@/lib/tourNarrationPlays'

function formatWhen(value: string, locale: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(locale === 'en' ? 'en-US' : 'ko-KR', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function PlayList({
  plays,
  locale,
}: {
  plays: TourNarrationHistoryRow['plays']
  locale: string
}) {
  const isEn = locale === 'en'
  if (plays.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        {isEn ? 'No narration was played.' : '재생된 나레이션이 없습니다.'}
      </p>
    )
  }
  return (
    <ul className="space-y-1.5">
      {plays.map((play) => (
        <li key={play.id} className="rounded-md bg-white px-3 py-2 text-sm ring-1 ring-border/60">
          <div className="font-medium text-gray-900">{play.material_title}</div>
          <div className="mt-0.5 text-xs text-gray-500">
            {play.played_by_name || play.played_by_email} · {narrationRoleLabel(play.played_as, locale)} ·{' '}
            {isEn ? `${play.play_count} time(s)` : `${play.play_count}회`} ·{' '}
            {formatNarrationDuration(play.play_seconds, locale)}
          </div>
          <div className="text-xs text-gray-400">{formatWhen(play.last_played_at, locale)}</div>
        </li>
      ))}
    </ul>
  )
}

function SkipReports({
  reports,
  locale,
}: {
  reports: TourNarrationSkipReport[]
  locale: string
}) {
  const isEn = locale === 'en'
  if (reports.length === 0) return null
  return (
    <ul className="mt-2 space-y-1.5">
      {reports.map((report, index) => (
        <li
          key={`${report.userEmail}-${index}`}
          className="rounded-md bg-amber-50 px-3 py-2 text-sm ring-1 ring-amber-200/80"
        >
          <div className="flex items-start gap-1.5 font-medium text-amber-950">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {report.explainedInPerson
              ? isEn
                ? 'Not played — explained without audio'
                : '재생 안 함 — 충분한 설명을 했습니다'
              : isEn
                ? 'Not played'
                : '나레이션 재생 안 함'}
          </div>
          <div className="mt-0.5 text-xs text-amber-900/80">
            {report.userName || report.userEmail}
            {report.reason ? ` · ${report.reason}` : ''}
          </div>
        </li>
      ))}
    </ul>
  )
}

function narrationStatus(row: TourNarrationHistoryRow): 'played' | 'explained' | 'reason' | 'missing' {
  if (row.played) return 'played'
  const reports = row.skipReports || []
  if (reports.some((report) => report.explainedInPerson)) return 'explained'
  if (reports.some((report) => report.reason)) return 'reason'
  return 'missing'
}

export default function TourNarrationHistoryModal({
  isOpen,
  onClose,
  locale = 'ko',
  tourId = null,
  startDate,
  endDate,
  goblinOnly = false,
  title,
  subtitle,
  extraActions,
}: {
  isOpen: boolean
  onClose: () => void
  locale?: string
  tourId?: string | null
  startDate?: string
  endDate?: string
  goblinOnly?: boolean
  title?: string
  subtitle?: string
  extraActions?: ReactNode
}) {
  const { operatorId } = useOperatorOptional()
  const isEn = locale === 'en'
  const [rangeStart, setRangeStart] = useState(startDate || '')
  const [rangeEnd, setRangeEnd] = useState(endDate || '')
  const [rows, setRows] = useState<TourNarrationHistoryRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setRangeStart(startDate || '')
      setRangeEnd(endDate || '')
    }
  }, [isOpen, startDate, endDate])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setLoading(true)
    void fetchToursNarrationHistory({
      tourId,
      startDate: tourId ? undefined : rangeStart || startDate,
      endDate: tourId ? undefined : rangeEnd || endDate,
      operatorId,
      goblinOnly,
      locale,
    })
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, tourId, rangeStart, rangeEnd, startDate, endDate, operatorId, goblinOnly, locale])

  const playedCount = useMemo(() => rows.filter((row) => row.played).length, [rows])
  const explainedCount = useMemo(
    () => rows.filter((row) => !row.played && narrationStatus(row) === 'explained').length,
    [rows],
  )
  const reasonCount = useMemo(
    () => rows.filter((row) => !row.played && narrationStatus(row) === 'reason').length,
    [rows],
  )
  const heading =
    title ||
    (tourId
      ? isEn
        ? 'Narration history'
        : '나레이션 재생 히스토리'
      : goblinOnly
        ? isEn
          ? 'Goblin tour narration'
          : '밤도깨비 나레이션 재생'
        : isEn
          ? 'Tour narration history'
          : '투어별 나레이션 히스토리')

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-narration-history-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id="tour-narration-history-title" className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Headphones className="h-5 w-5 text-gray-500" />
              {heading}
            </h2>
            {subtitle ? <p className="mt-1 text-sm text-gray-600">{subtitle}</p> : null}
            {!tourId ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <label className="text-gray-500">
                  {isEn ? 'From' : '시작'}
                  <input
                    type="date"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    className="ml-1.5 rounded-md border border-gray-200 px-2 py-1 text-gray-800"
                  />
                </label>
                <label className="text-gray-500">
                  {isEn ? 'To' : '종료'}
                  <input
                    type="date"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    className="ml-1.5 rounded-md border border-gray-200 px-2 py-1 text-gray-800"
                  />
                </label>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label={isEn ? 'Close' : '닫기'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEn ? 'Loading…' : '불러오는 중…'}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              {goblinOnly
                ? isEn
                  ? 'No goblin tours in this range.'
                  : '해당 기간에 밤도깨비 투어가 없습니다.'
                : isEn
                  ? 'No tours in this range.'
                  : '해당 기간에 투어가 없습니다.'}
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-gray-600">
                {isEn
                  ? `${playedCount} played · ${explainedCount} explained without audio · ${reasonCount} not played with reason · ${rows.length} total`
                  : `${rows.length}개 투어 중 재생 ${playedCount} · 설명으로 대체 ${explainedCount} · 사유 있음 ${reasonCount}`}
              </p>
              <div className="space-y-3">
                {rows.map((row) => {
                  const status = narrationStatus(row)
                  const badgeClass =
                    status === 'played'
                      ? 'bg-green-50 text-green-800'
                      : status === 'explained'
                        ? 'bg-emerald-50 text-emerald-800'
                        : status === 'reason'
                          ? 'bg-sky-50 text-sky-800'
                          : 'bg-amber-50 text-amber-800'
                  const badgeLabel =
                    status === 'played'
                      ? isEn
                        ? 'Played'
                        : '재생함'
                      : status === 'explained'
                        ? isEn
                          ? 'Explained without audio'
                          : '설명으로 대체'
                        : status === 'reason'
                          ? isEn
                            ? 'Not played · reason given'
                            : '미재생 · 사유 있음'
                          : isEn
                            ? 'Not played'
                            : '미재생'
                  return (
                  <section
                    key={row.tourId}
                    className="rounded-lg border border-border/70 bg-muted/20 p-3"
                  >
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">
                          {row.tourDate} · {row.productName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {isEn ? 'Guide' : '가이드'}: {row.guideName || '—'}
                          {row.assistantName
                            ? ` · ${isEn ? 'Assistant' : '어시'}: ${row.assistantName}`
                            : ''}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}
                      >
                        {status === 'missing' ? (
                          <XCircle className="h-3.5 w-3.5" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        {badgeLabel}
                      </span>
                    </div>
                    <PlayList plays={row.plays} locale={locale} />
                    <SkipReports reports={row.skipReports || []} locale={locale} />
                  </section>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
          {extraActions}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-900"
          >
            {isEn ? 'Close' : '닫기'}
          </button>
        </div>
      </div>
    </div>
  )
}
