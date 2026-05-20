'use client'

import React, { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import { AccountingTerm } from '@/components/ui/AccountingTerm'
import { formatPnlMonthLabel, formatPnlMoney } from '@/lib/pnlPaymentRecords'

export type PnlDepositNetTotals = {
  netColTotals: Record<string, number>
  netTotal: number
}

interface PnlUnifiedNetProfitSectionProps {
  months: string[]
  depositNet: PnlDepositNetTotals | null
  depositLoading: boolean
  expenseColTotals: Record<string, number>
  expenseGrandTotal: number
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
}: PnlUnifiedNetProfitSectionProps) {
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
    </div>
  )
}
