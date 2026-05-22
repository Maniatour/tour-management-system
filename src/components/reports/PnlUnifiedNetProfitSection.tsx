'use client'

import React, { useMemo, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { AccountingTerm } from '@/components/ui/AccountingTerm'
import PnlStatementInflowDetailDialog, {
  type PnlStatementInflowDrillState,
} from '@/components/reports/PnlStatementInflowDetailDialog'
import type { PnlStatementInflowLine } from '@/lib/pnlReportDataFetch'
import { formatPnlMonthLabel, formatPnlMoney } from '@/lib/pnlPaymentRecords'

export type PnlDepositNetTotals = {
  netColTotals: Record<string, number>
  netTotal: number
}

export type PnlStatementInflowTotals = {
  monthly: Record<string, number>
  total: number
  lineCount: number
}

export type PnlCashBucketTotals = {
  monthly: Record<string, number>
  total: number
}

/** @deprecated alias — use PnlCashBucketTotals */
export type PnlCashDepositTotals = PnlCashBucketTotals

export type PnlCashPaymentDrill = { mode: 'cell'; month: string } | { mode: 'grand' }

interface PnlUnifiedNetProfitSectionProps {
  months: string[]
  depositNet: PnlDepositNetTotals | null
  depositLoading: boolean
  expenseColTotals: Record<string, number>
  expenseGrandTotal: number
  statementInflow: PnlStatementInflowTotals | null
  statementInflowDetailLines: PnlStatementInflowLine[]
  cashDeposit: PnlCashBucketTotals | null
  cashRefund: PnlCashBucketTotals | null
  onStatementInflowChanged?: () => void | Promise<void>
  onOpenCashPaymentDetail?: (drill: PnlCashPaymentDrill) => void
}

function profitClass(v: number): string {
  if (v > 0.005) return 'text-emerald-800 font-semibold'
  if (v < -0.005) return 'text-red-700 font-semibold'
  return 'text-slate-600'
}

export default function PnlUnifiedNetProfitSection({
  months,
  depositNet,
  depositLoading,
  expenseColTotals,
  expenseGrandTotal,
  statementInflow,
  statementInflowDetailLines,
  cashDeposit,
  cashRefund,
  onStatementInflowChanged,
  onOpenCashPaymentDetail,
}: PnlUnifiedNetProfitSectionProps) {
  const [statementDetailOpen, setStatementDetailOpen] = useState(false)
  const [statementDetailDrill, setStatementDetailDrill] = useState<PnlStatementInflowDrillState | null>(null)
  const { profitByMonth, profitTotal } = useMemo(() => {
    const profitByMonth: Record<string, number> = {}
    if (!depositNet) return { profitByMonth, profitTotal: 0 }
    for (const ym of months) {
      const inflow = depositNet.netColTotals[ym] ?? 0
      const outflow = expenseColTotals[ym] ?? 0
      profitByMonth[ym] = inflow - outflow
    }
    return {
      profitByMonth,
      profitTotal: depositNet.netTotal - expenseGrandTotal,
    }
  }, [months, depositNet, expenseColTotals, expenseGrandTotal])

  const { cashNetByMonth, cashNetTotal } = useMemo(() => {
    const cashNetByMonth: Record<string, number> = {}
    for (const ym of months) {
      cashNetByMonth[ym] = (cashDeposit?.monthly[ym] ?? 0) + (cashRefund?.monthly[ym] ?? 0)
    }
    const cashNetTotal = (cashDeposit?.total ?? 0) + (cashRefund?.total ?? 0)
    return { cashNetByMonth, cashNetTotal }
  }, [months, cashDeposit, cashRefund])

  const { refProfitByMonth, refProfitTotal } = useMemo(() => {
    const refProfitByMonth: Record<string, number> = {}
    for (const ym of months) {
      const stmt = statementInflow?.monthly[ym] ?? 0
      const cashNet = cashNetByMonth[ym] ?? 0
      const exp = expenseColTotals[ym] ?? 0
      refProfitByMonth[ym] = stmt + cashNet - exp
    }
    const refProfitTotal = (statementInflow?.total ?? 0) + cashNetTotal - expenseGrandTotal
    return { refProfitByMonth, refProfitTotal }
  }, [months, statementInflow, cashNetByMonth, cashNetTotal, expenseColTotals, expenseGrandTotal])

  const refReady =
    !depositLoading && statementInflow != null && cashDeposit != null && cashRefund != null

  if (months.length === 0) return null

  return (
    <div className="rounded-lg border-2 border-indigo-200 bg-gradient-to-b from-indigo-50/90 to-white p-4 shadow-sm">
      <h3 className="font-semibold flex flex-wrap items-center gap-x-2 gap-y-1 mb-2 text-indigo-950">
        <TrendingUp className="h-5 w-5 shrink-0 text-indigo-700" aria-hidden />
        <AccountingTerm termKey="순수익">순수익</AccountingTerm>
        <span className="font-normal text-gray-600 text-sm">(입금 순합계 − 지출 월 합계)</span>
      </h3>
      <p className="text-xs text-indigo-900/85 mb-3 leading-relaxed">
        입금 표의 <strong>순합계(상태별)</strong>에서 지출 표 <strong>월 합계</strong>를 뺀 값입니다. 현금 결제수단
        입금 행은 입금 순합계에 포함되지 않습니다.
      </p>
      <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 touch-pan-x">
        <table className="w-full min-w-[480px] text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="border-b border-indigo-200 text-left text-indigo-800/80 bg-indigo-100/50">
              <th className="py-2 pl-2 pr-3 font-medium sticky left-0 z-10 bg-indigo-100/80 min-w-[220px]">
                구분
              </th>
              {months.map((ym) => (
                <th key={ym} className="py-2 px-2 text-right font-medium whitespace-nowrap min-w-[88px]">
                  {formatPnlMonthLabel(ym)}
                </th>
              ))}
              <th className="py-2 pl-2 pr-2 text-right font-semibold min-w-[100px] bg-indigo-200/60">
                기간 합계
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-indigo-100/80 text-slate-700">
              <td className="py-2 pl-2 pr-3 sticky left-0 z-10 bg-white/90 text-[11px] sm:text-xs">
                입금 순합계
              </td>
              {months.map((ym) => (
                <td key={ym} className="py-2 px-2 text-right tabular-nums text-emerald-800">
                  {depositLoading ? (
                    <span className="text-gray-400">…</span>
                  ) : depositNet ? (
                    formatPnlMoney(depositNet.netColTotals[ym] ?? 0)
                  ) : (
                    '—'
                  )}
                </td>
              ))}
              <td className="py-2 pl-2 pr-2 text-right tabular-nums text-emerald-900 bg-emerald-50/50 font-medium">
                {depositLoading ? '…' : depositNet ? formatPnlMoney(depositNet.netTotal) : '—'}
              </td>
            </tr>
            <tr className="border-b border-indigo-100/80 text-slate-700">
              <td className="py-2 pl-2 pr-3 sticky left-0 z-10 bg-white/90 text-[11px] sm:text-xs">
                지출 월 합계
              </td>
              {months.map((ym) => (
                <td key={ym} className="py-2 px-2 text-right tabular-nums text-slate-800">
                  {formatPnlMoney(expenseColTotals[ym] ?? 0)}
                </td>
              ))}
              <td className="py-2 pl-2 pr-2 text-right tabular-nums bg-slate-100 font-medium">
                {formatPnlMoney(expenseGrandTotal)}
              </td>
            </tr>
            <tr className="bg-indigo-100/70 font-semibold border-t-2 border-indigo-300">
              <td className="py-2.5 pl-2 pr-3 sticky left-0 z-10 bg-indigo-100/90 text-indigo-950">
                = 순수익
              </td>
              {months.map((ym) => {
                const v = profitByMonth[ym] ?? 0
                const ready = !depositLoading && depositNet
                return (
                  <td key={ym} className={`py-2.5 px-2 text-right tabular-nums ${ready ? profitClass(v) : ''}`}>
                    {!ready ? '…' : v !== 0 ? formatPnlMoney(v) : '—'}
                  </td>
                )
              })}
              <td
                className={`py-2.5 pl-2 pr-2 text-right tabular-nums bg-indigo-200/80 ${
                  !depositLoading && depositNet ? profitClass(profitTotal) : ''
                }`}
              >
                {!depositLoading && depositNet
                  ? formatPnlMoney(profitTotal)
                  : '…'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-3 border-t border-indigo-200/80">
        <p className="text-xs font-semibold text-slate-700 mb-2">참고</p>
        <p className="text-xs text-slate-600 mb-2 leading-relaxed">
          <strong>+ 명세 입금</strong> + <strong>현금 (입금·환불 합계)</strong> − <strong>지출 월 합계</strong>
          입니다. 셀을 누르면 내역이 열립니다. 위 순수익(상태별 입금 순합계 기준)과는 별도 대조용입니다.
        </p>
        <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 touch-pan-x">
          <table className="w-full min-w-[480px] text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-gray-500 bg-slate-50/90">
                <th className="py-2 pl-2 pr-3 font-medium sticky left-0 z-10 bg-slate-50/95 min-w-[220px]">
                  구분
                </th>
                {months.map((ym) => (
                  <th key={ym} className="py-2 px-2 text-right font-medium whitespace-nowrap min-w-[88px]">
                    {formatPnlMonthLabel(ym)}
                  </th>
                ))}
                <th className="py-2 pl-2 pr-2 text-right font-semibold min-w-[100px] bg-slate-100/80">
                  기간 합계
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200 text-slate-700">
                <td className="py-2 pl-2 pr-3 sticky left-0 z-10 bg-white/90 text-[11px] sm:text-xs">
                  + 명세 입금
                </td>
                {months.map((ym) => {
                  const v = statementInflow?.monthly[ym] ?? 0
                  return (
                    <td key={ym} className="py-1 px-2 text-right tabular-nums text-emerald-800 text-[11px] sm:text-xs">
                      <button
                        type="button"
                        disabled={!refReady}
                        className={`w-full min-h-[32px] rounded px-1 py-0.5 -mx-1 disabled:opacity-60 ${
                          v !== 0 ? 'hover:underline hover:bg-slate-50' : 'text-gray-400 hover:bg-slate-50'
                        }`}
                        title="명세 입금 줄 내역"
                        onClick={() => {
                          setStatementDetailDrill({ mode: 'cell', month: ym })
                          setStatementDetailOpen(true)
                        }}
                      >
                        {!refReady ? '…' : v !== 0 ? formatPnlMoney(v) : '—'}
                      </button>
                    </td>
                  )
                })}
                <td className="py-1 pl-2 pr-2 text-right tabular-nums text-emerald-900 bg-emerald-50/40 font-medium text-[11px] sm:text-xs">
                  <button
                    type="button"
                    disabled={!refReady}
                    className="w-full min-h-[32px] hover:underline disabled:opacity-60"
                    title="기간 전체 명세 입금"
                    onClick={() => {
                      setStatementDetailDrill({ mode: 'grand' })
                      setStatementDetailOpen(true)
                    }}
                  >
                    {!refReady ? '…' : formatPnlMoney(statementInflow?.total ?? 0)}
                  </button>
                </td>
              </tr>
              <tr className="border-b border-slate-200 text-slate-700">
                <td className="py-2 pl-2 pr-3 sticky left-0 z-10 bg-white/90 text-[11px] sm:text-xs text-teal-900">
                  + 현금 (입금·환불)
                </td>
                {months.map((ym) => {
                  const v = cashNetByMonth[ym] ?? 0
                  return (
                    <td key={ym} className="py-1 px-2 text-right tabular-nums text-[11px] sm:text-xs">
                      <button
                        type="button"
                        disabled={!refReady || !onOpenCashPaymentDetail}
                        className={`w-full min-h-[32px] rounded px-1 py-0.5 -mx-1 disabled:opacity-60 ${
                          v > 0.005
                            ? 'text-teal-800 hover:underline hover:bg-teal-50/50'
                            : v < -0.005
                              ? 'text-red-700 hover:underline hover:bg-rose-50/50'
                              : 'text-gray-400 hover:bg-slate-50'
                        }`}
                        title="현금 결제수단 입금·환불(payment_records)"
                        onClick={() => onOpenCashPaymentDetail?.({ mode: 'cell', month: ym })}
                      >
                        {!refReady ? '…' : v !== 0 ? formatPnlMoney(v) : '—'}
                      </button>
                    </td>
                  )
                })}
                <td className="py-1 pl-2 pr-2 text-right tabular-nums bg-teal-50/40 font-medium text-[11px] sm:text-xs">
                  <button
                    type="button"
                    disabled={!refReady || !onOpenCashPaymentDetail}
                    className={`w-full min-h-[32px] hover:underline disabled:opacity-60 ${
                      cashNetTotal > 0.005
                        ? 'text-teal-900'
                        : cashNetTotal < -0.005
                          ? 'text-red-700'
                          : ''
                    }`}
                    title="기간 전체 현금 입금·환불"
                    onClick={() => onOpenCashPaymentDetail?.({ mode: 'grand' })}
                  >
                    {!refReady ? '…' : formatPnlMoney(cashNetTotal)}
                  </button>
                </td>
              </tr>
              <tr className="border-b border-slate-200 text-slate-700">
                <td className="py-2 pl-2 pr-3 sticky left-0 z-10 bg-white/90 text-[11px] sm:text-xs">
                  − 지출
                </td>
                {months.map((ym) => (
                  <td key={ym} className="py-2 px-2 text-right tabular-nums text-slate-800 text-[11px] sm:text-xs">
                    {formatPnlMoney(expenseColTotals[ym] ?? 0)}
                  </td>
                ))}
                <td className="py-2 pl-2 pr-2 text-right tabular-nums bg-slate-100 font-medium text-[11px] sm:text-xs">
                  {formatPnlMoney(expenseGrandTotal)}
                </td>
              </tr>
              <tr className="bg-slate-100/80 font-semibold border-t-2 border-slate-300">
                <td className="py-2.5 pl-2 pr-3 sticky left-0 z-10 bg-slate-100/95 text-slate-950 text-[11px] sm:text-xs">
                  = 순수익
                </td>
                {months.map((ym) => {
                  const v = refProfitByMonth[ym] ?? 0
                  return (
                    <td
                      key={ym}
                      className={`py-2.5 px-2 text-right tabular-nums text-[11px] sm:text-xs ${
                        refReady ? profitClass(v) : ''
                      }`}
                    >
                      {!refReady ? '…' : v !== 0 ? formatPnlMoney(v) : '—'}
                    </td>
                  )
                })}
                <td
                  className={`py-2.5 pl-2 pr-2 text-right tabular-nums bg-slate-200/80 text-[11px] sm:text-xs ${
                    refReady ? profitClass(refProfitTotal) : ''
                  }`}
                >
                  {!refReady ? '…' : formatPnlMoney(refProfitTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <PnlStatementInflowDetailDialog
        open={statementDetailOpen}
        onOpenChange={setStatementDetailOpen}
        drill={statementDetailDrill}
        lines={statementInflowDetailLines}
        formatMonthLabel={formatPnlMonthLabel}
        onChanged={onStatementInflowChanged}
      />
    </div>
  )
}
