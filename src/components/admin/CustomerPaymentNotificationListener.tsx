'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, ExternalLink, Users, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { customerPaymentNotifyKindFromMessage } from '@/lib/customerPaymentNotifyKind'

type CustomerPaymentNotification = {
  id: string
  reservation_id: string
  payment_intent_id: string
  amount: number | string
  currency: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  product_name: string | null
  tour_date: string | null
  adults: number | null
  child: number | null
  infant: number | null
  message: string
  created_at: string
  recipient_email?: string
  read_at?: string | null
}

function formatMoney(amount: number | string, currency = 'usd'): string {
  const value = typeof amount === 'number' ? amount : Number(amount)
  if (!Number.isFinite(value)) return String(amount)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase() === 'USD' ? 'USD' : currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatTourDate(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}.${m[2]}.${m[3]}`
  return raw.trim()
}

function formatGuests(n: CustomerPaymentNotification): string {
  const parts: string[] = []
  if ((n.adults || 0) > 0) parts.push(`성인 ${n.adults}`)
  if ((n.child || 0) > 0) parts.push(`아동 ${n.child}`)
  if ((n.infant || 0) > 0) parts.push(`유아 ${n.infant}`)
  return parts.join(', ') || '—'
}

export default function CustomerPaymentNotificationListener({ locale }: { locale: string }) {
  const router = useRouter()
  const { authUser, userRole } = useAuth()
  const enabled = Boolean(authUser?.email && userRole && userRole !== 'customer')
  const [queue, setQueue] = useState<CustomerPaymentNotification[]>([])
  const notification = queue[0] ?? null

  const enqueue = useCallback((next: CustomerPaymentNotification) => {
    setQueue((prev) => {
      if (prev.some((item) => item.id === next.id)) return prev
      return [...prev, next]
    })
  }, [])

  useEffect(() => {
    if (!enabled || !authUser?.email) return

    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null
    const currentEmail = authUser.email.trim().toLowerCase()

    const start = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (cancelled || !sessionData?.session) return

      const { data: unread } = await (supabase as any)
        .from('customer_payment_notifications')
        .select(
          'id, reservation_id, payment_intent_id, amount, currency, customer_name, customer_email, customer_phone, product_name, tour_date, adults, child, infant, message, created_at, recipient_email, read_at'
        )
        .is('read_at', null)
        .ilike('recipient_email', currentEmail)
        .order('created_at', { ascending: true })
        .limit(10)

      if (!cancelled && Array.isArray(unread)) {
        for (const row of unread as CustomerPaymentNotification[]) {
          if (row?.id) enqueue(row)
        }
      }

      channel = supabase
        .channel(`customer-payment-notify-${currentEmail}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'customer_payment_notifications' },
          (change) => {
            const row = change.new as CustomerPaymentNotification
            if (!row?.id || row.recipient_email?.trim().toLowerCase() !== currentEmail) return
            enqueue(row)
          }
        )
        .subscribe()
    }

    void start()

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [authUser?.email, enabled, enqueue])

  const handleClose = async () => {
    const current = notification
    setQueue((prev) => prev.slice(1))
    if (current?.id) {
      await (supabase as any)
        .from('customer_payment_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', current.id)
    }
  }

  const handleGoToReservation = async () => {
    const reservationId = notification?.reservation_id
    await handleClose()
    if (reservationId) {
      router.push(`/${locale}/admin/reservations/${reservationId}`)
    }
  }

  if (!enabled || !notification) return null

  const remaining = Math.max(0, queue.length - 1)
  const isResidentCheck = customerPaymentNotifyKindFromMessage(notification.message) === 'resident_check'
  const title = isResidentCheck ? '거주·패스 안내 결제' : '고객 결제 완료'
  const headline = isResidentCheck
    ? '고객이 거주·연간 패스 안내에서 카드 결제를 완료했습니다.'
    : '고객이 웹에서 결제를 완료했습니다.'

  return (
    <div className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-payment-notify-title"
        className="w-full max-w-md overflow-hidden rounded-xl border border-border/60 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-start gap-2">
            <div className="rounded-lg bg-emerald-600 p-2 text-white">
              <CreditCard size={22} aria-hidden />
            </div>
            <div>
              <h2 id="customer-payment-notify-title" className="text-base font-semibold text-gray-900">
                {title}
              </h2>
              <p className="mt-1 text-sm font-semibold text-emerald-800">
                {formatMoney(notification.amount, notification.currency)}
              </p>
              {remaining > 0 ? (
                <p className="mt-0.5 text-xs text-emerald-700">외 {remaining}건 대기 중</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleClose()}
            className="rounded-md p-1 text-gray-500 hover:bg-white/80 hover:text-gray-800"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <p className="rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-900">
            {headline}
          </p>
          <dl className="space-y-2 text-sm text-gray-800">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">고객</dt>
              <dd className="font-medium">{notification.customer_name || '—'}</dd>
            </div>
            {notification.customer_email ? (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">이메일</dt>
                <dd>{notification.customer_email}</dd>
              </div>
            ) : null}
            {notification.customer_phone ? (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">전화</dt>
                <dd>{notification.customer_phone}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs font-medium text-muted-foreground">상품</dt>
              <dd>{notification.product_name || '—'}</dd>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">투어일</dt>
                <dd>{formatTourDate(notification.tour_date) || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">인원</dt>
                <dd className="inline-flex items-center gap-1">
                  <Users size={14} className="text-muted-foreground" aria-hidden />
                  {formatGuests(notification)}
                </dd>
              </div>
            </div>
          </dl>

          <div className="text-xs text-gray-500">
            예약 ID: <span className="font-mono">{notification.reservation_id}</span>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => void handleClose()}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={() => void handleGoToReservation()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
            >
              예약 열기
              <ExternalLink size={16} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
