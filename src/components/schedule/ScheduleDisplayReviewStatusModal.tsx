'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Star, Trophy } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import type {
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

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
        1
      </span>
    )
  }
  if (rank === 2) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
        2
      </span>
    )
  }
  if (rank === 3) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-800">
        3
      </span>
    )
  }
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center text-xs font-semibold tabular-nums text-muted-foreground">
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
  const [loading, setLoading] = useState(false)
  const [monthlyStats, setMonthlyStats] = useState<GoogleReviewStaffMonthlyStat[]>([])
  const [error, setError] = useState<string | null>(null)

  const monthLabels = isKo ? MONTH_LABELS_KO : MONTH_LABELS_EN

  const loadStats = useCallback(async () => {
    if (!open) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetchApiWithAuth(
        `/api/admin/google-business/reviews/staff-stats?view=monthly&year=${year}`
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
  }, [open, year, isKo])

  useEffect(() => {
    if (!open) return
    void loadStats()
  }, [open, loadStats])

  useEffect(() => {
    if (!open) return
    setYear(currentYear)
    setSelectedMonth(currentMonth)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(96vw,56rem)] max-w-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4 text-left sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Trophy className="h-5 w-5 text-amber-500" aria-hidden />
            {isKo ? '리뷰 현황' : 'Review status'}
          </DialogTitle>
          <DialogDescription>
            {isKo
              ? '활성 가이드·어시스턴트의 월별 리뷰 점수 순위입니다. 평균 별점이 높은 순으로 표시됩니다.'
              : 'Monthly review ranking for active guides and assistants, sorted by average rating.'}
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 space-y-3 border-b border-border/40 px-5 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="review-status-year">
              {isKo ? '연도' : 'Year'}
            </label>
            <select
              id="review-status-year"
              value={year}
              onChange={(e) => setYear(Number.parseInt(e.target.value, 10))}
              className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm font-medium"
            >
              {Array.from({ length: 4 }, (_, i) => currentYear - i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              {isKo
                ? `활성 ${rankedRows.length}명`
                : `${rankedRows.length} active`}
            </span>
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
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    selected
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'border border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {monthLabels[month - 1]}
                </button>
              )
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
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
              <div className="mb-3 hidden text-xs text-muted-foreground sm:block">
                {isKo
                  ? `${year}년 ${monthLabels[selectedMonth - 1]} · 평균 별점 → 리뷰 수 → 5점 순`
                  : `${monthLabels[selectedMonth - 1]} ${year} · avg rating → reviews → 5★`}
              </div>

              {/* Mobile cards */}
              <ul className="space-y-2 sm:hidden">
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
                            <span>
                              {isKo ? '리뷰율' : 'Rate'}{' '}
                              <span className="font-medium tabular-nums text-foreground">
                                {formatPercent(cell.guestReviewRatePercent)}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">{isKo ? '순위' : 'Rank'}</th>
                      <th className="py-2 pr-4 font-medium">{isKo ? '가이드' : 'Guide'}</th>
                      <th className="py-2 pr-4 font-medium">{isKo ? '평균' : 'Avg'}</th>
                      <th className="py-2 pr-4 font-medium">{isKo ? '리뷰 수' : 'Reviews'}</th>
                      <th className="py-2 px-2 text-center font-medium">5★</th>
                      <th className="py-2 px-2 text-center font-medium">4★</th>
                      <th className="py-2 px-2 text-center font-medium">3★</th>
                      <th className="py-2 px-2 text-center font-medium">2★</th>
                      <th className="py-2 px-2 text-center font-medium">1★</th>
                      <th className="py-2 pl-3 font-medium">
                        {isKo ? '게스트 리뷰율' : 'Guest rate'}
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
                          className={`border-b border-border/40 ${
                            topThree ? 'bg-amber-50/40' : ''
                          }`}
                        >
                          <td className="py-2.5 pr-3">
                            <RankBadge rank={row.rank} />
                          </td>
                          <td className="py-2.5 pr-4 font-medium whitespace-nowrap">
                            {row.staffName}
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-amber-600">
                              <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
                              {cell.avgRating?.toFixed(2) ?? '—'}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 tabular-nums">{cell.reviewCount}</td>
                          <td className="py-2.5 px-2 text-center tabular-nums text-emerald-700">
                            {cell.fiveStarCount}
                          </td>
                          <td className="py-2.5 px-2 text-center tabular-nums">{cell.fourStarCount}</td>
                          <td className="py-2.5 px-2 text-center tabular-nums text-amber-700">
                            {cell.threeStarCount}
                          </td>
                          <td className="py-2.5 px-2 text-center tabular-nums text-orange-700">
                            {cell.twoStarCount}
                          </td>
                          <td className="py-2.5 px-2 text-center tabular-nums text-red-600">
                            {cell.oneStarCount}
                          </td>
                          <td className="py-2.5 pl-3 tabular-nums text-muted-foreground">
                            {formatPercent(cell.guestReviewRatePercent)}
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
