'use client'

import { Star } from 'lucide-react'
import {
  REVIEW_BONUS_USD_PER_POINT,
  formatReviewBonusMonthLabel,
  type ReviewBonusSummary,
} from '@/lib/reviewBonusPoints'

type Props = {
  summary: ReviewBonusSummary | null
  loading: boolean
  formatCurrency: (amount: number) => string
}

function pointsClass(points: number): string {
  if (points > 0) return 'text-emerald-700'
  if (points < 0) return 'text-red-600'
  return 'text-gray-700'
}

export default function BiweeklyReviewBonusSection({ summary, loading, formatCurrency }: Props) {
  if (!summary && !loading) return null

  const monthLabel = summary
    ? formatReviewBonusMonthLabel(summary.year, summary.month, 'ko')
    : ''

  return (
    <div className="mt-6 sm:mt-8">
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
        후기 보너스 포인트
      </h3>
      <div className="rounded-lg border border-gray-200 bg-white p-3 sm:p-4 space-y-3">
        {loading ? (
          <p className="text-sm text-gray-500">후기 포인트를 불러오는 중...</p>
        ) : !summary ? null : !summary.includedInThisPayPeriod ? (
          <p className="text-sm text-gray-600 leading-6">
            {monthLabel} 후기 보너스(1일~말일, 고객 후기 등록일 기준)는{' '}
            <span className="font-medium text-gray-900">16일~말일 2주급</span>에 포함됩니다.
            이 기간(1~15일) 지급분에는 넣지 않습니다.
          </p>
        ) : (
          <>
            <p className="text-xs text-gray-500 leading-5">
              {monthLabel} 1일~말일 · 고객이 후기를 남긴 날 기준 · 1포인트 ${REVIEW_BONUS_USD_PER_POINT}
              {' '}(5점 +1 / 4점 0 / 3점 -1 / 2점 -2 / 1점 -3)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-md bg-gray-50 p-2 text-center">
                <div className="text-[10px] font-medium text-gray-500">후기 건수</div>
                <div className="text-sm font-bold text-gray-900 tabular-nums">{summary.reviewCount}건</div>
              </div>
              <div className="rounded-md bg-gray-50 p-2 text-center">
                <div className="text-[10px] font-medium text-gray-500">별점 합계</div>
                <div className="text-[11px] font-medium text-gray-700 tabular-nums">
                  5★ {summary.fiveStarCount} · 4★ {summary.fourStarCount} · 3★ {summary.threeStarCount}
                  <br />
                  2★ {summary.twoStarCount} · 1★ {summary.oneStarCount}
                </div>
              </div>
              <div className="rounded-md bg-gray-50 p-2 text-center">
                <div className="text-[10px] font-medium text-gray-500">포인트 합산</div>
                <div className={`text-sm font-bold tabular-nums ${pointsClass(summary.totalPoints)}`}>
                  {summary.totalPoints > 0 ? '+' : ''}
                  {summary.totalPoints}점
                </div>
              </div>
              <div className="rounded-md bg-gray-50 p-2 text-center">
                <div className="text-[10px] font-medium text-gray-500">보너스 금액</div>
                <div className={`text-sm font-bold tabular-nums ${pointsClass(summary.amountUsd)}`}>
                  {summary.amountUsd < 0 ? '-' : ''}${formatCurrency(Math.abs(summary.amountUsd))}
                </div>
              </div>
            </div>
            {summary.reviews.length > 0 ? (
              <div className="overflow-x-auto border border-gray-100 rounded-md">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-500">등록일</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-500">작성자</th>
                      <th className="px-2 py-1.5 text-center font-medium text-gray-500">별점</th>
                      <th className="px-2 py-1.5 text-right font-medium text-gray-500">포인트</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {summary.reviews.map((review) => (
                      <tr key={review.id}>
                        <td className="px-2 py-1.5 whitespace-nowrap text-gray-700">
                          {review.postedDateLv}
                        </td>
                        <td className="px-2 py-1.5 text-gray-700 max-w-[10rem] truncate">
                          {review.authorName || '—'}
                        </td>
                        <td className="px-2 py-1.5 text-center text-gray-800">
                          <span className="inline-flex items-center justify-center gap-0.5">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {review.rating}
                          </span>
                        </td>
                        <td
                          className={`px-2 py-1.5 text-right font-medium tabular-nums ${pointsClass(review.points)}`}
                        >
                          {review.points > 0 ? '+' : ''}
                          {review.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">이 달에 연결된 후기가 없습니다.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
