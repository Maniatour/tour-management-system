'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, FileSignature, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { useAuth } from '@/contexts/AuthContext'
import { invalidateWaiverCardSummary } from '@/lib/waiver/cardSummaryClient'

const DISMISSED_KEY = 'tms-guest-waiver-signed-notify-dismissed'
const POLL_MS = 30_000

type WaiverAcceptanceNotifyRow = {
  id: string
  reservation_id: string
  submission_id: string | null
  participant_full_legal_name: string | null
  document_code: string
  status: string
  created_at: string | null
  signed_at: string | null
}

type GuestWaiverSignedNotifyItem = {
  key: string
  reservationId: string
  participantName: string | null
  documentCodes: string[]
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

function documentLabel(code: string, isKo: boolean): string {
  if (code === 'LAS_VEGAS_MANIA') return isKo ? '마니아 투어 면책' : 'Mania waiver'
  if (code === 'ANTELOPE_CANYON_X') return 'Antelope Canyon X'
  if (code === 'LOWER_ANTELOPE') return 'Lower Antelope Canyon'
  return code
}

function asAcceptanceRow(raw: unknown): WaiverAcceptanceNotifyRow | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = typeof row.id === 'string' ? row.id : ''
  const reservationId = typeof row.reservation_id === 'string' ? row.reservation_id : ''
  if (!id || !reservationId) return null
  return {
    id,
    reservation_id: reservationId,
    submission_id: typeof row.submission_id === 'string' ? row.submission_id : null,
    participant_full_legal_name:
      typeof row.participant_full_legal_name === 'string' ? row.participant_full_legal_name : null,
    document_code: typeof row.document_code === 'string' ? row.document_code : '',
    status: typeof row.status === 'string' ? row.status : '',
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
    signed_at: typeof row.signed_at === 'string' ? row.signed_at : null,
  }
}

export default function GuestWaiverSignedNotificationListener({ locale }: { locale: string }) {
  const router = useRouter()
  const { authUser, userRole } = useAuth()
  const enabled = Boolean(authUser?.email && userRole && userRole !== 'customer')
  const isKo = locale !== 'en'
  const [queue, setQueue] = useState<GuestWaiverSignedNotifyItem[]>([])
  const sinceIsoRef = useRef(new Date().toISOString())
  const dismissedRef = useRef<Set<string>>(new Set())
  const notification = queue[0] ?? null

  const enqueue = useCallback((next: GuestWaiverSignedNotifyItem) => {
    if (!next.key || dismissedRef.current.has(next.key)) return
    setQueue((prev) => {
      const existing = prev.find((item) => item.key === next.key)
      if (existing) {
        const codes = [...new Set([...existing.documentCodes, ...next.documentCodes])]
        if (codes.length === existing.documentCodes.length) return prev
        return prev.map((item) => (item.key === next.key ? { ...item, documentCodes: codes } : item))
      }
      return [...prev, next]
    })
  }, [])

  const hydrateFromAcceptance = useCallback(
    async (raw: unknown) => {
      let parsed = asAcceptanceRow(raw)
      if (!parsed) return
      if (parsed.status && parsed.status !== 'signed') return
      if (!parsed.document_code) {
        const { data: full } = await fromUntypedTable(supabase, 'waiver_acceptances')
          .select(
            'id, reservation_id, submission_id, participant_full_legal_name, document_code, status, created_at, signed_at'
          )
          .eq('id', parsed.id)
          .maybeSingle()
        parsed = asAcceptanceRow(full)
        if (!parsed) return
      }
      if (parsed.status && parsed.status !== 'signed') return

      const key = parsed.submission_id || parsed.id
      if (dismissedRef.current.has(key)) return

      invalidateWaiverCardSummary(parsed.reservation_id)

      const { data: reservation } = await supabase
        .from('reservations')
        .select('id, tour_date, channel_rn, customer_id, product_id')
        .eq('id', parsed.reservation_id)
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
        key,
        reservationId: parsed.reservation_id,
        participantName: (parsed.participant_full_legal_name || '').trim() || null,
        documentCodes: parsed.document_code ? [parsed.document_code] : [],
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
      const { data } = await fromUntypedTable(supabase, 'waiver_acceptances')
        .select(
          'id, reservation_id, submission_id, participant_full_legal_name, document_code, status, created_at, signed_at'
        )
        .eq('status', 'signed')
        .gt('created_at', sinceIsoRef.current)
        .order('created_at', { ascending: true })
        .limit(20)

      if (cancelled || !Array.isArray(data)) return
      for (const row of data) {
        await hydrateFromAcceptance(row)
        const stamp = typeof row.created_at === 'string' ? row.created_at : null
        if (stamp && stamp > sinceIsoRef.current) sinceIsoRef.current = stamp
      }
    }

    const start = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (cancelled || !sessionData?.session) return

      channel = supabase
        .channel('guest-waiver-signed-notify')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'waiver_acceptances' },
          (change) => {
            void hydrateFromAcceptance(change.new)
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
  }, [enabled, hydrateFromAcceptance])

  const handleClose = () => {
    const current = notification
    if (current?.key) {
      dismissedRef.current.add(current.key)
      writeDismissed(dismissedRef.current)
    }
    setQueue((prev) => prev.slice(1))
  }

  const handleOpenReservation = () => {
    const current = notification
    handleClose()
    if (!current?.reservationId) return
    router.push(`/${locale}/admin/reservations/${current.reservationId}`)
  }

  if (!enabled || !notification) return null

  const remaining = Math.max(0, queue.length - 1)
  const docs = notification.documentCodes.map((code) => documentLabel(code, isKo)).join(', ')

  return (
    <div className="fixed inset-0 z-[10055] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-waiver-signed-notify-title"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border/60 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-emerald-100 bg-emerald-50 p-4">
          <div className="flex min-w-0 items-start gap-2">
            <div className="rounded-xl bg-emerald-600 p-2 text-white">
              <FileSignature size={22} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 id="guest-waiver-signed-notify-title" className="text-base font-semibold text-gray-900">
                {isKo ? '면책 동의서 접수' : 'Waiver signed'}
              </h2>
              {remaining > 0 ? (
                <p className="mt-0.5 text-xs text-emerald-700">
                  {isKo ? `외 ${remaining}건 대기 중` : `${remaining} more waiting`}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1 text-gray-500 hover:bg-white/80 hover:text-gray-800"
            aria-label={isKo ? '닫기' : 'Close'}
          >
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4 p-4">
          <p className="text-sm text-gray-600">
            {isKo
              ? '고객이 투어 면책 동의서에 서명했습니다. 예약 카드에서 완료 상태를 확인할 수 있습니다.'
              : 'A guest signed the required tour waiver. You can review it on the reservation card.'}
          </p>
          <dl className="space-y-2 text-sm text-gray-800">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">{isKo ? '고객' : 'Customer'}</dt>
              <dd className="font-medium">{notification.customerName || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">{isKo ? '서명자' : 'Signer'}</dt>
              <dd>{notification.participantName || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">{isKo ? '상품' : 'Tour'}</dt>
              <dd>{notification.productName || '—'}</dd>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">{isKo ? '투어일' : 'Tour date'}</dt>
                <dd>{formatTourDate(notification.tourDate) || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">{isKo ? '문서' : 'Document'}</dt>
                <dd>{docs || '—'}</dd>
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
              {isKo ? '나중에' : 'Later'}
            </button>
            <button
              type="button"
              onClick={handleOpenReservation}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {isKo ? '예약 보기' : 'View reservation'}
              <ExternalLink size={16} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
