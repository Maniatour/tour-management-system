'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Home, Plane, PlaneTakeoff, HelpCircle, X } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import ReservationEvidenceUpload from '@/components/reservation/ReservationEvidenceUpload'
import {
  loadResidentStatusAmountsForReservation,
  saveResidentStatusWithPricing,
} from '@/lib/saveResidentStatusWithPricing'
import {
  computePassCoveredCount,
  emptyResidentStatusAmounts,
  residentLineDefaultAmountUsd,
  type ResidentLineKey,
} from '@/utils/usResidentChoiceSync'

interface ResidentStatusIconProps {
  reservationId: string
  customerId: string | null
  totalPeople: number
  onUpdate?: () => void
  /** 목록 배치 프리패치로 전달 시 해당 예약에 대한 단건 GET 생략 */
  prefetchedResidentCustomerRows?: { resident_status: string | null }[]
  /** 간단 카드 등: 좌측 여백 없이 아이콘만 (h-4) */
  compact?: boolean
}

const RESIDENT_MODAL_ROWS: {
  lineKey: ResidentLineKey
  labelKo: string
  labelEn: string
  dotClass: string
  countField: keyof ResidentStatusCountsState
  amountHint?: string
}[] = [
  {
    lineKey: 'us_resident',
    labelKo: '미국 거주자',
    labelEn: 'US Resident',
    dotClass: 'bg-green-600',
    countField: 'usResident',
  },
  {
    lineKey: 'non_resident',
    labelKo: '비 거주자',
    labelEn: 'Non-Resident',
    dotClass: 'bg-blue-600',
    countField: 'nonResident',
  },
  {
    lineKey: 'non_resident_under_16',
    labelKo: '비 거주자 (16세 이하)',
    labelEn: 'Non-Resident (Under 16)',
    dotClass: 'bg-orange-600',
    countField: 'nonResidentUnder16',
  },
  {
    lineKey: 'non_resident_with_pass',
    labelKo: '비거주자 (패스 보유)',
    labelEn: 'Non-Resident (with pass)',
    dotClass: 'bg-purple-600',
    countField: 'nonResidentWithPass',
    amountHint: 'pass count',
  },
]

type ResidentStatusCountsState = {
  usResident: number
  nonResident: number
  nonResidentUnder16: number
  nonResidentWithPass: number
  passCoveredCount: number
}

function mostCommonResidentStatusFromRows(
  reservationCustomers: { resident_status?: string | null }[]
): 'us_resident' | 'non_resident' | 'non_resident_with_pass' | 'non_resident_under_16' | null {
  if (!reservationCustomers.length) return null
  const statusCounts: Record<string, number> = {}
  reservationCustomers.forEach((rc: { resident_status?: string | null }) => {
    const status = rc.resident_status || 'unknown'
    statusCounts[status] = (statusCounts[status] || 0) + 1
  })
  let mostCommonStatus: 'us_resident' | 'non_resident' | 'non_resident_with_pass' | 'non_resident_under_16' | null =
    null
  let maxCount = 0
  Object.entries(statusCounts).forEach(([status, count]) => {
    if (count > maxCount && status !== 'unknown') {
      maxCount = count
      mostCommonStatus = status as
        | 'us_resident'
        | 'non_resident'
        | 'non_resident_with_pass'
        | 'non_resident_under_16'
    }
  })
  return mostCommonStatus
}

