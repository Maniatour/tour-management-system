'use client'

import { useCallback, useEffect, useState } from 'react'
import { Wallet } from 'lucide-react'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { TourDetailResizableDialog } from '@/components/tour/TourDetailResizableDialog'
import {
  fetchUnreceivedAssignedCashBalances,
  formatUnreceivedCashAmount,
  type UnreceivedAssignedCashResult,
  type UnreceivedAssignedCashTourRow,
} from '@/lib/unreceivedAssignedCashBalance'

export default function UnreceivedAssignedCashBalancePanel() {
  const { operatorId } = useOperatorOptional()
  const activeOperatorId = resolveOperatorId(operatorId)
  const [data, setData] = useState<UnreceivedAssignedCashResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTour, setSelectedTour] = useState<UnreceivedAssignedCashTourRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchUnreceivedAssignedCashBalances(activeOperatorId)
      setData(result)
    } catch (error) {
      console.error('미수령 현금 잔금 로드 오류:', error)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [activeOperatorId])

  useEffect(() => {
    void load()
  }, [load])

  const selectedTitle = selectedTour
    ? `${selectedTour.tourDate} · ${selectedTour.productName}`
    : '투어 상세'

  return (
    <>
      <section className="rounded-xl border border-purple-200 bg-purple-50/60 p-4 sm:p-6 min-w-0 max-w-full overflow-x-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-w-0">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-purple-600 shrink-0" aria-hidden />
              미수령 현금 잔금
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed">
              {data
                ? `${data.fromDate} ~ ${data.asOfDate} 전날 · 배정 관리의 배정된 예약 잔액이 남은 투어`
                : '오늘 이전 투어의 배정된 예약 잔액을 합산합니다.'}
            </p>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <p className="text-xs text-purple-700 font-medium">합산 금액</p>
            <p className="text-2xl sm:text-3xl font-bold text-purple-700 tabular-nums">
              {loading ? '…' : formatUnreceivedCashAmount(data?.totalAmount ?? 0)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {loading ? '불러오는 중' : `${data?.tours.length ?? 0}개 투어`}
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 mt-4">미수령 잔금 투어를 불러오는 중입니다…</p>
        ) : !data || data.tours.length === 0 ? (
          <p className="text-sm text-gray-500 mt-4">잔금이 남은 과거 투어가 없습니다.</p>
        ) : (
          <ul className="mt-4 max-h-[28rem] overflow-y-auto divide-y divide-purple-100 rounded-lg border border-purple-100 bg-white">
            {data.tours.map((tour) => (
              <li key={tour.tourId}>
                <button
                  type="button"
                  onClick={() => setSelectedTour(tour)}
                  className="flex w-full min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between px-3 py-3 text-left hover:bg-purple-50/80 transition-colors duration-200 min-h-[44px]"
                >
                  <span className="text-sm text-gray-900 min-w-0 truncate">
                    <span className="font-semibold tabular-nums">{tour.tourDate}</span>
                    <span className="mx-1.5 text-gray-400" aria-hidden>
                      ·
                    </span>
                    <span className="text-gray-700">{tour.productName}</span>
                  </span>
                  <span className="text-sm font-semibold text-purple-700 tabular-nums shrink-0">
                    {formatUnreceivedCashAmount(tour.assignedBalance)} 미수령
                    {tour.unpaidReservationCount > 0 ? (
                      <span className="ml-1.5 font-normal text-gray-500">
                        ({tour.unpaidReservationCount}건)
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TourDetailResizableDialog
        open={Boolean(selectedTour)}
        onOpenChange={(open) => {
          if (!open) setSelectedTour(null)
        }}
        tourId={selectedTour?.tourId ?? null}
        onNavigateToTour={(nextTourId) =>
          setSelectedTour((prev) => (prev ? { ...prev, tourId: nextTourId } : null))
        }
        stackLevel="elevated"
        accessibilityTitle={selectedTitle}
        titleFallback={selectedTitle}
      />
    </>
  )
}
