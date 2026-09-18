'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, CreditCard } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { customerPaymentNotifyKindFromMessage } from '@/lib/customerPaymentNotifyKind'
import { DIALOG_Z_INDEX } from '@/lib/dialogZIndex'

export const GUIDE_FIELD_CHARGE_PAID_EVENT = 'guide-field-charge-paid'

type FieldChargePaidRow = {
  id: string
  reservation_id: string
  amount: number | string
  currency: string
  customer_name: string | null
  product_name: string | null
  tour_date: string | null
  message: string
  created_at: string
  recipient_email?: string
  read_at?: string | null
}

type Props = {
  userEmail: string | null | undefined
  locale: string
}

function formatUsd(amount: number | string, currency = 'usd'): string {
  const value = typeof amount === 'number' ? amount : Number(amount)
  if (!Number.isFinite(value)) return String(amount)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase() === 'USD' ? 'USD' : currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatTourDate(raw: string | null | undefined, locale: string): string | null {
  if (!raw?.trim()) return null
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return raw.trim()
  const date = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`)
  if (Number.isNaN(date.getTime())) return `${m[1]}.${m[2]}.${m[3]}`
  return date.toLocaleDateString(locale.startsWith('en') ? 'en-US' : 'ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function GuideFieldChargePaidNotificationLayer({ userEmail, locale }: Props) {
  const t = useTranslations('guideTour.fieldCharge')
  const { isInitialized, isSimulating, simulatedUser } = useAuth()
  const [queue, setQueue] = useState<FieldChargePaidRow[]>([])
  const dismissedIdsRef = useRef<Set<string>>(new Set())
  const emailKey = (
    isSimulating && simulatedUser?.email ? simulatedUser.email : userEmail || ''
  ).toLowerCase()
  const current = queue[0] ?? null

  const enqueue = useCallback((next: FieldChargePaidRow) => {
    if (customerPaymentNotifyKindFromMessage(next.message) !== 'field_charge') return
    if (dismissedIdsRef.current.has(next.id)) return
    setQueue((prev) => {
      if (prev.some((item) => item.id === next.id)) return prev
      return [...prev, next]
    })
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(GUIDE_FIELD_CHARGE_PAID_EVENT, {
          detail: { reservationId: next.reservation_id },
        })
      )
    }
  }, [])

  useEffect(() => {
    if (!emailKey || !isInitialized) return

    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const loadUnread = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (cancelled || !sessionData?.session) return

      const { data: unread } = await (supabase as any)
        .from('customer_payment_notifications')
        .select(
          'id, reservation_id, amount, currency, customer_name, product_name, tour_date, message, created_at, recipient_email, read_at'
        )
        .is('read_at', null)
        .ilike('recipient_email', emailKey)
        .order('created_at', { ascending: true })
        .limit(20)

      if (cancelled || !Array.isArray(unread)) return
      for (const row of unread as FieldChargePaidRow[]) {
        if (row?.id) enqueue(row)
      }
    }

    void loadUnread()
    const interval = window.setInterval(() => void loadUnread(), 5000)

    channel = supabase
      .channel(`guide-field-charge-paid-${emailKey}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'customer_payment_notifications' },
        (change) => {
          const row = change.new as FieldChargePaidRow
          if (!row?.id || row.recipient_email?.trim().toLowerCase() !== emailKey) return
          enqueue(row)
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      window.clearInterval(interval)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [emailKey, enqueue, isInitialized])

  const handleConfirm = async () => {
    const row = current
    if (row?.id) dismissedIdsRef.current.add(row.id)
    setQueue((prev) => prev.slice(1))
    if (!row?.id) return
    await (supabase as any)
      .from('customer_payment_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', row.id)
  }

  if (!emailKey || !current) return null

  const remaining = Math.max(0, queue.length - 1)
  const tourDate = formatTourDate(current.tour_date, locale)

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/55 p-4"
      style={{ zIndex: DIALOG_Z_INDEX.nestedElevated }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="guide-field-charge-paid-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl"
      >
        <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <CheckCircle2 className="h-6 w-6" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                id="guide-field-charge-paid-title"
                className="text-lg font-semibold tracking-tight text-gray-900"
              >
                {t('paidNoticeTitle')}
              </h2>
              <p className="mt-1 text-sm leading-6 text-emerald-900">{t('paidNoticeBody')}</p>
              {remaining > 0 ? (
                <p className="mt-1 text-xs font-medium tabular-nums text-emerald-800">
                  {t('paidNoticeMore', { count: remaining })}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
            <p className="text-xs font-medium text-emerald-800">{t('paidNoticeAmount')}</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-gray-900">
              {formatUsd(current.amount, current.currency)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t('paidNoticeCustomer')}</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {current.customer_name || t('paidNoticeGuest')}
            </p>
          </div>
          {current.product_name ? (
            <p className="text-sm text-muted-foreground">{current.product_name}</p>
          ) : null}
          {tourDate ? (
            <p className="text-sm tabular-nums text-muted-foreground">
              {t('paidNoticeTourDate')}: {tourDate}
            </p>
          ) : null}
        </div>

        <div className="border-t px-5 py-4">
          <button
            type="button"
            onClick={() => void handleConfirm()}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <CreditCard className="h-4 w-4" aria-hidden />
            {t('paidNoticeConfirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
