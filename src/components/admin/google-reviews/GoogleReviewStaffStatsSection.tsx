'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Star, Users } from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import type { GoogleReviewStaffStat } from '@/types/googleBusiness'

type Props = {
  locale: string
  enabled: boolean
  refreshKey: number
}

export default function GoogleReviewStaffStatsSection({
  locale,
  enabled,
  refreshKey,
}: Props) {
  const isKo = locale === 'ko'
  const [stats, setStats] = useState<GoogleReviewStaffStat[]>([])
  const [loading, setLoading] = useState(false)

  const loadStats = useCallback(async () => {
    if (!enabled) {
      setStats([])
      return
    }

    setLoading(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/google-business/reviews/staff-stats')
      const data = (await res.json()) as { ok?: boolean; stats?: GoogleReviewStaffStat[] }
      if (res.ok && data.ok) {
        setStats(data.stats ?? [])
      }
    } catch (error) {
      console.error('[GoogleReviewStaffStatsSection]', error)
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void loadStats()
  }, [loadStats, refreshKey])

  if (!enabled) return null

  return (
    <section className="rounded-2xl border border-border/60 bg-card shadow-sm p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          {isKo ? '가이드·어시스턴트 리뷰 점수' : 'Guide & assistant review scores'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isKo
            ? '승인된 Google 리뷰 중 투어·이름으로 연결된 직원의 평균 별점입니다.'
            : 'Average ratings from approved Google reviews linked to staff via tours or name mentions.'}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : stats.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {isKo
            ? '연결된 직원 리뷰가 없습니다. 투어 연결 또는 자동 분류를 실행해 보세요.'
            : 'No linked staff reviews yet. Link tours or run auto-classification.'}
        </p>
      ) : (
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
                  <td className="py-3 px-2 text-center tabular-nums text-success">{row.fiveStarCount}</td>
                  <td className="py-3 px-2 text-center tabular-nums">{row.fourStarCount}</td>
                  <td className="py-3 px-2 text-center tabular-nums text-muted-foreground">{row.threeStarCount}</td>
                  <td className="py-3 px-2 text-center tabular-nums text-warning">{row.twoStarCount}</td>
                  <td className="py-3 px-2 text-center tabular-nums text-danger">{row.oneStarCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
