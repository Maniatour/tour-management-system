'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, FileText, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { isGuestResidentCheckFilledByCustomer } from '@/lib/residentCheckGuestMapping'

const DISMISSED_KEY = 'tms-guest-resident-check-notify-dismissed'
const POLL_MS = 30_000

type SubmissionNotifyRow = {
  id: string
  token_id: string
  residency: string
  agreed: boolean
  updated_at: string | null
  created_at: string | null
}

type GuestResidentCheckNotifyItem = {
  tokenId: string
  submissionId: string
  reservationId: string
  residency: string
  customerName: string | null
  productName: string | null
  tourDate: string | null
  channelRn: string | null
}

function readDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return new Set(Array.isArray(parsed) ? parsed.map(String) : [])
  } catch {
    return new Set()
  }
}

function writeDismissed(ids: Set<string>) {
  try {
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids].slice(-80)))
  } catch {
    /* quota */
  }
}

function formatTourDate(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}.${m[2]}.${m[3]}`
  return raw.trim()
}

function residencyLabel(value: string): string {
  if (value === 'us_resident') return '미국 거주자 (전원)'
  if (value === 'non_resident') return '비거주자 (전원)'
  if (value === 'mixed') return '혼성 (일부 비거주)'
  return value || '—'
}

function asSubmissionRow(raw: unknown): SubmissionNotifyRow | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = typeof row.id === 'string' ? row.id : ''
  if (!id) return null
  return {
    id,
    token_id: typeof row.token_id === 'string' ? row.token_id : '',
    residency: typeof row.residency === 'string' ? row.residency : '',
    agreed: row.agreed === true,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
  }
}

export default function GuestResidentCheckNotificationListener({ locale }: { locale: string }) {
  const router = useRouter()
  const { authUser, userRole } = useAuth()
  const enabled = Boolean(authUser?.email && userRole && userRole !== 'customer')
  const [queue, setQueue] = useState<GuestResidentCheckNotifyItem[]>([])
  const sinceIsoRef = useRef(new Date().toISOString())
  const dismissedRef = useRef<Set<string>>(new Set())
  const notification = queue[0] ?? null

  const enqueue = useCallback((next: GuestResidentCheckNotifyItem) => {
    if (!next.tokenId || dismissedRef.current.has(next.tokenId)) return
    setQueue((prev) => {
      if (prev.some((item) => item.tokenId === next.tokenId)) return prev
      return [...prev, next]
    })
  }, [])

  const hydrateFromSubmission = useCallback(
    async (raw: unknown) => {
      let parsed = asSubmissionRow(raw)
      if (!parsed) return
      if (!parsed.token_id || !parsed.residency || !parsed.agreed) {
        const { data: full } = await supabase
          .from('resident_check_submissions')
          .select('id, token_id, residency, agreed, updated_at, created_at')
          .eq('id', parsed.id)
          .maybeSingle()
        parsed = asSubmissionRow(full)
        if (!parsed) return
      }
      if (
        !parsed.agreed ||
        !isGuestResidentCheckFilledByCustomer({
          completedAt: null,
          submission: { residency: parsed.residency, agreed: parsed.agreed },
        })
      ) {
        return
      }

      const { data: token } = await supabase
        .from('resident_check_tokens')
        .select('id, reservation_id, completed_at')
        .eq('id', parsed.token_id)
        .maybeSingle()
      const reservationId = (token as { reservation_id?: string } | null)?.reservation_id
      if (!reservationId) return

      const { data: reservation } = await supabase
        .from('reservations')
        .select('id, tour_date, channel_rn, customer_id, product_id')
        .eq('id', reservationId)
        .maybeSingle()
      if (!reservation) return

      const customerId = (reservation as { customer_id?: string | null }).customer_id
      const productId = (reservation as { product_id?: string | null }).product_id
      const [customerRes, productRes] = await Promise.all([
        customerId
          ? supabase.from('customers').select('name').eq('id', customerId).maybeSingle()
          : Promise.resolve({ data: null }),
        productId
          ? supabase.from('products').select('name, name_ko').eq('id', productId).maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      const product = productRes.data as { name?: string | null; name_ko?: string | null } | null
      enqueue({
        tokenId: parsed.token_id,
        submissionId: parsed.id,
        reservationId,
        residency: parsed.residency,
        customerName: ((customerRes.data as { name?: string | null } | null)?.name ?? '').trim() || null,
        productName: (product?.name_ko || product?.name || '').trim() || null,
        tourDate: (reservation as { tour_date?: string | null }).tour_date ?? null,
        channelRn: (reservation as { channel_rn?: string | null }).channel_rn ?? null,
      })
    },
    [enqueue]
  )

  useEffect(() => {
    if (!enabled) return
    dismissedRef.current = readDismissed()
    sinceIsoRef.current = new Date().toISOString()

    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const pullNew = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (cancelled || !sessionData?.session) return
      const { data } = await supabase
        .from('resident_check_submissions')
        .select('id, token_id, residency, agreed, updated_at, created_at')
        .gt('updated_at', sinceIsoRef.current)
        .order('updated_at', { ascending: true })
        .limit(20)

      if (cancelled || !Array.isArray(data)) return
      for (const row of data) {
        await hydrateFromSubmission(row)
        const stamp = typeof row.updated_at === 'string' ? row.updated_at : null
        if (stamp && stamp > sinceIsoRef.current) sinceIsoRef.current = stamp
      }
    }

    const start = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (cancelled || !sessionData?.session) return

      channel = supabase
        .channel('guest-resident-check-notify')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'resident_check_submissions' },
          (change) => {
            void hydrateFromSubmission(change.new)
          }
        )
        .subscribe()

      await pullNew()
    }

    void start()
    const timer = window.setInterval(() => {
      void pullNew()
    }, POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [enabled, hydrateFromSubmission])

  const handleClose = () => {
    const current = notification
    if (current?.tokenId) {
      dismissedRef.current.add(current.tokenId)
      writeDismissed(dismissedRef.current)
    }
    setQueue((prev) => prev.slice(1))
  }

  const handleOpenReservation = () => {
    const current = notification
    handleClose()
    if (!current?.reservationId) return
    router.push(
      `/${locale}/admin/reservations/${current.reservationId}?guestResidentCheck=1`
    )
  }

  if (!enabled || !notification) return null

  const remaining = Math.max(0, queue.length - 1)

  return (
    <div className="fixed inset-0 z-[10055] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-resident-check-notify-title"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border/60 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-violet-100 bg-violet-50 p-4">
          <div className="flex min-w-0 items-start gap-2">
            <div className="rounded-xl bg-violet-600 p-2 text-white">
              <FileText size={22} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 id="guest-resident-check-notify-title" className="text-base font-semibold text-gray-900">
                게스트 거주 확인 폼 접수
              </h2>
              {remaining > 0 ? (
                <p className="mt-0.5 text-xs text-violet-700">외 {remaining}건 대기 중</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1 text-gray-500 hover:bg-white/80 hover:text-gray-800"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4 p-4">
          <p className="text-sm text-gray-600">
            고객이 게스트 거주 확인 폼을 작성했습니다. 예약에서 내용을 확인할 수 있습니다.
          </p>
          <dl className="space-y-2 text-sm text-gray-800">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">고객</dt>
              <dd className="font-medium">{notification.customerName || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">상품</dt>
              <dd>{notification.productName || '—'}</dd>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">투어일</dt>
                <dd>{formatTourDate(notification.tourDate) || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">거주 상태</dt>
                <dd>{residencyLabel(notification.residency)}</dd>
              </div>
            </div>
            {notification.channelRn ? (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">채널 RN</dt>
                <dd className="font-mono text-xs">{notification.channelRn}</dd>
              </div>
            ) : null}
          </dl>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="min-h-[44px] rounded-xl px-4 text-sm text-gray-600 hover:bg-gray-50"
            >
              나중에
            </button>
            <button
              type="button"
              onClick={handleOpenReservation}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              예약 보기
              <ExternalLink size={16} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
