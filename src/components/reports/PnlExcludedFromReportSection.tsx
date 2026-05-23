'use client'

import React, { useMemo } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AccountingTerm } from '@/components/ui/AccountingTerm'

function formatMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function aggregateByYearMonth(
  months: string[],
  getAmount: (ym: string) => number
): { monthly: Record<string, number>; total: number } {
  const monthly: Record<string, number> = {}
  let total = 0
  for (const ym of months) {
    const v = getAmount(ym)
    monthly[ym] = v
    total += v
  }
  return { monthly, total }
}

type PnlExcludedFromReportSectionProps = {
  months: string[]
  formatMonthLabel: (ym: string) => string
  dateRangeLabel: string
  excludedExpenseCount: number
  excludedExpenseByMonth: Record<string, number>
  excludedExpenseTotal: number
  excludedInflowCount: number
  excludedInflowByMonth: Record<string, number>
  excludedInflowTotal: number
  onOpenExcludedExpenses: () => void
  onOpenExcludedInflows: () => void
  onOpenExcludedInflowsMonth?: (ym: string) => void
}

export default function PnlExcludedFromReportSection({
  months,
  formatMonthLabel,
  dateRangeLabel,
  excludedExpenseCount,
  excludedExpenseByMonth,
  excludedExpenseTotal,
  excludedInflowCount,
  excludedInflowByMonth,
  excludedInflowTotal,
  onOpenExcludedExpenses,
  onOpenExcludedInflows,
  onOpenExcludedInflowsMonth,
}: PnlExcludedFromReportSectionProps) {
  const hasExpenses = excludedExpenseCount > 0
  const hasInflows = excludedInflowCount > 0
  const hasAny = hasExpenses || hasInflows

  const expenseColTotals = useMemo(
    () => aggregateByYearMonth(months, (ym) => excludedExpenseByMonth[ym] ?? 0),
    [months, excludedExpenseByMonth]
  )

  const inflowColTotals = useMemo(
    () => aggregateByYearMonth(months, (ym) => excludedInflowByMonth[ym] ?? 0),
    [months, excludedInflowByMonth]
  )

  if (!hasAny) {
    return (
      <section className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
        <h3 className="font-semibold text-slate-800 mb-1">
          <AccountingTerm termKey="PNL제외">PNL 제외</AccountingTerm> 지출·입금
        </h3>
        <p className="text-xs leading-relaxed">
          기간 {dateRangeLabel}에 <strong>exclude_from_pnl</strong> 또는 명세 입금의{' '}
          <AccountingTerm termKey="PNL제외">PNL 제외</AccountingTerm>·개인(use)으로 집계에서 빠진 건이 없습니다.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-amber-200/80 bg-amber-50/30 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">
            <AccountingTerm termKey="PNL제외">PNL 제외</AccountingTerm> 지출·입금
          </h3>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
            위 <strong>통합 지출</strong>·<strong>통합 입금</strong>·<strong>순수익</strong> 표에 포함되지 않은
            항목만 모았습니다. 회사·투어·예약 지출의 PNL 제외 플래그, 명세 입금의 PNL 제외·개인(use) 줄이 해당합니다.
            (입장권·호텔 부킹은 PNL 제외 옵션이 없습니다.)
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-white/80 bg-white p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-800">
              제외 지출
              <span className="ml-1.5 text-xs font-normal text-slate-500">
                ({excludedExpenseCount.toLocaleString()}건 · 합계 {formatMoney(excludedExpenseTotal)})
              </span>
            </p>
            {hasExpenses ? (
              <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={onOpenExcludedExpenses}>
                <ExternalLink className="h-3.5 w-3.5 mr-1" aria-hidden />
                상세 보기
              </Button>
            ) : null}
          </div>
          {hasExpenses ? (
            <div className="overflow-x-auto -mx-1 px-1 touch-pan-x">
              <table className="w-full min-w-[320px] text-xs border-collapse">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-1.5 pr-2 text-left font-medium">월</th>
                    <th className="py-1.5 text-right font-medium">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((ym) => {
                    const v = excludedExpenseByMonth[ym] ?? 0
                    if (v === 0) return null
                    return (
                      <tr key={ym} className="border-b border-gray-100">
                        <td className="py-1 pr-2">{formatMonthLabel(ym)}</td>
                        <td className="py-1 text-right tabular-nums font-medium">{formatMoney(v)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-semibold border-t">
                    <td className="py-1.5 pr-2">합계</td>
                    <td className="py-1.5 text-right tabular-nums">{formatMoney(expenseColTotals.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-500">해당 기간에 PNL 제외 지출이 없습니다.</p>
          )}
        </div>

        <div className="rounded-md border border-white/80 bg-white p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-800">
              제외 입금 (명세)
              <span className="ml-1.5 text-xs font-normal text-slate-500">
                ({excludedInflowCount.toLocaleString()}건 · 합계 {formatMoney(excludedInflowTotal)})
              </span>
            </p>
            {hasInflows ? (
              <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={onOpenExcludedInflows}>
                <ExternalLink className="h-3.5 w-3.5 mr-1" aria-hidden />
                상세 보기
              </Button>
            ) : null}
          </div>
          {hasInflows ? (
            <div className="overflow-x-auto -mx-1 px-1 touch-pan-x">
              <table className="w-full min-w-[320px] text-xs border-collapse">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-1.5 pr-2 text-left font-medium">월</th>
                    <th className="py-1.5 text-right font-medium">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((ym) => {
                    const v = excludedInflowByMonth[ym] ?? 0
                    if (v === 0) return null
                    return (
                      <tr key={ym} className="border-b border-gray-100">
                        <td className="py-1 pr-2">
                          {onOpenExcludedInflowsMonth ? (
                            <button
                              type="button"
                              className="text-blue-800 hover:underline underline-offset-2"
                              onClick={() => onOpenExcludedInflowsMonth(ym)}
                            >
                              {formatMonthLabel(ym)}
                            </button>
                          ) : (
                            formatMonthLabel(ym)
                          )}
                        </td>
                        <td className="py-1 text-right tabular-nums font-medium">{formatMoney(v)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-semibold border-t">
                    <td className="py-1.5 pr-2">합계</td>
                    <td className="py-1.5 text-right tabular-nums">{formatMoney(inflowColTotals.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-500">해당 기간에 PNL 제외·개인 명세 입금이 없습니다.</p>
          )}
        </div>
      </div>
    </section>
  )
}
