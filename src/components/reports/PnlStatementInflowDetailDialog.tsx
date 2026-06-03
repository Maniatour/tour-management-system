'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { AccountingTerm } from '@/components/ui/AccountingTerm'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { PnlStatementInflowLine } from '@/lib/pnlReportDataFetch'
import { formatPnlMoney } from '@/lib/pnlPaymentRecords'

export type PnlStatementInflowDrillState =
  | { mode: 'cell'; month: string }
  | { mode: 'grand' }
  | { mode: 'excluded' }
  | { mode: 'excluded-cell'; month: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  drill: PnlStatementInflowDrillState | null
  lines: PnlStatementInflowLine[]
  formatMonthLabel: (ym: string) => string
  onChanged?: () => void | Promise<void>
}

function matchedStatusLabel(status: string | null): string {
  switch (status) {
    case 'matched':
      return '연결됨'
    case 'partial':
      return '부분 연결'
    case 'unmatched':
      return '미연결'
    default:
      return status?.trim() || '—'
  }
}

export default function PnlStatementInflowDetailDialog({
  open,
  onOpenChange,
  drill,
  lines,
  formatMonthLabel,
  onChanged,
}: Props) {
  const [localLines, setLocalLines] = useState<PnlStatementInflowLine[]>(lines)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (open) setLocalLines(lines)
  }, [open, lines])

  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  const scoped = useMemo(() => {
    if (!drill) return []
    const excludedOnly = (rows: PnlStatementInflowLine[]) => rows.filter((l) => !l.pnlIncluded)
    if (drill.mode === 'excluded') return excludedOnly(localLines)
    if (drill.mode === 'excluded-cell') {
      return excludedOnly(localLines).filter((l) => l.yearMonth === drill.month)
    }
    if (drill.mode === 'grand') return localLines
    return localLines.filter((l) => l.yearMonth === drill.month)
  }, [drill, localLines])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return scoped
    const terms = q.split(/\s+/).filter(Boolean)
    return scoped.filter((l) => {
      const haystack = [
        l.posted_date,
        String(l.amount),
        formatPnlMoney(l.amount),
        l.financial_account_name ?? '',
        l.description,
        matchedStatusLabel(l.matched_status),
      ]
        .join(' ')
        .toLowerCase()
      return terms.every((t) => haystack.includes(t))
    })
  }, [scoped, search])

  const title = useMemo(() => {
    if (!drill) return '명세 입금 상세'
    if (drill.mode === 'excluded') return '기간 전체 · PNL 제외·개인 명세 입금'
    if (drill.mode === 'excluded-cell') {
      return `${formatMonthLabel(drill.month)} · PNL 제외·개인 명세 입금`
    }
    if (drill.mode === 'grand') return '기간 전체 · 명세 입금 상세'
    return `${formatMonthLabel(drill.month)} · 명세 입금`
  }, [drill, formatMonthLabel])

  const pnlTotal = filtered.filter((l) => l.pnlIncluded).reduce((s, l) => s + l.amount, 0)
  const excludedCount = filtered.filter((l) => !l.pnlIncluded).length

  const toggleFlag = useCallback(
    async (line: PnlStatementInflowLine, field: 'exclude_from_pnl' | 'is_personal') => {
      setSavingId(line.id)
      const nextExclude = field === 'exclude_from_pnl' ? !line.exclude_from_pnl : line.exclude_from_pnl
      const nextPersonal = field === 'is_personal' ? !line.is_personal : line.is_personal
      const nextPnlIncluded = !nextExclude && !nextPersonal

      setLocalLines((prev) =>
        prev.map((row) =>
          row.id === line.id
            ? {
                ...row,
                exclude_from_pnl: nextExclude,
                is_personal: nextPersonal,
                pnlIncluded: nextPnlIncluded,
              }
            : row
        )
      )

      try {
        if (field === 'is_personal') {
          const { error } = await supabase
            .from('statement_lines')
            .update({ is_personal: nextPersonal, personal_partner: null })
            .eq('id', line.id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('statement_lines')
            .update({ exclude_from_pnl: nextExclude })
            .eq('id', line.id)
          if (error) throw error
        }
        await onChanged?.()
      } catch (e) {
        console.error(e)
        toast.error(e instanceof Error ? e.message : '저장에 실패했습니다.')
        await onChanged?.()
      } finally {
        setSavingId(null)
      }
    },
    [onChanged]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg pr-6">{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {filtered.length}건
            {excludedCount > 0 ? ` (PNL 제외·개인 ${excludedCount}건)` : ''} · 집계 합계{' '}
            {formatPnlMoney(pnlTotal)} (statement_lines · inflow · posted_date)
          </p>
          <p className="text-xs text-muted-foreground">
            <AccountingTerm termKey="PNL제외">PNL 제외</AccountingTerm>·개인(use)을 바꾸면 입금 표{' '}
            <strong>참고 › 명세 입금</strong>·순수익 <strong>참고</strong> 합계가 갱신됩니다(명세 대조 탭과 동일
            필드).
          </p>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="날짜, 금액, 금융 계정, 설명 검색…"
            className="h-9"
          />
          {search.trim() ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground underline"
            >
              지우기
            </button>
          ) : null}
        </div>
        {search.trim() ? (
          <p className="text-xs text-muted-foreground -mt-1">
            검색 결과 {filtered.length}건 (전체 {scoped.length}건)
          </p>
        ) : null}
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            {search.trim()
              ? '검색 결과가 없습니다.'
              : '해당 조건의 명세 입금 내역이 없습니다.'}
          </p>
        ) : (
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-gray-600">
                  <th className="py-2 px-2 whitespace-nowrap">거래일</th>
                  <th className="py-2 px-2">금융 계정</th>
                  <th className="py-2 px-2 min-w-[140px]">설명</th>
                  <th className="py-2 px-2 whitespace-nowrap">대조</th>
                  <th className="py-2 px-2 text-right whitespace-nowrap">금액</th>
                  <th className="py-2 px-2 whitespace-nowrap min-w-[7.5rem]">개인(use)</th>
                  <th className="py-2 px-2 whitespace-nowrap min-w-[5.5rem]">
                    <AccountingTerm termKey="PNL제외">PNL 제외</AccountingTerm>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const saving = savingId === l.id
                  return (
                    <tr
                      key={l.id}
                      className={`border-b border-gray-100 align-top ${
                        l.pnlIncluded ? 'hover:bg-slate-50/80' : 'bg-slate-100/60 text-muted-foreground'
                      }`}
                    >
                      <td className="py-1.5 px-2 whitespace-nowrap tabular-nums">{l.posted_date}</td>
                      <td className="py-1.5 px-2 max-w-[120px] truncate" title={l.financial_account_name || undefined}>
                        {l.financial_account_name || '—'}
                      </td>
                      <td className="py-1.5 px-2 break-words max-w-[240px]" title={l.description}>
                        {l.description}
                        {!l.pnlIncluded ? (
                          <span className="block text-[10px] text-amber-800/90 mt-0.5">집계 제외</span>
                        ) : null}
                      </td>
                      <td className="py-1.5 px-2 whitespace-nowrap text-[11px] sm:text-xs">
                        <span
                          className={
                            l.matched_status === 'matched'
                              ? 'text-emerald-800'
                              : l.matched_status === 'partial'
                                ? 'text-amber-800'
                                : 'text-muted-foreground'
                          }
                        >
                          {matchedStatusLabel(l.matched_status)}
                        </span>
                      </td>
                      <td
                        className={`py-1.5 px-2 text-right tabular-nums font-medium ${
                          l.pnlIncluded ? 'text-emerald-800' : ''
                        }`}
                      >
                        {formatPnlMoney(l.amount)}
                      </td>
                      <td className="py-1.5 px-2 align-middle">
                        <Label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] font-normal">
                          <Checkbox
                            checked={l.is_personal}
                            disabled={saving}
                            onCheckedChange={() => void toggleFlag(l, 'is_personal')}
                          />
                          개인
                        </Label>
                      </td>
                      <td className="py-1.5 px-2 align-middle">
                        <Label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] font-normal whitespace-nowrap">
                          <Checkbox
                            checked={l.exclude_from_pnl}
                            disabled={saving}
                            onCheckedChange={() => void toggleFlag(l, 'exclude_from_pnl')}
                          />
                          제외
                        </Label>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
