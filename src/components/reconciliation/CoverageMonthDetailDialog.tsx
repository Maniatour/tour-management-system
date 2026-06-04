'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatStatementLineDescription } from '@/lib/statement-display'

export type CoverageMonthStatementLine = {
  id: string
  posted_date: string
  amount: number | string
  direction: string
  description: string | null
  merchant: string | null
  matched_status: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  year: number
  /** 1–12 */
  month: number
  accountLabel: string
  lines: CoverageMonthStatementLine[]
  stats: { reconciled: number; uploaded: number }
}

function matchedStatusLabel(status: string | null): string {
  switch (status) {
    case 'matched':
      return '대조'
    case 'partial':
      return '부분 대조'
    case 'unmatched':
      return '미대조'
    default:
      return status?.trim() || '—'
  }
}

function isReconciledStatus(status: string | null): boolean {
  return status === 'matched' || status === 'partial'
}

export default function CoverageMonthDetailDialog({
  open,
  onOpenChange,
  year,
  month,
  accountLabel,
  lines,
  stats,
}: Props) {
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return lines
    const terms = q.split(/\s+/).filter(Boolean)
    return lines.filter((l) => {
      const desc = formatStatementLineDescription(l.description, l.merchant)
      const haystack = [
        l.posted_date,
        String(l.amount),
        desc,
        l.direction === 'outflow' ? '출금' : l.direction === 'inflow' ? '수입' : l.direction,
        matchedStatusLabel(l.matched_status),
      ]
        .join(' ')
        .toLowerCase()
      return terms.every((t) => haystack.includes(t))
    })
  }, [lines, search])

  const reconciledInView = filtered.filter((l) => isReconciledStatus(l.matched_status)).length
  const outflowTotal = filtered
    .filter((l) => l.direction === 'outflow')
    .reduce((s, l) => s + Math.abs(Number(l.amount) || 0), 0)
  const inflowTotal = filtered
    .filter((l) => l.direction === 'inflow')
    .reduce((s, l) => s + Math.abs(Number(l.amount) || 0), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 pr-12 border-b border-slate-100 shrink-0 text-left">
          <DialogTitle className="text-base sm:text-lg">
            {year}년 {month}월 · 명세 내역
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-slate-600 space-y-1">
            <span className="block truncate" title={accountLabel}>
              {accountLabel}
            </span>
            <span className="block tabular-nums">
              대조 {stats.reconciled}/{stats.uploaded}건
              {search.trim()
                ? ` · 표시 ${filtered.length}건 (대조 ${reconciledInView}건)`
                : ` · 출금 $${outflowTotal.toFixed(2)} · 수입 $${inflowTotal.toFixed(2)}`}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 py-2 border-b border-slate-100 shrink-0">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="날짜, 금액, 설명, 대조 상태 검색…"
            className="h-9"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              {search.trim() ? '검색 결과가 없습니다.' : '해당 월의 명세 줄이 없습니다.'}
            </p>
          ) : (
            <div className="overflow-x-auto border rounded-md">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-gray-600">
                    <th className="py-2 px-2 whitespace-nowrap">거래일</th>
                    <th className="py-2 px-2 whitespace-nowrap">구분</th>
                    <th className="py-2 px-2 text-right whitespace-nowrap">금액</th>
                    <th className="py-2 px-2 min-w-[140px]">설명</th>
                    <th className="py-2 px-2 whitespace-nowrap">대조</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => {
                    const desc = formatStatementLineDescription(l.description, l.merchant)
                    const isOut = l.direction === 'outflow'
                    return (
                      <tr key={l.id} className="border-b border-gray-100 align-top hover:bg-slate-50/80">
                        <td className="py-1.5 px-2 whitespace-nowrap tabular-nums">{l.posted_date}</td>
                        <td className="py-1.5 px-2 whitespace-nowrap">
                          <span className={isOut ? 'text-rose-800' : 'text-emerald-800'}>
                            {isOut ? '출금' : '수입'}
                          </span>
                        </td>
                        <td
                          className={`py-1.5 px-2 text-right tabular-nums font-medium ${
                            isOut ? 'text-rose-800' : 'text-emerald-800'
                          }`}
                        >
                          ${Math.abs(Number(l.amount) || 0).toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2 break-words max-w-[280px]" title={desc}>
                          {desc || '—'}
                        </td>
                        <td className="py-1.5 px-2 whitespace-nowrap text-[11px] sm:text-xs">
                          <span
                            className={
                              l.matched_status === 'matched'
                                ? 'text-emerald-800'
                                : l.matched_status === 'partial'
                                  ? 'text-amber-800'
                                  : 'text-slate-500'
                            }
                          >
                            {matchedStatusLabel(l.matched_status)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
