'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Star,
  Users,
} from 'lucide-react'
import GoogleReviewStaffStatReviewsModal, {
  type StaffStatReviewModalTarget,
} from '@/components/admin/google-reviews/GoogleReviewStaffStatReviewsModal'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import type {
  GoogleReviewStaffMonthlyCell,
  GoogleReviewStaffMonthlyStat,
  GoogleReviewStaffStat,
} from '@/types/googleBusiness'

type Props = {
  locale: string
  enabled: boolean
  refreshKey: number
}

type ViewMode = 'overall' | 'monthly'

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
] as const

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
] as const

const STAR_BREAKDOWN_ROWS = [
  { key: 'fiveStarCount' as const, label: '★★★★★', rating: 5 },
  { key: 'fourStarCount' as const, label: '★★★★☆', rating: 4 },
  { key: 'threeStarCount' as const, label: '★★★☆☆', rating: 3 },
  { key: 'twoStarCount' as const, label: '★★☆☆☆', rating: 2 },
  { key: 'oneStarCount' as const, label: '★☆☆☆☆', rating: 1 },
] as const

const OVERALL_STAR_COLUMNS = [
  { key: 'fiveStarCount' as const, rating: 5, className: 'text-success' },
  { key: 'fourStarCount' as const, rating: 4, className: '' },
  { key: 'threeStarCount' as const, rating: 3, className: 'text-muted-foreground' },
  { key: 'twoStarCount' as const, rating: 2, className: 'text-warning' },
  { key: 'oneStarCount' as const, rating: 1, className: 'text-danger' },
] as const

function StarCountButton({
  count,
  className,
  onClick,
  ariaLabel,
}: {
  count: number
  className?: string
  onClick?: () => void
  ariaLabel: string
}) {
  if (count <= 0) {
    return <span className={className}>{count}</span>
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`${className ?? ''} rounded px-1 -mx-1 hover:bg-muted/60 hover:underline underline-offset-2 transition-colors`}
    >
      {count}
    </button>
  )
}

function formatRateLine(
  reviews: number,
  denominator: number,
  percent: number | null
): string {
  if (denominator <= 0) return '—'
  const pct = percent != null ? `${percent}%` : '—'
  return `${reviews}/${denominator} ${pct}`
}

