'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, Headphones, Loader2, X, XCircle } from 'lucide-react'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import {
  fetchToursNarrationHistory,
  formatNarrationDuration,
  narrationRoleLabel,
  type TourNarrationHistoryRow,
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
                  ? `${playedCount} of ${rows.length} tour(s) played narration`
                  : `${rows.length}개 투어 중 ${playedCount}개에서 나레이션을 재생했습니다`}
              </p>
              <div className="space-y-3">
                {rows.map((row) => (
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
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.played ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {row.played ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        {row.played
                          ? isEn
                            ? 'Played'
                            : '재생함'
                          : isEn
                            ? 'Not played'
                            : '미재생'}
                      </span>
                    </div>
                    <PlayList plays={row.plays} locale={locale} />
                  </section>
                ))}
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
