'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale } from 'next-intl'
import { ArrowDownCircle } from 'lucide-react'
import { getCashPaymentMethodFilterValues } from '@/lib/cashPaymentMethodValues'
import { isPaymentRequestedStatus } from '@/utils/reservationPricingBalance'
import {
  aggregatePnlStatementInflows,
  buildPnlStatementInflowDetailLines,
  fetchPaymentRecordsForPnlReport,
  fetchStatementInflowsForPnlReport,
  type PnlStatementInflowLine,
} from '@/lib/pnlReportDataFetch'
import PnlStatementInflowDetailDialog, {
  type PnlStatementInflowDrillState,
} from '@/components/reports/PnlStatementInflowDetailDialog'
import { AccountingTerm } from '@/components/ui/AccountingTerm'
import {
  aggregatePnlPaymentRecords,
  buildPnlDepositTableRows,
  enumerateMonthsInclusive,
  formatPnlMonthLabel,
  formatPnlMoney,
  mergePnlDepositMonthlyCells,
  type PnlDepositBucketKey,
  type PnlDepositTableRow,
  type PnlPaymentRecordLine,
} from '@/lib/pnlPaymentRecords'
import PnlUnifiedDepositDetailDialog, {
  type PnlDepositDrillState,
} from '@/components/reports/PnlUnifiedDepositDetailDialog'
import type {
  PnlCashBucketTotals,
  PnlCashPaymentDrill,
  PnlDepositNetTotals,
  PnlStatementInflowTotals,
} from '@/components/reports/PnlUnifiedNetProfitSection'

interface PnlUnifiedDepositSectionProps {
  dateRange: { start: string; end: string }
  onLoadingChange?: (loading: boolean) => void
  onNetTotalsReady?: (totals: PnlDepositNetTotals) => void
  onStatementInflowReady?: (totals: PnlStatementInflowTotals) => void
  onStatementInflowDetailLinesReady?: (lines: PnlStatementInflowLine[]) => void
  onRegisterReloadStatementInflows?: (fn: () => Promise<void>) => void
  onCashDepositTotalsReady?: (totals: PnlCashBucketTotals) => void
  onCashRefundTotalsReady?: (totals: PnlCashBucketTotals) => void
  onRegisterOpenCashPaymentDetail?: (fn: (drill: PnlCashPaymentDrill) => void) => void
}

function bucketKeysInGroup(tableRows: PnlDepositTableRow[], groupIndex: number): PnlDepositBucketKey[] {
  const keys: PnlDepositBucketKey[] = []
  for (let i = groupIndex + 1; i < tableRows.length; i++) {
    const r = tableRows[i]
    if (r.kind === 'group') break
    if (r.kind === 'bucket') keys.push(r.rowKey)
  }
  return keys
}

