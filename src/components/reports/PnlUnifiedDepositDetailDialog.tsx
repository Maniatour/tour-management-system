'use client'

import React, { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { PnlDepositBucketKey, PnlPaymentRecordLine } from '@/lib/pnlPaymentRecords'
import { formatPnlMoney } from '@/lib/pnlPaymentRecords'
import { usePaymentMethodOptions } from '@/hooks/usePaymentMethodOptions'

const CASH_PAYMENT_BUCKETS = new Set<PnlDepositBucketKey>(['cash_deposit', 'cash_refund'])

export type PnlDepositDrillState =
  | { mode: 'cell'; bucketKey: PnlDepositBucketKey; month: string; rowTitle?: string }
  | { mode: 'row'; bucketKey: PnlDepositBucketKey; rowTitle?: string }
  | { mode: 'col'; month: string }
  | { mode: 'grand' }
  | { mode: 'net' }
  | { mode: 'cash_net'; scope: 'cell'; month: string; rowTitle?: string }
  | { mode: 'cash_net'; scope: 'grand'; rowTitle?: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  drill: PnlDepositDrillState | null
  lines: PnlPaymentRecordLine[]
  formatMonthLabel: (ym: string) => string
}

function isoToYmd(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function PnlUnifiedDepositDetailDialog({
  open,
  onOpenChange,
  drill,
  lines,
  formatMonthLabel,
}: Props) {
  const { paymentMethodMap } = usePaymentMethodOptions()

  const filtered = useMemo(() => {
    if (!drill) return []
    if (drill.mode === 'grand') return lines
    if (drill.mode === 'net') return lines.filter((l) => !CASH_PAYMENT_BUCKETS.has(l.bucketKey))
    if (drill.mode === 'cash_net') {
      const cashLines = lines.filter((l) => CASH_PAYMENT_BUCKETS.has(l.bucketKey))
      if (drill.scope === 'grand') return cashLines
      return cashLines.filter((l) => l.yearMonth === drill.month)
    }
    if (drill.mode === 'col') return lines.filter((l) => l.yearMonth === drill.month)
    if (drill.mode === 'row') return lines.filter((l) => l.bucketKey === drill.bucketKey)
    return lines.filter((l) => l.bucketKey === drill.bucketKey && l.yearMonth === drill.month)
  }, [drill, lines])

  const title = useMemo(() => {
    if (!drill) return '입금 상세'
    if (drill.mode === 'grand') return '기간 전체 · 입금·환불 상세'
    if (drill.mode === 'net') return '순합계 상세 (상태별 · 현금 행 제외)'
    if (drill.mode === 'cash_net') {
      if (drill.scope === 'grand') return drill.rowTitle ?? '기간 전체 · 현금 입금·환불'
      return `${drill.rowTitle ?? '현금 입금·환불'} · ${formatMonthLabel(drill.month)}`
    }
    if (drill.mode === 'col') return `${formatMonthLabel(drill.month)} · 전체`
    if (drill.mode === 'row') return drill.rowTitle ?? '행 상세'
    return `${drill.rowTitle ?? ''} · ${formatMonthLabel(drill.month)}`
  }, [drill, formatMonthLabel])

  const total = filtered.reduce((s, l) => s + l.signedAmount, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg pr-6">{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {filtered.length}건 · 합계 {formatPnlMoney(total)} (payment_records · submit_on 기준)
          </p>
        </DialogHeader>
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">해당 조건의 입금 내역이 없습니다.</p>
        ) : (
          <DepositDetailTable filtered={filtered} paymentMethodMap={paymentMethodMap} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function DepositDetailTable({
  filtered,
  paymentMethodMap,
}: {
  filtered: PnlPaymentRecordLine[]
  paymentMethodMap: Record<string, string>
}) {
  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="w-full text-xs sm:text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-left text-gray-600">
            <th className="py-2 px-2">제출일</th>
            <th className="py-2 px-2">예약</th>
            <th className="py-2 px-2">상태</th>
            <th className="py-2 px-2">결제수단</th>
            <th className="py-2 px-2 text-right">금액</th>
            <th className="py-2 px-2">메모</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((l) => {
            const pmLabel =
              (l.payment_method && paymentMethodMap[l.payment_method]) || l.payment_method || '—'
            const amtClass =
              l.signedAmount < 0 ? 'text-red-700' : l.signedAmount > 0 ? 'text-emerald-800' : 'text-gray-600'
            return (
              <tr key={`${l.id}-${l.bucketKey}`} className="border-b border-gray-100 hover:bg-slate-50/80">
                <td className="py-1.5 px-2 whitespace-nowrap tabular-nums">{isoToYmd(l.submit_on)}</td>
                <td className="py-1.5 px-2 font-mono text-[11px] max-w-[120px] truncate" title={l.reservation_id}>
                  {l.reservation_id}
                </td>
                <td className="py-1.5 px-2 max-w-[140px]">
                  <span className="line-clamp-2">{l.payment_status || '—'}</span>
                </td>
                <td className="py-1.5 px-2 max-w-[120px] truncate" title={pmLabel}>
                  {pmLabel}
                  {l.isCashPaymentMethod ? (
                    <span className="ml-1 text-[10px] text-teal-800 bg-teal-50 px-1 rounded">현금</span>
                  ) : null}
                </td>
                <td className={`py-1.5 px-2 text-right tabular-nums font-medium ${amtClass}`}>
                  {formatPnlMoney(l.signedAmount)}
                </td>
                <td className="py-1.5 px-2 text-gray-600 max-w-[200px] truncate" title={l.note || undefined}>
                  {l.note || '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