function MonthlyCellContent({
  cell,
  isKo,
  staffEmail,
  staffName,
  year,
  onStarClick,
}: {
  cell: GoogleReviewStaffMonthlyCell | null
  isKo: boolean
  staffEmail: string
  staffName: string
  year: number
  onStarClick: (target: StaffStatReviewModalTarget) => void
}) {
  if (
    !cell ||
    (cell.reviewCount === 0 &&
      cell.totalTourGuests === 0 &&
      cell.reservationGroupCount === 0)
  ) {
    return <span className="text-muted-foreground/40">—</span>
  }

  const starRows = STAR_BREAKDOWN_ROWS.filter((row) => cell[row.key] > 0)

  return (
    <div className="flex flex-col items-center gap-1 leading-tight text-center min-w-[5.5rem]">
      {starRows.length > 0 ? (
        <div className="space-y-0.5 w-full">
          {starRows.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-center gap-1.5 text-xs tabular-nums"
            >
              <span className="text-amber-500 tracking-tight text-[13px]">{row.label}</span>
              <StarCountButton
                count={cell[row.key]}
                className="font-semibold text-foreground"
                ariaLabel={
                  isKo
                    ? `${staffName} ${row.rating}점 리뷰 ${cell[row.key]}건 보기`
                    : `View ${cell[row.key]} ${row.rating}-star reviews for ${staffName}`
                }
                onClick={() =>
                  onStarClick({
                    staffEmail,
                    staffName,
                    rating: row.rating,
                    year,
                    month: cell.month,
                  })
                }
              />
            </div>
          ))}
        </div>
      ) : null}

      <div
        className={`space-y-0.5 w-full ${starRows.length > 0 ? 'border-t border-border/40 pt-1' : ''}`}
      >
        <div
          className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground tabular-nums"
          title={
            isKo
              ? '리뷰 수 ÷ 투어 총인원'
              : 'Reviews ÷ total tour guests'
          }
        >
          <span className="shrink-0 text-[11px] leading-none" aria-hidden>
            👥
          </span>
          <span>
            {formatRateLine(
              cell.reviewCount,
              cell.totalTourGuests,
              cell.guestReviewRatePercent
            )}
          </span>
        </div>
        <div
          className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground tabular-nums"
          title={
            isKo
              ? '리뷰 수 ÷ 예약 그룹 수'
              : 'Reviews ÷ reservation groups'
          }
        >
          <span className="shrink-0 text-[11px] leading-none" aria-hidden>
            📋
          </span>
          <span>
            {formatRateLine(
              cell.reviewCount,
              cell.reservationGroupCount,
              cell.groupReviewRatePercent
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function GoogleReviewStaffStatsSection({
  locale,
  enabled,
  refreshKey,
}: Props) {
  const isKo = locale === 'ko'
  const currentYear = new Date().getFullYear()
  const [viewMode, setViewMode] = useState<ViewMode>('overall')
  const [year, setYear] = useState(currentYear)
  const [stats, setStats] = useState<GoogleReviewStaffStat[]>([])
  const [monthlyStats, setMonthlyStats] = useState<GoogleReviewStaffMonthlyStat[]>([])
  const [loading, setLoading] = useState(false)
  const [reviewModalTarget, setReviewModalTarget] = useState<StaffStatReviewModalTarget | null>(
    null
  )

  const monthLabels = isKo ? MONTH_LABELS_KO : MONTH_LABELS_EN

  const monthlyCellMap = useMemo(() => {
    const map = new Map<string, Map<number, GoogleReviewStaffMonthlyCell>>()
    for (const row of monthlyStats) {
      const monthMap = new Map<number, GoogleReviewStaffMonthlyCell>()
      for (const cell of row.months) {
        monthMap.set(cell.month, cell)
      }
      map.set(row.staffEmail, monthMap)
    }
    return map
  }, [monthlyStats])

  const loadStats = useCallback(async () => {
    if (!enabled) {
      setStats([])
      setMonthlyStats([])
      return
    }

    setLoading(true)
    try {
      if (viewMode === 'overall') {
        const res = await fetchApiWithAuth('/api/admin/google-business/reviews/staff-stats')
        const data = (await res.json()) as { ok?: boolean; stats?: GoogleReviewStaffStat[] }
        if (res.ok && data.ok) {
          setStats(data.stats ?? [])
        }
      } else {
        const res = await fetchApiWithAuth(
          `/api/admin/google-business/reviews/staff-stats?view=monthly&year=${year}`
        )
        const data = (await res.json()) as {
          ok?: boolean
          monthlyStats?: GoogleReviewStaffMonthlyStat[]
        }
        if (res.ok && data.ok) {
          setMonthlyStats(data.monthlyStats ?? [])
        }
      }
    } catch (error) {
      console.error('[GoogleReviewStaffStatsSection]', error)
    } finally {
      setLoading(false)
    }
  }, [enabled, viewMode, year])

  useEffect(() => {
    void loadStats()
  }, [loadStats, refreshKey])

  if (!enabled) return null

  const hasOverallData = stats.length > 0
  const hasMonthlyData = monthlyStats.length > 0
  const isEmpty =
    viewMode === 'overall' ? !loading && !hasOverallData : !loading && !hasMonthlyData

  return (
    <section className="rounded-2xl border border-border/60 bg-card shadow-sm p-6 space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {isKo ? '가이드·어시스턴트 리뷰 점수' : 'Guide & assistant review scores'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {viewMode === 'overall'
              ? isKo
                ? '모든 플랫폼(Google·OTA 등) 리뷰 중 투어·직원 연결된 평균 별점입니다. 대기·승인 상태 모두 포함됩니다. 숫자를 클릭하면 리뷰 내용을 볼 수 있습니다.'
                : 'Average ratings from all platform reviews linked to staff via tours (pending and approved). Click counts to read reviews.'
              : isKo
                ? '월별 리뷰 수, 별점별 개수, 투어 인원·예약 그룹 대비 리뷰율입니다. 대기·승인 등 모든 상태 포함. 별점 숫자를 클릭하면 리뷰를 볼 수 있습니다.'
                : 'Monthly reviews, star breakdown, and review rates (all import statuses). Click star counts to read reviews.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {viewMode === 'monthly' ? (
            <div className="flex items-center rounded-lg border border-border bg-background">
              <button
                type="button"
                onClick={() => setYear((y) => y - 1)}
                className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-l-lg"
                aria-label={isKo ? '이전 연도' : 'Previous year'}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[4.5rem] text-center text-sm font-medium tabular-nums px-1">
                {year}
              </span>
              <button
                type="button"
                onClick={() => setYear((y) => Math.min(currentYear, y + 1))}
                disabled={year >= currentYear}
                className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-r-lg disabled:opacity-40"
                aria-label={isKo ? '다음 연도' : 'Next year'}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('overall')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'overall'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              OVERALL
            </button>
            <button
              type="button"
              onClick={() => setViewMode('monthly')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'monthly'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isKo ? '월별' : 'Monthly'}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isEmpty ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {isKo
            ? '연결된 직원 리뷰가 없습니다. 투어 연결 또는 자동 분류를 실행해 보세요.'
            : 'No linked staff reviews yet. Link tours or run auto-classification.'}
        </p>
      ) : viewMode === 'overall' ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">{isKo ? '직원' : 'Staff'}</th>
                <th className="py-2 pr-4 font-medium">{isKo ? '리뷰 수' : 'Reviews'}</th>
                <th className="py-2 pr-4 font-medium">{isKo ? '평균' : 'Average'}</th>
                <th className="py-2 px-2 font-medium text-center">5★</th>
                <th className="py-2 px-2 font-medium text-center">4★</th>
                <th className="py-2 px-2 font-medium text-center">3★</th>
                <th className="py-2 px-2 font-medium text-center">2★</th>
                <th className="py-2 px-2 font-medium text-center">1★</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => (
                <tr key={row.staffEmail} className="border-b border-border/40">
                  <td className="py-3 pr-4 font-medium text-foreground">{row.staffName}</td>
                  <td className="py-3 pr-4 tabular-nums">{row.reviewCount}</td>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center gap-1 text-amber-500 font-medium tabular-nums">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      {row.avgRating?.toFixed(2) ?? '—'}
                    </span>
                  </td>
                  {OVERALL_STAR_COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className={`py-3 px-2 text-center tabular-nums ${col.className}`}
                    >
                      <StarCountButton
                        count={row[col.key]}
                        className={col.className}
                        ariaLabel={
                          isKo
                            ? `${row.staffName} ${col.rating}점 리뷰 ${row[col.key]}건 보기`
                            : `View ${row[col.key]} ${col.rating}-star reviews for ${row.staffName}`
                        }
                        onClick={() =>
                          setReviewModalTarget({
                            staffEmail: row.staffEmail,
                            staffName: row.staffName,
                            rating: col.rating,
                          })
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="shrink-0 text-[11px] leading-none" aria-hidden>
                👥
              </span>
              {isKo ? '리뷰 ÷ 투어 총인원' : 'Reviews ÷ tour guests'}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="shrink-0 text-[11px] leading-none" aria-hidden>
                📋
              </span>
              {isKo ? '리뷰 ÷ 예약 그룹' : 'Reviews ÷ reservation groups'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground">
                  <th className="sticky left-0 z-10 bg-card py-2 pr-3 text-left font-medium min-w-[7rem]">
                    {isKo ? '직원' : 'Staff'}
                  </th>
                  {monthLabels.map((label) => (
                    <th
                      key={label}
                      className="py-2 px-1 text-center font-medium text-xs min-w-[6rem]"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlyStats.map((row) => {
                  const monthMap = monthlyCellMap.get(row.staffEmail)
                  return (
                    <tr key={row.staffEmail} className="border-b border-border/40">
                      <td className="sticky left-0 z-10 bg-card py-2 pr-3 font-medium text-foreground whitespace-nowrap">
                        {row.staffName}
                      </td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                        <td key={month} className="py-2 px-1 text-center align-middle">
                          <MonthlyCellContent
                            cell={monthMap?.get(month) ?? null}
                            isKo={isKo}
                            staffEmail={row.staffEmail}
                            staffName={row.staffName}
                            year={year}
                            onStarClick={setReviewModalTarget}
                          />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <GoogleReviewStaffStatReviewsModal
        locale={locale}
        target={reviewModalTarget}
        onClose={() => setReviewModalTarget(null)}
      />
    </section>
  )
}