export default function PnlUnifiedDepositSection({
  dateRange,
  onLoadingChange,
  onNetTotalsReady,
  onStatementInflowReady,
  onStatementInflowDetailLinesReady,
  onRegisterReloadStatementInflows,
  onCashDepositTotalsReady,
  onCashRefundTotalsReady,
  onRegisterOpenCashPaymentDetail,
}: PnlUnifiedDepositSectionProps) {
  const locale = useLocale()
  const [loading, setLoading] = useState(true)
  const [monthlyCells, setMonthlyCells] = useState<Record<string, Record<string, number>>>({})
  const [detailLines, setDetailLines] = useState<PnlPaymentRecordLine[]>([])
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailDrill, setDetailDrill] = useState<PnlDepositDrillState | null>(null)
  const [recordCount, setRecordCount] = useState(0)
  const [statementInflowMonthly, setStatementInflowMonthly] = useState<Record<string, number>>({})
  const [statementInflowTotal, setStatementInflowTotal] = useState(0)
  const [statementInflowLineCount, setStatementInflowLineCount] = useState(0)
  const [statementInflowDetailLines, setStatementInflowDetailLines] = useState<PnlStatementInflowLine[]>([])
  const [statementDetailOpen, setStatementDetailOpen] = useState(false)
  const [statementDetailDrill, setStatementDetailDrill] = useState<PnlStatementInflowDrillState | null>(null)

  const tableRows = useMemo(() => buildPnlDepositTableRows(locale), [locale])
  const months = useMemo(
    () => enumerateMonthsInclusive(dateRange.start, dateRange.end),
    [dateRange.start, dateRange.end]
  )

  useEffect(() => {
    onLoadingChange?.(loading)
  }, [loading, onLoadingChange])

  const applyStatementInflowData = useCallback(async (rawRows: Awaited<ReturnType<typeof fetchStatementInflowsForPnlReport>>['data']) => {
    const agg = aggregatePnlStatementInflows(rawRows)
    setStatementInflowMonthly(agg.monthly)
    setStatementInflowTotal(agg.total)
    setStatementInflowLineCount(agg.lineCount)
    try {
      const detail = await buildPnlStatementInflowDetailLines(rawRows)
      setStatementInflowDetailLines(detail)
    } catch (e) {
      console.error('통합 PNL 명세 입금 상세 구성 오류:', e)
      setStatementInflowDetailLines([])
    }
  }, [])

  const reloadStatementInflows = useCallback(async () => {
    const statementRes = await fetchStatementInflowsForPnlReport(dateRange.start, dateRange.end)
    if (statementRes.error) {
      console.error('통합 PNL 명세 입금 조회 오류:', statementRes.error)
      setStatementInflowMonthly({})
      setStatementInflowTotal(0)
      setStatementInflowLineCount(0)
      setStatementInflowDetailLines([])
      return
    }
    await applyStatementInflowData(statementRes.data)
  }, [dateRange.start, dateRange.end, applyStatementInflowData])

  useEffect(() => {
    onRegisterReloadStatementInflows?.(reloadStatementInflows)
  }, [onRegisterReloadStatementInflows, reloadStatementInflows])

  const openCashPaymentDetail = useCallback((drill: PnlCashPaymentDrill) => {
    if (drill.mode === 'grand') {
      setDetailDrill({ mode: 'cash_net', scope: 'grand', rowTitle: '현금 입금·환불 · 기간 합계' })
    } else {
      setDetailDrill({
        mode: 'cash_net',
        scope: 'cell',
        month: drill.month,
        rowTitle: '현금 입금·환불',
      })
    }
    setDetailOpen(true)
  }, [])

  useEffect(() => {
    onRegisterOpenCashPaymentDetail?.(openCashPaymentDetail)
  }, [onRegisterOpenCashPaymentDetail, openCashPaymentDetail])

  const loadDeposits = useCallback(async () => {
    setLoading(true)
    const startISO = new Date(dateRange.start + 'T00:00:00').toISOString()
    const endISO = new Date(dateRange.end + 'T23:59:59.999').toISOString()

    const [cashMethods, { data: rows, error }, statementRes] = await Promise.all([
      getCashPaymentMethodFilterValues(),
      fetchPaymentRecordsForPnlReport(startISO, endISO),
      fetchStatementInflowsForPnlReport(dateRange.start, dateRange.end),
    ])

    if (statementRes.error) {
      console.error('통합 PNL 명세 입금 조회 오류:', statementRes.error)
      setStatementInflowMonthly({})
      setStatementInflowTotal(0)
      setStatementInflowLineCount(0)
      setStatementInflowDetailLines([])
    } else {
      await applyStatementInflowData(statementRes.data)
    }

    if (error) {
      console.error('통합 PNL payment_records 조회 오류:', error)
      setMonthlyCells({})
      setDetailLines([])
      setRecordCount(0)
      setLoading(false)
      return
    }

    const cashSet = new Set(cashMethods)
    const { statusMonthly, cashMonthly, statusLines, cashLines } = aggregatePnlPaymentRecords(
      rows,
      cashSet
    )

    setMonthlyCells(mergePnlDepositMonthlyCells(statusMonthly, cashMonthly))
    setDetailLines([...statusLines, ...cashLines])
    setRecordCount(
      rows.filter((r) => r.submit_on && !isPaymentRequestedStatus(r.payment_status)).length
    )
    setLoading(false)
  }, [dateRange, applyStatementInflowData])

  useEffect(() => {
    void loadDeposits()
  }, [loadDeposits])

  const excludeFromNet = useMemo(() => {
    const s = new Set<PnlDepositBucketKey>()
    for (const row of tableRows) {
      if (row.kind === 'bucket' && row.excludeFromNetTotal) s.add(row.rowKey)
    }
    return s
  }, [tableRows])

  const { rowTotals, colTotals, grandTotal, netTotal, netColTotals } = useMemo(() => {
    const bucketKeys = Object.keys(monthlyCells)
    const rowTotals: Record<string, number> = {}
    for (const k of bucketKeys) {
      rowTotals[k] = Object.values(monthlyCells[k] || {}).reduce((s, v) => s + v, 0)
    }
    const colTotals: Record<string, number> = {}
    const netColTotals: Record<string, number> = {}
    for (const ym of months) {
      let s = 0
      let net = 0
      for (const k of bucketKeys) {
        const v = monthlyCells[k]?.[ym] ?? 0
        s += v
        if (!excludeFromNet.has(k as PnlDepositBucketKey)) net += v
      }
      colTotals[ym] = s
      netColTotals[ym] = net
    }
    const grandTotal = bucketKeys.reduce((sum, k) => sum + (rowTotals[k] ?? 0), 0)
    const netTotal = bucketKeys
      .filter((k) => !excludeFromNet.has(k as PnlDepositBucketKey))
      .reduce((sum, k) => sum + (rowTotals[k] ?? 0), 0)
    return { rowTotals, colTotals, grandTotal, netTotal, netColTotals }
  }, [monthlyCells, months, excludeFromNet])

  useEffect(() => {
    if (loading || !onNetTotalsReady) return
    onNetTotalsReady({ netColTotals, netTotal })
  }, [loading, netColTotals, netTotal, onNetTotalsReady])

  useEffect(() => {
    if (loading) return
    if (onCashDepositTotalsReady) {
      const cashCells = monthlyCells.cash_deposit ?? {}
      const total = Object.values(cashCells).reduce((s, v) => s + v, 0)
      onCashDepositTotalsReady({ monthly: { ...cashCells }, total })
    }
    if (onCashRefundTotalsReady) {
      const refundCells = monthlyCells.cash_refund ?? {}
      const total = Object.values(refundCells).reduce((s, v) => s + v, 0)
      onCashRefundTotalsReady({ monthly: { ...refundCells }, total })
    }
  }, [loading, monthlyCells, onCashDepositTotalsReady, onCashRefundTotalsReady])

  useEffect(() => {
    if (loading || !onStatementInflowReady) return
    onStatementInflowReady({
      monthly: statementInflowMonthly,
      total: statementInflowTotal,
      lineCount: statementInflowLineCount,
    })
  }, [
    loading,
    statementInflowMonthly,
    statementInflowTotal,
    statementInflowLineCount,
    onStatementInflowReady,
  ])

  useEffect(() => {
    if (loading) return
    onStatementInflowDetailLinesReady?.(statementInflowDetailLines)
  }, [loading, statementInflowDetailLines, onStatementInflowDetailLinesReady])

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="font-semibold flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
          <ArrowDownCircle className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
          <span>
            <AccountingTerm termKey="통합지출">통합</AccountingTerm> 입금
          </span>
          <span className="font-normal text-gray-600 text-sm">(payment_records)</span>
        </h3>
        <p className="text-xs sm:text-sm text-gray-600 mb-3 break-words">
          기간 {dateRange.start} ~ {dateRange.end} · 제출일(submit_on) 기준 {recordCount.toLocaleString()}건 ·
          환불·Returned는 음수로 표시합니다. 보증금·잔금·환불 <strong>요청</strong> 상태(Deposit Requested 등)는 실입금이
          아니므로 집계·기타 입금에서 제외합니다.
        </p>
            <p className="text-xs text-emerald-900/90 bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2 mb-3">
          금액·합계 셀을 누르면 상세 목록이 열립니다. 하단 <strong>참고 › 명세 입금</strong> 셀도 클릭하면 명세 줄
          내역을 볼 수 있습니다. <strong>현금 결제수단</strong> 행은 현금 리포트 참고용이며 <strong>순합계</strong>에는
          넣지 않습니다(상태별 합계와 중복).
        </p>
        <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 touch-pan-x">
          <table className="w-full min-w-[480px] text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-gray-500 bg-emerald-50/80">
                <th className="py-2 pl-2 pr-3 font-medium sticky left-0 z-20 bg-emerald-50/95 min-w-[220px]">
                  구분
                </th>
                {months.map((ym) => (
                  <th key={ym} className="py-2 px-2 text-right font-medium whitespace-nowrap min-w-[88px]">
                    {formatPnlMonthLabel(ym)}
                  </th>
                ))}
                <th className="py-2 pl-2 pr-2 text-right font-semibold min-w-[100px] bg-emerald-100/80">
                  합계
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, rowIndex) => {
                if (row.kind === 'group') {
                  const leafKeys = bucketKeysInGroup(tableRows, rowIndex)
                  const groupMonthSum = (ym: string) =>
                    leafKeys.reduce((s, id) => s + (monthlyCells[id]?.[ym] ?? 0), 0)
                  const groupPeriodSum = leafKeys.reduce((s, id) => s + (rowTotals[id] ?? 0), 0)
                  return (
                    <tr key={row.rowKey} className="bg-emerald-100/70 border-b border-emerald-200/80">
                      <td className="py-1.5 pl-3 pr-2 text-[11px] sm:text-xs font-semibold text-emerald-950 sticky left-0 z-10 bg-emerald-100/95">
                        {row.label}
                      </td>
                      {months.map((ym) => {
                        const v = groupMonthSum(ym)
                        return (
                          <td
                            key={ym}
                            className="py-1.5 px-2 text-right tabular-nums font-semibold text-emerald-900 text-[11px] sm:text-xs"
                          >
                            {v !== 0 ? formatPnlMoney(v) : '—'}
                          </td>
                        )
                      })}
                      <td className="py-1.5 pl-2 pr-2 text-right tabular-nums font-semibold text-emerald-950 bg-emerald-200/60 text-[11px] sm:text-xs">
                        {groupPeriodSum !== 0 ? formatPnlMoney(groupPeriodSum) : '—'}
                      </td>
                    </tr>
                  )
                }

                const dataKey = row.rowKey
                const vRow = rowTotals[dataKey] ?? 0
                const isCash = row.excludeFromNetTotal
                return (
                  <tr key={row.rowKey} className="border-b border-gray-100 hover:bg-emerald-50/40">
                    <td
                      className={`py-2 pr-3 sticky left-0 z-10 text-[11px] sm:text-xs bg-white shadow-[2px_0_4px_rgba(15,23,42,0.06)] ${
                        row.indent ? 'pl-5 sm:pl-7' : 'pl-2'
                      } ${isCash ? 'text-teal-900' : ''}`}
                    >
                      {row.label}
                    </td>
                    {months.map((ym) => {
                      const v = monthlyCells[dataKey]?.[ym] ?? 0
                      return (
                        <td key={ym} className="py-1 px-2 text-right tabular-nums">
                          <button
                            type="button"
                            className={`w-full min-h-[36px] rounded px-1 py-1 -mx-1 ${
                              v !== 0
                                ? 'text-emerald-800 hover:bg-emerald-50 hover:underline'
                                : 'text-gray-400 hover:bg-slate-100'
                            }`}
                            onClick={() => {
                              setDetailDrill({
                                mode: 'cell',
                                bucketKey: dataKey,
                                month: ym,
                                rowTitle: row.label,
                              })
                              setDetailOpen(true)
                            }}
                          >
                            {v !== 0 ? formatPnlMoney(v) : '—'}
                          </button>
                        </td>
                      )
                    })}
                    <td className="py-1 pl-2 pr-2 text-right tabular-nums font-medium bg-emerald-50/50">
                      <button
                        type="button"
                        className="w-full min-h-[36px] text-emerald-900 hover:bg-emerald-50 hover:underline"
                        onClick={() => {
                          setDetailDrill({
                            mode: 'row',
                            bucketKey: dataKey,
                            rowTitle: `${row.label} · 기간 합계`,
                          })
                          setDetailOpen(true)
                        }}
                      >
                        {formatPnlMoney(vRow)}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {months.length > 0 && (
              <tfoot>
                <tr className="font-semibold border-t border-slate-200 bg-slate-50/90 text-slate-700 text-xs">
                  <td className="py-2 pl-2 sticky left-0 bg-slate-50/95">전체 (현금 행 포함)</td>
                  {months.map((ym) => (
                    <td key={ym} className="py-1 px-2 text-right tabular-nums">
                      {formatPnlMoney(colTotals[ym] ?? 0)}
                    </td>
                  ))}
                  <td className="py-1 pl-2 pr-2 text-right tabular-nums bg-slate-100">
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => {
                        setDetailDrill({ mode: 'grand' })
                        setDetailOpen(true)
                      }}
                    >
                      {formatPnlMoney(grandTotal)}
                    </button>
                  </td>
                </tr>
                <tr className="font-semibold border-t-2 border-emerald-300 bg-emerald-50">
                  <td className="py-2 pl-2 sticky left-0 bg-emerald-50 text-emerald-950">
                    순합계 (상태별)
                  </td>
                  {months.map((ym) => (
                    <td key={ym} className="py-1 px-2 text-right tabular-nums text-emerald-900">
                      <button
                        type="button"
                        className="w-full hover:underline"
                        onClick={() => {
                          setDetailDrill({ mode: 'col', month: ym })
                          setDetailOpen(true)
                        }}
                      >
                        {formatPnlMoney(netColTotals[ym] ?? 0)}
                      </button>
                    </td>
                  ))}
                  <td className="py-1 pl-2 pr-2 text-right tabular-nums bg-emerald-100 text-emerald-950">
                    <button
                      type="button"
                      className="w-full font-semibold hover:underline"
                      onClick={() => {
                        setDetailDrill({ mode: 'net' })
                        setDetailOpen(true)
                      }}
                    >
                      {formatPnlMoney(netTotal)}
                    </button>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {months.length > 0 ? (
          <div className="mt-4 pt-3 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-700 mb-2">참고</p>
            <p className="text-xs text-slate-600 mb-2 break-words">
              <AccountingTerm termKey="명세대조">명세 대조</AccountingTerm>에 업로드한 은행·카드 명세의{' '}
              <strong>수입(입금)</strong> 줄 합계입니다. 거래일(posted_date) 기준 ·{' '}
              {statementInflowLineCount.toLocaleString()}건 ·{' '}
              <AccountingTerm termKey="PNL제외">PNL 제외</AccountingTerm>·개인(use) 처리한 줄은 빼었습니다. 금액
              셀을 누르면 줄별로 제외·개인을 바꿀 수 있습니다. 위 <strong>통합 입금</strong>·<strong>순합계</strong>에는
              포함되지 않습니다.
            </p>
            <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 touch-pan-x">
              <table className="w-full min-w-[480px] text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="border-b text-left text-gray-500 bg-slate-50/90">
                    <th className="py-2 pl-2 pr-3 font-medium sticky left-0 z-20 bg-slate-50/95 min-w-[220px]">
                      구분
                    </th>
                    {months.map((ym) => (
                      <th key={ym} className="py-2 px-2 text-right font-medium whitespace-nowrap min-w-[88px]">
                        {formatPnlMonthLabel(ym)}
                      </th>
                    ))}
                    <th className="py-2 pl-2 pr-2 text-right font-semibold min-w-[100px] bg-slate-100/80">
                      합계
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <td className="py-2 pl-2 pr-3 sticky left-0 z-10 bg-slate-50/95 text-[11px] sm:text-xs font-medium text-slate-800">
                      명세 입금
                      <span className="block font-normal text-slate-500 text-[10px] sm:text-[11px] mt-0.5">
                        (statement_lines · inflow)
                      </span>
                    </td>
                    {months.map((ym) => {
                      const v = statementInflowMonthly[ym] ?? 0
                      return (
                        <td key={ym} className="py-1 px-2 text-right tabular-nums text-[11px] sm:text-xs">
                          <button
                            type="button"
                            className={`w-full min-h-[36px] rounded px-1 py-1 -mx-1 ${
                              v !== 0
                                ? 'text-slate-900 hover:bg-slate-100 hover:underline font-medium'
                                : 'text-gray-400 hover:bg-slate-50'
                            }`}
                            onClick={() => {
                              setStatementDetailDrill({ mode: 'cell', month: ym })
                              setStatementDetailOpen(true)
                            }}
                          >
                            {v !== 0 ? formatPnlMoney(v) : '—'}
                          </button>
                        </td>
                      )
                    })}
                    <td className="py-1 pl-2 pr-2 text-right tabular-nums font-semibold bg-slate-100/60 text-[11px] sm:text-xs">
                      <button
                        type="button"
                        className="w-full min-h-[36px] text-slate-900 hover:bg-slate-100 hover:underline"
                        onClick={() => {
                          setStatementDetailDrill({ mode: 'grand' })
                          setStatementDetailOpen(true)
                        }}
                      >
                        {statementInflowTotal !== 0 ? formatPnlMoney(statementInflowTotal) : '—'}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      <PnlUnifiedDepositDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        drill={detailDrill}
        lines={detailLines}
        formatMonthLabel={formatPnlMonthLabel}
      />

      <PnlStatementInflowDetailDialog
        open={statementDetailOpen}
        onOpenChange={setStatementDetailOpen}
        drill={statementDetailDrill}
        lines={statementInflowDetailLines}
        formatMonthLabel={formatPnlMonthLabel}
        onChanged={reloadStatementInflows}
      />
    </>
  )
}
