'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Banknote, ExternalLink, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import CashLedgerReviewControls from '@/components/expenses/CashLedgerReviewControls'
import {
  CASH_WITHDRAWAL_NOTIFY_EMAIL,
  markCashWithdrawalNotificationRead,
  upsertCashLedgerReview,
  type CashLedgerReviewSource,
  type CashLedgerReviewStatus,
} from '@/lib/cashLedgerReview'

type CashWithdrawalNotification = {
  id: string
  source: CashLedgerReviewSource
  source_id: string
  recipient_email?: string
  amount: number | string
  transaction_date: string | null
  description: string | null
  category: string | null
  paid_to: string | null
  created_by: string | null
  message: string
  created_at: string
  read_at?: string | null
}

const SOURCE_LABEL: Record<CashLedgerReviewSource, string> = {
  cash_transactions: '현금 관리',
  payment_records: '예약 결제',
  company_expenses: '회사 지출',
  reservation_expenses: '예약 지출',
}

function formatMoney(amount: number | string): string {
  const value = typeof amount === 'number' ? amount : Number(amount)
  if (!Number.isFinite(value)) return String(amount)
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatWhen(raw: string | null | undefined): string {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}. ${m}. ${day}.`
}

export default function CashWithdrawalNotificationListener({ locale }: { locale: string }) {
  const router = useRouter()
  const { authUser } = useAuth()
  const email = authUser?.email?.trim().toLowerCase() ?? ''
  const enabled = email === CASH_WITHDRAWAL_NOTIFY_EMAIL
  const [queue, setQueue] = useState<CashWithdrawalNotification[]>([])
  const [saving, setSaving] = useState(false)
  const notification = queue[0] ?? null

  const enqueue = useCallback((next: CashWithdrawalNotification) => {
    setQueue((prev) => {
      if (prev.some((item) => item.id === next.id)) return prev
      return [...prev, next]
    })
  }, [])

  useEffect(() => {
    if (!enabled || !email) return

    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const start = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (cancelled || !sessionData?.session) return

      const { data: unread } = await (supabase as any)
        .from('cash_withdrawal_notifications')
        .select(
          'id, source, source_id, recipient_email, amount, transaction_date, description, category, paid_to, created_by, message, created_at, read_at'
        )
        .is('read_at', null)
        .ilike('recipient_email', email)
        .order('created_at', { ascending: true })
        .limit(20)

      if (!cancelled && Array.isArray(unread)) {
        for (const row of unread as CashWithdrawalNotification[]) {
          if (row?.id) enqueue(row)
        }
      }

      channel = supabase
        .channel(`cash-withdrawal-notify-${email}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'cash_withdrawal_notifications' },
          (change) => {
            const row = change.new as CashWithdrawalNotification
            if (!row?.id || row.recipient_email?.trim().toLowerCase() !== email) return
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
  }, [email, enabled, enqueue])

  const dismissCurrent = useCallback(async () => {
    const current = notification
    setQueue((prev) => prev.slice(1))
    if (current?.id) await markCashWithdrawalNotificationRead(current.id)
  }, [notification])

  const handleReview = async (status: CashLedgerReviewStatus) => {
    if (!notification || saving) return
    setSaving(true)
    const ok = await upsertCashLedgerReview({
      source: notification.source,
      sourceId: notification.source_id,
      status,
      reviewedBy: email,
    })
    setSaving(false)
    if (!ok) {
      toast.error('검토 상태를 저장하지 못했습니다.')
      return
    }
    toast.success(
      status === 'approved' ? '승인했습니다.' : status === 'flagged' ? '플래그 처리했습니다.' : '비승인으로 표시했습니다.'
    )
    await dismissCurrent()
  }

  const handleOpenCash = async () => {
    await dismissCurrent()
    router.push(`/${locale}/admin/expenses?tab=cash`)
  }

  if (!enabled || !notification) return null

  const remaining = Math.max(0, queue.length - 1)
  const sourceLabel = SOURCE_LABEL[notification.source] ?? notification.source

  return (
    <div className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-withdrawal-notify-title"
        className="w-full max-w-md overflow-hidden rounded-xl border border-border/60 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-rose-100 bg-rose-50 p-4">
          <div className="flex items-start gap-2">
            <div className="rounded-lg bg-rose-600 p-2 text-white">
              <Banknote size={22} aria-hidden />
            </div>
            <div>
              <h2 id="cash-withdrawal-notify-title" className="text-base font-semibold text-gray-900">
                현금 출금 추가
              </h2>
              <p className="mt-1 text-sm font-semibold text-rose-800">{formatMoney(notification.amount)}</p>
              {remaining > 0 ? (
                <p className="mt-0.5 text-xs text-rose-700">외 {remaining}건 대기 중</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void dismissCurrent()}
            className="rounded-md p-1 text-gray-500 hover:bg-white/80 hover:text-gray-800"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <p className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-800">
            {notification.message}
          </p>
          <dl className="grid grid-cols-2 gap-3 text-sm text-gray-800">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">날짜</dt>
              <dd>{formatWhen(notification.transaction_date)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">출처</dt>
              <dd>{sourceLabel}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">설명</dt>
              <dd className="break-words">{notification.description?.trim() || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">결제처</dt>
              <dd>{notification.paid_to?.trim() || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">카테고리</dt>
              <dd>{notification.category?.trim() || '—'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">작성자</dt>
              <dd>{notification.created_by?.trim() || '—'}</dd>
            </div>
          </dl>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">검토</p>
            <CashLedgerReviewControls
              status={null}
              disabled={saving}
              showLabel
              onChange={(next) => void handleReview(next)}
            />
          </div>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => void dismissCurrent()}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              나중에
            </button>
            <button
              type="button"
              onClick={() => void handleOpenCash()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-700"
            >
              현금 관리 열기
              <ExternalLink size={16} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
