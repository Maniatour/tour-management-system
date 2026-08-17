'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Maximize2, Minimize2, Star, Trophy } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { cn } from '@/lib/utils'
import type {
  GoogleReviewStaffMonthBy,
  GoogleReviewStaffMonthlyCell,
  GoogleReviewStaffMonthlyStat,
} from '@/types/googleBusiness'

type Props = {
  locale: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

type RankedRow = {
  rank: number
  staffEmail: string
  staffName: string
  cell: GoogleReviewStaffMonthlyCell | null
}

const MONTH_LABELS_KO = [
  '1월',
  '2월',
  '3월',
  '4월',
  '5월',
  '6월',
  '7월',
  '8월',
  '9월',
  '10월',
  '11월',
  '12월',
]

const MONTH_LABELS_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const EMPTY_CELL: GoogleReviewStaffMonthlyCell = {
  month: 0,
  reviewCount: 0,
  avgRating: null,
  fiveStarCount: 0,
  fourStarCount: 0,
  threeStarCount: 0,
  twoStarCount: 0,
  oneStarCount: 0,
  totalTourGuests: 0,
  reservationGroupCount: 0,
  guestReviewRatePercent: null,
  groupReviewRatePercent: null,
}

function compareRankRows(
  a: { staffName: string; cell: GoogleReviewStaffMonthlyCell | null },
  b: { staffName: string; cell: GoogleReviewStaffMonthlyCell | null }
): number {
  const aRating = a.cell?.avgRating ?? -1
  const bRating = b.cell?.avgRating ?? -1
  if (bRating !== aRating) return bRating - aRating

  const aCount = a.cell?.reviewCount ?? 0
  const bCount = b.cell?.reviewCount ?? 0
  if (bCount !== aCount) return bCount - aCount

  const aFive = a.cell?.fiveStarCount ?? 0
  const bFive = b.cell?.fiveStarCount ?? 0
  if (bFive !== aFive) return bFive - aFive

  return a.staffName.localeCompare(b.staffName, 'ko')
}

function formatPercent(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${value.toFixed(0)}%`
}

function formatRateDetail(
  reviews: number,
  denominator: number,
  percent: number | null
): string {
  if (denominator <= 0) return '—'
  return `${reviews}/${denominator} ${formatPercent(percent)}`
}

function RankBadge({ rank, large }: { rank: number; large?: boolean }) {
  const size = large ? 'h-9 w-9 text-sm' : 'h-7 w-7 text-xs'
  if (rank === 1) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full bg-amber-100 font-bold text-amber-700',
          size
        )}
      >
        1
      </span>
    )
  }
  if (rank === 2) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full bg-slate-200 font-bold text-slate-700',
          size
        )}
      >
        2
      </span>
    )
  }
  if (rank === 3) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full bg-orange-100 font-bold text-orange-800',
          size
        )}
      >
        3
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-semibold tabular-nums text-muted-foreground',
        size
      )}
    >
      {rank}
    </span>
  )
}

export default function ScheduleDisplayReviewStatusModal({
  locale,
  open,
  onOpenChange,
}: Props) {
  const isKo = locale === 'ko'
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const [year, setYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [monthBy, setMonthBy] = useState<GoogleReviewStaffMonthBy>('review_date')
  const [loading, setLoading] = useState(false)
  const [monthlyStats, setMonthlyStats] = useState<GoogleReviewStaffMonthlyStat[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const monthLabels = isKo ? MONTH_LABELS_KO : MONTH_LABELS_EN

  const exitBrowserFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return
    if (!document.fullscreenElement) return
    try {
      await document.exitFullscreen()
    } catch {
      // ignore — CSS fullscreen still applies
    }
  }, [])

  const enterBrowserFullscreen = useCallback(async () => {
    const el = contentRef.current
    if (!el || typeof el.requestFullscreen !== 'function') return
    try {
      await el.requestFullscreen()
    } catch {
      // CSS fullscreen still applies without native API
    }
  }, [])

  const setFullscreen = useCallback(
    async (next: boolean) => {
      setIsFullscreen(next)
      if (next) {
        await enterBrowserFullscreen()
      } else {
        await exitBrowserFullscreen()
      }
    },
    [enterBrowserFullscreen, exitBrowserFullscreen]
  )

  useEffect(() => {
    if (!open) {
      setIsFullscreen(false)
      void exitBrowserFullscreen()
    }
  }, [open, exitBrowserFullscreen])

  const loadStats = useCallback(async () => {
    if (!open) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetchApiWithAuth(
        `/api/admin/google-business/reviews/staff-stats?view=monthly&year=${year}&monthBy=${monthBy}`
      )
      const data = (await res.json()) as {
        ok?: boolean
        monthlyStats?: GoogleReviewStaffMonthlyStat[]
        error?: string
      }
      if (!res.ok || !data.ok) {
        setMonthlyStats([])
        setError(data.error || (isKo ? '리뷰 현황을 불러오지 못했습니다.' : 'Failed to load review status.'))
        return
      }
      setMonthlyStats(data.monthlyStats ?? [])
    } catch (err) {
      console.error('[ScheduleDisplayReviewStatusModal]', err)
      setMonthlyStats([])
      setError(isKo ? '리뷰 현황을 불러오지 못했습니다.' : 'Failed to load review status.')
    } finally {
      setLoading(false)
    }
  }, [open, year, monthBy, isKo])

  useEffect(() => {
    if (!open) return
    void loadStats()
  }, [open, loadStats])

  useEffect(() => {
    if (!open) return
    setYear(currentYear)
    setSelectedMonth(currentMonth)
    setMonthBy('review_date')
  }, [open, currentYear, currentMonth])

  const rankedRows = useMemo((): RankedRow[] => {
    const active = monthlyStats.filter((row) => row.staffIsActive)
    const prepared = active.map((row) => {
      const cell = row.months.find((m) => m.month === selectedMonth) ?? null
      return {
        staffEmail: row.staffEmail,
        staffName: row.staffName,
        cell,
      }
    })

    prepared.sort(compareRankRows)

    return prepared.map((row, index) => ({
      ...row,
      rank: index + 1,
    }))
  }, [monthlyStats, selectedMonth])

  const availableMonths = useMemo(() => {
    const months: number[] = []
    for (let m = 12; m >= 1; m -= 1) {
      if (year === currentYear && m > currentMonth) continue
      months.push(m)
    }
    return months
  }, [year, currentYear, currentMonth])

  useEffect(() => {
    if (!availableMonths.includes(selectedMonth) && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[0])
    }
  }, [availableMonths, selectedMonth])

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setIsFullscreen(false)
      void exitBrowserFullscreen()
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        ref={contentRef}
        className={cn(
          'flex flex-col gap-0 overflow-hidden bg-background p-0',
          isFullscreen
            ? 'fixed inset-0 left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 shadow-none data-[state=open]:zoom-in-100'
            : 'max-h-[92vh] w-[min(96vw,64rem)] max-w-none'
        )}
      >
        <DialogHeader
          className={cn(
            'shrink-0 border-b border-border/60 text-left',
            isFullscreen ? 'px-6 py-5 sm:px-8' : 'px-5 py-4 sm:px-6'
          )}
        >
          <div className="flex items-start justify-between gap-3 pr-10">
            <div className="min-w-0 space-y-1.5">
              <DialogTitle
                className={cn(
                  'flex items-center gap-2 font-semibold',
                  isFullscreen ? 'text-2xl md:text-3xl' : 'text-lg'
                )}
              >
                <Trophy
                  className={cn(
                    'shrink-0 text-amber-500',
                    isFullscreen ? 'h-7 w-7' : 'h-5 w-5'
                  )}
                  aria-hidden
                />
                {isKo ? '리뷰 현황' : 'Review status'}
                {isFullscreen ? (
                  <span className="ml-1 text-base font-medium text-muted-foreground md:text-lg">
                    · {year}
                    {isKo ? '년' : ''} {monthLabels[selectedMonth - 1]}
                  </span>
                ) : null}
              </DialogTitle>
              {!isFullscreen ? (
                <DialogDescription>
                  {isKo
                    ? `활성 가이드·어시스턴트의 월별 리뷰 점수 순위입니다. ${
                        monthBy === 'review_date' ? '등록일(고객이 리뷰를 남긴 날)' : '투어 출발일'
                      } 기준이며, 평균 별점이 높은 순으로 표시됩니다.`
                    : `Monthly review ranking for active guides and assistants by ${
                        monthBy === 'review_date' ? 'review date' : 'tour date'
                      }, sorted by average rating.`}
                </DialogDescription>
              ) : (
                <DialogDescription className="text-base text-muted-foreground">
                  {isKo
                    ? '인원별 리뷰율 = 리뷰 ÷ 투어 총인원 · 예약건별 리뷰율 = 리뷰 ÷ 예약 건수'
                    : 'By guests = reviews ÷ tour guests · By bookings = reviews ÷ reservation groups'}
                </DialogDescription>
              )}
            </div>

            <button
              type="button"
              onClick={() => void setFullscreen(!isFullscreen)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-xl border border-border/60 bg-muted/40 font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isFullscreen ? 'h-11 px-4 text-sm' : 'h-9 px-3 text-xs'
              )}
              aria-pressed={isFullscreen}
              title={
                isFullscreen
                  ? isKo
                    ? '전체 화면 종료'
                    : 'Exit fullscreen'
                  : isKo
                    ? '전체 화면 보기'
                    : 'Fullscreen'
              }
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-4 w-4" aria-hidden />
                  {isKo ? '축소' : 'Exit'}
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4" aria-hidden />
                  {isKo ? '전체 화면' : 'Fullscreen'}
                </>
              )}
            </button>
          </div>
        </DialogHeader>

        <div
          className={cn(
            'shrink-0 space-y-3 border-b border-border/40',
            isFullscreen ? 'px-6 py-4 sm:px-8' : 'px-5 py-3 sm:px-6'
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={cn(
                'font-medium text-muted-foreground',
                isFullscreen ? 'text-sm' : 'text-xs'
              )}
              htmlFor="review-status-year"
            >
              {isKo ? '연도' : 'Year'}
            </label>
            <select
              id="review-status-year"
              value={year}
              onChange={(e) => setYear(Number.parseInt(e.target.value, 10))}
              className={cn(
                'rounded-lg border border-border bg-background font-medium',
                isFullscreen ? 'h-11 px-3 text-base' : 'h-9 px-2.5 text-sm'
              )}
            >
              {Array.from({ length: 4 }, (_, i) => currentYear - i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <span
              className={cn(
                'text-muted-foreground',
                isFullscreen ? 'text-sm' : 'text-xs'
              )}
            >
              {isKo
                ? `활성 ${rankedRows.length}명`
                : `${rankedRows.length} active`}
            </span>
            <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => setMonthBy('review_date')}
                className={cn(
                  'rounded-md font-medium transition-colors',
                  isFullscreen ? 'px-3 py-2 text-sm' : 'px-3 py-1.5 text-xs',
                  monthBy === 'review_date'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {isKo ? '월별·등록일' : 'Monthly · posted'}
              </button>
              <button
                type="button"
                onClick={() => setMonthBy('tour_date')}
                className={cn(
                  'rounded-md font-medium transition-colors',
                  isFullscreen ? 'px-3 py-2 text-sm' : 'px-3 py-1.5 text-xs',
                  monthBy === 'tour_date'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {isKo ? '월별·투어일' : 'Monthly · tour'}
              </button>
            </div>
          </div>

          <div
            className="flex flex-wrap gap-1.5"
            role="tablist"
            aria-label={isKo ? '월 선택' : 'Select month'}
          >
            {availableMonths.map((month) => {
              const selected = selectedMonth === month
              return (
                <button
                  key={month}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setSelectedMonth(month)}
                  className={cn(
                    'rounded-full font-medium transition-colors',
                    isFullscreen ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs',
                    selected
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'border border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {monthLabels[month - 1]}
                </button>
              )
            })}
          </div>
        </div>

        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto',
            isFullscreen ? 'px-6 py-5 sm:px-8' : 'px-5 py-4 sm:px-6'
          )}
        >
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <p className="text-sm text-destructive">{error}</p>
              <button
                type="button"
                onClick={() => void loadStats()}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                {isKo ? '다시 시도' : 'Retry'}
              </button>
            </div>
          ) : rankedRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {isKo
                ? '활성 직원의 리뷰 현황이 없습니다.'
                : 'No review status for active staff.'}
            </p>
          ) : (
            <>
              {!isFullscreen ? (
                <div className="mb-3 hidden text-xs text-muted-foreground sm:block">
                  {isKo
                    ? `${year}년 ${monthLabels[selectedMonth - 1]} · ${
                        monthBy === 'review_date' ? '등록일' : '투어일'
                      } 기준 · 평균 별점 → 리뷰 수 → 5점 순 · 인원별 = 리뷰÷총인원 · 예약건별 = 리뷰÷예약건수`
                    : `${monthLabels[selectedMonth - 1]} ${year} · by ${
                        monthBy === 'review_date' ? 'review date' : 'tour date'
                      } · avg rating → reviews → 5★ · by guests = reviews÷guests · by bookings = reviews÷groups`}
                </div>
              ) : null}

              {/* Mobile cards — hide in board/fullscreen mode (TV is landscape) */}
              <ul className={cn('space-y-2', isFullscreen ? 'hidden' : 'sm:hidden')}>
                {rankedRows.map((row) => {
                  const cell = row.cell ?? { ...EMPTY_CELL, month: selectedMonth }
                  return (
                    <li
                      key={row.staffEmail}
                      className="rounded-xl border border-border/60 bg-card p-3 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <RankBadge rank={row.rank} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate font-semibold text-foreground">{row.staffName}</p>
                            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-amber-600">
                              <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
                              {cell.avgRating?.toFixed(2) ?? '—'}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>
                              {isKo ? '리뷰' : 'Reviews'}{' '}
                              <span className="font-medium tabular-nums text-foreground">
                                {cell.reviewCount}
                              </span>
                            </span>
                            <span>
                              5★{' '}
                              <span className="font-medium tabular-nums text-foreground">
                                {cell.fiveStarCount}
                              </span>
                            </span>
                            <span
                              title={
                                isKo
                                  ? '리뷰 수 ÷ 투어 총인원'
                                  : 'Reviews ÷ total tour guests'
                              }
                            >
                              {isKo ? '인원별' : 'By guests'}{' '}
                              <span className="font-medium tabular-nums text-foreground">
                                {formatPercent(cell.guestReviewRatePercent)}
                              </span>
                            </span>
                            <span
                              title={
                                isKo
                                  ? '리뷰 수 ÷ 예약 건수'
                                  : 'Reviews ÷ reservation groups'
                              }
                            >
                              {isKo ? '예약건별' : 'By bookings'}{' '}
                              <span className="font-medium tabular-nums text-foreground">
                                {formatPercent(cell.groupReviewRatePercent)}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>

              {/* Desktop / board table */}
              <div className={cn(isFullscreen ? 'block' : 'hidden overflow-x-auto sm:block')}>
                <table
                  className={cn(
                    'min-w-full',
                    isFullscreen ? 'w-full text-base md:text-lg' : 'text-sm'
                  )}
                >
                  <thead>
                    <tr className="border-b border-border/60 text-left text-muted-foreground">
                      <th className={cn('font-medium', isFullscreen ? 'py-3 pr-4' : 'py-2 pr-3')}>
                        {isKo ? '순위' : 'Rank'}
                      </th>
                      <th className={cn('font-medium', isFullscreen ? 'py-3 pr-5' : 'py-2 pr-4')}>
                        {isKo ? '가이드' : 'Guide'}
                      </th>
                      <th className={cn('font-medium', isFullscreen ? 'py-3 pr-5' : 'py-2 pr-4')}>
                        {isKo ? '평균' : 'Avg'}
                      </th>
                      <th className={cn('font-medium', isFullscreen ? 'py-3 pr-5' : 'py-2 pr-4')}>
                        {isKo ? '리뷰 수' : 'Reviews'}
                      </th>
                      <th
                        className={cn(
                          'text-center font-medium',
                          isFullscreen ? 'px-3 py-3' : 'px-2 py-2'
                        )}
                      >
                        5★
                      </th>
                      <th
                        className={cn(
                          'text-center font-medium',
                          isFullscreen ? 'px-3 py-3' : 'px-2 py-2'
                        )}
                      >
                        4★
                      </th>
                      <th
                        className={cn(
                          'text-center font-medium',
                          isFullscreen ? 'px-3 py-3' : 'px-2 py-2'
                        )}
                      >
                        3★
                      </th>
                      <th
                        className={cn(
                          'text-center font-medium',
                          isFullscreen ? 'px-3 py-3' : 'px-2 py-2'
                        )}
                      >
                        2★
                      </th>
                      <th
                        className={cn(
                          'text-center font-medium',
                          isFullscreen ? 'px-3 py-3' : 'px-2 py-2'
                        )}
                      >
                        1★
                      </th>
                      <th
                        className={cn(
                          'font-medium',
                          isFullscreen ? 'py-3 pl-4 pr-3' : 'py-2 pl-3 pr-2'
                        )}
                        title={
                          isKo
                            ? '리뷰 수 ÷ 투어 총인원'
                            : 'Reviews ÷ total tour guests'
                        }
                      >
                        {isKo ? '인원별 리뷰율' : 'By guests'}
                      </th>
                      <th
                        className={cn('pl-2 font-medium', isFullscreen ? 'py-3' : 'py-2')}
                        title={
                          isKo
                            ? '리뷰 수 ÷ 예약 건수'
                            : 'Reviews ÷ reservation groups'
                        }
                      >
                        {isKo ? '예약건별 리뷰율' : 'By bookings'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedRows.map((row) => {
                      const cell = row.cell ?? { ...EMPTY_CELL, month: selectedMonth }
                      const topThree = row.rank <= 3
                      return (
                        <tr
                          key={row.staffEmail}
                          className={cn(
                            'border-b border-border/40',
                            topThree && 'bg-amber-50/40'
                          )}
                        >
                          <td className={cn(isFullscreen ? 'py-3.5 pr-4' : 'py-2.5 pr-3')}>
                            <RankBadge rank={row.rank} large={isFullscreen} />
                          </td>
                          <td
                            className={cn(
                              'font-medium whitespace-nowrap',
                              isFullscreen ? 'py-3.5 pr-5 text-lg md:text-xl' : 'py-2.5 pr-4'
                            )}
                          >
                            {row.staffName}
                          </td>
                          <td className={cn(isFullscreen ? 'py-3.5 pr-5' : 'py-2.5 pr-4')}>
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 font-semibold tabular-nums text-amber-600',
                                isFullscreen && 'text-lg'
                              )}
                            >
                              <Star
                                className={cn(
                                  'fill-current',
                                  isFullscreen ? 'h-4 w-4' : 'h-3.5 w-3.5'
                                )}
                                aria-hidden
                              />
                              {cell.avgRating?.toFixed(2) ?? '—'}
                            </span>
                          </td>
                          <td
                            className={cn(
                              'tabular-nums',
                              isFullscreen ? 'py-3.5 pr-5 font-medium' : 'py-2.5 pr-4'
                            )}
                          >
                            {cell.reviewCount}
                          </td>
                          <td
                            className={cn(
                              'text-center tabular-nums text-emerald-700',
                              isFullscreen ? 'px-3 py-3.5' : 'px-2 py-2.5'
                            )}
                          >
                            {cell.fiveStarCount}
                          </td>
                          <td
                            className={cn(
                              'text-center tabular-nums',
                              isFullscreen ? 'px-3 py-3.5' : 'px-2 py-2.5'
                            )}
                          >
                            {cell.fourStarCount}
                          </td>
                          <td
                            className={cn(
                              'text-center tabular-nums text-amber-700',
                              isFullscreen ? 'px-3 py-3.5' : 'px-2 py-2.5'
                            )}
                          >
                            {cell.threeStarCount}
                          </td>
                          <td
                            className={cn(
                              'text-center tabular-nums text-orange-700',
                              isFullscreen ? 'px-3 py-3.5' : 'px-2 py-2.5'
                            )}
                          >
                            {cell.twoStarCount}
                          </td>
                          <td
                            className={cn(
                              'text-center tabular-nums text-red-600',
                              isFullscreen ? 'px-3 py-3.5' : 'px-2 py-2.5'
                            )}
                          >
                            {cell.oneStarCount}
                          </td>
                          <td
                            className={cn(
                              'tabular-nums text-muted-foreground',
                              isFullscreen
                                ? 'py-3.5 pl-4 pr-3 font-semibold text-foreground'
                                : 'py-2.5 pl-3 pr-2'
                            )}
                            title={formatRateDetail(
                              cell.reviewCount,
                              cell.totalTourGuests,
                              cell.guestReviewRatePercent
                            )}
                          >
                            {formatPercent(cell.guestReviewRatePercent)}
                          </td>
                          <td
                            className={cn(
                              'pl-2 tabular-nums text-muted-foreground',
                              isFullscreen
                                ? 'py-3.5 font-semibold text-foreground'
                                : 'py-2.5'
                            )}
                            title={formatRateDetail(
                              cell.reviewCount,
                              cell.reservationGroupCount,
                              cell.groupReviewRatePercent
                            )}
                          >
                            {formatPercent(cell.groupReviewRatePercent)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
