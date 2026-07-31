'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { useAuth } from '@/contexts/AuthContext'
import type { BentoCheckTourRow } from '@/lib/bentoCheckQueue'

type BentoCheckOrderModalProps = {
  row: BentoCheckTourRow
  locale: string
  onClose: () => void
  onOrdered: () => void
}

function formatShortDate(raw: string): string {
  if (!raw) return '—'
  const parts = raw.split('-')
  if (parts.length !== 3) return raw
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!month || !day) return raw
  return `${month}/${day}`
}

export function BentoCheckOrderModal({ row, locale, onClose, onOrdered }: BentoCheckOrderModalProps) {
  const isKo = locale === 'ko'
  const { user } = useAuth()
  const [note, setNote] = useState(row.order_note || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    try {
      const orderDetails = {
        bento_lines: row.bento_lines,
        reservations: row.reservations.map((r) => ({
          reservation_id: r.reservation_id,
          customer_name: r.customer_name,
          lines: r.lines,
          total_quantity: r.total_quantity,
        })),
      }

      const payload = {
        tour_id: row.id,
        tour_date: row.tour_date,
        total_quantity: row.total_bento_quantity,
        order_details: orderDetails,
        ordered_by_email: user?.email ?? null,
        note: note.trim() || null,
        ordered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      if (row.order_id) {
        const { error: updateErr } = await fromUntypedTable(supabase, 'tour_bento_orders')
          .update(payload)
          .eq('id', row.order_id)
        if (updateErr) throw updateErr
      } else {
        const { error: insertErr } = await fromUntypedTable(supabase, 'tour_bento_orders').insert(payload)
        if (insertErr) throw insertErr
      }

      onOrdered()
      onClose()
    } catch (e) {
      console.error('BentoCheckOrderModal', e)
      setError(
        e instanceof Error
          ? e.message
          : isKo
            ? '주문 저장에 실패했습니다.'
            : 'Failed to save order.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bento-order-title"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 id="bento-order-title" className="text-lg font-semibold text-foreground">
              {isKo ? '도시락 주문' : 'Place bento order'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatShortDate(row.tour_date)} · {row.product_internal_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            aria-label={isKo ? '닫기' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-xl border border-orange-200/80 bg-orange-50/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-orange-800/80">
              {isKo ? '총 수량' : 'Total quantity'}
            </p>
            <p className="mt-1 text-2xl font-semibold text-orange-900">
              {row.total_bento_quantity}
              <span className="ml-1 text-base font-medium">{isKo ? '개' : 'ea'}</span>
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-foreground">
              {isKo ? '옵션별 합계' : 'By option'}
            </h3>
            <ul className="space-y-1.5">
              {row.bento_lines.map((line) => (
                <li
                  key={line.key}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
                >
                  <span>{line.option_name}</span>
                  <span className="font-medium tabular-nums">×{line.quantity}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-foreground">
              {isKo ? '예약별 내역' : 'By reservation'}
            </h3>
            <ul className="space-y-2">
              {row.reservations.map((reservation) => (
                <li
                  key={reservation.reservation_id}
                  className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between font-medium">
                    <span>{reservation.customer_name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      ×{reservation.total_quantity}
                    </span>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {reservation.lines.map((line) => (
                      <li key={`${reservation.reservation_id}-${line.key}`}>
                        {line.option_name} ×{line.quantity}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label htmlFor="bento-order-note" className="mb-1.5 block text-sm font-medium">
              {isKo ? '메모 (선택)' : 'Note (optional)'}
            </label>
            <textarea
              id="bento-order-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder={isKo ? '업체·메뉴·특이사항 등' : 'Vendor, menu, special requests…'}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
            disabled={saving}
          >
            {isKo ? '취소' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {row.order_id
              ? isKo
                ? '주문 수정'
                : 'Update order'
              : isKo
                ? '주문 완료'
                : 'Confirm order'}
          </button>
        </div>
      </div>
    </div>
  )
}
