'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, ExternalLink, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { isSuperAdminActor } from '@/lib/superAdmin'

type PricingAuditNotification = {
  id: string
  reservation_id: string
  reservation_pricing_id: string | null
  request_id: string | null
  notification_type: 'modification_request' | 'audited_pricing_updated'
  actor_email: string
  actor_name: string | null
  actor_nick_name: string | null
  message: string
  created_at: string
}

export default function ReservationPricingAuditNotificationListener({ locale }: { locale: string }) {
  const router = useRouter()
  const { authUser, userPosition } = useAuth()
  const isSuper = isSuperAdminActor(authUser?.email, userPosition)
  const [notification, setNotification] = useState<PricingAuditNotification | null>(null)

  const showNotification = useCallback((next: PricingAuditNotification) => {
    setNotification(next)
  }, [])

  useEffect(() => {
    if (!isSuper || !authUser?.email) return

    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null
    const currentEmail = authUser.email.trim().toLowerCase()

    const start = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (cancelled || !sessionData?.session) return

      channel = supabase
        .channel(`reservation-pricing-audit-notify-${currentEmail}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'reservation_pricing_audit_notifications' },
          (change) => {
            const row = change.new as PricingAuditNotification & { recipient_email?: string }
            if (!row?.id || row.recipient_email?.trim().toLowerCase() !== currentEmail) return
            if (row.actor_email?.trim().toLowerCase() === currentEmail) return
            showNotification(row)
          }
        )
        .subscribe()
    }

    void start()

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [authUser?.email, isSuper, showNotification])

  const handleClose = async () => {
    const id = notification?.id
    setNotification(null)
    if (id) {
      await (supabase as any)
        .from('reservation_pricing_audit_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
    }
  }

  const handleGoToReservation = async () => {
    const reservationId = notification?.reservation_id
    await handleClose()
    if (reservationId) {
      router.push(`/${locale}/admin/reservations/${reservationId}`)
    }
  }

  if (!isSuper || !notification) return null

  const isRequest = notification.notification_type === 'modification_request'
  const actor = notification.actor_nick_name || notification.actor_name || notification.actor_email

  return (
    <div className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <div className={`rounded-lg p-2 text-white ${isRequest ? 'bg-amber-600' : 'bg-emerald-600'}`}>
              {isRequest ? <AlertTriangle size={22} aria-hidden /> : <CheckCircle2 size={22} aria-hidden />}
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {isRequest ? '가격 정보 수정 요청' : 'Audited 가격 정보 수정 알림'}
              </h2>
              <p className="mt-1 text-sm text-gray-700">
                <span className="font-medium">{actor}</span> 님
              </p>
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
          <p className="whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-800">
            {notification.message}
          </p>
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
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700"
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