export const ResidentStatusIcon: React.FC<ResidentStatusIconProps> = ({
  reservationId,
  customerId,
  totalPeople,
  onUpdate,
  prefetchedResidentCustomerRows,
  compact = false,
}) => {
  const t = useTranslations('common')
  const locale = useLocale()
  const isKo = locale === 'ko'
  const [residentStatus, setResidentStatus] = useState<'us_resident' | 'non_resident' | 'non_resident_with_pass' | 'non_resident_under_16' | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [productId, setProductId] = useState<string | null>(null)
  const [residentStatusCounts, setResidentStatusCounts] = useState<ResidentStatusCountsState>({
    usResident: 0,
    nonResident: 0,
    nonResidentUnder16: 0,
    nonResidentWithPass: 0,
    passCoveredCount: 0,
  })
  const [residentStatusAmounts, setResidentStatusAmounts] = useState(
    () => emptyResidentStatusAmounts()
  )

  const calculateActualPassCovered = (
    passCount: number,
    usResident: number,
    nonResident: number,
    nonResidentUnder16: number
  ) => {
    return computePassCoveredCount(passCount, usResident, nonResident, nonResidentUnder16, totalPeople)
  }

  const fetchResidentStatus = useCallback(async () => {
    try {
      const { data: reservationCustomers, error } = await supabase
        .from('reservation_customers')
        .select('resident_status')
        .eq('reservation_id', reservationId)

      if (!error && reservationCustomers && reservationCustomers.length > 0) {
        setResidentStatus(mostCommonResidentStatusFromRows(reservationCustomers))
      } else {
        setResidentStatus(null)
      }
    } catch (error) {
      console.error('거주 상태 조회 오류:', error)
    }
  }, [reservationId])

  const handleOpenModal = useCallback(async () => {
    try {
      const { data: reservation } = await supabase
        .from('reservations')
        .select('product_id')
        .eq('id', reservationId)
        .maybeSingle()
      const pid = reservation?.product_id ? String(reservation.product_id) : null
      setProductId(pid)

      const { data: reservationCustomers, error } = await supabase
        .from('reservation_customers')
        .select('resident_status, pass_covered_count')
        .eq('reservation_id', reservationId)

      let counts: ResidentStatusCountsState = {
        usResident: 0,
        nonResident: 0,
        nonResidentUnder16: 0,
        nonResidentWithPass: 0,
        passCoveredCount: 0,
      }

      if (!error && reservationCustomers && reservationCustomers.length > 0) {
        let totalPassCoveredCount = 0
        reservationCustomers.forEach((rc: { resident_status?: string | null; pass_covered_count?: number | null }) => {
          if (rc.resident_status === 'us_resident') {
            counts.usResident++
          } else if (rc.resident_status === 'non_resident') {
            counts.nonResident++
          } else if (rc.resident_status === 'non_resident_under_16') {
            counts.nonResidentUnder16++
          } else if (rc.resident_status === 'non_resident_with_pass') {
            counts.nonResidentWithPass++
            if (rc.pass_covered_count) {
              totalPassCoveredCount += rc.pass_covered_count
            }
          }
        })
        counts = { ...counts, passCoveredCount: totalPassCoveredCount }
      }

      setResidentStatusCounts(counts)

      const amounts = await loadResidentStatusAmountsForReservation(supabase, reservationId, pid)
      setResidentStatusAmounts({ ...emptyResidentStatusAmounts(), ...amounts })
    } catch (error) {
      console.error('거주 상태 정보 로드 오류:', error)
    }

    setShowModal(true)
  }, [reservationId])

  const handleSave = async () => {
    const passCount = residentStatusCounts.nonResidentWithPass
    const actualPassCovered = calculateActualPassCovered(
      passCount,
      residentStatusCounts.usResident,
      residentStatusCounts.nonResident,
      residentStatusCounts.nonResidentUnder16
    )
    const statusTotal =
      residentStatusCounts.usResident +
      residentStatusCounts.nonResident +
      residentStatusCounts.nonResidentUnder16 +
      actualPassCovered

    if (statusTotal !== totalPeople) {
      alert(
        isKo
          ? `총 인원(${totalPeople}명)과 거주 상태별 합계(${statusTotal}명)가 일치하지 않습니다.`
          : `Total people (${totalPeople}) does not match resident status total (${statusTotal}).`
      )
      return
    }

    setSaving(true)
    try {
      const result = await saveResidentStatusWithPricing(
        supabase,
        reservationId,
        customerId,
        totalPeople,
        {
          usResident: residentStatusCounts.usResident,
          nonResident: residentStatusCounts.nonResident,
          nonResidentUnder16: residentStatusCounts.nonResidentUnder16,
          nonResidentWithPass: passCount,
          residentStatusAmounts,
        }
      )

      if (!result.ok) {
        if (result.error === 'RESIDENT_COUNT_MISMATCH') {
          alert(
            isKo
              ? `총 인원(${totalPeople}명)과 거주 상태별 합계가 일치하지 않습니다.`
              : `Total people (${totalPeople}) does not match resident status total.`
          )
        } else {
          alert(t('residentStatusUpdateFailed'))
        }
        return
      }

      setShowModal(false)
      await fetchResidentStatus()
      onUpdate?.()
      alert(t('residentStatusUpdateSuccess'))
    } catch (error) {
      console.error('Error updating resident status:', error)
      alert(t('residentStatusUpdateFailed'))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (prefetchedResidentCustomerRows !== undefined) {
      setResidentStatus(mostCommonResidentStatusFromRows(prefetchedResidentCustomerRows))
      return
    }
    void fetchResidentStatus()
  }, [reservationId, prefetchedResidentCustomerRows, fetchResidentStatus])

  const getStatusIcon = () => {
    const iconCls = 'block h-4 w-4 shrink-0 cursor-pointer transition-transform hover:scale-110'
    if (residentStatus === 'us_resident') {
      return <Home className={`${iconCls} text-green-600`} />
    } else if (residentStatus === 'non_resident') {
      return <Plane className={`${iconCls} text-primary`} />
    } else if (residentStatus === 'non_resident_with_pass') {
      return <PlaneTakeoff className={`${iconCls} text-purple-600`} />
    } else if (residentStatus === 'non_resident_under_16') {
      return <Plane className={`${iconCls} text-orange-600`} />
    } else {
      return <HelpCircle className={`${iconCls} text-gray-400`} />
    }
  }

  const amounts = { ...emptyResidentStatusAmounts(), ...residentStatusAmounts }
  const statusSum =
    residentStatusCounts.usResident +
    residentStatusCounts.nonResident +
    residentStatusCounts.nonResidentUnder16 +
    residentStatusCounts.passCoveredCount

  const residentStatusTooltipLines = (() => {
    const rows = prefetchedResidentCustomerRows

    let usResident = 0
    let nonResident = 0
    let nonResidentUnder16 = 0
    let nonResidentWithPass = 0

    if (rows?.length) {
      for (const rc of rows) {
        if (rc.resident_status === 'us_resident') usResident++
        else if (rc.resident_status === 'non_resident') nonResident++
        else if (rc.resident_status === 'non_resident_under_16') nonResidentUnder16++
        else if (rc.resident_status === 'non_resident_with_pass') nonResidentWithPass++
      }
    }

    const statusTotal =
      usResident +
      nonResident +
      nonResidentUnder16 +
      computePassCoveredCount(
        nonResidentWithPass,
        usResident,
        nonResident,
        nonResidentUnder16,
        totalPeople
      )
    const isIncomplete = totalPeople > 0 && statusTotal !== totalPeople

    if (!rows?.length || isIncomplete || residentStatus === null) {
      return [t('residentStatusSetup')]
    }

    const lines: string[] = []
    if (usResident > 0) {
      lines.push(`${t('statusUsResident')}: ${usResident}${isKo ? '명' : ''}`)
    }
    if (nonResident > 0) {
      lines.push(`${t('statusNonResident')}: ${nonResident}${isKo ? '명' : ''}`)
    }
    if (nonResidentUnder16 > 0) {
      lines.push(
        `${isKo ? '비거주자 (16세 이하)' : 'Non-resident (under 16)'}: ${nonResidentUnder16}${isKo ? '명' : ''}`
      )
    }
    if (nonResidentWithPass > 0) {
      lines.push(`${t('statusNonResidentWithPass')}: ${nonResidentWithPass}${isKo ? '명' : ''}`)
    }

    return lines
  })()

  return (
    <>
      <span
        className={
          compact
            ? 'group relative inline-flex h-4 w-4 shrink-0 items-center justify-center'
            : 'group relative ml-2 flex-shrink-0'
        }
        aria-label={residentStatusTooltipLines.join(', ')}
        onClick={(e) => {
          e.stopPropagation()
          void handleOpenModal()
        }}
      >
        {getStatusIcon()}
        {residentStatusTooltipLines.length > 0 ? (
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max max-w-[220px] -translate-x-1/2 rounded-lg bg-gray-900 px-2.5 py-2 text-left text-[11px] leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-hover:block group-hover:opacity-100 group-focus-visible:block group-focus-visible:opacity-100"
          >
            {residentStatusTooltipLines.map((line) => (
              <span key={line} className="block whitespace-nowrap">
                {line}
              </span>
            ))}
            <span
              className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-gray-900"
            />
          </span>
        ) : null}
      </span>

      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false)
            }
          }}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{t('residentStatusSetup')}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-muted/50 border border-border rounded-lg p-3">
                <div className="text-sm font-medium text-foreground">
                  {t('total')}: {totalPeople}
                  {isKo ? '명' : ` ${t('people')}`}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                  <div className="flex-1 min-w-0">{isKo ? '구분' : 'Category'}</div>
                  <div className="w-16 shrink-0 text-center">{isKo ? '수량' : 'Qty'}</div>
                  <div className="w-20 shrink-0 text-center">{isKo ? '금액($)' : 'Amount ($)'}</div>
                </div>

                {RESIDENT_MODAL_ROWS.map((row) => (
                  <div key={row.lineKey}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0 text-sm font-medium text-gray-700">
                        <span className="inline-flex items-center gap-1.5 leading-snug">
                          <span className={`w-3 h-3 shrink-0 rounded-full ${row.dotClass}`} />
                          <span className="break-words">
                            {isKo ? row.labelKo : row.labelEn}
                            {row.amountHint ? (
                              <span className="ml-1 text-xs font-normal text-gray-400">
                                ({isKo ? '패스 장수' : row.amountHint})
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </div>
                      <input
                        type="number"
                        value={residentStatusCounts[row.countField]}
                        onChange={(e) => {
                          const newCount = Math.max(0, Number(e.target.value) || 0)
                          const nextCounts = { ...residentStatusCounts, [row.countField]: newCount }
                          const actualPassCovered = calculateActualPassCovered(
                            nextCounts.nonResidentWithPass,
                            nextCounts.usResident,
                            nextCounts.nonResident,
                            nextCounts.nonResidentUnder16
                          )
                          const lineAmount = residentLineDefaultAmountUsd(row.lineKey, newCount)
                          setResidentStatusCounts({
                            ...nextCounts,
                            passCoveredCount: actualPassCovered,
                          })
                          setResidentStatusAmounts((prev) => ({
                            ...prev,
                            [row.lineKey]: lineAmount,
                          }))
                        }}
                        min="0"
                        className="w-16 shrink-0 px-1.5 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring text-sm text-center"
                      />
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={amounts[row.lineKey] ?? 0}
                        onChange={(e) => {
                          const v = e.target.value === '' ? 0 : Number(e.target.value)
                          const num = Number.isFinite(v) ? v : 0
                          setResidentStatusAmounts((prev) => ({
                            ...prev,
                            [row.lineKey]: num,
                          }))
                        }}
                        className="w-20 shrink-0 px-1.5 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-sm text-center"
                      />
                    </div>
                    {row.lineKey === 'non_resident_with_pass' ? (
                      <p className="mt-1 text-xs text-gray-500">
                        {isKo
                          ? `패스 ${residentStatusCounts.nonResidentWithPass}장 = ${residentStatusCounts.passCoveredCount}인 커버`
                          : `${residentStatusCounts.nonResidentWithPass} passes = covers ${residentStatusCounts.passCoveredCount} people`}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-sm text-gray-700">
                  {t('residentStatusTotal')}: {statusSum}
                  {isKo ? '명' : ` ${t('people')}`}
                </div>
                {statusSum !== totalPeople && (
                  <div className="text-xs text-orange-600 mt-1">⚠️ {t('peopleCountMismatch')}</div>
                )}
              </div>

              {productId ? (
                <p className="text-[11px] text-gray-500 leading-snug">
                  {isKo
                    ? '저장 시 거주 상태·금액이 예약 가격(총 결제 예정·잔액)에 반영됩니다.'
                    : 'Saving updates resident counts and amounts on reservation pricing and balance.'}
                </p>
              ) : null}

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {isKo ? '취소' : 'Cancel'}
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? (isKo ? '저장 중…' : 'Saving…') : isKo ? '저장' : 'Save'}
                </button>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <ReservationEvidenceUpload reservationId={reservationId} compact locale={locale} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
